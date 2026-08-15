import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { UserPlus, User, Mail, Lock, AlertCircle } from 'lucide-react';

export const Register = ({ onNavigate }) => {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      return setError('Passwords do not match');
    }

    if (password.length < 6) {
      return setError('Password must be at least 6 characters');
    }

    setLoading(true);
    try {
      await register(name, email, password);
      onNavigate('dashboard');
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '460px', margin: '60px auto', padding: '0 20px' }}>
      <div className="glass-card" style={{ padding: '40px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'linear-gradient(135deg, #06B6D4, #6366F1)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'white', marginBottom: '16px', boxShadow: '0 8px 24px rgba(6, 182, 212, 0.4)' }}>
            <UserPlus size={28} />
          </div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800 }}>Create Your Account</h2>
          <p style={{ color: '#9CA3AF', fontSize: '0.9rem', marginTop: '6px' }}>Start practicing soft skills with AI feedback</p>
        </div>

        {error && (
          <div style={{ padding: '12px 16px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#FCA5A5', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#D1D5DB', marginBottom: '6px' }}>Full Name</label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                required
                className="glass-input"
                placeholder="e.g. Rahul Sharma"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{ paddingLeft: '42px' }}
              />
              <User size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#D1D5DB', marginBottom: '6px' }}>Email Address</label>
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
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#D1D5DB', marginBottom: '6px' }}>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type="password"
                required
                className="glass-input"
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ paddingLeft: '42px' }}
              />
              <Lock size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#D1D5DB', marginBottom: '6px' }}>Confirm Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type="password"
                required
                className="glass-input"
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                style={{ paddingLeft: '42px' }}
              />
              <Lock size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn-primary" style={{ marginTop: '10px', width: '100%', padding: '14px' }}>
            {loading ? 'Creating Account...' : 'Register Account'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '0.88rem', color: '#9CA3AF' }}>
          Already have an account?{' '}
          <span onClick={() => onNavigate('login')} style={{ color: '#818CF8', fontWeight: 700, cursor: 'pointer' }}>
            Sign In
          </span>
        </div>
      </div>
    </div>
  );
};
