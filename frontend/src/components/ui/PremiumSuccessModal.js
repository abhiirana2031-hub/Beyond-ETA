import React from 'react';
import { Crown, CheckCircle, Sparkle } from '@phosphor-icons/react';

const PremiumSuccessModal = ({ userName, onClose }) => {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
      <div className="bg-[#121212] border border-[#FFD700]/30 rounded-xl max-w-sm w-full p-8 text-center relative overflow-hidden shadow-[0_0_50px_rgba(255,215,0,0.15)] animate-slide-up">
        
        {/* Background glow effects */}
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-[#FFD700]/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-[#D500F9]/20 rounded-full blur-3xl"></div>

        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-white/40 hover:text-white"
        >
          ✕
        </button>

        <div className="relative mx-auto w-20 h-20 bg-gradient-to-br from-[#FFD700] to-[#F57F17] rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(255,215,0,0.4)] animate-bounce">
          <Crown size={40} weight="fill" className="text-black mt-1" />
          <Sparkle size={16} weight="fill" className="text-white absolute -top-1 -right-1 animate-pulse" />
          <Sparkle size={12} weight="fill" className="text-white absolute bottom-2 -left-2 animate-pulse" />
        </div>

        <h2 className="text-2xl font-black text-white uppercase tracking-widest mb-2 heading-font">
          Payment Successful!
        </h2>
        
        <div className="w-12 h-1 bg-[#FFD700] rounded-full mx-auto mb-4"></div>

        <p className="text-[#A1A1AA] text-sm leading-relaxed font-medium mb-6">
          Thank you, <span className="text-[#FFD700] font-bold">{userName}</span>! 
          <br /><br />
          Your account has been upgraded successfully. Experience fully unlocked access to the Premium Safety Vault and Advanced Telemetry Features!
        </p>

        <button 
          onClick={onClose}
          className="w-full bg-[#FFD700] hover:bg-[white] text-black font-black uppercase tracking-widest py-3 rounded-md transition-all shadow-lg shadow-[#FFD700]/20 active:scale-95 flex items-center justify-center gap-2"
        >
          <CheckCircle size={20} weight="fill" />
          ENTER PRO DASHBOARD
        </button>

      </div>
    </div>
  );
};

export default PremiumSuccessModal;
