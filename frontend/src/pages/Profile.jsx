import React from 'react';
import { useAuth } from '../context/AuthContext';
import { formatImprovementLabel } from '../utils/sessionScores';
import { Mail } from 'lucide-react';

export const Profile = () => {
  const { user } = useAuth();

  if (!user) return null;

  const hasSessions = (user.sessionsCompleted || 0) > 0;

  const getLevelBadgeClass = (level) => {
    switch (level?.toLowerCase()) {
      case 'excellent': return 'badge-excellent';
      case 'advanced': return 'badge-advanced';
      case 'beginner': return 'badge-beginner';
      default: return 'badge-intermediate';
    }
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '30px 20px' }}>
      
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '2.2rem', fontWeight: 800 }}>User Profile</h1>
        <p style={{ color: '#9CA3AF', fontSize: '1rem', marginTop: '6px' }}>
          Your account details, proficiency tier level, and historical activity stats.
        </p>
      </div>

      {/* Profile Card Header */}
      <div className="glass-card" style={{ padding: '36px', marginBottom: '30px', display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
        <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg, #06B6D4, #6366F1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.2rem', fontWeight: 800, boxShadow: '0 8px 30px rgba(6, 182, 212, 0.4)' }}>
          {user.name ? user.name[0].toUpperCase() : 'U'}
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0 }}>{user.name}</h2>
            <span className={`badge-level ${getLevelBadgeClass(user.level)}`} style={{ padding: '6px 14px', fontSize: '0.8rem' }}>
              ★ {user.level || 'Beginner'} Level
            </span>
          </div>
          <p style={{ color: '#9CA3AF', fontSize: '0.95rem', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Mail size={16} /> {user.email}
          </p>
        </div>
      </div>

      {/* Main Performance Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '30px' }}>
        <div className="glass-card" style={{ padding: '24px', textAlign: 'center' }}>
          <span style={{ fontSize: '0.82rem', color: '#9CA3AF', fontWeight: 600 }}>Total Sessions</span>
          <div style={{ fontSize: '2.4rem', fontWeight: 800, color: '#F3F4F6', marginTop: '8px' }}>
            {user.sessionsCompleted || 0}
          </div>
        </div>

        <div className="glass-card" style={{ padding: '24px', textAlign: 'center' }}>
          <span style={{ fontSize: '0.82rem', color: '#9CA3AF', fontWeight: 600 }}>Average Score</span>
          <div style={{ fontSize: '2.4rem', fontWeight: 800, color: hasSessions ? '#818CF8' : '#6B7280', marginTop: '8px' }}>
            {hasSessions ? (user.overallScore ?? 0) : 0}
          </div>
        </div>

        <div className="glass-card" style={{ padding: '24px', textAlign: 'center' }}>
          <span style={{ fontSize: '0.82rem', color: '#9CA3AF', fontWeight: 600 }}>Best Score</span>
          <div style={{ fontSize: '2.4rem', fontWeight: 800, color: hasSessions ? '#34D399' : '#6B7280', marginTop: '8px' }}>
            {hasSessions ? (user.overallScore ?? 0) : 0}
          </div>
        </div>

        <div className="glass-card" style={{ padding: '24px', textAlign: 'center' }}>
          <span style={{ fontSize: '0.82rem', color: '#9CA3AF', fontWeight: 600 }}>Improvement</span>
          <div style={{ fontSize: '2.4rem', fontWeight: 800, color: hasSessions ? '#06B6D4' : '#6B7280', marginTop: '8px' }}>
            {formatImprovementLabel(user.improvementPercentage)}
          </div>
        </div>
      </div>

      {/* Proficiency Level Classification Standard */}
      <div className="glass-card" style={{ padding: '32px' }}>
        <h3 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '20px' }}>
          Proficiency Level Tiers
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          {[
            { level: 'Beginner', range: '0 - 64 Score', desc: 'Developing foundational speech clarity and structure.' },
            { level: 'Intermediate', range: '65 - 77 Score', desc: 'Solid speech flow, minimal hesitation, good topic alignment.' },
            { level: 'Advanced', range: '78 - 87 Score', desc: 'Strong vocal authority, rich vocabulary, clear leadership.' },
            { level: 'Excellent', range: '88 - 100 Score', desc: 'Mastery in executive communication, persuasion & fluency.' }
          ].map((t, idx) => {
            const isCurrent = (user.level || 'Beginner').toLowerCase() === t.level.toLowerCase();
            return (
              <div key={idx} style={{
                padding: '18px',
                borderRadius: '14px',
                background: isCurrent ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255,255,255,0.03)',
                border: isCurrent ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid rgba(255,255,255,0.06)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#F3F4F6' }}>{t.level}</span>
                  {isCurrent && <span style={{ fontSize: '0.7rem', color: '#10B981', fontWeight: 700 }}>CURRENT</span>}
                </div>
                <span style={{ fontSize: '0.75rem', color: '#818CF8', fontWeight: 700, display: 'block', marginBottom: '8px' }}>{t.range}</span>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#9CA3AF', lineHeight: 1.4 }}>{t.desc}</p>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};
