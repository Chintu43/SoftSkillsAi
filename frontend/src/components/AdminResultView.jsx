import React from 'react';
import { ArrowLeft, X, Star } from 'lucide-react';
import { ResultsPage } from '../pages/ResultsPage';

const StarRating = ({ rating }) => (
  <span style={{ display: 'inline-flex', gap: '3px' }}>
    {[1, 2, 3, 4, 5].map(n => (
      <Star
        key={n}
        size={16}
        fill={n <= rating ? '#FBBF24' : 'none'}
        stroke={n <= rating ? '#FBBF24' : '#4B5563'}
      />
    ))}
  </span>
);

/**
 * AdminResultView — Complete, authentic session evaluation report reusing ResultsPage directly,
 * with an Admin navigation bar and dedicated User Feedback display.
 */
export const AdminResultView = ({ record, onClose }) => {
  if (!record) return null;

  // Build the complete session object ensuring every single stored result field is passed
  const session = {
    ...record,
    _id: record.sessionId || record._id,
    id: record.sessionId || record.id,
    activityName: record.activityName || 'Practice Session',
    activityType: record.activityType || 'individual',
    topic: record.topic || '',
    transcript: record.transcript || '',
    finalScore: record.finalScore,
    performanceLevel: record.performanceLevel,
    scores: record.scores || null,
    criteria: Array.isArray(record.criteria) ? record.criteria : [],
    strengths: Array.isArray(record.strengths) ? record.strengths : [],
    areasToImprove: Array.isArray(record.areasToImprove) ? record.areasToImprove : [],
    positiveObservations: Array.isArray(record.positiveObservations) ? record.positiveObservations : [],
    mistakeAnalysis: record.mistakeAnalysis || null,
    mistakes: Array.isArray(record.mistakes) ? record.mistakes : [],
    wordMistakes: Array.isArray(record.wordMistakes) ? record.wordMistakes : (Array.isArray(record.wordAnalysis) ? record.wordAnalysis : []),
    sentenceAnalysis: Array.isArray(record.sentenceAnalysis) ? record.sentenceAnalysis : [],
    correctedSpeech: record.correctedSpeech || '',
    summary: record.summary || '',
    hasSpeech: record.hasSpeech !== undefined ? record.hasSpeech : true,
    speechDetected: record.speechDetected !== undefined ? record.speechDetected : true,
    pronunciationAnalysis: record.pronunciationAnalysis || '',
    fluencyDelivery: record.fluencyDelivery || '',
    topicRelevance: record.topicRelevance || '',
    mentorAdvice: Array.isArray(record.mentorAdvice) ? record.mentorAdvice : [],
    aiFeedback: record.aiFeedback || '',
    isEmptySpeech: record.isEmptySpeech || false,
    createdAt: record.sessionCreatedAt || record.createdAt,
    userFeedback: record.userFeedback || {
      rating: record.feedbackRating,
      description: record.feedbackComment,
      createdAt: record.feedbackCreatedAt
    },
    feedbackSubmitted: true // guarantees MandatoryFeedbackModal never pops up in Admin view
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      background: 'var(--bg-primary, #090d16)',
      overflowY: 'auto',
      color: 'var(--text-primary, #f3f4f6)'
    }}>
      {/* ── Sticky Top Admin Bar ── */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: 'rgba(15, 23, 42, 0.96)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        padding: '14px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(99, 102, 241, 0.15)',
              border: '1px solid rgba(99, 102, 241, 0.35)',
              color: '#A5B4FC',
              padding: '8px 16px',
              borderRadius: '10px',
              fontSize: '0.86rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.3)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.15)'}
          >
            <ArrowLeft size={16} /> Back to Dashboard
          </button>

          <div style={{ width: '1px', height: '24px', background: 'rgba(255, 255, 255, 0.15)' }} />

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{
                background: 'linear-gradient(135deg, #7C3AED, #A78BFA)',
                color: '#FFF',
                padding: '2px 8px',
                borderRadius: '6px',
                fontSize: '0.72rem',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                Admin View
              </span>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: '#F9FAFB' }}>
                Full Evaluation Report — <span style={{ color: '#A78BFA' }}>{record.userName || 'Anonymous'}</span>
              </h2>
            </div>
            <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: '#9CA3AF' }}>
              Email: <strong>{record.userEmail || 'N/A'}</strong> · Session ID: <code style={{ color: '#818CF8' }}>{record.sessionId || record._id}</code> · Date: {record.sessionCreatedAt || record.createdAt ? new Date(record.sessionCreatedAt || record.createdAt).toLocaleString() : 'N/A'}
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          title="Close Full Result View"
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            color: '#9CA3AF',
            borderRadius: '10px',
            width: '38px',
            height: '38px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s',
            flexShrink: 0
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'; e.currentTarget.style.color = '#FCA5A5'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'; e.currentTarget.style.color = '#9CA3AF'; }}
        >
          <X size={18} />
        </button>
      </div>

      {/* ── Outer Page Wrapper ── */}
      <div style={{ maxWidth: '1050px', margin: '0 auto', padding: '24px 20px 0' }}>

        {/* ── SECTION 1: USER FEEDBACK (Clearly separated & highlighted) ── */}
        <div style={{
          padding: '24px 28px',
          borderRadius: '16px',
          marginBottom: '24px',
          background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.12), rgba(245, 158, 11, 0.05))',
          border: '1px solid rgba(251, 191, 36, 0.35)',
          boxShadow: '0 8px 32px rgba(251, 191, 36, 0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '42px', height: '42px', borderRadius: '12px',
                background: 'rgba(251, 191, 36, 0.2)', border: '1px solid rgba(251, 191, 36, 0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FBBF24'
              }}>
                <Star size={22} fill="#FBBF24" />
              </div>
              <div>
                <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#FBBF24', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Submitted User Feedback
                </span>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: '2px 0 0', color: '#F9FAFB' }}>
                  User Feedback for this Specific Session
                </h3>
              </div>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              background: 'rgba(251, 191, 36, 0.15)',
              border: '1px solid rgba(251, 191, 36, 0.3)',
              padding: '6px 14px',
              borderRadius: '10px'
            }}>
              <StarRating rating={record.feedbackRating} />
              <span style={{ fontWeight: 800, color: '#FBBF24', fontSize: '0.95rem' }}>
                {record.feedbackRating !== null && record.feedbackRating !== undefined ? `${record.feedbackRating} / 5` : 'N/A'}
              </span>
            </div>
          </div>

          <div style={{ background: 'rgba(0, 0, 0, 0.25)', borderRadius: '12px', padding: '16px 20px', marginBottom: '14px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
            <p style={{ fontSize: '0.78rem', color: '#9CA3AF', margin: '0 0 6px', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>
              User's Feedback Comment:
            </p>
            <p style={{ margin: 0, fontSize: '0.95rem', color: '#E5E7EB', lineHeight: 1.6, fontStyle: record.feedbackComment ? 'normal' : 'italic' }}>
              {record.feedbackComment ? `"${record.feedbackComment}"` : 'No written comment was provided.'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', fontSize: '0.8rem', color: '#9CA3AF' }}>
            <span>👤 User: <strong style={{ color: '#E5E7EB' }}>{record.userName || 'Anonymous'}</strong></span>
            <span>✉️ Email: <strong style={{ color: '#E5E7EB' }}>{record.userEmail || 'N/A'}</strong></span>
            <span>🕒 Submitted: <strong style={{ color: '#E5E7EB' }}>{record.feedbackCreatedAt ? new Date(record.feedbackCreatedAt).toLocaleString() : 'N/A'}</strong></span>
            <span>🔗 Exact Session ID: <strong style={{ color: '#818CF8' }}>{record.sessionId || record._id}</strong></span>
          </div>
        </div>

        {/* ── Visual Section Divider ── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          margin: '28px 0 0',
          color: '#6B7280',
          fontSize: '0.82rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.08em'
        }}>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.12)' }} />
          <span>Full Stored Session Result (Exact User View)</span>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.12)' }} />
        </div>
      </div>

      {/* ── SECTION 2: Exact ResultsPage component ── */}
      <ResultsPage
        session={session}
        onDashboard={onClose}
        onNewSession={onClose}
      />
    </div>
  );
};
