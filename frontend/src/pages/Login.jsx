import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogIn, Mail, Lock, AlertCircle } from 'lucide-react';

export const Login = ({ onNavigate }) => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '440px', margin: '80px auto', padding: '0 20px' }}>
      <div className="glass-card" style={{ padding: '40px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'white', marginBottom: '16px', boxShadow: '0 8px 24px rgba(99, 102, 241, 0.4)' }}>
            <LogIn size={28} />
          </div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800 }}>Welcome Back</h2>
          <p style={{ color: '#9CA3AF', fontSize: '0.9rem', marginTop: '6px' }}>Sign in to continue your soft skills journey</p>
        </div>

        {error && (
          <div style={{ padding: '12px 16px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#FCA5A5', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#D1D5DB', marginBottom: '8px' }}>Email Address</label>
            <div style={{ position: 'relative' }}>
              <input
                type="email"
                required
                className="glass-input"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ paddingLeft: '42px' }}
              />
              <Mail size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#D1D5DB', marginBottom: '8px' }}>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type="password"
                required
                className="glass-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ paddingLeft: '42px' }}
              />
              <Lock size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn-primary" style={{ marginTop: '10px', width: '100%', padding: '14px' }}>
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '0.88rem', color: '#9CA3AF' }}>
          Don't have an account?{' '}
          <span onClick={() => navigate('/register')} style={{ color: '#818CF8', fontWeight: 700, cursor: 'pointer' }}>
            Register here
          </span>
        </div>
      </div>
    </div>
  );
};
