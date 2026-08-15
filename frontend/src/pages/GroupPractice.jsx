import React, { useState } from 'react';
import { Users, Plus, LogIn, ShieldAlert, Sparkles, MessageSquare, Flame, CheckCircle2 } from 'lucide-react';
import { CreateRoomModal } from './CreateRoomModal';
import { JoinRoomModal } from './JoinRoomModal';

export const GroupPractice = ({ onEnterRoom }) => {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isJoinOpen, setIsJoinOpen] = useState(false);

  const groupActivities = [
    {
      id: 'gd',
      name: 'Group Discussion',
      icon: '👥',
      desc: 'Participate in structured group discussions on trending business, technology, and social issues.',
      topic: 'Is Artificial Intelligence replacing jobs?'
    },
    {
      id: 'debate',
      name: 'Debate',
      icon: '⚔️',
      desc: 'Engage in competitive arguments with FOR / AGAINST role assignments and evidence-based rebuttals.',
      topic: 'Social Media is beneficial for students.'
    },
    {
      id: 'team-disc',
      name: 'Team Discussion',
      icon: '🤝',
      desc: 'Practice team collaboration, consensus building, and constructive feedback in high-pressure scenarios.',
      topic: 'Strategies for Remote Team Productivity'
    },
    {
      id: 'problem-solving',
      name: 'Collaborative Problem Solving',
      icon: '🧩',
      desc: 'Work together with peers to analyze root causes and formulate actionable business solutions.',
      topic: 'Solving Urban Traffic & Environmental Congestion'
    },
    {
      id: 'group-jam',
      name: 'Group JAM',
      icon: '🎤',
      desc: 'Fast-paced sequential individual speech rounds where participants take turns on rapid topics.',
      topic: 'Rapid Tech Innovations in 2026'
    },
    {
      id: 'mock-panel',
      name: 'Mock Interview Panel',
      icon: '👔',
      desc: 'Simulate multi-interviewer interview panels where participants ask and answer structured questions.',
      topic: 'Panel Review for Senior Technical Leader'
    }
  ];

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '30px 20px' }}>
      
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '2.2rem', fontWeight: 800 }}>Group Voice Practice</h1>
          <p style={{ color: '#9CA3AF', fontSize: '1rem', marginTop: '6px' }}>
            Real-time Zoom-style voice rooms (Audio only). Practice discussions with up to 4 members.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={() => setIsCreateOpen(true)} className="btn-primary" style={{ padding: '12px 24px' }}>
            <Plus size={18} /> Create Room
          </button>
          <button onClick={() => setIsJoinOpen(true)} className="btn-secondary" style={{ padding: '12px 24px' }}>
            <LogIn size={18} /> Join Room
          </button>
        </div>
      </div>

      {/* Safety Notice Banner */}
      <div className="glass-card" style={{ padding: '20px 24px', marginBottom: '32px', borderLeft: '4px solid #6366F1', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ padding: '8px', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.2)', color: '#818CF8' }}>
            <Sparkles size={20} />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>Real-Time AI Moderation Active</h4>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.85rem', color: '#9CA3AF' }}>
              Gemini AI automatically monitors off-topic speech and maintains professional discussion guidelines.
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '16px', fontSize: '0.82rem', color: '#D1D5DB' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><CheckCircle2 size={14} color="#10B981" /> Max 4 Members</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><CheckCircle2 size={14} color="#10B981" /> Voice Only</span>
        </div>
      </div>

      {/* Activities Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '24px' }}>
        {groupActivities.map((act) => (
          <div key={act.id} className="glass-card" style={{ padding: '28px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '2.5rem', marginBottom: '16px' }}>{act.icon}</div>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '8px' }}>{act.name}</h3>
              <p style={{ color: '#9CA3AF', fontSize: '0.88rem', lineHeight: 1.5, marginBottom: '16px' }}>{act.desc}</p>
              
              <div style={{ padding: '10px 14px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', marginBottom: '20px' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#A5B4FC', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>Sample Topic</span>
                <span style={{ fontSize: '0.85rem', color: '#E5E7EB', fontWeight: 600 }}>"{act.topic}"</span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button onClick={() => setIsCreateOpen(true)} className="btn-primary" style={{ padding: '10px', fontSize: '0.88rem' }}>
                <Plus size={16} /> Create
              </button>
              <button onClick={() => setIsJoinOpen(true)} className="btn-secondary" style={{ padding: '10px', fontSize: '0.88rem' }}>
                <LogIn size={16} /> Join
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modals */}
      <CreateRoomModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onRoomCreated={(room) => {
          setIsCreateOpen(false);
          onEnterRoom(room);
        }}
      />

      <JoinRoomModal
        isOpen={isJoinOpen}
        onClose={() => setIsJoinOpen(false)}
        onRoomJoined={(room) => {
          setIsJoinOpen(false);
          onEnterRoom(room);
        }}
      />

    </div>
  );
};
