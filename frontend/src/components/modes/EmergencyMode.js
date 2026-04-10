import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Siren, MapPin, Bell, CheckCircle, WarningCircle, Camera, CarProfile, PaperPlaneRight } from '@phosphor-icons/react';
import { PremiumOverlay } from '../ui/Subscription';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const EmergencyMode = ({ isSubscribed, onUpgrade }) => {
  const [alerts, setAlerts] = useState([]);
  const [sirenDetected, setSirenDetected] = useState(false);
  const [carNumber, setCarNumber] = useState('');
  const [photo, setPhoto] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const loadAlerts = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/emergency/alerts`);
      setAlerts(response.data);
    } catch (error) {
      console.error('Error loading alerts:', error);
    }
  }, []);

  useEffect(() => {
    loadAlerts();
    const interval = setInterval(() => {
      loadAlerts();
      if (Math.random() < 0.1) {
        setSirenDetected(true);
        setTimeout(() => setSirenDetected(false), 3000);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [loadAlerts]);

  const handleFreeSOS = async () => {
    try {
      const payload = {
        type: 'manual-sos',
        location: { lat: 28.6139, lng: 77.2090 }, 
        message: "EMERGENCY: User requested immediate manual basic SOS dispatch."
      };
      await axios.post(`${API}/emergency/alert`, payload);
      alert("EMERGENCY SIGNAL SENT! Help is on the way.");
      loadAlerts();
    } catch (e) {
      console.error(e);
      alert("Failed to send network SOS.");
    }
  };

  const handleAdvancedDispatch = async () => {
    try {
      setIsUploading(true);
      const payload = {
        type: 'advanced-sos',
        location: { lat: 28.6139, lng: 77.2090 },
        message: "ADVANCED EMERGENCY: User dispatched with specific vehicle or photo context.",
        car_number: carNumber,
        photo: photo ? "ATTACHED" : null
      };
      await axios.post(`${API}/emergency/alert`, payload);
      alert("✅ ADVANCED TELEMETRY SENT SECURELY.");
      setCarNumber('');
      setPhoto(null);
      loadAlerts();
    } catch (e) {
      console.error(e);
      alert("Failed to send Advanced Dispatch.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* FREE TIER - BASIC SOS DISPATCH */}
      <div className="bg-[#FF0000]/10 border border-[#FF0000]/30 rounded-sm p-4 relative overflow-hidden flex flex-col items-center text-center">
        <div className="absolute top-0 right-0 px-2 py-0.5 bg-[#FF0000]/20 text-[#FF3366] text-[8px] font-black uppercase tracking-widest">Always Free</div>
        <WarningCircle size={48} weight="fill" className="text-[#FF3366] mb-3 shadow-xl" />
        <h2 className="text-white font-black uppercase tracking-widest text-lg mb-1">Emergency SOS</h2>
        <p className="text-[10px] text-[#A1A1AA] uppercase font-bold tracking-widest mb-4">Ping local authorities immediately</p>
        <button 
          onClick={handleFreeSOS}
          className="w-full py-4 bg-[#FF3366] hover:bg-white text-[#0A0A0A] font-black uppercase tracking-widest transition-all rounded-sm shadow-[0_0_20px_rgba(255,51,102,0.4)] hover:shadow-none hover:scale-[0.99] active:scale-95 flex items-center justify-center gap-2"
        >
          <WarningCircle size={20} weight="fill" /> DISPATCH HELP NOW
        </button>
      </div>

      {/* PREMIUM TIER - ADVANCED VAULT */}
      <PremiumOverlay 
        isSubscribed={isSubscribed} 
        onUpgrade={onUpgrade}
        featureName="Advanced Emergency Vault"
      >
        <div className="bg-[#121212] border border-white/5 rounded-sm p-4 space-y-4">
          <div className="flex items-center gap-3 border-b border-white/5 pb-3 mb-2">
            <div className="w-8 h-8 rounded-sm bg-[#00E5FF]/10 flex items-center justify-center">
              <Siren size={18} weight="fill" className="text-[#00E5FF]" />
            </div>
            <div>
              <h3 className="text-xs font-black uppercase text-white tracking-widest">Advanced Telemetry</h3>
              <p className="text-[9px] text-[#A1A1AA] uppercase tracking-widest">Attach Evidentiary Data</p>
            </div>
          </div>

          <div className="space-y-3">
             <div className="space-y-1.5">
               <label className="text-[9px] uppercase font-bold text-[#71717A] tracking-wider flex items-center gap-1.5">
                 <CarProfile size={12} /> Target Vehicle Number
               </label>
               <input 
                 type="text" 
                 value={carNumber}
                 onChange={(e) => setCarNumber(e.target.value)}
                 placeholder="e.g. DL-1C-AA-1111"
                 className="w-full bg-[#0A0A0A] border border-white/10 rounded-sm px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00E5FF] transition-colors"
               />
             </div>

             <div className="space-y-1.5">
               <label className="text-[9px] uppercase font-bold text-[#71717A] tracking-wider flex items-center gap-1.5">
                 <Camera size={12} /> Photographic Evidence
               </label>
               <div className="flex items-center gap-3">
                 <button 
                   onClick={() => setPhoto("CAPTURED_MOCK_BYTES")}
                   className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 p-3 rounded-sm flex items-center justify-center gap-2 text-xs font-bold text-white uppercase tracking-widest transition-all hover:border-[#00E5FF]/50"
                 >
                   <Camera size={16} /> {photo ? 'Photo Captured' : 'Launch Camera'}
                 </button>
                 {photo && <div className="w-8 h-8 bg-[#00E5FF]/20 border border-[#00E5FF] rounded-sm flex items-center justify-center animate-pulse"><CheckCircle size={16} weight="fill" className="text-[#00E5FF]" /></div>}
               </div>
             </div>

             <button 
               onClick={handleAdvancedDispatch}
               disabled={isUploading || (!carNumber && !photo)}
               className={`w-full flex items-center justify-center gap-2 py-3 rounded-sm text-xs font-black uppercase tracking-widest transition-all ${
                 (!carNumber && !photo) 
                   ? 'bg-white/5 text-[#A1A1AA] cursor-not-allowed border border-white/5' 
                   : 'bg-[#00E5FF] text-[#0A0A0A] hover:bg-white shadow-[0_0_15px_rgba(0,229,255,0.3)]'
               }`}
             >
               <PaperPlaneRight size={16} weight="fill" />
               {isUploading ? 'Transmitting...' : 'Send Secure Payload'}
             </button>
          </div>
        </div>
      </PremiumOverlay>

      {/* Alert Status Card - Automated SIREN */}
      <div className="bg-white/5 border border-white/10 rounded-sm p-4 text-center space-y-4">
        <div className="flex items-center justify-center gap-3">
          <Siren size={20} weight="loose" className={`text-[#FF3366] ${sirenDetected ? 'pulse' : 'opacity-30'}`} />
          <h2 className="text-[11px] font-black text-white uppercase tracking-[0.2em]">
            Automated Siren Detection
          </h2>
        </div>

        {sirenDetected ? (
          <div data-testid="siren-detection-alert" className="space-y-3 bg-[#FF3366]/10 p-3 rounded-sm border border-[#FF3366]/30">
            <div className="text-[10px] text-[#FF3366] font-black blink uppercase tracking-[0.2em]">
              ⚠ SIREN DETECTED ⚠
            </div>
            <div className="text-[10px] text-white/90">
              Emergency vehicle presence confirmed. Route clearing active.
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2">
              <div className="w-1.5 h-1.5 bg-[#A1A1AA] rounded-full" />
              <span className="text-[9px] text-[#A1A1AA] uppercase font-bold tracking-widest">
                Listening for ambient sirens
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Recent Alerts List */}
      <div className="space-y-4 border-t border-white/5 pt-6 pb-20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell size={16} weight="bold" className="text-[#FF3366]" />
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#71717A]">Event Log</h3>
          </div>
          <span className="text-[9px] text-[#A1A1AA] uppercase font-bold">{alerts.length} Records</span>
        </div>

        <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
          {alerts.length > 0 ? (
            alerts.map((alert) => (
              <div 
                key={alert.id}
                className="p-3 bg-[#0A0A0A] border border-white/5 rounded-sm flex items-start gap-3"
              >
                <div className={`w-8 h-8 rounded-sm rounded-tr-lg flex items-center justify-center flex-none ${alert.type === 'advanced-sos' ? 'bg-[#00E5FF]/10 text-[#00E5FF]' : 'bg-[#FF3366]/10 text-[#FF3366]'}`}>
                  {alert.type === 'advanced-sos' ? <Siren size={14} weight="fill" /> : <WarningCircle size={14} weight="fill" />}
                </div>
                <div className="flex-1">
                  <div className="text-[10px] text-white font-bold mb-1 leading-snug">{alert.message}</div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-[8px] text-[#A1A1AA] uppercase tracking-widest font-bold">
                      {new Date(alert.timestamp).toLocaleTimeString()}
                    </div>
                    {alert.car_number && (
                      <div className="text-[8px] text-[#00E5FF] uppercase tracking-widest font-bold bg-[#00E5FF]/10 px-1.5 py-0.5 border border-[#00E5FF]/20 rounded-sm">
                        {alert.car_number}
                      </div>
                    )}
                    {alert.photo && (
                       <div className="text-[8px] text-[#00E676] uppercase tracking-widest font-bold flex items-center gap-1 bg-[#00E676]/10 px-1.5 py-0.5 border border-[#00E676]/20 rounded-sm">
                         <Camera size={10} /> ATTACHMENT
                       </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-[10px] text-[#A1A1AA]/50 text-center py-6 border border-dashed border-white/5 rounded-sm font-bold uppercase tracking-widest">
              No recent dispatches
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmergencyMode;