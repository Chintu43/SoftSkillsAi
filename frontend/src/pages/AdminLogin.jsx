import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, User, Lock, AlertCircle } from 'lucide-react';

export const AdminLogin = () => {
  const { adminLogin } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await adminLogin(username, password);
      navigate('/admin');
    } catch (err) {
      if (err instanceof TypeError || err.message?.toLowerCase().includes('fetch') || err.message?.toLowerCase().includes('network')) {
        setError('Unable to connect to server. Please try again.');
      } else {
        setError(err.message || 'Invalid admin credentials.');
      }
    } finally {
      setLoading(false);
    }
  };


  return (
    <div style={{ maxWidth: '440px', margin: '80px auto', padding: '0 20px' }}>
      <div className="glass-card" style={{ padding: '40px' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '16px',
            background: 'linear-gradient(135deg, #7C3AED, #A78BFA)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', marginBottom: '16px',
            boxShadow: '0 8px 24px rgba(124, 58, 237, 0.45)'
          }}>
            <ShieldCheck size={28} />
          </div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800 }}>Admin Login</h2>
          <p style={{ color: '#9CA3AF', fontSize: '0.9rem', marginTop: '6px' }}>
            Restricted — authorised personnel only
          </p>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            padding: '12px 16px', borderRadius: '12px',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#FCA5A5', fontSize: '0.88rem',
            display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px'
          }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Username */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#D1D5DB', marginBottom: '8px' }}>
              Username
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="admin-username"
                type="text"
                required
                autoComplete="username"
                className="glass-input"
                placeholder="Admin username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={{ paddingLeft: '42px' }}
              />
              <User size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
            </div>
          </div>

          {/* Password */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#D1D5DB', marginBottom: '8px' }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="admin-password"
                type="password"
                required
                autoComplete="current-password"
                className="glass-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ paddingLeft: '42px' }}
              />
              <Lock size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
            </div>
          </div>

          <button
            id="admin-signin-btn"
            type="submit"
            disabled={loading}
            className="btn-primary"
            style={{
              marginTop: '10px', width: '100%', padding: '14px',
              background: 'linear-gradient(135deg, #7C3AED, #A78BFA)'
            }}
          >
            {loading ? 'Signing In…' : 'Admin Sign In'}
          </button>
        </form>

        {/* Back link */}
        <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '0.85rem', color: '#6B7280' }}>
          Not an admin?{' '}
          <span
            onClick={() => navigate('/login')}
            style={{ color: '#818CF8', fontWeight: 600, cursor: 'pointer' }}
          >
            User Login
          </span>
        </div>
      </div>
    </div>
  );
};
