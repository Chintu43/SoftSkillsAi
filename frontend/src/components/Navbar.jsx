import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Mic, LayoutDashboard, Users, BarChart3, History, MessageSquareText, LogOut } from 'lucide-react';

export const Navbar = ({ activeTab, setActiveTab }) => {
  const { user, logout } = useAuth();

  if (!user) return null;

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'individual', label: 'Individual Practice', icon: Mic },
    { id: 'group', label: 'Group Practice', icon: Users },
    { id: 'progress', label: 'Progress', icon: BarChart3 },
    { id: 'history', label: 'History', icon: History },
    { id: 'aicoach', label: 'AI Coach', icon: MessageSquareText },
  ];

  const getLevelBadgeClass = (level) => {
    switch (level?.toLowerCase()) {
      case 'excellent': return 'badge-excellent';
      case 'advanced': return 'badge-advanced';
      case 'beginner': return 'badge-beginner';
      default: return 'badge-intermediate';
    }
  };

  return (
    <nav className="glass-card" style={{ borderRadius: '0 0 20px 20px', borderTop: 'none', padding: '12px 24px', position: 'sticky', top: 0, zIndex: 100 }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        
        {/* Brand Logo */}
        <div 
          onClick={() => setActiveTab('dashboard')} 
          style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
        >
          <div style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', padding: '10px', borderRadius: '12px', display: 'flex', color: 'white', boxShadow: '0 4px 15px rgba(99, 102, 241, 0.4)' }}>
            <Mic size={22} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, lineHeight: 1 }} className="text-gradient">
              SkillForge AI
            </h1>
            <span style={{ fontSize: '0.7rem', color: '#9CA3AF', fontWeight: 600, letterSpacing: '0.05em' }}>
              AI Soft Skills Training & Evaluation Platform
            </span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflowX: 'auto', padding: '4px' }}>
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 14px',
                  borderRadius: '10px',
                  border: 'none',
                  background: isActive ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.25), rgba(139, 92, 246, 0.25))' : 'transparent',
                  color: isActive ? '#A5B4FC' : '#9CA3AF',
                  borderBottom: isActive ? '2px solid #6366F1' : '2px solid transparent',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s ease'
                }}
              >
                <Icon size={16} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* User Badge & Profile */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div 
            onClick={() => setActiveTab('profile')}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '6px 12px', borderRadius: '12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'linear-gradient(135deg, #06B6D4, #6366F1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.9rem' }}>
              {user.name ? user.name[0].toUpperCase() : 'U'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#F3F4F6', lineHeight: 1.2 }}>{user.name}</span>
              <span className={`badge-level ${getLevelBadgeClass(user.level)}`} style={{ marginTop: '2px', fontSize: '0.65rem' }}>
                {user.level || 'Beginner'}
              </span>
            </div>
          </div>

          <button 
            onClick={logout} 
            title="Logout"
            style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#FCA5A5', padding: '8px', borderRadius: '10px', cursor: 'pointer', display: 'flex' }}
          >
            <LogOut size={18} />
          </button>
        </div>

      </div>
    </nav>
  );
};
