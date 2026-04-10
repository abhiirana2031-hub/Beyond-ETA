import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { Eye, Warning, Coffee, ChartLine, Camera, CameraSlash } from '@phosphor-icons/react';
// Removing face-api as we are moving to backend-based OpenCV/MediaPipe

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';
const API = `${BACKEND_URL}/api`;

// Simple Progress Bar Component
const ProgressBar = ({ value = 0, className = '' }) => (
  <div className={`w-full h-2 bg-black/20 rounded-full overflow-hidden ${className}`}>
    <div 
      className="h-full bg-[#FF6D00] transition-all"
      style={{ width: `${Math.min(value, 100)}%` }}
    />
  </div>
);

const DrowsinessMode = () => {
  const [drowsinessStatus, setDrowsinessStatus] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [realTimeData, setRealTimeData] = useState({
    alertness: 85,
    eyeClosure: 0.15,
    yawnCount: 0,
    lowAlertnessDuration: 0  // Track low alertness (<60%) duration
  });
  
  // NEW: State for auto-SOS
  const [autoSOSTriggered, setAutoSOSTriggered] = useState(false);
  const [sosAlertActive, setSosAlertActive] = useState(false);
  const [isSirenPlaying, setIsSirenPlaying] = useState(false);
  
  const videoRef = useRef();
  const canvasRef = useRef();
  const captureCanvasRef = useRef(null); // Hidden canvas for capturing frames
  const wsRef = useRef(null); // WebSocket reference
  
  const lowAlertnessStartTimeRef = useRef(null);
  const audioContextRef = useRef(null);
  const sirenOscillatorsRef = useRef([]);

  // Initialize capture canvas
  useEffect(() => {
    captureCanvasRef.current = document.createElement('canvas');
  }, []);

  // WebSocket Connection Logic - Direct Connection
  useEffect(() => {
    const backendHost = BACKEND_URL.replace('http://', '').replace('https://', '');
    const wsUrl = `ws://${backendHost}/api/ws/drowsiness`;
    
    let socket = null;
    let reconnectCount = 0;
    const maxReconnectAttempts = 5;
    
    const connectWS = () => {
      try {
        console.log(`🔌 Connecting to ${wsUrl}...`);
        socket = new WebSocket(wsUrl);
        
        socket.onopen = () => {
          console.log('✅ Direct WebSocket Connected');
          setWsConnected(true);
          setModelsLoaded(true);
          reconnectCount = 0;
        };
        
        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            handleDetectionResult(data);
          } catch (e) {
            console.error('Error parsing message:', e);
          }
        };
        
        socket.onclose = () => {
          setWsConnected(false);
          console.log(`⚠️ WebSocket closed. Reconnect attempts: ${reconnectCount + 1}/${maxReconnectAttempts}`);
          
          if (reconnectCount < maxReconnectAttempts) {
            reconnectCount++;
            setTimeout(connectWS, 1000); // Try reconnect every 1 second
          } else {
            console.error('❌ Max reconnection attempts reached');
          }
        };
        
        socket.onerror = (error) => {
          console.error('❌ WebSocket Error:', error.message);
          setWsConnected(false);
        };
        
        wsRef.current = socket;
      } catch (err) {
        console.error('❌ WebSocket creation error:', err);
        setWsConnected(false);
      }
    };

    // Connect immediately
    connectWS();
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const loadModels = async () => {
    // No longer needed as we use backend logic
    setModelsLoaded(true);
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 640, height: 480, facingMode: 'user' } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play();
          setCameraActive(true);
        };
      }
    } catch (error) {
      console.error('Camera access denied:', error);
      alert('Camera error: Ensure you have granted permissions and no other app is using it.');
    }
  };

  const handleDetectionResult = (data) => {
    if (!data.detected) return;

    const { alertness, eye_closure, is_eyes_closed, is_yawning, landmarks } = data;
    
    // Track low alertness (< 60%) duration locally for sound alert
    let lowAlertnessDuration = 0;
    if (alertness < 60) {
      if (!lowAlertnessStartTimeRef.current) {
        lowAlertnessStartTimeRef.current = Date.now();
      }
      lowAlertnessDuration = (Date.now() - lowAlertnessStartTimeRef.current) / 1000;
    } else {
      lowAlertnessStartTimeRef.current = null;
      lowAlertnessDuration = 0;
    }

    // Trigger siren if alertness < 60% > 3 seconds
    if (lowAlertnessDuration > 3 && !autoSOSTriggered) {
      triggerDrowsinessAlert(alertness, lowAlertnessDuration);
    }

    setRealTimeData(prev => ({
      ...prev,
      alertness,
      eyeClosure: eye_closure,
      yawnCount: is_yawning ? prev.yawnCount + 1 : prev.yawnCount,
      lowAlertnessDuration: parseFloat(lowAlertnessDuration.toFixed(2))
    }));

    // Draw landmarks overlay
    if (canvasRef.current && videoRef.current && landmarks) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Draw Eye Points
      ctx.fillStyle = '#00FF00';
      const drawPoints = (points) => {
        points.forEach(p => {
          ctx.beginPath();
          ctx.arc(p[0], p[1], 1.5, 0, 2 * Math.PI);
          ctx.fill();
        });
      };
      
      if (landmarks.left_eye) drawPoints(landmarks.left_eye);
      if (landmarks.right_eye) drawPoints(landmarks.right_eye);
      
      // Draw warning box if alertness is dangerously low
      if (alertness < 60 && lowAlertnessDuration > 1) {
        ctx.strokeStyle = '#FF3366';
        ctx.lineWidth = 6;
        ctx.strokeRect(0, 0, w, h);
      }
    }
  };

  const captureFrameAndSend = useCallback(() => {
    if (!videoRef.current || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !cameraActive) {
      if (cameraActive) requestAnimationFrame(captureFrameAndSend);
      return;
    }

    const video = videoRef.current;
    const canvas = captureCanvasRef.current;
    
    if (video.videoWidth > 0 && video.videoHeight > 0) {
      canvas.width = 320; // Lower resolution for streaming
      canvas.height = 240;
      const ctx = canvas.getContext('2d');
      
      // Draw video frame
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const imageData = canvas.toDataURL('image/jpeg', 0.7);
      try {
        wsRef.current.send(imageData);
      } catch (e) {
        console.error('Error sending frame:', e);
      }
    }
    
    requestAnimationFrame(captureFrameAndSend);
  }, [cameraActive]);

  useEffect(() => {
    if (cameraActive && wsConnected) {
      captureFrameAndSend();
    }
  }, [cameraActive, wsConnected, captureFrameAndSend]);

  const EMERGENCY_PHONE = '6396941307';

  // Generate Google Maps Link
  const generateMapsLink = (lat, lng) => {
    return `https://maps.google.com/?q=${lat},${lng}`;
  };

  // Generate WhatsApp Share Link
  const generateWhatsAppLink = (phoneNumber, message, mapsLink) => {
    const fullMessage = `🚨 DROWSINESS EMERGENCY ALERT\n\n${message}\n\n📍 My Live Location:\n${mapsLink}\n\n🆘 Please check on me immediately - eyes closed while driving!`;
    const encodedMessage = encodeURIComponent(fullMessage);
    return `https://wa.me/${phoneNumber}?text=${encodedMessage}`;
  };

  // detectFace removed in favor of backend vision feed

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      setCameraActive(false);
    }
  };

  // NEW: Trigger drowsiness alert with sound and auto-SOS
  const triggerDrowsinessAlert = async (alertness, lowAlertnessDuration) => {
    setAutoSOSTriggered(true);
    setSosAlertActive(true);
    setIsSirenPlaying(true);
    
    // High-frequency vibration pattern
    if (navigator.vibrate) {
      navigator.vibrate([1000, 500, 1000, 500, 1000, 500, 1000]);
    }
    
    // Start persistent siren
    startPersistentSiren();
    
    // Auto-send SOS to backend and WhatsApp
    try {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(async (position) => {
          const { latitude, longitude } = position.coords;
          const mapsLink = generateMapsLink(latitude, longitude);
          
          const sosMessageForBackend = `🚨 DROWSINESS EMERGENCY ALERT\n\nDriver alertness fell below 60% for ${lowAlertnessDuration.toFixed(1)} seconds\nAlertness Level: ${alertness}%\nAuto-triggered emergency alert - IMMEDIATE ACTION REQUIRED`;
          
          const sosPayload = {
            type: 'drowsiness-emergency',
            location: { lat: latitude, lng: longitude },
            message: sosMessageForBackend,
            active: true
          };
          
          console.log('📍 Auto-SOS Sending:', sosPayload);
          
          // Send to backend
          await axios.post(`${API}/emergency/alert`, sosPayload, {
            timeout: 5000,
            headers: { 'Content-Type': 'application/json' }
          });
          
          // Automated Multi-Channel Alert: Background notification already processed by backend.
          console.log('✅ Auto-SOS Multi-Channel Sent Successfully (Direct)');
          
          console.log('✅ Auto-SOS Multi-Channel Sent Successfully');
        });
      }
    } catch (error) {
      console.error('❌ Error sending auto-SOS:', error);
    }
  };

  const stopEmergencyAlert = () => {
    setIsSirenPlaying(false);
    setAutoSOSTriggered(false);
    setSosAlertActive(false);
    if (navigator.vibrate) navigator.vibrate(0);
  };

  // Persistent siren oscillators (already declared above)


  const startPersistentSiren = () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      
      const audioCtx = audioContextRef.current;
      if (audioCtx.state === 'suspended') audioCtx.resume();

      // Clear any existing oscillators
      sirenOscillatorsRef.current.forEach(osc => {
        try { osc.stop(); } catch(e) {}
      });
      sirenOscillatorsRef.current = [];

      // Create a more aggressive siren (Two tones alternating)
      const playTone = (freq, startOffset) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        osc.type = 'square'; // More piercing than sine
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        
        // Alternating pitch (siren effect)
        osc.frequency.exponentialRampToValueAtTime(freq * 1.5, audioCtx.currentTime + 0.5);
        osc.frequency.exponentialRampToValueAtTime(freq, audioCtx.currentTime + 1.0);
        osc.loop = true;

        gain.gain.setValueAtTime(0, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.5, audioCtx.currentTime + 0.1);
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        osc.start();
        sirenOscillatorsRef.current.push(osc);
      };

      playTone(800, 0);
      playTone(600, 0.5);

    } catch (error) {
      console.error('Error playing siren:', error);
    }
  };

  useEffect(() => {
    if (!isSirenPlaying && sirenOscillatorsRef.current.length > 0) {
      sirenOscillatorsRef.current.forEach(osc => {
        try { osc.stop(); } catch(e) {}
      });
      sirenOscillatorsRef.current = [];
    }
  }, [isSirenPlaying]);

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const calculateEyeAspectRatio = (eye) => {
    const d = (p1, p2) => Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
    const vertical1 = d(eye[1], eye[5]);
    const vertical2 = d(eye[2], eye[4]);
    const horizontal = d(eye[0], eye[3]);
    return (vertical1 + vertical2) / (2.0 * horizontal);
  };

  const calculateMouthAspectRatio = (mouth) => {
    const d = (p1, p2) => Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
    const vertical = d(mouth[3], mouth[9]);
    const horizontal = d(mouth[0], mouth[6]);
    return vertical / horizontal;
  };

  const getAlertColor = (level) => {
    if (level >= 75) return '#00E676';
    if (level >= 60) return '#FFB020';
    return '#FF3366';
  };

  const warning = realTimeData.alertness < 60 || realTimeData.eyeClosure > 0.3;
  const recommendation = warning 
    ? "ALERT: Driver drowsiness detected. Please take a break immediately."
    : realTimeData.alertness < 75 
      ? "Alertness declining. Consider taking a break soon."
      : "Driver alert and focused. Safe to continue.";

  return (
    <div className="space-y-6">
      {/* Status Panel - Integrated into Side Panel */}
      <div className="bg-white/5 border border-white/10 rounded-sm p-6">
        <div className="flex items-center gap-3 mb-6">
          <Eye size={24} weight="bold" className="text-[#FF6D00]" />
          <h3 className="text-lg font-bold heading-font text-white uppercase tracking-tight">Status Monitor</h3>
          <div className={`w-2 h-2 rounded-full ml-auto ${cameraActive ? 'bg-[#00E676] blink' : 'bg-[#71717A]'}`} />
        </div>

        <div className="space-y-6">
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] uppercase font-bold text-[#A1A1AA] tracking-widest">Alertness Level</span>
              <span 
                className="text-2xl font-bold telemetry-font"
                style={{ color: getAlertColor(realTimeData.alertness) }}
              >
                {realTimeData.alertness}%
              </span>
            </div>
            <ProgressBar value={realTimeData.alertness} className="h-2 bg-white/5" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-black/40 border border-white/5 p-4 rounded-sm">
              <div className="text-[10px] uppercase font-bold text-[#71717A] tracking-wider mb-1">Eye Closure</div>
              <div className="text-xl font-bold text-white telemetry-font">
                {(realTimeData.eyeClosure * 100).toFixed(1)}%
              </div>
            </div>
            <div className="bg-black/40 border border-white/5 p-4 rounded-sm">
              <div className="text-[10px] uppercase font-bold text-[#71717A] tracking-wider mb-1">Yawn Count</div>
              <div className="text-xl font-bold text-white telemetry-font">
                {realTimeData.yawnCount}
              </div>
            </div>
          </div>

          {warning && (
            <div className="p-4 bg-[#FF3366]/10 border border-[#FF3366]/50 rounded-sm animate-pulse">
              <div className="flex items-center gap-2 mb-1">
                <Warning size={18} weight="fill" className="text-[#FF3366]" />
                <span className="text-xs font-black text-[#FF3366] uppercase tracking-wider">Critical Alert</span>
              </div>
              <div className="text-xs text-white leading-relaxed">{recommendation}</div>
            </div>
          )}
        </div>
      </div>

      {/* Camera Preview */}
      <div className="bg-black border border-white/10 rounded-sm p-4 relative group">
        <div className="flex items-center justify-between mb-4">
           <div className="flex items-center gap-2">
            <Camera size={20} className="text-[#FF6D00]" />
            <span className="text-xs font-bold text-white uppercase tracking-widest">AI Vision Feed</span>
            {wsConnected && <span className="text-[8px] bg-[#00E676] text-black px-2 py-1 rounded ml-2 font-bold">CONNECTED</span>}
            {!wsConnected && <span className="text-[8px] bg-[#71717A] text-white px-2 py-1 rounded ml-2">CONNECTING...</span>}
          </div>
          {!cameraActive ? (
            <button
              onClick={startCamera}
              disabled={!wsConnected}
              className="px-4 py-1.5 bg-[#FF6D00] text-white text-[10px] font-black uppercase tracking-widest rounded-sm hover:bg-white hover:text-black transition-all disabled:opacity-30"
            >
              {wsConnected ? 'Initialize Camera' : 'Connecting...'}
            </button>
          ) : (
            <button
              onClick={stopCamera}
              className="px-4 py-1.5 bg-white/10 text-white text-[10px] font-black uppercase tracking-widest rounded-sm hover:bg-[#FF3366] transition-all"
            >
              Deactivate
            </button>
          )}
        </div>

        <div className="relative aspect-video bg-[#0D0D0D] rounded-sm overflow-hidden border border-white/5">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            style={{ transform: 'scaleX(-1)' }}
            playsInline
            muted
          />
          <canvas
            ref={canvasRef}
            className="absolute top-0 left-0 w-full h-full pointer-events-none"
            style={{ transform: 'scaleX(-1)' }}
          />
          {!cameraActive && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0D0D0D]">
              <CameraSlash size={40} className="text-white/10 mb-2" />
              <div className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">Sensor Offline</div>
            </div>
          )}
          {cameraActive && !wsConnected && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <div className="text-white text-xs font-bold animate-pulse">🔗 Connecting to AI Backend...</div>
            </div>
          )}
        </div>
      </div>

      {/* AUTO-SOS ALERT PANEL */}
      {sosAlertActive && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50">
          <div className="bg-gradient-to-br from-[#FF3366] to-[#FF1744] border-2 border-[#FF3366] rounded-lg p-8 max-w-md w-[90%] shadow-2xl animate-pulse">
            <div className="flex items-center justify-center mb-6">
              <div className="relative">
                <div className="absolute inset-0 bg-[#FF3366]/20 blur-lg rounded-full"></div>
                <Warning size={48} weight="fill" className="text-white relative z-10" />
              </div>
            </div>
            
            <h2 className="text-2xl font-black text-white text-center mb-4 uppercase tracking-wider">
              🚨 EMERGENCY ALERT
            </h2>
            
            <div className="bg-white/10 rounded-lg p-4 mb-6 border border-white/20">
              <p className="text-white text-center font-bold mb-2 uppercase tracking-widest">Drowsiness Signal Detected</p>
              <div className="flex flex-col items-center gap-1">
                <p className="text-white/90 text-[10px]">LOW ALERTNESS (<60%): <span className="text-white font-bold">{realTimeData.lowAlertnessDuration?.toFixed(1)}s</span></p>
                <ProgressBar value={realTimeData.lowAlertnessDuration * 33.3} className="h-1.5 w-32 bg-white/20" />
              </div>
            </div>

            <div className="space-y-3 mb-8">
              <div className="flex items-center gap-3 text-white text-[11px] font-bold">
                <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">📍</div>
                <span>LIVE LOCATION SHARED</span>
              </div>
              <div className="flex items-center gap-3 text-white text-[11px] font-bold">
                <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">📲</div>
                <span>WHATSAPP SOS DISPATCHED</span>
              </div>
            </div>

            <button
               onClick={stopEmergencyAlert}
               className="w-full py-4 bg-white text-[#FF3366] rounded-sm font-black uppercase tracking-[0.2em] shadow-xl hover:bg-black hover:text-white transition-all active:scale-95"
            >
              I am awake
            </button>
          </div>
        </div>
      )}

      {/* Safety Tips - Scrollable Horizontal Row */}
      <div className="space-y-4">
        <h4 className="text-[10px] font-black text-[#71717A] uppercase tracking-[0.3em]">Safety Recommendations</h4>
        <div className="grid grid-cols-1 gap-3">
          <div className="p-4 bg-white/2 border border-white/5 rounded-sm hover:bg-white/5 transition-colors">
            <div className="text-xs font-bold text-white mb-1">☕ Scheduled Breaks</div>
            <p className="text-[10px] text-[#A1A1AA] leading-relaxed">System recommends a 15-minute rest every 120 minutes of travel.</p>
          </div>
          <div className="p-4 bg-white/2 border border-white/5 rounded-sm hover:bg-white/5 transition-colors">
            <div className="text-xs font-bold text-white mb-1">💧 Hydration Guard</div>
            <p className="text-[10px] text-[#A1A1AA] leading-relaxed">Maintain cognitive function with regular water intake.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DrowsinessMode;
