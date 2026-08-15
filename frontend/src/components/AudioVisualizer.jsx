import React from 'react';
import { Mic } from 'lucide-react';

export const AudioVisualizer = ({ isActive = true, label = 'Microphone Active' }) => {
  return (
    <div className="glass-card" style={{ padding: '12px 20px', display: 'inline-flex', alignItems: 'center', gap: '14px', border: '1px solid rgba(16, 185, 129, 0.3)', background: 'rgba(16, 185, 129, 0.06)' }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10B981' }}>
          <Mic size={20} />
        </div>
        <div className="pulse-glow" style={{ position: 'absolute', width: '44px', height: '44px', borderRadius: '50%', border: '2px solid rgba(16, 185, 129, 0.4)' }} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
          <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#10B981' }}>🎙 {label}</span>
        </div>
        <span style={{ fontSize: '0.72rem', color: '#9CA3AF' }}>Speech input live & transmitting</span>
      </div>

      {/* Dynamic Soundwave Equalizer */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', height: '24px', marginLeft: '12px' }}>
        {[0.4, 0.8, 1.2, 0.6, 0.9, 1.1, 0.5].map((delay, idx) => (
          <div
            key={idx}
            className="wave-bar"
            style={{
              animationDelay: `${delay}s`,
              height: isActive ? '20px' : '6px',
              background: idx % 2 === 0 ? '#10B981' : '#06B6D4'
            }}
          />
        ))}
      </div>
    </div>
  );
};
