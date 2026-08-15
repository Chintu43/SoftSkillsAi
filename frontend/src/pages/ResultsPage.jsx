import React from 'react';
import { Award, CheckCircle2, AlertTriangle, MessageSquare, ArrowRight, RefreshCw, BarChart2, AlertCircle, Lightbulb } from 'lucide-react';

export const ResultsPage = ({ session, onDashboard, onNewSession }) => {
  if (!session) return null;

  const rawTranscript = (session.transcript || '').trim();
  const isEmptySpeech = session.isEmptySpeech || rawTranscript === '' || rawTranscript.startsWith('Topic:');

  const scores = session.scores || {};
  const overallScore = isEmptySpeech ? 0 : (scores.overall || 0);

  const strengths = isEmptySpeech ? [] : (session.strengths || ['Good topic focus', 'Clear articulation']);
  const areasToImprove = isEmptySpeech 
    ? ['Try speaking for the full session duration so your communication skills can be evaluated.']
    : (session.areasToImprove || ['Reduce filler words', 'Improve sentence structure']);
  const mistakes = isEmptySpeech ? [] : (session.mistakes || []);

  const metricsList = [
    { label: 'Communication', score: isEmptySpeech ? 0 : (scores.communication || 0), color: '#6366F1' },
    { label: 'Fluency', score: isEmptySpeech ? 0 : (scores.fluency || 0), color: '#8B5CF6' },
    { label: 'Confidence', score: isEmptySpeech ? 0 : (scores.confidence || 0), color: '#06B6D4' },
    { label: 'Grammar', score: isEmptySpeech ? 0 : (scores.grammar || 0), color: '#10B981' },
    { label: 'Vocabulary', score: isEmptySpeech ? 0 : (scores.vocabulary || 0), color: '#F59E0B' },
    { label: 'Topic Relevance', score: isEmptySpeech ? 0 : (scores.topicRelevance || 0), color: '#3B82F6' },
    { label: 'Professionalism', score: isEmptySpeech ? 0 : (scores.professionalism || 0), color: '#EC4899' },
  ];

  return (
    <div style={{ maxWidth: '1050px', margin: '0 auto', padding: '30px 20px 60px 20px' }}>
      
      {/* Top Banner */}
      <div style={{ textAlign: 'center', marginBottom: '36px' }}>
        <div style={{ width: '64px', height: '64px', borderRadius: '20px', background: isEmptySpeech ? 'linear-gradient(135deg, #F59E0B, #EF4444)' : 'linear-gradient(135deg, #6366F1, #8B5CF6)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'white', marginBottom: '16px', boxShadow: '0 8px 30px rgba(99, 102, 241, 0.4)' }}>
          {isEmptySpeech ? <AlertTriangle size={36} /> : <Award size={36} />}
        </div>
        <h1 style={{ fontSize: '2.4rem', fontWeight: 800 }}>
          {isEmptySpeech ? '⚠️ No Speech Detected' : '🏆 Session Complete'}
        </h1>
        <p style={{ color: '#9CA3AF', fontSize: '1rem', marginTop: '6px' }}>
          Evaluation Report for <strong>{session.activityName}</strong>
        </p>
      </div>

      {/* Main Overall Score Card */}
      <div className="glass-card" style={{ padding: '40px', marginBottom: '32px', textAlign: 'center', background: 'linear-gradient(135deg, rgba(30, 27, 75, 0.9), rgba(17, 24, 39, 0.9))' }}>
        <span style={{ fontSize: '0.9rem', color: '#A5B4FC', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Overall Soft Skills Score
        </span>
        <div style={{ fontSize: '4.5rem', fontWeight: 800, color: isEmptySpeech ? '#6B7280' : '#818CF8', margin: '10px 0', lineHeight: 1 }}>
          {overallScore}<span style={{ fontSize: '1.8rem', color: '#9CA3AF' }}>/100</span>
        </div>
        
        {isEmptySpeech ? (
          <div style={{ marginTop: '16px', padding: '16px', borderRadius: '14px', background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
            <p style={{ color: '#FCD34D', fontSize: '1rem', fontWeight: 700, margin: 0 }}>
              You did not speak during this session.
            </p>
            <p style={{ color: '#D1D5DB', fontSize: '0.9rem', marginTop: '6px', margin: '6px 0 0 0' }}>
              💡 Tip: Try speaking for the full session duration so your communication skills can be evaluated.
            </p>
          </div>
        ) : (
          <p style={{ color: '#D1D5DB', fontSize: '1rem', maxWidth: '600px', margin: '0 auto' }}>
            {session.aiFeedback || 'Great work! Your speech was evaluated using Gemini AI.'}
          </p>
        )}
      </div>

      {/* Sub-Scores Grid */}
      <div className="glass-card" style={{ padding: '32px', marginBottom: '32px' }}>
        <h3 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BarChart2 size={20} color="#6366F1" /> Dimension Performance Breakdown
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          {metricsList.map((m, idx) => (
            <div key={idx} style={{ background: 'rgba(255,255,255,0.03)', padding: '16px 20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#D1D5DB' }}>{m.label}</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 800, color: m.score > 0 ? m.color : '#6B7280' }}>{m.score}</span>
              </div>
              <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ width: `${m.score}%`, height: '100%', background: m.color, borderRadius: '3px' }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Strengths & Areas to Improve 2-Column Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', marginBottom: '32px' }}>
        
        {/* Strengths */}
        <div className="glass-card" style={{ padding: '30px', borderTop: '4px solid #10B981' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#34D399', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={22} color="#10B981" /> Your Strengths
          </h3>
          {strengths.length === 0 ? (
            <span style={{ fontSize: '0.9rem', color: '#9CA3AF', fontStyle: 'italic' }}>
              No strengths recorded for no-speech sessions.
            </span>
          ) : (
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {strengths.map((str, idx) => (
                <li key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '0.92rem', color: '#E5E7EB', lineHeight: 1.4 }}>
                  <span style={{ color: '#10B981', fontWeight: 800 }}>✔</span>
                  <span>{str}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Areas to Improve */}
        <div className="glass-card" style={{ padding: '30px', borderTop: '4px solid #F59E0B' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FBBF24', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={22} color="#F59E0B" /> Areas to Improve
          </h3>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {areasToImprove.map((area, idx) => (
              <li key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '0.92rem', color: '#E5E7EB', lineHeight: 1.4 }}>
                <span style={{ color: '#F59E0B', fontWeight: 800 }}>⚠️</span>
                <span>{area}</span>
              </li>
            ))}
          </ul>
        </div>

      </div>

      {/* Mistake Analysis */}
      <div className="glass-card" style={{ padding: '32px', marginBottom: '32px' }}>
        <h3 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '20px' }}>
          🔍 Mistake Analysis & Smart Corrections
        </h3>

        {isEmptySpeech ? (
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '24px' }}>
            <p style={{ margin: 0, fontSize: '0.95rem', color: '#D1D5DB', fontWeight: 600 }}>
              No speech was detected.
            </p>
            <p style={{ margin: '8px 0 16px 0', fontSize: '0.9rem', color: '#9CA3AF' }}>
              You have not spoken anything in this session, so there are no mistakes to analyze.
            </p>
            <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.1)', color: '#A5B4FC', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Lightbulb size={18} />
              <span>💡 Tip: Try speaking clearly and continuously during your next session.</span>
            </div>
          </div>
        ) : mistakes.length === 0 ? (
          <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '14px', padding: '20px', color: '#9CA3AF', fontSize: '0.9rem' }}>
            No major structural mistakes detected! Keep up the clear delivery.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {mistakes.map((m, idx) => (
              <div key={idx} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '20px' }}>
                <div style={{ marginBottom: '10px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#FCA5A5', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>You Said</span>
                  <p style={{ margin: 0, fontSize: '0.95rem', color: '#FCA5A5', fontStyle: 'italic' }}>
                    "{m.original}"
                  </p>
                </div>
                <div style={{ marginBottom: '10px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#86EFAC', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Better Alternative</span>
                  <p style={{ margin: 0, fontSize: '0.95rem', color: '#86EFAC', fontWeight: 700 }}>
                    "{m.better}"
                  </p>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>Reason & Tip</span>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#D1D5DB' }}>
                    {m.reason}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <button onClick={onDashboard} className="btn-secondary" style={{ padding: '14px 28px' }}>
          Return to Dashboard
        </button>
        <button onClick={onNewSession} className="btn-primary" style={{ padding: '14px 32px' }}>
          <RefreshCw size={18} /> Practice Another Activity
        </button>
      </div>

    </div>
  );
};
