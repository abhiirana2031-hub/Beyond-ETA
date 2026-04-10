import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import axios from 'axios';
import { Heartbeat, TrendUp, Car, Warning, Pulse } from '@phosphor-icons/react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, CartesianGrid, Tooltip, Legend } from 'recharts';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

const PotholeMode = ({ routes, selectedRoute, setSelectedRoute }) => {
  const [sensorData, setSensorData] = useState(null);
  const [dataHistory, setDataHistory] = useState([]);
  const [potholeCount, setPotholeCount] = useState(0);
  const [useDemoMode, setUseDemoMode] = useState(true);
  const [sensorPermission, setSensorPermission] = useState('prompt'); // 'prompt', 'granted', 'denied', 'unsupported'
  const [isSecure, setIsSecure] = useState(true);
  const [vibrationIntensity, setVibrationIntensity] = useState({ x: 0, y: 0, z: 0 });
  const [allTimeMax, setAllTimeMax] = useState({ x: 0, y: 0, z: 0 });
  const demoPhaseRef = useRef(0);
  const realTimeSensorRef = useRef({ 
    accel: { x: 0, y: 0, z: 0 }, 
    gyro: { x: 0, y: 0, z: 0 } 
  });

  const generateDemoData = useCallback(() => {
    const phase = demoPhaseRef.current;
    const normalVariation = 0.5;
    const gyroVariation = 0.1;
    
    let x, y, z;
    let gx, gy, gz;
    
    // Demo pattern: normal driving with pothole strike
    if (phase % 15 < 10) {
      // Normal road vibration
      x = 10 + Math.sin(phase * 0.3) * normalVariation;
      y = 9.8 + Math.cos(phase * 0.25) * normalVariation;
      z = 11 + Math.sin(phase * 0.35) * normalVariation;
      
      // Normal gyro stability
      gx = Math.sin(phase * 0.2) * gyroVariation;
      gy = Math.cos(phase * 0.15) * gyroVariation;
      gz = Math.sin(phase * 0.1) * (gyroVariation / 2);
    } else if (phase % 15 < 12) {
      // Pothole impact - sudden vertical and rotational spike
      z = 14 + Math.sin(phase * 0.8) * 3;
      y = 12 + Math.cos(phase * 0.7) * 2;
      x = 11 + Math.sin(phase * 0.9) * 2;
      
      // Sudden rotation (Angular Velocity spike)
      gx = (Math.random() - 0.5) * 5.0; // Pitch
      gy = (Math.random() - 0.5) * 4.0; // Roll
      gz = (Math.random() - 0.5) * 2.0; // Yaw
    } else {
      // Recovery
      x = 10.2 + Math.sin(phase * 0.2) * normalVariation;
      y = 9.9 + Math.cos(phase * 0.2) * normalVariation;
      z = 11.2 + Math.sin(phase * 0.25) * normalVariation;
      
      gx = Math.sin(phase * 0.1) * gyroVariation;
      gy = Math.cos(phase * 0.1) * gyroVariation;
      gz = 0.05;
    }
    
    demoPhaseRef.current = (phase + 1) % 60;
    return { 
      x: x + (Math.random() - 0.5) * 0.2, 
      y: y + (Math.random() - 0.5) * 0.2, 
      z: z + (Math.random() - 0.5) * 0.2,
      gx, gy, gz
    };
  }, []);

  // REAL-TIME SENSOR LOGIC
  const handleDeviceMotion = useCallback((event) => {
    if (!event.accelerationIncludingGravity || !event.rotationRate) return;
    
    const { x, y, z } = event.accelerationIncludingGravity;
    const { alpha, beta, gamma } = event.rotationRate;
    
    realTimeSensorRef.current = {
      accel: { 
        x: x || 0, 
        y: y || 0, 
        z: z || 0 
      },
      gyro: { 
        x: beta || 0,  // Pitch
        y: gamma || 0, // Roll
        z: alpha || 0  // Yaw
      }
    };
  }, []);

  const requestSensorPermission = async () => {
    if (!window.isSecureContext) {
      setIsSecure(false);
      return;
    }

    if (typeof DeviceMotionEvent === 'undefined') {
      setSensorPermission('unsupported');
      return;
    }

    try {
      // iOS 13+ requires explicit permission
      if (typeof DeviceMotionEvent.requestPermission === 'function') {
        const result = await DeviceMotionEvent.requestPermission();
        setSensorPermission(result);
        if (result === 'granted') {
          window.addEventListener('devicemotion', handleDeviceMotion);
        }
      } else {
        // Android / Other browsers: assume granted if the event exists
        window.addEventListener('devicemotion', handleDeviceMotion);
        setSensorPermission('granted');
      }
    } catch (error) {
      console.error('Error requesting sensor permissions:', error);
      setSensorPermission('denied');
    }
  };

  useEffect(() => {
    // Check security context on mount
    if (!window.isSecureContext) {
      setIsSecure(false);
    }

    if (!useDemoMode && sensorPermission === 'granted') {
      window.addEventListener('devicemotion', handleDeviceMotion);
    }
    return () => window.removeEventListener('devicemotion', handleDeviceMotion);
  }, [useDemoMode, sensorPermission, handleDeviceMotion]);

  const fetchSensorData = useCallback(async () => {
    try {
      if (useDemoMode) {
        // Demo mode with synthetic data
        const demoData = generateDemoData();
        const accel = {
          x: demoData.x,
          y: demoData.y,
          z: demoData.z
        };
        
        const magnitude = Math.sqrt(demoData.x ** 2 + demoData.y ** 2 + demoData.z ** 2);
        const isPothole = magnitude > 18 || (demoPhaseRef.current % 15 >= 10 && demoPhaseRef.current % 15 < 12);
        
        setSensorData({
          accelerometer: accel,
          gyroscope: { x: demoData.gx, y: demoData.gy, z: demoData.gz },
          pothole_detected: isPothole,
          severity: isPothole ? (magnitude > 20 ? 'CRITICAL' : 'HIGH') : 'LOW'
        });
        
        if (isPothole) {
          setPotholeCount(prev => prev + 1);
        }
        
        setVibrationIntensity(accel);
        setAllTimeMax(prev => ({
          x: Math.max(prev.x, accel.x),
          y: Math.max(prev.y, accel.y),
          z: Math.max(prev.z, accel.z)
        }));
        
        setDataHistory(prev => {
          const newHistory = [...prev, {
            time: `${(prev.length).toString().padStart(2, '0')}s`,
            x: accel.x,
            y: accel.y,
            z: accel.z,
            magnitude: magnitude
          }].slice(-25);
          return newHistory;
        });
      } else if (sensorPermission === 'granted') {
        // PHYSICAL DEVICE SENSORS
        const { accel, gyro } = realTimeSensorRef.current;
        
        const magnitude = Math.sqrt(accel.x ** 2 + accel.y ** 2 + accel.z ** 2);
        const isPothole = magnitude > 18; // Similar threshold for real data
        
        setSensorData({
          accelerometer: accel,
          gyroscope: gyro,
          pothole_detected: isPothole,
          severity: isPothole ? (magnitude > 22 ? 'CRITICAL' : 'HIGH') : 'LOW'
        });
        
        if (isPothole) {
          setPotholeCount(prev => prev + 1);
        }
        
        setVibrationIntensity(accel);
        setAllTimeMax(prev => ({
          x: Math.max(prev.x, accel.x),
          y: Math.max(prev.y, accel.y),
          z: Math.max(prev.z, accel.z)
        }));
        
        setDataHistory(prev => {
          const newHistory = [...prev, {
            time: new Date().toLocaleTimeString().split(' ')[0],
            x: accel.x,
            y: accel.y,
            z: accel.z,
            magnitude: magnitude
          }].slice(-25);
          return newHistory;
        });
      } else {
        // REAL BACKEND DATA (Original logic)
        const response = await axios.get(`${API}/sensor/data`);
        const data = response.data;
        setSensorData(data);
        
        if (data.pothole_detected) {
          setPotholeCount(prev => prev + 1);
        }
        
        const accel = data.accelerometer;
        setVibrationIntensity(accel);
        setAllTimeMax(prev => ({
          x: Math.max(prev.x, accel.x),
          y: Math.max(prev.y, accel.y),
          z: Math.max(prev.z, accel.z)
        }));
        
        const magnitude = Math.sqrt(accel.x ** 2 + accel.y ** 2 + accel.z ** 2);
        
        setDataHistory(prev => {
          const newHistory = [...prev, {
            time: new Date().toLocaleTimeString(),
            x: accel.x,
            y: accel.y,
            z: accel.z,
            magnitude: magnitude
          }].slice(-25);
          return newHistory;
        });
      }
    } catch (error) {
      console.error('Error fetching sensor data:', error);
      // Fallback to demo mode if real backend fails
      setUseDemoMode(true);
    }
  }, [useDemoMode, generateDemoData]);

  useEffect(() => {
    fetchSensorData();
    const interval = setInterval(fetchSensorData, 300); // Faster refresh for better visualization
    return () => clearInterval(interval);
  }, [fetchSensorData]);


  return (
    <div className="space-y-6">
      {/* DEMO MODE TOGGLE & SENSOR PERMISSION */}
      <div className="bg-white/5 border border-white/10 p-3 rounded-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Pulse size={16} className="text-[#00E5FF]" />
            <span className="text-xs font-bold text-white">Pattern Source</span>
          </div>
          <button
            onClick={() => setUseDemoMode(!useDemoMode)}
            className={`px-3 py-1 rounded-sm text-[9px] font-bold uppercase transition-all ${
              useDemoMode 
                ? 'bg-[#00E5FF] text-black' 
                : 'bg-white/10 text-[#A1A1AA] hover:bg-white/20'
            }`}
          >
            {useDemoMode ? 'Demo Mode' : 'Physical Hardware'}
          </button>
        </div>

        {!useDemoMode && (
          <div className="pt-2 border-t border-white/5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${sensorPermission === 'granted' ? 'bg-[#00E676]' : 'bg-[#FF3366]'}`} />
                <span className="text-[10px] text-[#A1A1AA] uppercase tracking-wider font-medium">
                  {sensorPermission === 'granted' ? 'Sensors Active' : 'Sensors Locked'}
                </span>
              </div>
              
              {sensorPermission !== 'granted' && sensorPermission !== 'unsupported' && isSecure && (
                <button
                  onClick={requestSensorPermission}
                  className="px-3 py-1 bg-[#FFB020] text-black text-[9px] font-black uppercase tracking-widest rounded-sm hover:bg-white scale-95 transition-all"
                >
                  Activate Sensors
                </button>
              )}
            </div>

            {!isSecure && (
              <div className="bg-[#FF3366]/10 border border-[#FF3366]/30 p-3 rounded-sm space-y-2">
                <div className="flex items-center gap-2 text-[#FF3366]">
                  <Warning size={14} weight="fill" />
                  <span className="text-[10px] font-bold uppercase tracking-tight">Insecure Connection</span>
                </div>
                <p className="text-[9px] text-[#A1A1AA] leading-relaxed">
                  Mobile browsers block sensor access on <span className="text-white font-bold">non-HTTPS</span> connections. 
                  Please use <span className="text-[#00E5FF] font-black italic">ngrok</span> to test on your phone.
                </p>
              </div>
            )}

            {sensorPermission === 'denied' && isSecure && (
              <div className="bg-[#FFB020]/10 border border-[#FFB020]/30 p-3 rounded-sm space-y-2">
                <div className="flex items-center gap-2 text-[#FFB020]">
                  <Warning size={14} weight="fill" />
                  <span className="text-[10px] font-bold uppercase tracking-tight">Permission Blocked</span>
                </div>
                <p className="text-[9px] text-[#A1A1AA] leading-relaxed">
                  You previously denied sensor access. To fix: 
                  <br />• Tap the <span className="text-white font-bold">Settings/Lock icon</span> in address bar
                  <br />• Select <span className="text-white font-bold">Site Settings</span>
                  <br />• Tap <span className="text-white font-bold">Clear & Reset</span>
                </p>
              </div>
            )}

            {sensorPermission === 'unsupported' && (
              <div className="text-center py-1">
                <span className="text-[9px] text-[#FF3366] uppercase font-bold italic tracking-widest">⚠️ No Gyroscope/Accel Hardware Found</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sensor Data Display */}
      {sensorData && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 mb-3">
            <Heartbeat size={20} weight="bold" className="text-[#FFB020]" />
            <h3 className="text-sm font-bold heading-font">Live Telemetry</h3>
            <div className={`w-1.5 h-1.5 rounded-full ml-auto ${sensorData.pothole_detected ? 'bg-[#FF3366] blink' : 'bg-[#00E676]'}`} />
          </div>

          {/* Detection Status Banner */}
          {sensorData.pothole_detected && (
            <div 
              data-testid="pothole-detected-alert"
              className="bg-[#FF3366]/20 border-l-4 border-[#FF3366] rounded-sm p-4 animate-pulse"
            >
              <div className="flex items-center gap-2 mb-1">
                <Warning size={18} weight="fill" className="text-[#FF3366]" />
                <span className="text-[#FF3366] font-black text-xs uppercase tracking-tighter">
                  ⚠ POTHOLE DETECTED - {sensorData.severity}
                </span>
              </div>
              <div className="text-[10px] text-white/70">Impact magnitude exceeds safe threshold</div>
            </div>
          )}

          {/* Vibration Status Grid */}
          <div className="grid grid-cols-3 gap-3">
            {/* Accelerometer X */}
            <div className="bg-white/5 p-4 border border-white/5 rounded-sm">
              <div className="text-[8px] text-[#A1A1AA] mb-2 uppercase font-bold tracking-wider">X-Axis</div>
              <div className="telemetry-font text-lg text-white font-bold mb-2">
                {sensorData.accelerometer.x.toFixed(1)}
              </div>
              <div className="w-full bg-black/40 rounded-full h-2 overflow-hidden">
                <div 
                  className={`h-full transition-all duration-100 ${
                    vibrationIntensity.x > 12 ? 'bg-[#FF3366]' : 'bg-[#FFB020]'
                  }`}
                  style={{ width: `${Math.min((vibrationIntensity.x / 15) * 100, 100)}%` }}
                />
              </div>
              <div className="text-[9px] text-[#A1A1AA] mt-1">Max: {allTimeMax.x.toFixed(1)}</div>
            </div>

            {/* Accelerometer Y */}
            <div className="bg-white/5 p-4 border border-white/5 rounded-sm">
              <div className="text-[8px] text-[#A1A1AA] mb-2 uppercase font-bold tracking-wider">Y-Axis</div>
              <div className="telemetry-font text-lg text-white font-bold mb-2">
                {sensorData.accelerometer.y.toFixed(1)}
              </div>
              <div className="w-full bg-black/40 rounded-full h-2 overflow-hidden">
                <div 
                  className={`h-full transition-all duration-100 ${
                    vibrationIntensity.y > 12 ? 'bg-[#FF3366]' : 'bg-[#00E5FF]'
                  }`}
                  style={{ width: `${Math.min((vibrationIntensity.y / 15) * 100, 100)}%` }}
                />
              </div>
              <div className="text-[9px] text-[#A1A1AA] mt-1">Max: {allTimeMax.y.toFixed(1)}</div>
            </div>

            {/* Accelerometer Z */}
            <div className="bg-white/5 p-4 border border-white/5 rounded-sm">
              <div className="text-[8px] text-[#A1A1AA] mb-2 uppercase font-bold tracking-wider">Z-Axis (IMPACT)</div>
              <div className={`telemetry-font text-lg font-bold mb-2 ${
                sensorData.pothole_detected ? 'text-[#FF3366]' : 'text-white'
              }`}>
                {sensorData.accelerometer.z.toFixed(1)}
              </div>
              <div className="w-full bg-black/40 rounded-full h-2 overflow-hidden">
                <div 
                  className={`h-full transition-all duration-100 ${
                    vibrationIntensity.z > 13 ? 'bg-[#FF3366]' : 'bg-[#00E676]'
                  }`}
                  style={{ width: `${Math.min((vibrationIntensity.z / 18) * 100, 100)}%` }}
                />
              </div>
              <div className="text-[9px] text-[#A1A1AA] mt-1">Max: {allTimeMax.z.toFixed(1)}</div>
            </div>
          </div>

          {/* Gyroscope Data Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white/5 p-4 border border-white/5 rounded-sm">
              <div className="text-[8px] text-[#A1A1AA] mb-2 uppercase font-bold tracking-wider">Pitch (X)</div>
              <div className="telemetry-font text-lg text-white font-bold mb-2">
                {sensorData.gyroscope.x.toFixed(2)}
              </div>
              <div className="text-[8px] text-[#71717A] uppercase tracking-tighter">rad/s</div>
            </div>
            <div className="bg-white/5 p-4 border border-white/5 rounded-sm">
              <div className="text-[8px] text-[#A1A1AA] mb-2 uppercase font-bold tracking-wider">Roll (Y)</div>
              <div className="telemetry-font text-lg text-white font-bold mb-2">
                {sensorData.gyroscope.y.toFixed(2)}
              </div>
              <div className="text-[8px] text-[#71717A] uppercase tracking-tighter">rad/s</div>
            </div>
            <div className="bg-white/5 p-4 border border-white/5 rounded-sm">
              <div className="text-[8px] text-[#A1A1AA] mb-2 uppercase font-bold tracking-wider">Yaw (Z)</div>
              <div className="telemetry-font text-lg text-white font-bold mb-2">
                {sensorData.gyroscope.z.toFixed(2)}
              </div>
              <div className="text-[8px] text-[#71717A] uppercase tracking-tighter">rad/s</div>
            </div>
          </div>

          {/* Multi-Axis Acceleration Chart */}
          <div className="bg-white/5 border border-white/5 p-4 rounded-sm">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-[9px] text-[#A1A1AA] uppercase font-bold tracking-wider">Multi-Axis Vibration Analysis</div>
                <div className="text-[10px] text-[#A1A1AA] mt-1">Real-time acceleration trends (m/s²)</div>
              </div>
              <div className="text-[9px] text-[#71717A]">Last 25 samples</div>
            </div>
            
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={dataHistory} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1A1A1A" vertical={false} />
                <XAxis 
                  dataKey="time" 
                  tick={{ fontSize: 10, fill: '#71717A' }}
                  interval={Math.floor(dataHistory.length / 5)} 
                />
                <YAxis 
                  domain={[8, 18]} 
                  tick={{ fontSize: 10, fill: '#71717A' }}
                  label={{ value: 'm/s²', angle: -90, position: 'insideLeft', style: { fill: '#71717A', fontSize: 10 } }}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: '#0D0D0D',
                    border: '1px solid #A1A1AA',
                    borderRadius: '4px'
                  }}
                  labelStyle={{ color: '#fff' }}
                  formatter={(value) => value.toFixed(2)}
                />
                <Legend 
                  wrapperStyle={{ paddingTop: '10px' }}
                  iconType="line"
                />
                <Line 
                  type="monotone" 
                  dataKey="x" 
                  stroke="#FFB020" 
                  strokeWidth={2} 
                  dot={false}
                  isAnimationActive={false}
                  name="X-Axis"
                />
                <Line 
                  type="monotone" 
                  dataKey="y" 
                  stroke="#00E5FF" 
                  strokeWidth={2} 
                  dot={false}
                  isAnimationActive={false}
                  name="Y-Axis"
                />
                <Line 
                  type="monotone" 
                  dataKey="z" 
                  stroke="#00E676" 
                  strokeWidth={2.5} 
                  dot={false}
                  isAnimationActive={false}
                  name="Z-Axis (Impact)"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white/5 p-3 border border-white/5 rounded-sm text-center">
              <div className="text-[9px] text-[#A1A1AA] uppercase font-bold mb-1">Detections</div>
              <div className="telemetry-font text-2xl text-[#FFB020] font-bold">{potholeCount}</div>
            </div>
            <div className="bg-white/5 p-3 border border-white/5 rounded-sm text-center">
              <div className="text-[9px] text-[#A1A1AA] uppercase font-bold mb-1">Current Intensity</div>
              <div className="telemetry-font text-2xl text-[#00E5FF] font-bold">
                {Math.sqrt(
                  Math.pow(vibrationIntensity.x, 2) + 
                  Math.pow(vibrationIntensity.y, 2) + 
                  Math.pow(vibrationIntensity.z, 2)
                ).toFixed(1)}
              </div>
            </div>
            <div className="bg-white/5 p-3 border border-white/5 rounded-sm text-center">
              <div className="text-[9px] text-[#A1A1AA] uppercase font-bold mb-1">Status</div>
              <div className={`telemetry-font text-sm font-bold ${
                sensorData.pothole_detected ? 'text-[#FF3366]' : 'text-[#00E676]'
              }`}>
                {sensorData.pothole_detected ? '⚠ ALERT' : '✓ NORMAL'}
              </div>
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-[#000]/40 border border-white/10 p-3 rounded-sm">
            <div className="text-[9px] text-[#A1A1AA] mb-2">💡 How it works:</div>
            <ul className="text-[9px] text-[#A1A1AA] space-y-1">
              <li>• <span className="text-white">Z-axis spikes</span> indicate road impacts (potholes, bumps)</li>
              <li>• <span className="text-white">Multi-axis vibration</span> helps distinguish pothole patterns</li>
              <li>• <span className="text-white">Intensity bars</span> show relative vibration magnitude (Red = Critical)</li>
              <li>• <span className="text-white">Demo mode</span> shows synthetic pothole impacts every ~5 seconds</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default PotholeMode;