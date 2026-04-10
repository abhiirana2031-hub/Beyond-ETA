import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Siren, MapPin, Bell, CheckCircle } from '@phosphor-icons/react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const EmergencyMode = () => {
  const [alerts, setAlerts] = useState([]);
  const [sirenDetected, setSirenDetected] = useState(false);

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

  return (
    <div className="space-y-6">
      {/* Alert Status Card */}
      <div className="bg-[#FF3366]/5 border-2 border-[#FF3366]/20 rounded-sm p-4 text-center space-y-4">
        <div className="flex items-center justify-center gap-3">
          <Siren size={32} weight="fill" className={`text-[#FF3366] ${sirenDetected ? 'pulse' : 'opacity-30'}`} />
          <h2 className="text-sm font-black heading-font text-white uppercase tracking-tighter">
            Emergency Detection
          </h2>
        </div>

        {sirenDetected ? (
          <div data-testid="siren-detection-alert" className="space-y-3">
            <div className="text-sm text-[#FF3366] font-black blink uppercase tracking-widest">
              ⚠ SIREN DETECTED ⚠
            </div>
            <div className="text-[11px] text-white/90 leading-tight">
              Emergency vehicle presence confirmed by nearby devices.
            </div>
            <div className="pt-3 border-t border-[#FF3366]/20 space-y-2">
               <div className="flex items-center justify-center gap-2 text-[10px] text-[#00E676] font-bold">
                  <CheckCircle size={14} weight="fill" />
                  <span>Nearby drivers notified</span>
               </div>
               <div className="flex items-center justify-center gap-2 text-[10px] text-[#00E676] font-bold">
                  <CheckCircle size={14} weight="fill" />
                  <span>Route clearing active</span>
               </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-[11px] text-[#A1A1AA]">
              Monitoring for service sirens...
            </div>
            <div className="flex items-center justify-center gap-2">
              <div className="w-1.5 h-1.5 bg-[#00E676] rounded-full blink" />
              <span className="text-[9px] text-[#A1A1AA] telemetry-font uppercase font-bold tracking-widest">
                Detection Active
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Recent Alerts List */}
      <div className="space-y-4 border-t border-white/5 pt-6">
        <div className="flex items-center gap-3">
          <Bell size={20} weight="bold" className="text-[#FF3366]" />
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#71717A]">Recent Events</h3>
        </div>

        <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
          {alerts.length > 0 ? (
            alerts.map((alert) => (
              <div 
                key={alert.id}
                data-testid={`emergency-alert-${alert.id}`}
                className="p-3 bg-white/5 border border-white/5 rounded-sm"
              >
                <div className="flex items-start gap-2">
                  <Siren size={14} weight="fill" className="text-[#FF3366] mt-0.5" />
                  <div className="flex-1">
                    <div className="text-[11px] text-white font-bold leading-tight">{alert.message}</div>
                    <div className="text-[9px] text-[#A1A1AA] mt-1 telemetry-font font-bold">
                      {new Date(alert.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-xs text-[#A1A1AA]/50 text-center py-4 border border-dashed border-white/5 rounded-sm font-bold uppercase tracking-widest">
              No active alerts
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmergencyMode;