import React, { useState } from 'react';
import { api } from '../services/api';
import { recommendedTopics } from '../utils/topics';
import { Users, X, Search, CheckCircle2 } from 'lucide-react';

const GROUP_ACTIVITY_TOPICS = {
  'Group Discussion': recommendedTopics.groupDiscussion,
  'Debate':          recommendedTopics.debate,
  'Team Discussion': recommendedTopics.groupDiscussion,
  'Collaborative Problem Solving': recommendedTopics.groupDiscussion,
  'Group JAM':       recommendedTopics.jam,
  'Mock Interview Panel': recommendedTopics.interview,
};

export const CreateRoomModal = ({ isOpen, onClose, onRoomCreated }) => {
  const [activityType, setActivityType] = useState('Group Discussion');
  const [searchQuery,  setSearchQuery]  = useState('');
  const [selectedTopic, setSelectedTopic] = useState('');
  const [maxMembers, setMaxMembers]     = useState(4);
  const [loading, setLoading]           = useState(false);
  const [error,   setError]             = useState('');

  if (!isOpen) return null;

  const currentTopics = GROUP_ACTIVITY_TOPICS[activityType] || recommendedTopics.groupDiscussion;
  const filteredTopics = currentTopics.filter(t =>
    t.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleActivityChange = (e) => {
    setActivityType(e.target.value);
    setSelectedTopic('');
    setSearchQuery('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!selectedTopic) {
      return setError('Please select a topic for the discussion.');
    }
    setLoading(true);
    try {
      const room = await api.createRoom(activityType, selectedTopic, maxMembers);
      onRoomCreated(room);
    } catch (err) {
      setError(err.message || 'Failed to create room');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div className="glass-card" style={{ width: '100%', maxWidth: '580px', padding: '32px', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>

        <button onClick={onClose} style={{ position: 'absolute', right: '20px', top: '20px', background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer' }}>
          <X size={22} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <div style={{ padding: '10px', borderRadius: '12px', background: 'rgba(99,102,241,0.2)', color: '#818CF8' }}>
            <Users size={24} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Create Group Voice Room</h2>
            <span style={{ fontSize: '0.8rem', color: '#9CA3AF' }}>Voice-only WebRTC real-time session</span>
          </div>
        </div>

        {error && (
          <div style={{ padding: '10px 14px', borderRadius: '10px', background: 'rgba(239,68,68,0.15)', color: '#FCA5A5', fontSize: '0.85rem', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Activity Type */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#D1D5DB', marginBottom: '8px' }}>Activity Type</label>
            <select className="glass-input" value={activityType} onChange={handleActivityChange}>
              <option value="Group Discussion">Group Discussion</option>
              <option value="Debate">Debate (FOR / AGAINST)</option>
              <option value="Team Discussion">Team Discussion</option>
              <option value="Collaborative Problem Solving">Collaborative Problem Solving</option>
              <option value="Group JAM">Group JAM</option>
              <option value="Mock Interview Panel">Mock Interview Panel</option>
            </select>
          </div>

          {/* Topic Selection */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#D1D5DB' }}>
                🎯 Select Discussion Topic
              </label>
              <span style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>
                {currentTopics.length} topics available
              </span>
            </div>

            {/* Selected topic preview */}
            {selectedTopic && (
              <div style={{ padding: '10px 16px', borderRadius: '10px', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', color: '#34D399', fontSize: '0.88rem', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={16} />
                <span style={{ fontWeight: 600 }}>"{selectedTopic}"</span>
              </div>
            )}

            {/* Search */}
            <div style={{ position: 'relative', marginBottom: '10px' }}>
              <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }} />
              <input
                type="text"
                className="glass-input"
                placeholder={`Search ${activityType} topics...`}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '36px', fontSize: '0.85rem' }}
              />
            </div>

            {/* Topic list */}
            <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', paddingRight: '4px' }}>
              {filteredTopics.map((topic, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelectedTopic(topic)}
                  style={{
                    textAlign: 'left',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    background: selectedTopic === topic ? 'rgba(99,102,241,0.18)' : 'var(--bg-input)',
                    border: selectedTopic === topic ? '1px solid var(--primary)' : '1px solid var(--border-glass)',
                    color: selectedTopic === topic ? 'var(--primary)' : 'var(--text-primary)',
                    fontSize: '0.85rem',
                    fontWeight: selectedTopic === topic ? 700 : 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span style={{ color: '#6366F1', fontWeight: 700, flexShrink: 0, fontSize: '0.78rem' }}>
                    {String(idx + 1).padStart(2,'0')}.
                  </span>
                  {topic}
                </button>
              ))}
              {filteredTopics.length === 0 && (
                <p style={{ color: '#6B7280', fontSize: '0.85rem', textAlign: 'center', padding: '20px 0' }}>
                  No topics match your search.
                </p>
              )}
            </div>
          </div>

          {/* Max Participants */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#D1D5DB', marginBottom: '10px' }}>
              Maximum Participants
            </label>
            <div style={{ display: 'flex', gap: '14px' }}>
              {[2, 3, 4].map(num => (
                <label key={num} style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '12px',
                  borderRadius: '12px',
                  background: maxMembers === num ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.04)',
                  border: maxMembers === num ? '1px solid #6366F1' : '1px solid rgba(255,255,255,0.08)',
                  cursor: 'pointer',
                  fontWeight: 700,
                  color: maxMembers === num ? '#A5B4FC' : '#9CA3AF'
                }}>
                  <input
                    type="radio"
                    name="maxMembers"
                    value={num}
                    checked={maxMembers === num}
                    onChange={() => setMaxMembers(num)}
                    style={{ accentColor: '#6366F1' }}
                  />
                  {num} Members
                </label>
              ))}
            </div>
          </div>

          <button type="submit" disabled={loading || !selectedTopic} className="btn-primary" style={{ padding: '14px', marginTop: '6px', opacity: !selectedTopic ? 0.6 : 1 }}>
            {loading ? 'Creating Room…' : 'Create & Open Waiting Room'}
          </button>
        </form>
      </div>
    </div>
  );
};
