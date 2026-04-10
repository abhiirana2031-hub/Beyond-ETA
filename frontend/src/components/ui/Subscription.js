import React from 'react';
import { Lock, Crown, CheckCircle } from '@phosphor-icons/react';

/**
 * PremiumOverlay: Blurs content and shows a locked state CTA
 */
export const PremiumOverlay = ({ children, isSubscribed, onUpgrade, featureName }) => {
  if (isSubscribed) return children;

  return (
    <div className="relative group">
      {/* Blurred Content */}
      <div className="filter blur-md pointer-events-none select-none opacity-40 transition-all duration-700">
        {children}
      </div>

      {/* Lock UI */}
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px] rounded-sm border border-white/5 transition-all duration-300">
        <div className="bg-gradient-to-br from-[#FFD700] to-[#FFA000] p-3 rounded-full mb-4 shadow-[0_0_20px_rgba(255,215,0,0.3)] group-hover:scale-110 transition-transform">
          <Lock size={24} weight="fill" className="text-black" />
        </div>
        <h4 className="text-white font-bold text-sm mb-1 uppercase tracking-widest text-center px-4">
          {featureName || 'Premium Feature'}
        </h4>
        <p className="text-[#A1A1AA] text-[10px] mb-4 text-center px-6">
          Upgrade to Beyond-ETA Pro to unlock this high-fidelity safety module.
        </p>
        <button 
          onClick={onUpgrade}
          className="px-6 py-2 bg-white text-black text-[10px] font-black uppercase tracking-widest rounded-sm hover:bg-[#FFD700] transition-colors shadow-lg active:scale-95"
        >
          Unlock Now
        </button>
      </div>
    </div>
  );
};

/**
 * SubscriptionPlans: Modal for choosing a plan
 */
export const SubscriptionPlans = ({ isOpen, onClose, onSelectPlan, loading }) => {
  if (!isOpen) return null;

  const plans = [
    {
      id: 'monthly',
      name: 'Monthly Pro',
      price: 149,
      period: 'month',
      features: ['Real-time Fatigue Guard', 'Safest Route Navigation', 'Women\'s Safety Vault', 'Smart AQI Routes']
    },
    {
      id: 'yearly',
      name: 'Yearly Pro',
      price: 1299,
      period: 'year',
      savings: 'Save 27%',
      features: ['Everything in Monthly', 'Priority AI Analysis', 'Cloud Safety Sync', 'No Interruptions'],
      popular: true
    }
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="bg-[#0D0D0D] border border-white/10 w-full max-w-2xl rounded-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#1A1A1A] to-[#0D0D0D] p-8 border-b border-white/5 text-center relative">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-[#71717A] hover:text-white transition-colors"
          >
            <span className="text-2xl">&times;</span>
          </button>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#FFD700]/10 rounded-full mb-4">
            <Crown size={14} weight="fill" className="text-[#FFD700]" />
            <span className="text-[10px] font-black text-[#FFD700] uppercase tracking-widest">Premium Pass</span>
          </div>
          <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">Upgrade to Pro</h2>
          <p className="text-[#A1A1AA] text-xs">Unlock high-fidelity safety features and smarter routes.</p>
        </div>

        {/* Plans Grid */}
        <div className="p-8 grid md:grid-cols-2 gap-6">
          {plans.map((plan) => (
            <div 
              key={plan.id}
              className={`relative flex flex-col p-6 rounded-sm border transition-all ${
                plan.popular 
                  ? 'bg-white/5 border-[#FFD700]/30 shadow-[0_0_30px_rgba(255,215,0,0.05)]' 
                  : 'bg-white/[0.02] border-white/10'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#FFD700] text-black text-[8px] font-black uppercase px-3 py-1 rounded-full shadow-lg">
                  Best Value
                </div>
              )}
              
              <div className="mb-6">
                <h3 className="text-white font-bold text-lg mb-1">{plan.name}</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black text-white">₹{plan.price}</span>
                  <span className="text-[#71717A] text-xs uppercase">/{plan.period}</span>
                </div>
                {plan.savings && <span className="text-[#00E676] text-[10px] font-bold mt-1 inline-block">{plan.savings}</span>}
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle size={14} weight="fill" className="text-[#00E676] mt-0.5" />
                    <span className="text-[11px] text-[#D4D4D8]">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                disabled={loading}
                onClick={() => onSelectPlan(plan)}
                className={`w-full py-4 rounded-sm font-black uppercase tracking-widest text-[10px] transition-all active:scale-[0.98] ${
                  plan.popular 
                    ? 'bg-[#FFD700] text-black hover:bg-white shadow-xl shadow-[#FFD700]/10' 
                    : 'bg-white/10 text-white hover:bg-white/20'
                } disabled:opacity-50`}
              >
                {loading ? 'Processing...' : `Get ${plan.name}`}
              </button>
            </div>
          ))}
        </div>

        <div className="p-6 bg-black/40 text-center border-t border-white/5">
          <p className="text-[9px] text-[#52525B] uppercase tracking-[0.1em]">
            Secure payment via Razorpay • Cancel anytime • High-Fidelity Safety Dispatch
          </p>
        </div>
      </div>
    </div>
  );
};
