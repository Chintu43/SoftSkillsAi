import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { getSessionScore, calculateImprovementRate, formatImprovementLabel, getImprovementIndicator } from '../utils/sessionScores';
import { Mic, Users, TrendingUp, Play, ChevronRight, Sparkles } from 'lucide-react';

export const Dashboard = ({ onNavigate }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const data = await api.getUserSessions();
        setSessions(data || []);
      } catch (err) {
        console.warn('Dashboard fetch sessions notice:', err);
      }
    };
    fetchSessions();
  }, []);

  const nav = (tab) => {
    const paths = { individual: '/practice', group: '/group', progress: '/progress' };
    navigate(paths[tab] || `/${tab}`);
  };

  if (!user) return null;

  const hasSessions = (user.sessionsCompleted || 0) > 0;

  // Derive Improvement Rate strictly from actual session Overall Scores (skipping failed evaluation runs)
  let currentScore = null;
  let previousScore = null;

  for (let i = 0; i < sessions.length; i++) {
    const sScore = getSessionScore(sessions[i]);
    if (sScore !== null) {
      if (currentScore === null) {
        currentScore = sScore;
      } else if (previousScore === null) {
        previousScore = sScore;
        break;
      }
    }
  }

  const improvementRate = calculateImprovementRate(currentScore, previousScore);
  const improvementLabel = formatImprovementLabel(improvementRate);
  const indicator = getImprovementIndicator(improvementRate);

  const scoreMetrics = [
    { label: 'Communication', score: hasSessions ? (user.communicationScore ?? 0) : 0, color: '#6366F1' },
    { label: 'Confidence', score: hasSessions ? (user.confidenceScore ?? 0) : 0, color: '#06B6D4' },
    { label: 'Fluency', score: hasSessions ? (user.fluencyScore ?? 0) : 0, color: '#8B5CF6' },
    { label: 'Vocabulary', score: hasSessions ? (user.vocabularyScore ?? 0) : 0, color: '#F59E0B' },
    { label: 'Grammar', score: hasSessions ? (user.grammarScore ?? 0) : 0, color: '#10B981' },
    { label: 'Listening', score: hasSessions ? (user.listeningScore ?? 0) : 0, color: '#EC4899' },
    { label: 'Clarity', score: hasSessions ? (user.clarityScore ?? 0) : 0, color: '#3B82F6' },
    { label: 'Leadership', score: hasSessions ? (user.leadershipScore ?? 0) : 0, color: '#84CC16' },
    { label: 'Teamwork', score: hasSessions ? (user.teamworkScore ?? 0) : 0, color: '#14B8A6' },
    { label: 'Critical Thinking', score: hasSessions ? (user.criticalThinkingScore ?? 0) : 0, color: '#F97316' },
    { label: 'Topic Relevance', score: hasSessions ? (user.topicRelevanceScore ?? 0) : 0, color: '#A855F7' }
  ];

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '30px 20px' }}>
      
      {/* Welcome Banner */}
      <div className="glass-card" style={{ padding: '32px 40px', marginBottom: '30px', background: 'linear-gradient(135deg, rgba(30, 27, 75, 0.8), rgba(17, 24, 39, 0.9))', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 12px', borderRadius: '20px', background: 'rgba(99, 102, 241, 0.2)', color: '#A5B4FC', fontSize: '0.8rem', fontWeight: 600, marginBottom: '12px' }}>
              <Sparkles size={14} /> AI Evaluation Dashboard Active
            </div>
            <h1 style={{ fontSize: '2.4rem', fontWeight: 800, margin: 0 }}>
              Welcome back, {user.name} 👋
            </h1>
            <p style={{ color: '#9CA3AF', fontSize: '1rem', marginTop: '8px', maxWidth: '540px' }}>
              {!hasSessions 
                ? 'Complete your first practice session to earn your official soft skills score!' 
                : 'Track your communication growth, join live group practice, or start a solo JAM session today.'}
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button onClick={() => nav('individual')} className="btn-primary" style={{ padding: '14px 24px' }}>
                <Play size={18} /> Start Practice
              </button>
<p className="speech-tip">
🎧 Pro Tip: Use earphones for clearer voice detection and more accurate feedback.</p>              
              <button onClick={() => nav('group')} className="btn-secondary" style={{ padding: '14px 24px' }}>
                <Users size={18} /> Join Group
              </button>
              <button onClick={() => nav('progress')} className="btn-secondary" style={{ padding: '14px 24px' }}>
                <TrendingUp size={18} /> View Progress
              </button>
            </div>
            <div style={{ fontSize: '0.78rem', color: '#9CA3AF', display: 'flex', alignItems: 'center', gap: '4px', opacity: 0.85, marginTop: '2px' }}>
              <span>🎧 Pro Tip: Use earphones for clearer voice detection and more accurate feedback.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '30px' }}>
        <div className="glass-card" style={{ padding: '24px' }}>
          <span style={{ fontSize: '0.85rem', color: '#9CA3AF', fontWeight: 600 }}>Overall Soft Skills Score</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '10px' }}>
            <span style={{ fontSize: '2.4rem', fontWeight: 800, color: hasSessions ? '#818CF8' : '#6B7280' }}>
              {hasSessions ? (user.overallScore ?? 0) : 0}
            </span>
            <span style={{ color: '#9CA3AF', fontSize: '1rem', fontWeight: 600 }}>/ 100</span>
          </div>
          <span style={{ fontSize: '0.75rem', color: hasSessions ? '#10B981' : '#F59E0B', fontWeight: 700, marginTop: '6px', display: 'inline-block' }}>
            ★ {user.level || 'Beginner'} Level
          </span>
        </div>

        <div className="glass-card" style={{ padding: '24px' }}>
          <span style={{ fontSize: '0.85rem', color: '#9CA3AF', fontWeight: 600 }}>Sessions Completed</span>
          <div style={{ fontSize: '2.4rem', fontWeight: 800, color: '#F3F4F6', marginTop: '10px' }}>
            {user.sessionsCompleted || 0}
          </div>
          <span style={{ fontSize: '0.75rem', color: '#9CA3AF', marginTop: '6px', display: 'inline-block' }}>
            Total practice activity runs
          </span>
        </div>

        <div className="glass-card" style={{ padding: '24px' }}>
          <span style={{ fontSize: '0.85rem', color: '#9CA3AF', fontWeight: 600 }}>Individual Sessions</span>
          <div style={{ fontSize: '2.4rem', fontWeight: 800, color: '#38BDF8', marginTop: '10px' }}>
            {user.individualSessions || 0}
          </div>
          <span style={{ fontSize: '0.75rem', color: '#9CA3AF', marginTop: '6px', display: 'inline-block' }}>
            JAM, Interview & Solo modules
          </span>
        </div>

        <div className="glass-card" style={{ padding: '24px' }}>
          <span style={{ fontSize: '0.85rem', color: '#9CA3AF', fontWeight: 600 }}>Group Sessions</span>
          <div style={{ fontSize: '2.4rem', fontWeight: 800, color: '#C084FC', marginTop: '10px' }}>
            {user.groupSessions || 0}
          </div>
          <span style={{ fontSize: '0.75rem', color: '#9CA3AF', marginTop: '6px', display: 'inline-block' }}>
            GD, Debates & Team meetings
          </span>
        </div>

        <div className="glass-card" style={{ padding: '24px' }}>
          <span style={{ fontSize: '0.85rem', color: '#9CA3AF', fontWeight: 600 }}>Improvement Rate</span>
          <div style={{ fontSize: '2.4rem', fontWeight: 800, color: hasSessions ? (improvementRate < 0 ? '#EF4444' : (improvementRate > 0 ? '#34D399' : '#F3F4F6')) : '#6B7280', marginTop: '10px' }}>
            {improvementLabel}
          </div>
          <span style={{ fontSize: '0.75rem', color: hasSessions ? indicator.color : '#9CA3AF', fontWeight: 700, marginTop: '6px', display: 'inline-block' }}>
            {indicator.text}
          </span>
        </div>
      </div>

      {/* Sub-Score Performance Breakdown */}
      <div className="glass-card" style={{ padding: '30px', marginBottom: '30px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Skill Dimension Breakdown</h2>
            <p style={{ color: '#9CA3AF', fontSize: '0.88rem', marginTop: '4px' }}>
              {!hasSessions ? 'Scores will populate automatically after your first completed practice session' : 'Calculated from actual AI speech analysis'}
            </p>
          </div>
          <span className="text-gradient" style={{ fontWeight: 700, fontSize: '0.9rem' }}>Weighted AI Evaluation</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
          {scoreMetrics.map((item, idx) => (
            <div key={idx} style={{ background: 'rgba(255,255,255,0.03)', padding: '16px 20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#E5E7EB' }}>{item.label}</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 800, color: item.score > 0 ? item.color : '#6B7280' }}>
                  {item.score} / 100
                </span>
              </div>
              <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${item.score}%`, height: '100%', background: item.color, borderRadius: '4px', transition: 'width 1s ease' }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Launch Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px' }}>
        <div 
          onClick={() => nav('individual')}
          className="glass-card glass-card-interactive" 
          style={{ padding: '30px' }}
        >
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(99, 102, 241, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818CF8', marginBottom: '16px' }}>
            <Mic size={26} />
          </div>
          <h3 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '8px' }}>Individual Practice</h3>
          <p style={{ color: '#9CA3AF', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: '20px' }}>
            Solo practice activities including JAM, Self Introduction, Interview Prep, Storytelling, and Impromptu Speaking with Gemini AI feedback.
          </p>
          <div style={{ color: '#818CF8', fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            Explore 12 Activities <ChevronRight size={18} />
          </div>
        </div>

        <div 
          onClick={() => nav('group')}
          className="glass-card glass-card-interactive" 
          style={{ padding: '30px' }}
        >
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(6, 182, 212, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#06B6D4', marginBottom: '16px' }}>
            <Users size={26} />
          </div>
          <h3 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '8px' }}>Group Practice Rooms</h3>
          <p style={{ color: '#9CA3AF', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: '20px' }}>
            Real-time audio meetings for Group Discussion, Debates, and Team Problem Solving. Create or join rooms with up to 4 participants.
          </p>
          <div style={{ color: '#06B6D4', fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            Create or Join Room <ChevronRight size={18} />
          </div>
        </div>
      </div>

    </div>
  );
};
