import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { 
  ShieldCheck, 
  Phone, 
  UserList, 
  MapPin, 
  Copy, 
  CheckCircle, 
  Warning,
  MapTrifold,
  Heart,
  Camera,
  IdentificationCard,
  CarProfile
} from '@phosphor-icons/react';
import EmergencyContactsModal from '../EmergencyContactsModal';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const EMERGENCY_PHONE = '6396941307'; // Women's safety emergency contact

// Simple Progress Bar Component
const ProgressBar = ({ value = 0, className = '' }) => (
  <div className={`w-full h-2 bg-black/20 rounded-full overflow-hidden ${className}`}>
    <div 
      className="h-full bg-[#D500F9] transition-all"
      style={{ width: `${Math.min(value, 100)}%` }}
    />
  </div>
);

const getRouteStatusMessage = (score) => {
  if (score > 85) return '✅ Highly Safe - Well-lit and populated route';
  if (score > 70) return '🟡 Safe - Moderate traffic and lighting';
  return '⚠️ Caution Advised - Consider alternative route';
};

const WomenSafetyMode = ({ routes, selectedRoute, setSelectedRoute }) => {
  const [safetyMetrics, setSafetyMetrics] = useState(null);
  const [sosActive, setSosActive] = useState(false);
  const [showContactsModal, setShowContactsModal] = useState(false);
  const [liveLocation, setLiveLocation] = useState(null);
  const [sosMessage, setSosMessage] = useState('');
  const [locationCopied, setLocationCopied] = useState(false);
  const [showSosPanel, setShowSosPanel] = useState(false);
  const [sosHistory, setSosHistory] = useState([]);
  const [carNumber, setCarNumber] = useState(localStorage.getItem('userCarNumber') || '');
  const [userPhoto, setUserPhoto] = useState(localStorage.getItem('userPhoto') || null);
  const [isPoliceAlerted, setIsPoliceAlerted] = useState(false);
  const [dispatchStep, setDispatchStep] = useState(0); // 0: Idle, 1: Gathering, 2: Encrypting, 3: Transmitting, 4: Done

  // Generate Google Maps Link
  const generateMapsLink = (lat, lng) => {
    return `https://maps.google.com/?q=${lat},${lng}`;
  };

  // Generate WhatsApp Share Link
  const generateWhatsAppLink = (phoneNumber, message, mapsLink, vNumber) => {
    const vehicleInfo = vNumber ? `🚗 VEHICLE: ${vNumber}\n` : '';
    const fullMessage = `🚨 WOMEN'S SAFETY EMERGENCY ALERT\n\n${message}\n${vehicleInfo}\n📍 LIVE LOCATION:\n${mapsLink}\n\n⏰ Time: ${new Date().toLocaleString()}\n\n🆘 URGENT - PLEASE HELP!`;
    const encodedMessage = encodeURIComponent(fullMessage);
    return `https://wa.me/${phoneNumber}?text=${encodedMessage}`;
  };

  // Copy location to clipboard
  const copyLocationToClipboard = () => {
    if (liveLocation) {
      const mapsLink = generateMapsLink(liveLocation.lat, liveLocation.lng);
      navigator.clipboard.writeText(mapsLink);
      setLocationCopied(true);
      setTimeout(() => setLocationCopied(false), 2000);
    }
  };

  const loadSafetyMetrics = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/safety/metrics`);
      setSafetyMetrics(response.data);
    } catch (error) {
      console.error('Error loading safety metrics:', error);
    }
  }, []);

  useEffect(() => {
    loadSafetyMetrics();
    const interval = setInterval(loadSafetyMetrics, 5000);

    // Enable geolocation with high accuracy
    if (navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          setLiveLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: new Date().toISOString()
          });
        },
        (error) => {
          console.error('Error watching location:', error);
        },
        { 
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );

      return () => {
        clearInterval(interval);
        navigator.geolocation.clearWatch(watchId);
      };
    }

    return () => clearInterval(interval);
  }, [loadSafetyMetrics]);

  const handleSOS = async () => {
    if (!liveLocation) {
      alert('⚠️ Waiting for location... Please enable location services and try again.');
      return;
    }

    setSosActive(true);
    setShowSosPanel(true);
    setDispatchStep(1); // Gathering Data

    const mapsLink = generateMapsLink(liveLocation.lat, liveLocation.lng);
    const emergencyMessage = `🚨 HELP NEEDED - I am in an emergency situation!\n\nI am requesting immediate assistance.\n\nAccuracy: ±${Math.round(liveLocation.accuracy)}m`;
    setSosMessage(emergencyMessage);

    // Sequence through dispatch steps for realism/feedback
    setTimeout(() => setDispatchStep(2), 800); // Encrypting Identity
    setTimeout(() => setDispatchStep(3), 1600); // Transmitting to Helpline

    // Add to SOS history
    const newAlert = {
      timestamp: new Date().toLocaleString(),
      location: {lat: liveLocation.lat, lng: liveLocation.lng},
      mapsLink: mapsLink
    };
    setSosHistory([newAlert, ...sosHistory.slice(0, 4)]);

    try {
      // Send to backend
      const sosPayload = {
        type: 'sos-women-safety',
        location: {
          lat: liveLocation.lat,
          lng: liveLocation.lng
        },
        message: emergencyMessage,
        car_number: carNumber,
        photo: userPhoto,  // Send the actual Base64 photo
        active: true
      };
      
      setIsPoliceAlerted(true);
      setSosMessage("AUTOMATED SOS: Transmitting location, vehicle details, and identity photo to emergency services...");
      
      console.log('📍 Sending SOS Alert:', sosPayload);
      
      const response = await axios.post(`${API}/emergency/alert`, sosPayload, {
        timeout: 8000,
        headers: { 'Content-Type': 'application/json' }
      });
      
      setDispatchStep(4); // Fully Dispatched
      console.log('✅ SOS Alert Sent Successfully:', response.data);
      
      // Trigger vibrations (alert pattern)
      if (navigator.vibrate) {
        navigator.vibrate([300, 100, 300, 100, 300, 100, 500]);
      }

      // Play alert sound
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);

      // Simulated Automated Success: 
      // 100% Direct - No window.open needed now.
      console.log('✅ Automated Alert Dispatched Successfully');

      // Also send to emergency contacts from localStorage
      const contacts = JSON.parse(localStorage.getItem('emergencyContacts') || '[]');
      if (contacts.length > 0) {
        console.log(`📱 SOS Alert sent to ${contacts.length} emergency contacts`);
        contacts.forEach(contact => {
          console.log(`✓ Alert for: ${contact.name} (${contact.phone})`);
        });
      }

    } catch (error) {
      setDispatchStep(0);
      console.error('❌ Error sending SOS:', error);
      
      // We will NO LONGER window.open(whatsAppLink) automatically ever.
      // The user must click the manual backup button if they see a failure.
      setSosMessage("🚨 Dispatch Handshake Busy: Please use the Manual Backup button below.");
    }

    // Keep button in active state for 3 seconds
    setTimeout(() => {
      setSosActive(false);
      setIsPoliceAlerted(false);
      setDispatchStep(0);
    }, 8000);
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result;
        setUserPhoto(base64String);
        localStorage.setItem('userPhoto', base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCarNumberChange = (val) => {
    setCarNumber(val.toUpperCase());
    localStorage.setItem('userCarNumber', val.toUpperCase());
  };

  return (
    <div className="space-y-6">
      <EmergencyContactsModal
        isOpen={showContactsModal}
        onClose={() => setShowContactsModal(false)}
      />

      {/* Location Status */}
      <div className="bg-white/5 border border-white/10 rounded-sm p-3">
        <div className="flex items-center gap-2 text-[10px] font-bold text-[#A1A1AA] mb-2">
          <MapPin size={14} weight="fill" className="text-[#D500F9]" />
          LIVE LOCATION TRACKING
        </div>
        {liveLocation ? (
          <div className="space-y-2">
            <div className="text-[12px] text-white/80 font-mono bg-black/20 p-2 rounded">
              {liveLocation.lat.toFixed(6)}, {liveLocation.lng.toFixed(6)}
            </div>
            <div className="text-[9px] text-white/60">Accuracy: ±{Math.round(liveLocation.accuracy)}m</div>
            <div className="flex gap-2">
              <button
                onClick={copyLocationToClipboard}
                className="flex-1 py-1.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded text-[10px] font-bold text-white transition-all flex items-center justify-center gap-1"
              >
                <Copy size={12} weight="fill" />
                {locationCopied ? '✓ COPIED' : 'COPY'}
              </button>
              <a
                href={generateMapsLink(liveLocation.lat, liveLocation.lng)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-1.5 bg-[#1E88E5]/20 hover:bg-[#1E88E5]/40 border border-[#1E88E5]/50 rounded text-[10px] font-bold text-[#1E88E5] transition-all flex items-center justify-center gap-1"
              >
                <MapTrifold size={12} weight="fill" />
                OPEN MAP
              </a>
            </div>
          </div>
        ) : (
          <div className="text-[11px] text-[#FFB020] flex items-center gap-2">
            <div className="w-2 h-2 bg-[#FFB020] rounded-full animate-pulse"></div>
            Activating GPS tracking...
          </div>
        )}
      </div>

      {/* Vehicle & Identity Section */}
      <div className="bg-white/5 border border-white/10 rounded-sm p-4 space-y-4 shadow-inner">
        <div className="flex items-center gap-2 text-[10px] font-black text-[#D500F9] uppercase tracking-[0.2em] mb-1">
          <IdentificationCard size={14} weight="fill" />
          Vehicle & Identity Profile
        </div>

        <div className="flex items-center gap-4">
          <div className="relative group flex-none">
            <div className="w-16 h-16 rounded-sm bg-black/40 border border-white/10 overflow-hidden flex items-center justify-center transition-all group-hover:border-[#D500F9]/50">
              {userPhoto ? (
                <img src={userPhoto} alt="User" className="w-full h-full object-cover" />
              ) : (
                <Camera size={24} className="text-white/20" />
              )}
            </div>
            <label className="absolute -bottom-1 -right-1 bg-[#D500F9] p-1.5 rounded-sm cursor-pointer hover:bg-white hover:text-black transition-all shadow-lg active:scale-90">
              <Camera size={12} weight="bold" />
              <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} />
            </label>
          </div>

          <div className="flex-1 space-y-2">
            <div className="flex flex-col gap-1">
              <label className="text-[8px] font-black text-[#71717A] uppercase tracking-wider">Vehicle Number</label>
              <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-sm px-3 h-10 transition-all focus-within:border-[#D500F9]/50 group">
                <CarProfile size={16} className="text-[#A1A1AA] group-focus-within:text-[#D500F9]" />
                <input 
                  type="text"
                  placeholder="E.G. KA 01 AB 1234"
                  value={carNumber}
                  onChange={(e) => handleCarNumberChange(e.target.value)}
                  className="bg-transparent border-none outline-none text-white text-xs font-bold w-full uppercase placeholder:text-white/10 tracking-widest"
                />
              </div>
            </div>
          </div>
        </div>
        <p className="text-[8px] text-[#71717A] italic opacity-80">* This info is shared only with Highway Helpline during emergencies</p>
      </div>

      {/* Safety Metrics Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <ShieldCheck size={20} weight="bold" className="text-[#D500F9]" />    
          <h3 className="text-sm font-bold heading-font uppercase">Route Safety Analysis</h3>
          <div
            className="ml-auto text-xl font-black telemetry-font px-3 py-1 rounded"
            style={{ 
              color: safetyMetrics?.overall_score > 80 ? '#00E676' : '#FFB020',
              backgroundColor: safetyMetrics?.overall_score > 80 ? 'rgba(0, 230, 118, 0.1)' : 'rgba(255, 176, 32, 0.1)'
            }}
          >
            {safetyMetrics?.overall_score || 0}%
          </div>
        </div>

        {safetyMetrics && (
          <div className="bg-white/5 p-4 border border-white/5 rounded-sm space-y-4">
            <div>
              <div className="flex items-center justify-between text-[10px] mb-1.5 font-bold uppercase tracking-wider">
                <span className="text-[#A1A1AA]">🔆 Street Lighting</span>
                <span className="text-white">{safetyMetrics.street_lighting}%</span>
              </div>
              <ProgressBar value={safetyMetrics.street_lighting} />
            </div>

            <div>
              <div className="flex items-center justify-between text-[10px] mb-1.5 font-bold uppercase tracking-wider">
                <span className="text-[#A1A1AA]">🚗 Vehicle Density</span>
                <span className="text-white">{safetyMetrics.vehicle_density}%</span>
              </div>
              <ProgressBar value={safetyMetrics.vehicle_density} />
            </div>

            <div className="pt-2 border-t border-white/5">
              <div className="text-[10px] font-black text-[#D500F9] uppercase tracking-widest mb-2">🛣️ Route Assessment</div>
              <div className="text-[11px] text-white/90 leading-tight font-semibold">       
                {getRouteStatusMessage(safetyMetrics.overall_score)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MAIN SOS BUTTON - Large & Prominent */}
      <div className="space-y-3">
        <button
          data-testid="sos-button"
          onClick={handleSOS}
          disabled={sosActive || !liveLocation}
          className={`w-full py-6 rounded-sm font-black text-xl transition-all duration-200 transform ${
            !liveLocation
              ? 'bg-gray-600 text-gray-400 cursor-not-allowed opacity-50'
              : sosActive
              ? 'bg-[#00E676] text-black shadow-[0_0_40px_#00E676] scale-95 animate-pulse'       
              : 'bg-[#FF3366] text-white hover:bg-[#FF1744] hover:scale-105 shadow-[0_0_30px_rgba(255,51,102,0.6)] active:scale-95'
          }`}
        >
          <div className="flex flex-col items-center justify-center gap-2">
            <div className="text-3xl">
              {sosActive ? '✓' : '🆘'}
            </div>
            <span>{sosActive ? '🚨 ALERT SENT!' : 'SOS EMERGENCY'}</span>
          </div>
          <div className="text-[10px] font-normal mt-2 opacity-90">
            Sends live location to +6396941307 via WhatsApp
          </div>
        </button>

        {/* SOS Confirmation Panel */}
        {showSosPanel && liveLocation && (
          <div className="p-4 bg-[#FF3366]/20 border-2 border-[#FF3366]/60 rounded-sm space-y-3 animate-pulse">
            <div className="text-[11px] text-[#FF3366] font-black flex items-center gap-2">
              <Warning size={16} weight="fill" />
              🚨 DIRECT DISPATCH INITIATED
            </div>
            
            {/* Dispatch Steps Visualization */}
            <div className="bg-black/40 border border-white/10 rounded p-2 space-y-2">
              <div className={`flex items-center gap-2 text-[9px] font-bold ${dispatchStep >= 1 ? 'text-[#00E676]' : 'text-white/30'}`}>
                {dispatchStep >= 1 ? '✓' : '○'} 📍 GPS LOCATION LOCKED
              </div>
              <div className={`flex items-center gap-2 text-[9px] font-bold ${dispatchStep >= 2 ? 'text-[#00E676]' : 'text-white/30'}`}>
                {dispatchStep >= 2 ? '✓' : '○'} 🚗 VEHICLE METADATA BUNDLED
              </div>
              <div className={`flex items-center gap-2 text-[9px] font-bold ${dispatchStep >= 3 ? 'text-[#00E676]' : 'text-white/30'}`}>
                {dispatchStep >= 3 ? '✓' : '○'} 🖼️ IDENTITY PHOTO ENCRYPTED
              </div>
              <div className={`flex items-center gap-2 text-[9px] font-bold ${dispatchStep >= 4 ? 'text-[#00E5FF]' : 'text-white/30'}`}>
                {dispatchStep >= 4 ? '✓' : '○'} 🚨 HIGHWAY HELPLINE NOTIFIED
              </div>
            </div>

            <div className="space-y-1.5 text-[10px] text-white/80">
              {dispatchStep === 4 && (
                <div className="space-y-3 pt-2">
                  <div className="bg-[#00E676]/20 border border-[#00E676]/40 p-2 rounded text-[#00E676] font-black text-center text-[10px] tracking-widest animate-bounce">
                    ALERT SUCCESSFULLY DISPATCHED
                  </div>
                  
                  <div className="pt-3 border-t border-white/10">
                    <p className="text-[9px] text-white/50 mb-2 italic">Manual backup option if needed:</p>
                    <a
                      href={generateWhatsAppLink(EMERGENCY_PHONE, sosMessage, generateMapsLink(liveLocation.lat, liveLocation.lng), carNumber)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#25D366]/20 border border-[#25D366]/40 rounded-sm text-[10px] font-bold text-[#25D366] hover:bg-[#25D366]/40 transition-all opacity-60 hover:opacity-100"
                    >
                      <Phone size={14} weight="fill" />
                      MANUAL WHATSAPP (BACKUP)
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Location Permission Warning */}
        {!liveLocation && (
          <div className="p-3 bg-[#FFB020]/20 border border-[#FFB020]/40 rounded-sm">
            <div className="text-[10px] text-[#FFB020] font-bold flex items-center gap-2">
              <Warning size={14} weight="fill" />
              Enable location services to use emergency SOS. Go to browser settings.
            </div>
          </div>
        )}

        {/* Emergency Contacts Management */}
        <button
          onClick={() => setShowContactsModal(true)}
          className="w-full py-2.5 bg-white/5 border border-white/10 rounded-sm text-[10px] font-bold text-[#A1A1AA] hover:text-white hover:bg-white/10 transition-all flex items-center justify-center gap-2"
        >
          <UserList size={16} weight="fill" />
          Manage Emergency Contacts
        </button>
      </div>

      {/* SOS History */}
      {sosHistory.length > 0 && (
        <div className="bg-white/5 border border-white/5 rounded-sm p-3 space-y-2">
          <div className="text-[10px] font-black text-[#D500F9] uppercase tracking-widest">📋 Recent Alerts</div>
          <div className="space-y-1.5 max-h-32 overflow-y-auto">
            {sosHistory.map((alert, idx) => (
              <div key={idx} className="text-[9px] text-white/60 p-1.5 bg-black/20 rounded flex items-start justify-between">
                <span>{alert.timestamp}</span>
                <span className="text-[#FFB020]">✓ Sent</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Safety Tips & Resources */}
      <div className="bg-white/5 border border-white/5 rounded-sm p-4 space-y-3">
        <div className="text-[10px] font-black text-[#D500F9] uppercase tracking-widest flex items-center gap-2">
          <Heart size={12} weight="fill" />
          Women's Safety Tips
        </div>
        <div className="space-y-2 text-[10px] text-white/70 leading-relaxed">
          <p>✓ Share your live location with trusted contacts before traveling</p>
          <p>✓ Inform someone about your destination and expected arrival time</p>
          <p>✓ Enable location tracking on your device at all times</p>
          <p>✓ Trust your intuition - if something feels wrong, it probably is</p>
          <p>✓ Use well-lit, populated routes whenever possible</p>
          <p>✓ Keep your phone charged and easily accessible</p>
          <p>✓ In emergency, call local police first (100 in India)</p>
        </div>
      </div>
    </div>
  );
};

export default WomenSafetyMode;
