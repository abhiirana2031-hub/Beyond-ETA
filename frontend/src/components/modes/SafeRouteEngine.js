import React, { useMemo } from 'react';
import { ShieldCheck, Warning, Lightbulb, Users } from '@phosphor-icons/react';

const SafeRouteEngine = ({ routes, selectedRoute, setSelectedRoute }) => {
  // Generate safety scores for current routes
  const routeSafetyData = useMemo(() => {
    return routes.map(route => {
      // Mock safety calculation
      const lightingScore = Math.floor(Math.random() * 40) + 60; // 60-100
      const trafficScore = Math.floor(Math.random() * 30) + 70; // 70-100
      const overallScore = Math.floor((lightingScore + trafficScore) / 2);
      
      return {
        id: route.id,
        lighting: lightingScore,
        traffic: trafficScore,
        score: overallScore,
        isSafest: false
      };
    });
  }, [routes]);

  // Mark the safest one
  const safestRouteId = useMemo(() => {
    if (routeSafetyData.length === 0) return null;
    return [...routeSafetyData].sort((a, b) => b.score - a.score)[0].id;
  }, [routeSafetyData]);

  return (
    <div className="space-y-6">
      <div className="bg-white/5 border border-[#00E676]/30 p-4 rounded-sm">
        <div className="flex items-center gap-3 mb-4">
          <ShieldCheck size={24} weight="fill" className="text-[#00E676]" />
          <div>
            <h3 className="text-sm font-black uppercase text-white tracking-widest">SafeRoute Engine</h3>
            <p className="text-[10px] text-[#A1A1AA]">Proprietary AI filtering based on Street Lighting & Traffic Density</p>
          </div>
        </div>

        <div className="space-y-3">
          {routes.map((route, idx) => {
            const safety = routeSafetyData.find(s => s.id === route.id) || { score: 0, lighting: 0, traffic: 0 };
            const isSafest = route.id === safestRouteId;
            const isSelected = selectedRoute?.id === route.id;

            return (
              <div 
                key={route.id}
                onClick={() => setSelectedRoute(route)}
                className={`p-4 border rounded-sm transition-all cursor-pointer ${
                  isSelected 
                    ? 'bg-[#00E676]/10 border-[#00E676]' 
                    : 'bg-white/5 border-white/5 hover:border-white/20'
                } relative overflow-hidden`}
              >
                {isSafest && (
                  <div className="absolute top-0 right-0 bg-[#00E676] text-black text-[8px] font-black px-2 py-0.5 rounded-bl-sm uppercase tracking-tighter">
                    RECOMMENDED SAFEST
                  </div>
                )}
                
                <div className="flex justify-between items-center mb-3">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-white uppercase">Route {idx + 1}</span>
                    <span className="text-[9px] text-[#71717A] uppercase tracking-widest">{(route.distance).toFixed(1)} km • {route.duration} min</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-black telemetry-font" style={{ color: isSafest ? '#00E676' : '#FFB020' }}>
                      {safety.score}%
                    </span>
                    <div className="text-[8px] uppercase font-bold text-[#71717A]">Safety Score</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <Lightbulb size={14} className={safety.lighting > 80 ? 'text-[#00E676]' : 'text-[#FFB020]'} />
                    <div className="flex-1">
                      <div className="flex justify-between text-[8px] uppercase font-bold mb-1">
                        <span className="text-[#71717A]">Lighting</span>
                        <span className="text-white">{safety.lighting}%</span>
                      </div>
                      <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-white transition-all" style={{ width: `${safety.lighting}%` }} />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users size={14} className={safety.traffic > 80 ? 'text-[#00E676]' : 'text-[#FFB020]'} />
                    <div className="flex-1">
                      <div className="flex justify-between text-[8px] uppercase font-bold mb-1">
                        <span className="text-[#71717A]">Density</span>
                        <span className="text-white">{safety.traffic}%</span>
                      </div>
                      <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-white transition-all" style={{ width: `${safety.traffic}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="p-4 bg-[#FFB020]/10 border border-[#FFB020]/30 rounded-sm">
         <div className="flex items-center gap-2 mb-2">
           <Warning size={16} weight="fill" className="text-[#FFB020]" />
           <span className="text-[9px] font-black uppercase text-[#FFB020] tracking-widest">Risk Advisory</span>
         </div>
         <p className="text-[10px] text-white leading-relaxed">
           SafeRoute AI has identified 3 "Low Lighting" sections on Alternative Route 2. We recommend sticking to the main highway for maximum safety.
         </p>
      </div>
    </div>
  );
};

export default SafeRouteEngine;
