import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import {
  Users, LogIn, BarChart2, MessageSquare, Star,
  LogOut, RefreshCw, ShieldCheck, AlertCircle
} from 'lucide-react';

/* ── helpers ─────────────────────────────────────────────── */
const StatCard = ({ icon: Icon, label, value, color = '#818CF8' }) => (
  <div className="glass-card" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '18px' }}>
    <div style={{
      width: '52px', height: '52px', borderRadius: '14px', flexShrink: 0,
      background: `${color}22`, border: `1px solid ${color}44`,
      display: 'flex', alignItems: 'center', justifyContent: 'center', color
    }}>
      <Icon size={24} />
    </div>
    <div>
      <p style={{ fontSize: '0.8rem', color: '#9CA3AF', marginBottom: '4px', fontWeight: 500 }}>{label}</p>
      <p style={{ fontSize: '1.7rem', fontWeight: 800, color: '#F9FAFB', lineHeight: 1 }}>{value ?? '—'}</p>
    </div>
  </div>
);

const StarRating = ({ rating }) => (
  <span style={{ display: 'inline-flex', gap: '2px' }}>
    {[1, 2, 3, 4, 5].map(n => (
      <Star
        key={n}
        size={14}
        fill={n <= rating ? '#FBBF24' : 'none'}
        stroke={n <= rating ? '#FBBF24' : '#4B5563'}
      />
    ))}
  </span>
);

/* ── main component ─────────────────────────────────────── */
export const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = useCallback(async (showRefresh = false) => {
    try {
      if (showRefresh) setRefreshing(true);
      else setLoadingStats(true);
      setError('');
      const data = await api.getAdminStats();
      setStats(data);
    } catch (err) {
      setError(err.message || 'Failed to load admin statistics.');
    } finally {
      setLoadingStats(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  /* guard — should not normally be reached because of RequireAdmin route wrapper */
  if (user && user.role !== 'admin') {
    return (
      <div style={{ maxWidth: '500px', margin: '80px auto', padding: '0 20px', textAlign: 'center' }}>
        <div className="glass-card" style={{ padding: '40px' }}>
          <AlertCircle size={48} style={{ color: '#F87171', marginBottom: '16px' }} />
          <h2 style={{ fontWeight: 800 }}>Access Denied</h2>
          <p style={{ color: '#9CA3AF', marginTop: '10px' }}>You do not have administrator privileges.</p>
          <button onClick={() => navigate('/dashboard')} className="btn-primary" style={{ marginTop: '24px', padding: '12px 28px' }}>
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '32px 20px' }}>

      {/* ── Page Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '14px',
            background: 'linear-gradient(135deg, #7C3AED, #A78BFA)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', boxShadow: '0 6px 20px rgba(124,58,237,0.4)'
          }}>
            <ShieldCheck size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>Admin Dashboard</h1>
            <p style={{ color: '#9CA3AF', fontSize: '0.85rem', margin: 0 }}>
              Logged in as <strong style={{ color: '#A78BFA' }}>{user?.username || user?.name || 'Admin'}</strong>
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => fetchStats(true)}
            disabled={refreshing}
            className="btn-secondary"
            style={{ padding: '10px 18px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.87rem' }}
          >
            <RefreshCw size={15} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
          <button
            onClick={handleLogout}
            className="btn-secondary"
            style={{ padding: '10px 18px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.87rem', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.3)' }}
          >
            <LogOut size={15} />
            Logout
          </button>
        </div>
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div style={{
          padding: '14px 18px', borderRadius: '12px', marginBottom: '24px',
          background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
          color: '#FCA5A5', display: 'flex', alignItems: 'center', gap: '12px'
        }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {loadingStats ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#9CA3AF' }}>
          Loading statistics…
        </div>
      ) : stats ? (
        <>
          {/* ── Stat Cards ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '36px' }}>
            <StatCard icon={Users}        label="Total Registered Users" value={stats.totalUsers}        color="#818CF8" />
            <StatCard icon={LogIn}        label="Users Logged In"         value={stats.loggedInUsers}     color="#34D399" />
            <StatCard icon={BarChart2}    label="Total Sessions"          value={stats.totalSessions}     color="#60A5FA" />
            <StatCard icon={MessageSquare} label="Feedback Received"      value={stats.totalFeedback}     color="#FBBF24" />
            <StatCard icon={Star}         label="Average Rating"          value={stats.avgRating != null ? Number(stats.avgRating).toFixed(1) : '—'} color="#F472B6" />
          </div>

          {/* ── Feedback Table ── */}
          <div className="glass-card" style={{ padding: '28px' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <MessageSquare size={18} style={{ color: '#FBBF24' }} />
              User Feedback
            </h2>

            {stats.feedbackList && stats.feedbackList.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.87rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                      {['User', 'Rating', 'Comment', 'Session', 'Submitted At'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '10px 14px', color: '#9CA3AF', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {stats.feedbackList.map((fb, idx) => (
                      <tr
                        key={idx}
                        style={{
                          borderBottom: '1px solid rgba(255,255,255,0.05)',
                          transition: 'background 0.15s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={{ padding: '12px 14px', color: '#E5E7EB', fontWeight: 500 }}>{fb.userName || fb.userEmail || 'Unknown'}</td>
                        <td style={{ padding: '12px 14px' }}><StarRating rating={fb.rating} /></td>
                        <td style={{ padding: '12px 14px', color: '#D1D5DB', maxWidth: '280px' }}>
                          <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {fb.description || <em style={{ color: '#6B7280' }}>No comment</em>}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', color: '#9CA3AF', fontFamily: 'monospace', fontSize: '0.78rem' }}>
                          {fb.sessionId ? String(fb.sessionId).slice(-8) : '—'}
                        </td>
                        <td style={{ padding: '12px 14px', color: '#9CA3AF', whiteSpace: 'nowrap' }}>
                          {fb.createdAt ? new Date(fb.createdAt).toLocaleString() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ color: '#6B7280', textAlign: 'center', padding: '32px' }}>No feedback submitted yet.</p>
            )}
          </div>
        </>
      ) : null}

      {/* spin keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};
