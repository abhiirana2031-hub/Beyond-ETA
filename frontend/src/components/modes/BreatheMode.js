import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { Wind, Atom, Heartbeat, CaretRight } from '@phosphor-icons/react';
import { RadialBarChart, RadialBar, ResponsiveContainer, PolarAngleAxis } from 'recharts';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AQI_DOMAIN = [0, 200];

const BreatheMode = ({ routes, selectedRoute, setSelectedRoute, userLocation }) => {
  const [aqiData, setAqiData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadAQIData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Verify API endpoint
      if (!API || API.includes('undefined')) {
        console.error('❌ REACT_APP_BACKEND_URL not configured. API:', API);
        setError('Backend URL not configured');
        setLoading(false);
        return;
      }
      
      const lat = userLocation?.lat || 12.9716;
      const lon = userLocation?.lng || 77.5946;
      
      console.log(`📍 Fetching AQI from: ${API}/aqi/explain`);
      console.log(`📍 Location: ${lat}, ${lon}`);
      
      const response = await axios.post(`${API}/aqi/explain`, {
        latitude: lat,
        longitude: lon
      });
      
      console.log('✅ AQI data received:', response.data);
      setAqiData(response.data);
      setError(null);
    } catch (error) {
      console.error('❌ Error loading AQI data:', error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
      setError(error.message);
      setAqiData(null);
    } finally {
      setLoading(false);
    }
  }, [userLocation]);

  useEffect(() => {
    loadAQIData();
    
    // Refresh AQI data every 5 minutes
    const interval = setInterval(loadAQIData, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [loadAQIData]);

  const getAQIColor = (aqi) => {
    if (aqi <= 50) return '#00E676';
    if (aqi <= 100) return '#FFB020';
    return '#FF3366';
  };

  const chartData = aqiData ? [{
    name: 'AQI',
    value: aqiData.aqi,
    fill: getAQIColor(aqiData.aqi)
  }] : [];

  return (
    <div className="space-y-6">
      {/* Loading State */}
      {loading && (
        <div className="bg-white/5 border border-white/5 p-4 rounded-sm text-center">
          <div className="animate-spin text-[#00E5FF] mb-2 text-xl">⟳</div>
          <div className="text-xs text-[#A1A1AA]">Fetching real-time AQI data...</div>
        </div>
      )}
      
      {/* Error State */}
      {error && !loading && (
        <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-sm text-center">
          <div className="text-xs text-red-400 mb-2">⚠️ Error loading AQI</div>
          <div className="text-[10px] text-red-300 mb-3">{error}</div>
          <button
            onClick={loadAQIData}
            className="text-[10px] px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded transition"
          >
            Retry
          </button>
        </div>
      )}
      
      {/* AQI Display */}
      {aqiData && !loading && (
        <div className="space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <Wind size={20} weight="bold" className="text-[#00E5FF]" />
            <h3 className="text-sm font-bold heading-font uppercase">🌍 Real-time Air Quality</h3>
            <div 
              className="ml-auto text-xs font-black telemetry-font px-2 py-0.5 rounded-sm cursor-pointer hover:opacity-80 transition"
              style={{ backgroundColor: `${getAQIColor(aqiData.aqi)}20`, color: getAQIColor(aqiData.aqi) }}
              onClick={loadAQIData}
              title="Click to refresh"
            >
              AQI {aqiData.aqi} ↻
            </div>
          </div>

          {/* AQI Gauge & Info */}
          <div className="flex items-center gap-6 bg-white/5 p-4 border border-white/5 rounded-sm">
            <div className="relative w-24 h-24 flex-none">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart 
                  innerRadius="80%" 
                  outerRadius="100%" 
                  data={chartData} 
                  startAngle={180} 
                  endAngle={0}
                >
                  <PolarAngleAxis type="number" domain={AQI_DOMAIN} angleAxisId={0} tick={false} />
                  <RadialBar background dataKey="value" cornerRadius={5} />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pt-4">
                <div className="text-xl font-bold telemetry-font" style={{ color: getAQIColor(aqiData.aqi) }}>
                  {aqiData.aqi}
                </div>
              </div>
            </div>
            
            <div className="flex-1">
              <div className="text-[10px] uppercase font-bold text-[#71717A] mb-1">Status</div>
              <div className="text-sm font-bold text-white uppercase tracking-tight">{aqiData.category}</div>
              <div className="text-[10px] text-[#A1A1AA] mt-1 leading-tight">{aqiData.health_impact}</div>
            </div>
          </div>

          {/* Pollutant Levels */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/5 p-3 border border-white/5 rounded-sm">
              <div className="flex justify-between text-[9px] mb-1.5 font-bold uppercase tracking-wider">
                <span className="text-[#A1A1AA]">PM2.5</span>
                <span className="text-white">{aqiData.pm25} µg/m³</span>
              </div>
              <div className="w-full h-1.5 bg-[#1A1A1A] rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[#00E5FF]" 
                  style={{ width: `${Math.min((aqiData.pm25 / 55) * 100, 100)}%` }}
                />
              </div>
            </div>

            <div className="bg-white/5 p-3 border border-white/5 rounded-sm">
              <div className="flex justify-between text-[9px] mb-1.5 font-bold uppercase tracking-wider">
                <span className="text-[#A1A1AA]">NO₂</span>
                <span className="text-white">{aqiData.no2} ppb</span>
              </div>
              <div className="w-full h-1.5 bg-[#1A1A1A] rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[#00E5FF]" 
                  style={{ width: `${Math.min((aqiData.no2 / 120) * 100, 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* AI Analysis Section */}
          <div className="bg-white/5 border border-white/5 p-4 rounded-sm relative overflow-hidden">
            <div className="flex items-center gap-2 mb-3">
              <Atom size={18} weight="bold" className="text-[#00E5FF]" />
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#00E5FF]">SafeRoute AI Analysis</h4>
            </div>
            <div className="text-[11px] text-white/90 leading-relaxed italic border-l-2 border-[#00E5FF] pl-3 py-1">
              "{aqiData.explanation}"
            </div>
          </div>
        </div>
      )}
      
      {/* Empty State - Not loading and no data */}
      {!aqiData && !loading && !error && (
        <div className="bg-white/5 border border-white/5 p-6 rounded-sm text-center">
          <Wind size={24} weight="bold" className="text-[#00E5FF] mx-auto mb-2" />
          <div className="text-xs text-[#A1A1AA] mb-3">Loading air quality data...</div>
          <button
            onClick={loadAQIData}
            className="text-[10px] px-4 py-2 bg-[#00E5FF]/20 hover:bg-[#00E5FF]/30 text-[#00E5FF] rounded transition"
          >
            Load Now
          </button>
        </div>
      )}
    </div>
  );
};

export default BreatheMode;