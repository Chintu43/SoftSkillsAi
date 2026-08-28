import React, { useState } from 'react';
import {
  Award, CheckCircle2, AlertTriangle, MessageSquare,
  RefreshCw, BarChart2, AlertCircle, Lightbulb, Filter, Sparkles,
  MicOff, Volume2, Compass, BookOpen, UserCheck, Check, Info, FileText
} from 'lucide-react';
import { ScoreCoaching } from '../components/ScoreCoaching';

/**
 * ResultsPage — Dynamic Evidence-Grounded Speech Evaluation Report with Deep English Mentor Feedback.
 */
export const ResultsPage = ({ session, onDashboard, onNewSession }) => {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showFullTranscript, setShowFullTranscript] = useState(false);

  React.useEffect(() => {
    console.log('[PERF] ResultsPage rendered');
    if (window.__perfSubmitStart) {
      console.log(`[PERF] TOTAL: ${Date.now() - window.__perfSubmitStart} ms`);
    }
  }, []);

  if (!session) return null;

  const rawTranscript = (session.transcript || '').trim();
  const isEmptySpeech =
    session.isEmptySpeech === true ||
    session.hasSpeech === false ||
    session.speechDetected === false ||
    rawTranscript === '' ||
    (session.finalScore === 0 && rawTranscript.split(/\s+/).length <= 3);

  // ── Score ──────────────────────────────────────────────────────────────────
  const finalScore = isEmptySpeech ? 0 : (session.finalScore ?? session.scores?.overall ?? 0);

  // ── Performance level ──────────────────────────────────────────────────────
  const performanceLevel = isEmptySpeech
    ? 'Poor'
    : (session.performanceLevel || getLevel(finalScore));

  const levelColor = {
    'Exceptional': '#a855f7',
    'Excellent':   '#10b981',
    'Very Good':   '#3b82f6',
    'Good':        '#06b6d4',
    'Average':     '#f59e0b',
    'Needs Improvement': '#f97316',
    'Poor':        '#ef4444'
  }[performanceLevel] || '#9ca3af';

  // ── Strengths / Areas / Positive Observations / Mistakes ──────────────────
  const strengths            = isEmptySpeech ? [] : (session.strengths || []);
  const areasToImprove       = isEmptySpeech
    ? [
        'Make sure microphone permission is enabled in your browser settings.',
        'Speak clearly and continuously into the microphone.',
        'Check that words appear in the live transcript box before submitting.',
        'Develop your thoughts with supporting reasons and examples.'
      ]
    : (session.areasToImprove || []);

  const positiveObservations = isEmptySpeech ? [] : (session.positiveObservations || []);
  const wordMistakes         = isEmptySpeech ? [] : (session.wordMistakes || session.wordAnalysis || []);

  // ── Authoritative Mistake Source: session.mistakeAnalysis.issues ──────────
  // ONE source of truth. Do not merge with mistakes[], sentenceAnalysis[], or wordMistakes[].
  // Those fields may still be used by their own sections but do NOT affect the issue count here.
  const rawMistakeData = isEmptySpeech ? null : (session.mistakeAnalysis || null);

  let status = 'success';
  let analysisErrorMessage = null;
  let mistakeAnalysis = [];

  if (isEmptySpeech) {
    status = 'no_speech';
  } else if (session?.aiAnalysisAvailable === false || rawMistakeData?.status === 'error') {
    status = 'error';
    analysisErrorMessage = session?.analysisError || rawMistakeData?.errorMessage || 'AI evaluation unavailable. Please try again.';
  } else if (rawMistakeData && typeof rawMistakeData === 'object' && !Array.isArray(rawMistakeData)) {
    // Structured object format: { status, issueCount, issues: [...], errorMessage }
    status = rawMistakeData.status || 'success';
    analysisErrorMessage = rawMistakeData.errorMessage || null;
    const rawIssues = Array.isArray(rawMistakeData.issues) ? rawMistakeData.issues : [];
    mistakeAnalysis = rawIssues.filter(m => m && (m.youSaid || m.original || m.correction));
  } else if (Array.isArray(rawMistakeData)) {
    // Legacy flat array (older sessions)
    status = 'success';
    mistakeAnalysis = rawMistakeData.filter(m => m && (m.youSaid || m.original || m.correction));
  }

  // Fallback: if mistakeAnalysis.issues is empty but session.mistakes has data, use it
  if (!isEmptySpeech && status === 'success' && mistakeAnalysis.length === 0 && Array.isArray(session?.mistakes) && session.mistakes.length > 0) {
    mistakeAnalysis = session.mistakes.filter(m => m && (m.youSaid || m.original || m.correction));
  }

  console.log("RESULT SESSION:", session);
  console.log("MISTAKE ANALYSIS:", session?.mistakeAnalysis);
  console.log("NORMALIZED MISTAKES:", mistakeAnalysis);

  // Extract unique categories for filter pills
  const categoriesMap = {};
  mistakeAnalysis.forEach(m => {
    const cat = m.category || 'Grammar';
    categoriesMap[cat] = (categoriesMap[cat] || 0) + 1;
  });

  const categoryList = ['All', ...Object.keys(categoriesMap)];

  const filteredMistakes = selectedCategory === 'All'
    ? mistakeAnalysis
    : mistakeAnalysis.filter(m => (m.category || 'Grammar') === selectedCategory);

  // Dimension breakdown criteria
  const hasCriteria = Array.isArray(session.criteria) && session.criteria.length > 0;

  const PALETTE = [
    '#6366F1','#8B5CF6','#06B6D4','#10B981',
    '#F59E0B','#EC4899','#3B82F6','#84CC16',
    '#14B8A6','#F97316','#A855F7','#EF4444'
  ];

  return (
    <div style={{ maxWidth: '1050px', margin: '0 auto', padding: '30px 20px 60px' }}>

      {/* ── Header ── */}
      <div style={{ textAlign: 'center', marginBottom: '36px' }}>
        <div style={{
          width: '64px', height: '64px', borderRadius: '20px',
          background: isEmptySpeech
            ? 'linear-gradient(135deg, #F59E0B, #EF4444)'
            : 'linear-gradient(135deg, #6366F1, #8B5CF6)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', marginBottom: '16px',
          boxShadow: isEmptySpeech ? '0 8px 30px rgba(239,68,68,0.35)' : '0 8px 30px rgba(99,102,241,0.4)'
        }}>
          {isEmptySpeech ? <MicOff size={34} /> : <Award size={36} />}
        </div>
        <h1 style={{ fontSize: '2.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>
          {isEmptySpeech ? '⚠️ No Speech Detected' : '🏆 Session Complete'}
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1rem', marginTop: '6px' }}>
          Evaluation Report for <strong style={{ color: 'var(--text-primary)' }}>{session.activityName}</strong>
          {session.topic && <> · Topic: <em>{session.topic}</em></>}
        </p>
      </div>

      {/* ── Overall Score Card ── */}
      <div className="glass-card" style={{ padding: '40px', marginBottom: '28px', textAlign: 'center' }}>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {session.activityName} Performance Score
        </span>
        <div style={{ fontSize: '5rem', fontWeight: 800, color: isEmptySpeech ? 'var(--text-dim)' : '#818CF8', margin: '10px 0', lineHeight: 1 }}>
          {finalScore}<span style={{ fontSize: '1.8rem', color: 'var(--text-muted)' }}>/100</span>
        </div>

        <div style={{
          display: 'inline-block',
          padding: '6px 20px',
          borderRadius: '9999px',
          background: `${levelColor}22`,
          border: `1px solid ${levelColor}55`,
          color: levelColor,
          fontWeight: 800,
          fontSize: '1rem',
          marginBottom: '18px',
          letterSpacing: '0.04em'
        }}>
          {performanceLevel}
        </div>

        {isEmptySpeech ? (
          <div style={{ marginTop: '6px', padding: '18px 24px', borderRadius: '14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', maxWidth: '650px', margin: '0 auto' }}>
            <p style={{ color: '#F87171', fontWeight: 700, fontSize: '1rem', margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <AlertTriangle size={18} /> No meaningful speech was recorded during this session.
            </p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '8px', lineHeight: 1.5 }}>
              Soft skills evaluation requires audible, spoken speech. Please ensure your microphone is unmuted and speak clearly on the given topic.
            </p>
          </div>
        ) : (
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: '640px', margin: '0 auto', lineHeight: 1.6 }}>
            {session.aiFeedback || 'Speech successfully analyzed by Gemini AI mentor.'}
          </p>
        )}
      </div>

      {/* ── Score Explanation & 80+ Coaching Section ── */}
      {!isEmptySpeech && (
        <ScoreCoaching
          session={session}
          onNewSession={onNewSession}
        />
      )}

      {/* ── Speech Summary & Transcript Box (if speech exists) ── */}
      {!isEmptySpeech && rawTranscript && (
        <div className="glass-card" style={{ padding: '24px 32px', marginBottom: '28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BookOpen size={18} color="#6366F1" /> Spoken Speech Transcript
            </h3>
            <button
              onClick={() => setShowFullTranscript(!showFullTranscript)}
              style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}
            >
              {showFullTranscript ? 'Collapse Transcript ▲' : 'Expand Full Transcript ▼'}
            </button>
          </div>

          {session.summary && (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', marginBottom: '12px', fontStyle: 'italic', lineHeight: 1.5 }}>
              "{session.summary}"
            </p>
          )}

          <div style={{
            background: 'var(--bg-input)',
            border: '1px solid var(--border-glass)',
            borderRadius: '12px',
            padding: '16px 20px',
            maxHeight: showFullTranscript ? '400px' : '100px',
            overflowY: 'auto',
            fontSize: '0.9rem',
            color: 'var(--text-primary)',
            lineHeight: 1.6,
            transition: 'max-height 0.3s ease'
          }}>
            {rawTranscript}
          </div>
        </div>
      )}

      {/* ── Dimension Performance Breakdown ── */}
      <div className="glass-card" style={{ padding: '32px', marginBottom: '28px' }}>
        <h3 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
          <BarChart2 size={20} color="#6366F1" /> Dimension Performance Breakdown
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '24px' }}>
          {hasCriteria
            ? `Activity-specific rubric — ${session.activityName}. Score = (rating/5) × criterion weight.`
            : 'Evaluated dimensions for this session.'}
        </p>

        {hasCriteria ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {session.criteria.map((c, idx) => {
              const color = PALETTE[idx % PALETTE.length];
              const pct = c.weight > 0 ? Math.round((c.weightedScore / c.weight) * 100) : 0;
              return (
                <div key={c.key || idx} style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-glass)',
                  borderRadius: '14px',
                  padding: '16px 20px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: color, flexShrink: 0 }} />
                      <span style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)' }}>{c.label}</span>
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)', fontWeight: 500 }}>
                        (weight: {c.weight})
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                        Rating: <strong style={{ color: c.rating > 0 ? color : 'var(--text-dim)' }}>{c.rating}/5</strong>
                      </span>
                      <span style={{
                        fontSize: '1rem', fontWeight: 800,
                        color: c.weightedScore > 0 ? color : 'var(--text-dim)'
                      }}>
                        {c.weightedScore}/{c.weight}
                      </span>
                    </div>
                  </div>

                  <div style={{ width: '100%', height: '7px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden', marginBottom: '10px' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '4px', transition: 'width 0.8s ease' }} />
                  </div>

                  {c.evidence && c.evidence !== 'No speech was detected in this session.' && (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0', lineHeight: 1.5 }}>
                      <strong style={{ color: 'var(--text-secondary)' }}>Evidence:</strong> {c.evidence}
                    </p>
                  )}
                  {c.improvement && (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', margin: '3px 0 0', lineHeight: 1.5 }}>
                      <strong style={{ color: 'var(--text-muted)' }}>Improvement:</strong> {c.improvement}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))', gap: '14px' }}>
            {buildLegacyMetrics(session.scores || {}, isEmptySpeech).map((m, idx) => (
              <div key={idx} style={{ background: 'var(--bg-input)', padding: '14px 18px', borderRadius: '12px', border: '1px solid var(--border-glass)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{m.label}</span>
                  <span style={{ fontWeight: 800, color: m.score > 0 ? m.color : 'var(--text-dim)' }}>{m.score}</span>
                </div>
                <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${m.score}%`, height: '100%', background: m.color, borderRadius: '3px' }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Strengths & Areas to Improve ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px,1fr))', gap: '24px', marginBottom: '28px' }}>
        <div className="glass-card" style={{ padding: '28px', borderTop: '4px solid #10B981' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#34D399', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={20} color="#10B981" /> Your Strengths
          </h3>
          {strengths.length === 0 ? (
            <span style={{ fontSize: '0.88rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>
              {isEmptySpeech
                ? 'None — there was not enough speech to evaluate strengths.'
                : 'No major strengths recorded — speak for longer to demonstrate communication skills.'}
            </span>
          ) : (
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {strengths.map((str, idx) => (
                <li key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                  <span style={{ color: '#10B981', fontWeight: 800, flexShrink: 0 }}>✔</span>
                  <span>{str}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="glass-card" style={{ padding: '28px', borderTop: '4px solid #F59E0B' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#FBBF24', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={20} color="#F59E0B" /> Areas to Improve
          </h3>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {areasToImprove.map((area, idx) => (
              <li key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                <span style={{ color: '#F59E0B', fontWeight: 800, flexShrink: 0 }}>⚠</span>
                <span>{area}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ── 🔍 MISTAKE ANALYSIS & SMART CORRECTIONS ── */}
      <div className="glass-card" style={{ padding: '32px', marginBottom: '32px' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h3 style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              🔍 Mistake Analysis &amp; Smart Corrections
            </h3>
            {status === 'no_speech' && (
              <span style={{
                padding: '3px 10px',
                borderRadius: '9999px',
                background: 'rgba(245,158,11,0.18)',
                border: '1px solid rgba(245,158,11,0.4)',
                color: '#FCD34D',
                fontSize: '0.78rem',
                fontWeight: 700
              }}>
                No Speech Detected
              </span>
            )}
            {status === 'error' && (
              <span style={{
                padding: '3px 10px',
                borderRadius: '9999px',
                background: 'rgba(239,68,68,0.18)',
                border: '1px solid rgba(239,68,68,0.4)',
                color: '#FCA5A5',
                fontSize: '0.78rem',
                fontWeight: 700
              }}>
                Analysis Incomplete
              </span>
            )}
            {status === 'success' && mistakeAnalysis.length > 0 && (
              <span style={{
                padding: '3px 10px',
                borderRadius: '9999px',
                background: 'rgba(239,68,68,0.18)',
                border: '1px solid rgba(239,68,68,0.4)',
                color: '#FCA5A5',
                fontSize: '0.78rem',
                fontWeight: 700
              }}>
                {mistakeAnalysis.length} {mistakeAnalysis.length === 1 ? 'Issue' : 'Issues'} Detected
              </span>
            )}
            {status === 'success' && mistakeAnalysis.length === 0 && (
              <span style={{
                padding: '3px 10px',
                borderRadius: '9999px',
                background: 'rgba(16,185,129,0.18)',
                border: '1px solid rgba(16,185,129,0.4)',
                color: '#34D399',
                fontSize: '0.78rem',
                fontWeight: 700
              }}>
                0 Issues Detected
              </span>
            )}
          </div>
        </div>

        {status === 'no_speech' ? (
          <div style={{ background: 'var(--bg-input)', border: '1px solid var(--border-glass)', borderRadius: '14px', padding: '24px' }}>
            <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              No speech available for analysis.
            </p>
            <p style={{ margin: '8px 0 16px', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
              No usable speech was detected, so a meaningful English evaluation could not be performed.
            </p>
            <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(99,102,241,0.08)', color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Lightbulb size={16} />
              <span>Tip: Speak continuously into your microphone for at least 1-2 minutes during your next practice session.</span>
            </div>
          </div>
        ) : status === 'error' ? (
          <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.3)', borderLeft: '4px solid #EF4444', borderRadius: '14px', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#EF4444', fontWeight: 700, fontSize: '1.05rem', marginBottom: '8px' }}>
              <Info size={22} />
              <span>Speech Analysis Incomplete</span>
            </div>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>
              {analysisErrorMessage || 'Speech analysis could not be completed. Please try analyzing the session again.'}
            </p>
          </div>
        ) : mistakeAnalysis.length > 0 ? (
          <div>
            {/* Category Filter Pills */}
            {categoryList.length > 2 && (
              <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '12px', marginBottom: '20px' }}>
                {categoryList.map(cat => {
                  const isSel = selectedCategory === cat;
                  const count = cat === 'All' ? mistakeAnalysis.length : categoriesMap[cat];
                  return (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '20px',
                        border: isSel ? '1px solid #6366F1' : '1px solid var(--border-glass)',
                        background: isSel ? 'rgba(99,102,241,0.22)' : 'var(--bg-input)',
                        color: isSel ? '#A5B4FC' : 'var(--text-muted)',
                        fontWeight: isSel ? 700 : 500,
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        transition: 'all 0.18s ease'
                      }}
                    >
                      {cat} ({count})
                    </button>
                  );
                })}
              </div>
            )}

            {/* List of Mistake Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {filteredMistakes.map((m, idx) => {
                const categoryColor = getCategoryColor(m.category || 'Grammar');

                return (
                  <div
                    key={idx}
                    style={{
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-glass)',
                      borderLeft: `4px solid ${categoryColor}`,
                      borderRadius: '14px',
                      padding: '20px'
                    }}
                  >
                    {/* Category & Error Type Pill */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          padding: '3px 10px',
                          borderRadius: '6px',
                          background: `${categoryColor}22`,
                          border: `1px solid ${categoryColor}44`,
                          color: categoryColor,
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em'
                        }}>
                          {m.category || 'Grammar'}
                        </span>
                        {m.errorType && (
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            background: 'rgba(99,102,241,0.15)',
                            color: '#A5B4FC'
                          }}>
                            {m.errorType}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Original vs Correction Row */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                      <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px', padding: '12px' }}>
                        <span style={{ fontSize: '0.72rem', color: '#F87171', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                          ❌ Original / Spoken
                        </span>
                        <span style={{ fontSize: '0.92rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                          "{m.original || m.youSaid}"
                        </span>
                      </div>

                      {m.correction && (
                        <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '10px', padding: '12px' }}>
                          <span style={{ fontSize: '0.72rem', color: '#34D399', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                            ✅ Corrected Version
                          </span>
                          <span style={{ fontSize: '0.92rem', color: '#34D399', fontWeight: 700 }}>
                            "{m.correction}"
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Explanation */}
                    {m.explanation && (
                      <p style={{ margin: '0 0 6px', fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                        💡 <strong>Why:</strong> {m.explanation}
                      </p>
                    )}

                    {/* Improvement */}
                    {m.improvement && (
                      <p style={{ margin: 0, fontSize: '0.84rem', color: '#A5B4FC', lineHeight: 1.5, fontWeight: 600 }}>
                        🚀 <strong>Improve:</strong> {m.improvement}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Sustained clean speech state */
          <div style={{ background: 'var(--bg-input)', border: '1px solid var(--border-glass)', borderRadius: '16px', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#34D399', fontWeight: 700, fontSize: '1.05rem', marginBottom: '12px' }}>
              <CheckCircle2 size={22} />
              <span>No significant grammar, word-usage, or sentence-formation mistakes were detected in the analyzed speech.</span>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '16px', lineHeight: 1.5 }}>
              Your speech demonstrated good grammatical control and sentence formation across sustained spoken content.
            </p>

            {positiveObservations.length > 0 && (
              <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '12px', padding: '16px' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#34D399', textTransform: 'uppercase', display: 'block', marginBottom: '8px', letterSpacing: '0.04em' }}>
                  🌟 Demonstrated Language Strengths
                </span>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {positiveObservations.map((obs, idx) => (
                    <li key={idx} style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: '#34D399', fontWeight: 800 }}>✔</span>
                      <span>{obs}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── 📝 Word-Level Corrections Table / Cards (if word errors exist) ── */}
      {!isEmptySpeech && wordMistakes.length > 0 && (
        <div className="glass-card" style={{ padding: '28px', marginBottom: '32px' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={20} color="#06B6D4" /> 📝 Word-by-Word Analysis &amp; Corrections
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
            {wordMistakes.map((wm, idx) => (
              <div key={idx} style={{ background: 'var(--bg-input)', border: '1px solid var(--border-glass)', borderRadius: '12px', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ color: '#F87171', fontWeight: 700, fontSize: '0.88rem' }}>
                    ❌ "{wm.spokenWord}"
                  </span>
                  <span style={{ color: '#34D399', fontWeight: 800, fontSize: '0.88rem' }}>
                    ➜ "{wm.betterWord}"
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                  {wm.explanation || wm.problem}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Pronunciation & Delivery Analysis ── */}
      {!isEmptySpeech && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginBottom: '32px' }}>
          <div className="glass-card" style={{ padding: '24px' }}>
            <h4 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 12px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Volume2 size={18} color="#8B5CF6" /> Pronunciation Observation
            </h4>
            <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {session.pronunciationAnalysis || 'Pronunciation requires audio-level analysis. The current speech transcript can evaluate language usage, but it cannot reliably determine exact pronunciation.'}
            </p>
          </div>

          <div className="glass-card" style={{ padding: '24px' }}>
            <h4 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 12px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Compass size={18} color="#06B6D4" /> Fluency &amp; Topic Alignment
            </h4>
            <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              <strong>Fluency:</strong> {session.fluencyDelivery || 'Speech delivery was captured and assessed.'}
            </p>
            {session.topicRelevance && (
              <p style={{ margin: '8px 0 0', fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                <strong>Topic Relevance:</strong> {session.topicRelevance}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── 🔍 Detailed Speech Analysis Collapsible Section ── */}
      {!isEmptySpeech && (
        <details className="glass-card" style={{ padding: '24px', marginBottom: '32px', cursor: 'pointer' }} open>
          <summary style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', listStyle: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <BookOpen size={22} color="#8B5CF6" /> 🔍 Detailed Speech Analysis
            </span>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600, background: 'var(--bg-input)', padding: '4px 12px', borderRadius: '9999px' }}>
              Click to Expand / Collapse
            </span>
          </summary>

          <div style={{ marginTop: '24px', cursor: 'default' }}>
            {/* 1. Spoken Speech Transcript */}
            <div style={{ marginBottom: '24px', background: 'var(--bg-input)', borderRadius: '12px', padding: '16px', border: '1px solid var(--border-glass)' }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 8px' }}>
                1. Spoken Speech Transcript
              </h4>
              <p style={{ margin: 0, fontSize: '0.92rem', color: 'var(--text-primary)', lineHeight: 1.6, fontStyle: 'italic' }}>
                "{rawTranscript}"
              </p>
            </div>

            {/* 2. Full Corrected Speech */}
            {session.correctedSpeech && (
              <div style={{ marginBottom: '24px', background: 'rgba(16,185,129,0.06)', borderRadius: '12px', padding: '18px', border: '1px solid rgba(16,185,129,0.25)' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#10B981', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCircle2 size={18} /> 2. Complete Corrected Speech
                </h4>
                <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-primary)', lineHeight: 1.6 }}>
                  {session.correctedSpeech}
                </p>
              </div>
            )}

            {/* 3. Sentence-by-Sentence Analysis */}
            {Array.isArray(session.sentenceAnalysis) && session.sentenceAnalysis.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <h4 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <MessageSquare size={18} color="#6366F1" /> 3. Sentence-by-Sentence Analysis
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {session.sentenceAnalysis.map((sa, idx) => (
                    <div key={idx} style={{
                      background: sa.isCorrect ? 'rgba(16,185,129,0.04)' : 'rgba(239,68,68,0.04)',
                      border: `1px solid ${sa.isCorrect ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
                      borderRadius: '12px', padding: '16px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                          Sentence {sa.sentenceIndex || idx + 1}
                        </span>
                        <span style={{
                          padding: '2px 10px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 700,
                          background: sa.isCorrect ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                          color: sa.isCorrect ? '#10B981' : '#EF4444'
                        }}>
                          {sa.isCorrect ? '✓ Grammatically Correct' : '❌ Needs Correction'}
                        </span>
                      </div>

                      <p style={{ margin: '0 0 8px', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                        <strong>Original:</strong> "{sa.original}"
                      </p>

                      {!sa.isCorrect && sa.correctedSentence && (
                        <p style={{ margin: '0 0 8px', fontSize: '0.9rem', color: '#10B981', fontWeight: 600 }}>
                          <strong>Corrected:</strong> "{sa.correctedSentence}"
                        </p>
                      )}

                      {Array.isArray(sa.errors) && sa.errors.length > 0 && (
                        <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {sa.errors.map((e, eIdx) => (
                            <div key={eIdx} style={{ background: 'var(--bg-input)', padding: '8px 12px', borderRadius: '8px', fontSize: '0.82rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                                <span style={{
                                  padding: '1px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 800, color: 'white',
                                  background: e.severity === 'major' ? '#EF4444' : e.severity === 'minor' ? '#F59E0B' : '#F97316'
                                }}>
                                  {e.severity === 'major' ? '🔴 MAJOR' : e.severity === 'minor' ? '🟡 MINOR' : '🟠 MODERATE'}
                                </span>
                                <strong style={{ color: '#F87171' }}>"{e.youSaid}"</strong>
                                <span style={{ color: 'var(--text-muted)' }}>➜</span>
                                <strong style={{ color: '#34D399' }}>"{e.correction}"</strong>
                              </div>
                              <p style={{ margin: 0, color: 'var(--text-muted)' }}>{e.explanation}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {sa.improvementTip && (
                        <p style={{ margin: '8px 0 0', fontSize: '0.8rem', color: '#A5B4FC', fontStyle: 'italic' }}>
                          💡 <strong>Tip:</strong> {sa.improvementTip}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </details>
      )}

      {/* ── Smart Mentor Advice ── */}
      {!isEmptySpeech && Array.isArray(session.mentorAdvice) && session.mentorAdvice.length > 0 && (
        <div className="glass-card" style={{ padding: '28px', marginBottom: '32px', borderTop: '4px solid #6366F1' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <UserCheck size={20} color="#6366F1" /> 🧠 Smart Communication Mentor Advice
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
            {session.mentorAdvice.map((adv, idx) => (
              <div key={idx} style={{ background: 'var(--bg-input)', border: '1px solid var(--border-glass)', padding: '14px 18px', borderRadius: '12px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(99,102,241,0.2)', color: 'var(--primary)', fontWeight: 800, fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' }}>
                  {idx + 1}
                </span>
                <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                  {adv}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Actions ── */}
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

// ── Helpers ─────────────────────────────────────────────────────────────────

function getLevel(score) {
  if (score >= 90) return 'Exceptional';
  if (score >= 80) return 'Excellent';
  if (score >= 70) return 'Very Good';
  if (score >= 60) return 'Good';
  if (score >= 50) return 'Average';
  if (score >= 40) return 'Needs Improvement';
  return 'Poor';
}

function getCategoryColor(category) {
  switch (category) {
    case 'Tense': return '#EF4444';
    case 'Subject-Verb Agreement': return '#F59E0B';
    case 'Prepositions': return '#3B82F6';
    case 'Articles': return '#8B5CF6';
    case 'Word Usage': return '#EC4899';
    case 'Sentence Structure': return '#06B6D4';
    case 'Word Formation': return '#14B8A6';
    case 'Natural Expression': return '#10B981';
    default: return '#6366F1';
  }
}

const LEGACY_METRICS = [
  { key: 'communication',  label: 'Communication',  color: '#6366F1' },
  { key: 'fluency',        label: 'Fluency',        color: '#8B5CF6' },
  { key: 'confidence',     label: 'Confidence',     color: '#06B6D4' },
  { key: 'grammar',        label: 'Grammar',        color: '#10B981' },
  { key: 'vocabulary',     label: 'Vocabulary',     color: '#F59E0B' },
  { key: 'topicRelevance', label: 'Topic Relevance',color: '#3B82F6' },
  { key: 'professionalism',label: 'Professionalism',color: '#EC4899' },
];

function buildLegacyMetrics(scores, isEmpty) {
  return LEGACY_METRICS.map((m) => ({
    ...m,
    score: isEmpty ? 0 : (scores[m.key] || 0)
  }));
}
