import React from 'react';
import { Phone, Mic } from 'lucide-react';

/**
 * Global site footer — appears on every page.
 * Theme is handled automatically via CSS variables (--footer-bg, --text-muted, etc.)
 */
export const Footer = () => (
  <footer
    className="app-footer"
    style={{
      padding: '28px 24px 20px',
      textAlign: 'center'
    }}
  >
    <div style={{ maxWidth: '960px', margin: '0 auto' }}>

      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '10px' }}>
        <div style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', padding: '6px', borderRadius: '8px', display: 'flex', color: 'white' }}>
          <Mic size={16} />
        </div>
        <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)' }} className="text-gradient">
          SkillForge AI
        </span>
      </div>

      <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: '14px' }}>
        AI Soft Skills Training &amp; Evaluation Platform
      </p>

      {/* Divider */}
      <div style={{ width: '100%', height: '1px', background: 'var(--border-glass)', margin: '14px 0' }} />

      {/* Contact */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>
          For any queries, contact us:
        </span>
        <a
          href="tel:7981600294"
          aria-label="Call SkillForge AI support at 7981600294"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            fontSize: '0.95rem',
            fontWeight: 700,
            color: 'var(--primary)',
            textDecoration: 'none',
            padding: '4px 12px',
            borderRadius: '8px',
            border: '1px solid rgba(99,102,241,0.25)',
            background: 'rgba(99,102,241,0.08)',
            transition: 'all 0.18s ease'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(99,102,241,0.18)';
            e.currentTarget.style.borderColor = 'rgba(99,102,241,0.5)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(99,102,241,0.08)';
            e.currentTarget.style.borderColor = 'rgba(99,102,241,0.25)';
          }}
        >
          <Phone size={15} />
          📞 7981600294
        </a>
      </div>

      <p style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '14px' }}>
        © {new Date().getFullYear()} SkillForge AI · All rights reserved
      </p>
    </div>
  </footer>
);
