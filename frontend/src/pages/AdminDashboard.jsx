import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import {
  Users, LogIn, BarChart2, MessageSquare, Star,
  LogOut, RefreshCw, ShieldCheck, AlertCircle, Trash2, AlertTriangle, XCircle,
  Search, Eye, X
} from 'lucide-react';
import { AdminResultView } from '../components/AdminResultView';

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

/* ── Score Badge ──────────────────────────────────────────── */
const ScoreBadge = ({ score }) => {
  if (score === null || score === undefined) return <span style={{ color: '#6B7280' }}>N/A</span>;
  const s = Number(score);
  const color = s >= 80 ? '#34D399' : s >= 60 ? '#60A5FA' : s >= 40 ? '#FBBF24' : '#F87171';
  return (
    <span style={{
      fontWeight: 700, fontSize: '0.95rem', color,
      background: `${color}18`, padding: '2px 10px', borderRadius: '8px',
      border: `1px solid ${color}33`
    }}>
      {s}
    </span>
  );
};

/* â”€â”€ main component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
export const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // User Results & Feedback state
  const [userResults, setUserResults] = useState(null);
  const [loadingResults, setLoadingResults] = useState(false);
  const [resultsError, setResultsError] = useState('');
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRating, setFilterRating] = useState('all');
  const [sortBy, setSortBy] = useState('latest');

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

  const fetchUserResults = useCallback(async () => {
    try {
      setLoadingResults(true);
      setResultsError('');
      const data = await api.getUserResultsFeedback();
      setUserResults(data.records || []);
    } catch (err) {
      setResultsError(err.message || 'Failed to load user results and feedback.');
    } finally {
      setLoadingResults(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    fetchUserResults();
  }, [fetchStats, fetchUserResults]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleDeleteFeedback = async (id) => {
    if (!window.confirm('Are you sure you want to delete this user feedback? This will update feedback stats immediately.')) {
      return;
    }
    try {
      setError('');
      const res = await api.deleteFeedback(id);
      if (res.stats) {
        setStats(res.stats);
      } else {
        await fetchStats();
      }
      // Refresh results list too since feedback was deleted
      fetchUserResults();
    } catch (err) {
      setError(err.message || 'Failed to delete feedback.');
    }
  };

  const handleClearQuotaAlert = async () => {
    try {
      setError('');
      const res = await api.clearQuotaAlert();
      if (res.stats) {
        setStats(res.stats);
      } else {
        await fetchStats();
      }
    } catch (err) {
      setError(err.message || 'Failed to clear quota alert.');
    }
  };

  // Filtered + sorted user results
  const filteredResults = useMemo(() => {
    if (!Array.isArray(userResults)) return [];
    let list = [...userResults];

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(r =>
        (r.userName || '').toLowerCase().includes(q) ||
        (r.userEmail || '').toLowerCase().includes(q) ||
        String(r.sessionId || '').toLowerCase().includes(q) ||
        (r.topic || '').toLowerCase().includes(q) ||
        (r.activityName || '').toLowerCase().includes(q)
      );
    }

    // Rating filter
    if (filterRating !== 'all') {
      const rNum = Number(filterRating);
      list = list.filter(r => r.feedbackRating === rNum);
    }

    // Sort
    list.sort((a, b) => {
      if (sortBy === 'latest') return new Date(b.feedbackCreatedAt) - new Date(a.feedbackCreatedAt);
      if (sortBy === 'oldest') return new Date(a.feedbackCreatedAt) - new Date(b.feedbackCreatedAt);
      if (sortBy === 'score_desc') return (b.finalScore ?? -1) - (a.finalScore ?? -1);
      if (sortBy === 'score_asc') return (a.finalScore ?? -1) - (b.finalScore ?? -1);
      if (sortBy === 'rating_desc') return (b.feedbackRating ?? 0) - (a.feedbackRating ?? 0);
      if (sortBy === 'rating_asc') return (a.feedbackRating ?? 0) - (b.feedbackRating ?? 0);
      return 0;
    });

    return list;
  }, [userResults, searchQuery, filterRating, sortBy]);

  /* guard â€” should not normally be reached because of RequireAdmin route wrapper */
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

      {/* â”€â”€ Page Header â”€â”€ */}
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
            onClick={() => { fetchStats(true); fetchUserResults(); }}
            disabled={refreshing}
            className="btn-secondary"
            style={{ padding: '10px 18px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.87rem' }}
          >
            <RefreshCw size={15} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            {refreshing ? 'Refreshingâ€¦' : 'Refresh'}
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

      {/* â”€â”€ Gemini Quota Alert Banner â”€â”€ */}
      {stats?.geminiQuotaExceeded && (
        <div style={{
          padding: '20px 24px', borderRadius: '16px', marginBottom: '28px',
          background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.18), rgba(220, 38, 38, 0.08))',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          boxShadow: '0 8px 24px rgba(239, 68, 68, 0.15)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px'
        }}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', maxWidth: '750px' }}>
            <div style={{
              width: '44px', height: '44px', borderRadius: '12px', flexShrink: 0,
              background: 'rgba(239, 68, 68, 0.25)', border: '1px solid rgba(239, 68, 68, 0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#EF4444'
            }}>
              <AlertTriangle size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#FCA5A5', margin: '0 0 6px 0' }}>
                âš ï¸ Gemini API Quota Exceeded / Rate Limit Reached
              </h3>
              <p style={{ color: '#E5E7EB', fontSize: '0.88rem', margin: '0 0 8px 0', lineHeight: 1.5 }}>
                The backend detected that Gemini API daily free-tier quota (HTTP 429) was reached during evaluation requests. AI evaluations are currently degraded or returning quota notices.
              </p>
              <p style={{ color: '#9CA3AF', fontSize: '0.8rem', margin: 0 }}>
                ðŸ’¡ <strong>Resolution:</strong> Wait for daily quota reset (midnight UTC) or update <code>GEMINI_API_KEY</code> in backend <code>.env</code> with a paid tier key.
                {stats.geminiQuotaExceededAt && ` (Recorded at: ${new Date(stats.geminiQuotaExceededAt).toLocaleString()})`}
              </p>
            </div>
          </div>
          <button
            onClick={handleClearQuotaAlert}
            className="btn-secondary"
            style={{
              padding: '8px 16px', fontSize: '0.82rem', color: '#FCA5A5',
              borderColor: 'rgba(239, 68, 68, 0.4)', background: 'rgba(239, 68, 68, 0.15)',
              display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer'
            }}
          >
            <XCircle size={15} />
            Dismiss / Re-check
          </button>
        </div>
      )}

      {/* â”€â”€ Error banner â”€â”€ */}
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
          Loading statisticsâ€¦
        </div>
      ) : stats ? (
        <>
          {/* â”€â”€ Stat Cards â”€â”€ */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '36px' }}>
            <StatCard icon={Users}        label="Total Registered Users" value={stats.totalFeedback !== undefined ? (stats.totalUsers ?? stats.totalMembers ?? 0) : (stats.totalUsers ?? stats.totalMembers ?? 0)} color="#818CF8" />
            <StatCard icon={LogIn}        label="Users Logged In"         value={stats.loggedInUsers ?? 0} color="#34D399" />
            <StatCard icon={BarChart2}    label="Total Sessions"          value={stats.totalSessions ?? 0} color="#60A5FA" />
            <StatCard icon={MessageSquare} label="Feedback Received"      value={(stats.totalFeedback ?? stats.totalFeedbacks) !== undefined ? (stats.totalFeedback ?? stats.totalFeedbacks) : 0} color="#FBBF24" />
            <StatCard icon={Star}         label="Average Rating"          value={(stats.averageRating ?? stats.avgRating) !== undefined && Number(stats.averageRating ?? stats.avgRating) > 0 ? `${Number(stats.averageRating ?? stats.avgRating).toFixed(1)} / 5` : 'N/A'} color="#F472B6" />
          </div>

          {/* â”€â”€ Feedback Table â”€â”€ */}
          <div className="glass-card" style={{ padding: '28px' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <MessageSquare size={18} style={{ color: '#FBBF24' }} />
              User Feedback
            </h2>

            {Array.isArray(stats.feedbacks || stats.feedbackList) && (stats.feedbacks || stats.feedbackList).length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.87rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                      {['User', 'Rating', 'Comment', 'Session', 'Submitted At', 'Action'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '10px 14px', color: '#9CA3AF', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(stats.feedbacks || stats.feedbackList).map((fb, idx) => (
                      <tr
                        key={fb.id || fb.sessionId || idx}
                        style={{
                          borderBottom: '1px solid rgba(255,255,255,0.05)',
                          transition: 'background 0.15s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={{ padding: '12px 14px', color: '#E5E7EB', fontWeight: 500 }}>
                          {fb.user || fb.userName || fb.userEmail || 'Anonymous'}
                        </td>
                        <td style={{ padding: '12px 14px' }}><StarRating rating={fb.rating} /></td>
                        <td style={{ padding: '12px 14px', color: '#D1D5DB', maxWidth: '280px' }}>
                          <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {fb.description || fb.comment || <em style={{ color: '#6B7280' }}>No comment</em>}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', color: '#9CA3AF', fontFamily: 'monospace', fontSize: '0.78rem' }}>
                          {fb.session || (fb.sessionId || fb.id ? String(fb.sessionId || fb.id).slice(-8) : 'â€”')}
                        </td>
                        <td style={{ padding: '12px 14px', color: '#9CA3AF', whiteSpace: 'nowrap' }}>
                          {fb.createdAt || fb.date ? new Date(fb.createdAt || fb.date).toLocaleString() : 'â€”'}
                        </td>
                        <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                          <button
                            onClick={() => handleDeleteFeedback(fb.id || fb.sessionId)}
                            title="Delete Feedback"
                            style={{
                              background: 'rgba(239, 68, 68, 0.12)',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              color: '#FCA5A5',
                              padding: '6px 12px',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              fontSize: '0.8rem',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.25)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.12)'}
                          >
                            <Trash2 size={13} />
                            Delete
                          </button>
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

          {/* â”€â”€ User Results & Feedback Section â”€â”€ */}
          <div className="glass-card" style={{ padding: '28px', marginTop: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
                <Eye size={18} style={{ color: '#818CF8' }} />
                User Results &amp; Feedback
              </h2>
              <button
                onClick={fetchUserResults}
                disabled={loadingResults}
                style={{
                  background: 'rgba(129,140,248,0.12)', border: '1px solid rgba(129,140,248,0.3)',
                  color: '#818CF8', padding: '7px 14px', borderRadius: '10px',
                  fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                <RefreshCw size={13} style={{ animation: loadingResults ? 'spin 1s linear infinite' : 'none' }} />
                {loadingResults ? 'Loadingâ€¦' : 'Refresh'}
              </button>
            </div>

            {/* Controls: Search + Filter + Sort */}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
              {/* Search */}
              <div style={{ position: 'relative', flex: '1 1 220px', minWidth: '180px' }}>
                <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#6B7280', pointerEvents: 'none' }} />
                <input
                  type="text"
                  placeholder="Search by name, email, topic, session IDâ€¦"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%', paddingLeft: '34px', paddingRight: '12px', paddingTop: '9px', paddingBottom: '9px',
                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '10px', color: '#E5E7EB', fontSize: '0.84rem', outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Filter by rating */}
              <select
                value={filterRating}
                onChange={e => setFilterRating(e.target.value)}
                style={{
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '10px', color: '#E5E7EB', fontSize: '0.84rem', padding: '9px 12px',
                  cursor: 'pointer', outline: 'none'
                }}
              >
                <option value="all">All Ratings</option>
                {[5, 4, 3, 2, 1].map(r => (
                  <option key={r} value={r}>{r} Star{r !== 1 ? 's' : ''}</option>
                ))}
              </select>

              {/* Sort */}
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                style={{
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '10px', color: '#E5E7EB', fontSize: '0.84rem', padding: '9px 12px',
                  cursor: 'pointer', outline: 'none'
                }}
              >
                <option value="latest">Latest Feedback First</option>
                <option value="oldest">Oldest Feedback First</option>
                <option value="score_desc">Highest Score First</option>
                <option value="score_asc">Lowest Score First</option>
                <option value="rating_desc">Highest Rating First</option>
                <option value="rating_asc">Lowest Rating First</option>
              </select>
            </div>

            {/* Results error */}
            {resultsError && (
              <div style={{
                padding: '12px 16px', borderRadius: '10px', marginBottom: '16px',
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
                color: '#FCA5A5', fontSize: '0.87rem', display: 'flex', alignItems: 'center', gap: '10px'
              }}>
                <AlertCircle size={15} />
                {resultsError}
              </div>
            )}

            {loadingResults ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#9CA3AF' }}>Loading resultsâ€¦</div>
            ) : filteredResults.length > 0 ? (
              <>
                <p style={{ color: '#6B7280', fontSize: '0.8rem', marginBottom: '12px' }}>
                  Showing {filteredResults.length} record{filteredResults.length !== 1 ? 's' : ''}
                  {(userResults && filteredResults.length < userResults.length) ? ` of ${userResults.length} total` : ''}
                </p>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                        {['User', 'Email', 'Session / Topic', 'Overall Score', 'Performance', 'Rating', 'Comment', 'Feedback Date', 'Action'].map(h => (
                          <th key={h} style={{ textAlign: 'left', padding: '10px 14px', color: '#9CA3AF', fontWeight: 600, whiteSpace: 'nowrap', fontSize: '0.8rem' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredResults.map((r, idx) => (
                        <tr
                          key={String(r.sessionId) || idx}
                          style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.15s' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <td style={{ padding: '12px 14px', color: '#E5E7EB', fontWeight: 500, whiteSpace: 'nowrap' }}>
                            {r.userName || 'Anonymous'}
                          </td>
                          <td style={{ padding: '12px 14px', color: '#9CA3AF', fontSize: '0.8rem' }}>
                            {r.userEmail || <em style={{ color: '#4B5563' }}>N/A</em>}
                          </td>
                          <td style={{ padding: '12px 14px', color: '#D1D5DB', maxWidth: '180px' }}>
                            <div style={{ fontWeight: 500, fontSize: '0.85rem' }}>{r.activityName || 'N/A'}</div>
                            {r.topic && <div style={{ color: '#6B7280', fontSize: '0.77rem', marginTop: '2px' }}>{r.topic}</div>}
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                            <ScoreBadge score={r.finalScore} />
                          </td>
                          <td style={{ padding: '12px 14px', color: '#9CA3AF', whiteSpace: 'nowrap', fontSize: '0.82rem' }}>
                            {r.performanceLevel || <em style={{ color: '#4B5563' }}>N/A</em>}
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            {r.feedbackRating !== null && r.feedbackRating !== undefined
                              ? <StarRating rating={r.feedbackRating} />
                              : <em style={{ color: '#4B5563' }}>N/A</em>}
                          </td>
                          <td style={{ padding: '12px 14px', color: '#D1D5DB', maxWidth: '200px' }}>
                            <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                              {r.feedbackComment || <em style={{ color: '#4B5563' }}>No comment</em>}
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px', color: '#9CA3AF', whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
                            {r.feedbackCreatedAt ? new Date(r.feedbackCreatedAt).toLocaleString() : 'â€”'}
                          </td>
                          <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                            <button
                              onClick={() => setSelectedRecord(r)}
                              title="View Full Result"
                              style={{
                                background: 'rgba(129,140,248,0.12)',
                                border: '1px solid rgba(129,140,248,0.3)',
                                color: '#818CF8',
                                padding: '6px 12px',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontSize: '0.8rem',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                transition: 'all 0.2s'
                              }}
                              onMouseEnter={e => e.currentTarget.style.background = 'rgba(129,140,248,0.25)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'rgba(129,140,248,0.12)'}
                            >
                              <Eye size={13} />
                              View Result
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p style={{ color: '#6B7280', textAlign: 'center', padding: '32px' }}>
                {Array.isArray(userResults) && userResults.length > 0
                  ? 'No records match your current search or filter.'
                  : 'No session results with feedback found yet.'}
              </p>
            )}
          </div>
        </>
      ) : null}

      {/* ── Complete Admin Result View ── */}
      {selectedRecord && (
        <AdminResultView
          record={selectedRecord}
          onClose={() => setSelectedRecord(null)}
        />
      )}

      {/* spin keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};
