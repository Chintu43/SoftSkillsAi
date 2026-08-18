import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Mic, LayoutDashboard, Users, BarChart3, History, MessageSquareText, LogOut, Sun, Moon } from 'lucide-react';

export const Navbar = ({ activeTab, setActiveTab }) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  if (!user) return null;

  const navItems = [
    { id: 'dashboard',  label: 'Dashboard',          icon: LayoutDashboard },
    { id: 'individual', label: 'Individual Practice', icon: Mic },
    { id: 'group',      label: 'Group Practice',      icon: Users },
    { id: 'progress',   label: 'Progress',            icon: BarChart3 },
    { id: 'history',    label: 'History',             icon: History },
    { id: 'aicoach',    label: 'AI Coach',            icon: MessageSquareText },
  ];

  const getLevelBadgeClass = (level) => {
    switch (level?.toLowerCase()) {
      case 'exceptional': return 'badge-excellent';
      case 'excellent': return 'badge-excellent';
      case 'advanced': return 'badge-advanced';
      case 'beginner': return 'badge-beginner';
      default: return 'badge-intermediate';
    }
  };

  const isDark = theme === 'dark';

  return (
    <nav
      className="app-navbar"
      style={{
        borderRadius: '0 0 20px 20px',
        padding: '12px 24px',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}
    >
      <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>

        {/* Brand */}
        <div onClick={() => setActiveTab('dashboard')} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', flexShrink: 0 }}>
          <div style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', padding: '10px', borderRadius: '12px', display: 'flex', color: 'white', boxShadow: '0 4px 15px rgba(99,102,241,0.4)' }}>
            <Mic size={22} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, lineHeight: 1 }} className="text-gradient">
              SkillForge AI
            </h1>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em' }}>
              AI Soft Skills Training &amp; Evaluation Platform
            </span>
          </div>
        </div>

        {/* Nav tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', overflowX: 'auto', padding: '4px', flexShrink: 1, minWidth: 0 }}>
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
                  gap: '6px',
                  padding: '8px 12px',
                  borderRadius: '10px',
                  border: 'none',
                  background: isActive
                    ? 'linear-gradient(135deg, rgba(99,102,241,0.22), rgba(139,92,246,0.22))'
                    : 'transparent',
                  color: isActive ? '#A5B4FC' : 'var(--text-muted)',
                  borderBottom: isActive ? '2px solid #6366F1' : '2px solid transparent',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s ease'
                }}
              >
                <Icon size={15} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right: theme toggle + user + logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="theme-toggle"
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDark ? <Sun size={15} /> : <Moon size={15} />}
            <span style={{ display: 'none', '@media (min-width: 900px)': { display: 'inline' } }}>
              {isDark ? 'Light' : 'Dark'}
            </span>
          </button>

          {/* User badge */}
          <div
            onClick={() => setActiveTab('profile')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              padding: '6px 10px',
              borderRadius: '12px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-glass)'
            }}
          >
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, #06B6D4, #6366F1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.9rem', color: 'white', flexShrink: 0 }}>
              {user.name ? user.name[0].toUpperCase() : 'U'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>{user.name}</span>
              <span className={`badge-level ${getLevelBadgeClass(user.level)}`} style={{ marginTop: '2px', fontSize: '0.63rem' }}>
                {user.level || 'Beginner'}
              </span>
            </div>
          </div>

          {/* Logout */}
          <button
            onClick={logout}
            title="Logout"
            style={{
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.2)',
              color: '#FCA5A5',
              padding: '8px',
              borderRadius: '10px',
              cursor: 'pointer',
              display: 'flex'
            }}
          >
            <LogOut size={17} />
          </button>
        </div>

      </div>
    </nav>
  );
};
