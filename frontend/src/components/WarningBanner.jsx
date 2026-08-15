import React from 'react';
import { AlertTriangle, ShieldAlert } from 'lucide-react';

export const WarningBanner = ({ warningCount, message }) => {
  if (!warningCount || warningCount <= 0) return null;

  return (
    <div style={{
      margin: '16px 0',
      padding: '14px 20px',
      borderRadius: '14px',
      background: 'rgba(245, 158, 11, 0.12)',
      border: '1px solid rgba(245, 158, 11, 0.4)',
      display: 'flex',
      alignItems: 'center',
      gap: '14px',
      boxShadow: '0 4px 20px rgba(245, 158, 11, 0.15)'
    }}>
      <div style={{ padding: '8px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.2)', color: '#F59E0B' }}>
        <AlertTriangle size={24} />
      </div>
      <div>
        <h4 style={{ margin: 0, color: '#F59E0B', fontSize: '0.95rem', fontWeight: 700 }}>
          ⚠️ AI Moderation Warning (Violation {warningCount}/2)
        </h4>
        <p style={{ margin: '2px 0 0 0', color: '#FDE68A', fontSize: '0.85rem', lineHeight: 1.4 }}>
          {message || 'Please stay focused on the discussion topic and maintain professional language.'}
        </p>
      </div>
    </div>
  );
};
