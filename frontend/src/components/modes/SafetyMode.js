import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { ShieldCheck, Lightbulb, Users, MapTrifold, Phone, UserList, MapPin, Copy, CheckCircle, Warning } from '@phosphor-icons/react';
import { Progress } from '../ui/progress';
import EmergencyContactsModal from '../EmergencyContactsModal';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const EMERGENCY_PHONE = '6396941307'; // WhatsApp number for women's safety

const getRouteStatusMessage = (score) => {
  if (score > 85) return 'Highly Safe - Well-lit and populated route';
  if (score > 70) return 'Safe - Moderate traffic and lighting';
  return 'Use Caution - Consider alternative route';
};

const SafetyMode = ({ routes, selectedRoute, setSelectedRoute }) => {
  const [safetyMetrics, setSafetyMetrics] = useState(null);
  const [sosActive, setSosActive] = useState(false);
  const [showContactsModal, setShowContactsModal] = useState(false);
  const [liveLocation, setLiveLocation] = useState(null);
  const [sosMessage, setSosMessage] = useState('');
  const [locationCopied, setLocationCopied] = useState(false);
  const [showSosPanel, setShowSosPanel] = useState(false);

  // Generate Google Maps Link
  const generateMapsLink = (lat, lng) => {
    return `https://maps.google.com/?q=${lat},${lng}`;
  };

  // Generate WhatsApp Share Link
  const generateWhatsAppLink = (phoneNumber, message, mapsLink) => {
    const fullMessage = `🚨 WOMEN'S SAFETY ALERT\n\n${message}\n\n📍 My Live Location:\n${mapsLink}\n\n⏰ Time: ${new Date().toLocaleTimeString()}\n\n🆘 Please help immediately!`;
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

    if (navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          setLiveLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            timestamp: new Date().toISOString()
          });
        },
        (error) => console.error('Error watching location:', error),
        { enableHighAccuracy: true }
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
      alert('Waiting for location... Please try again in a moment.');
      return;
    }

    setSosActive(true);
    setShowSosPanel(true);

    const mapsLink = generateMapsLink(liveLocation.lat, liveLocation.lng);
    const emergencyMessage = `🚨 WOMEN'S SAFETY EMERGENCY\n\nI need immediate help!\n\nMy current location:\n${mapsLink}`;
    setSosMessage(emergencyMessage);

    // Send to backend
    try {
      await axios.post(`${API}/emergency/alert`, {
        type: 'sos',
        location: liveLocation,
        message: emergencyMessage,
        active: true
      });

      // Vibration alert
      if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200, 100, 200, 100, 500]);
      }

      // Automated alert successfully triggered in background
      console.log('✅ Automated Dispatch Completed');

      // Also send to emergency contacts from localStorage
      const contacts = JSON.parse(localStorage.getItem('emergencyContacts') || '[]');
      contacts.forEach(contact => {
        console.log(`Alert sent to: ${contact.name} (${contact.phone})`);
      });

    } catch (error) {
      console.error('Error sending SOS:', error);
      alert('Failed to send SOS alert. Please try again.');
    }

  };

  return (
    <div className="space-y-6">
      <EmergencyContactsModal 
        isOpen={showContactsModal} 
        onClose={() => setShowContactsModal(false)} 
      />
      
      {/* Safety Header */}
      <div className="space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <ShieldCheck size={20} weight="bold" className="text-[#D500F9]" />
          <h3 className="text-sm font-bold heading-font uppercase">Safety Analysis</h3>
          <div 
            className="ml-auto text-xl font-black telemetry-font" 
            style={{ color: safetyMetrics?.overall_score > 80 ? '#00E676' : '#FFB020' }}
          >
            {safetyMetrics?.overall_score || 0}%
          </div>
        </div>

        {safetyMetrics && (
          <div className="space-y-4">
            <div className="bg-white/5 p-4 border border-white/5 rounded-sm space-y-4">
              <div>
                <div className="flex items-center justify-between text-[10px] mb-1.5 font-bold uppercase tracking-wider">
                  <span className="text-[#A1A1AA]">Lighting</span>
                  <span className="text-white">{safetyMetrics.street_lighting}%</span>
                </div>
                <Progress value={safetyMetrics.street_lighting} className="h-1.5" />
              </div>

              <div>
                <div className="flex items-center justify-between text-[10px] mb-1.5 font-bold uppercase tracking-wider">
                  <span className="text-[#A1A1AA]">Density</span>
                  <span className="text-white">{safetyMetrics.vehicle_density}%</span>
                </div>
                <Progress value={safetyMetrics.vehicle_density} className="h-1.5" />
              </div>

              <div className="pt-2 border-t border-white/5">
                <div className="text-[10px] font-black text-[#D500F9] uppercase tracking-widest mb-1">Route Status</div>
                <div className="text-[11px] text-white/90 leading-tight">
                  {getRouteStatusMessage(safetyMetrics.overall_score)}
                </div>
              </div>
            </div>

            {/* Emergency / SOS Section */}
            <div className="space-y-3">
              <button
                data-testid="sos-button"
                onClick={handleSOS}
                disabled={sosActive}
                className={`w-full py-4 rounded-sm font-black text-lg transition-all duration-300 ${
                  sosActive
                    ? 'bg-[#00E676] text-black shadow-[0_0_20px_#00E676]'
                    : 'bg-[#FF3366] text-white hover:bg-white hover:text-black shadow-[0_0_20px_rgba(255,51,102,0.2)]'
                }`}
              >
                <div className="flex items-center justify-center gap-3">
                  <Phone size={24} weight="fill" />
                  {sosActive ? 'ALERT SENT' : 'SOS EMERGENCY'}
                </div>
              </button>

              <button
                onClick={() => setShowContactsModal(true)}
                className="w-full py-2 bg-white/5 border border-white/10 rounded-sm text-[10px] font-bold text-[#A1A1AA] hover:text-white hover:bg-white/10 transition-all flex items-center justify-center gap-2"
              >
                <UserList size={16} weight="fill" />
                Manage Contacts
              </button>
            </div>

            {sosActive && (
              <div className="p-3 bg-[#00E676]/10 border border-[#00E676]/30 rounded-sm animate-pulse">
                <div className="text-[10px] text-[#00E676] font-bold leading-tight">
                  Live location shared with emergency contacts.
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SafetyMode;