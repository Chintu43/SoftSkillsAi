import React, { useState } from 'react';
import { api } from '../services/api';
import { LogIn, X } from 'lucide-react';

export const JoinRoomModal = ({ isOpen, onClose, onRoomJoined }) => {
  const [roomId, setRoomId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const room = await api.joinRoom(roomId.trim().toUpperCase());
      onRoomJoined(room);
    } catch (err) {
      setError(err.message || 'Room is full or invalid Room ID.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div className="glass-card" style={{ width: '100%', maxWidth: '460px', padding: '32px', position: 'relative' }}>
        
        <button onClick={onClose} style={{ position: 'absolute', right: '20px', top: '20px', background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer' }}>
          <X size={22} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <div style={{ padding: '10px', borderRadius: '12px', background: 'rgba(6, 182, 212, 0.2)', color: '#06B6D4' }}>
            <LogIn size={24} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Join Group Room</h2>
            <span style={{ fontSize: '0.8rem', color: '#9CA3AF' }}>Enter unique Room ID</span>
          </div>
        </div>

        {error && (
          <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#FCA5A5', fontSize: '0.88rem', marginBottom: '18px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#D1D5DB', marginBottom: '8px' }}>Room ID</label>
            <input
              type="text"
              required
              className="glass-input"
              placeholder="e.g. SKILL-4829"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value.toUpperCase())}
              style={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}
            />
          </div>

          <button type="submit" disabled={loading} className="btn-primary" style={{ padding: '14px', marginTop: '6px' }}>
            {loading ? 'Joining Room...' : 'Join Voice Room'}
          </button>
        </form>

      </div>
    </div>
  );
};
