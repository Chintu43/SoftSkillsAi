import React, { useState } from 'react';
import {
  Award, CheckCircle2, AlertTriangle, MessageSquare,
  RefreshCw, BarChart2, AlertCircle, Lightbulb, Filter, Sparkles
} from 'lucide-react';

/**
 * ResultsPage — shows activity-specific criterion breakdown & detailed sentence-by-sentence mistake analysis.
 */
export const ResultsPage = ({ session, onDashboard, onNewSession }) => {
  const [selectedCategory, setSelectedCategory] = useState('All');

  if (!session) return null;

  const rawTranscript = (session.transcript || '').trim();
  const isEmptySpeech = session.isEmptySpeech || rawTranscript === '';

  // ── Score ──────────────────────────────────────────────────────────────────
  const finalScore = isEmptySpeech ? 0 : (session.finalScore ?? session.scores?.overall ?? 0);

  // ── Performance level ──────────────────────────────────────────────────────
  const performanceLevel = isEmptySpeech
    ? 'Poor'
    : session.performanceLevel || getLevel(finalScore);

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
    ? ['Speak clearly during the session so your soft skills can be evaluated.']
    : (session.areasToImprove || []);
  const positiveObservations = isEmptySpeech ? [] : (session.positiveObservations || []);
  const rawMistakes          = isEmptySpeech ? [] : (session.mistakeAnalysis || session.mistakes || []);

  // Filter out invalid mistake objects
  const mistakeAnalysis = rawMistakes.filter(m => m && (m.youSaid || m.original || m.correction));

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
          boxShadow: '0 8px 30px rgba(99,102,241,0.4)'
        }}>
          {isEmptySpeech ? <AlertTriangle size={36} /> : <Award size={36} />}
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
          {session.activityName} Score
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
          <div style={{ marginTop: '4px', padding: '16px', borderRadius: '14px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' }}>
            <p style={{ color: '#FCD34D', fontWeight: 700, margin: 0 }}>
              You did not speak during this session.
            </p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '6px', margin: '6px 0 0' }}>
              There is not enough evidence to evaluate your soft skills. Please complete a full session with meaningful speech.
            </p>
          </div>
        ) : (
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: '620px', margin: '0 auto' }}>
            {session.aiFeedback || 'Good effort! Your speech was evaluated using Gemini AI.'}
          </p>
        )}
      </div>

      {/* ── Dimension Breakdown ── */}
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

      {/* ── Strengths & Areas ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px,1fr))', gap: '24px', marginBottom: '28px' }}>
        <div className="glass-card" style={{ padding: '28px', borderTop: '4px solid #10B981' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#34D399', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={20} color="#10B981" /> Your Strengths
          </h3>
          {strengths.length === 0 ? (
            <span style={{ fontSize: '0.88rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>
              No strengths recorded — complete a full session to receive strength feedback.
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

      {/* ── MISTAKE ANALYSIS & SMART CORRECTIONS ── */}
      <div className="glass-card" style={{ padding: '32px', marginBottom: '32px' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h3 style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              🔍 Mistake Analysis &amp; Smart Corrections
            </h3>
            {mistakeAnalysis.length > 0 && (
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
            {!isEmptySpeech && mistakeAnalysis.length === 0 && (
              <span style={{
                padding: '3px 10px',
                borderRadius: '9999px',
                background: 'rgba(16,185,129,0.18)',
                border: '1px solid rgba(16,185,129,0.4)',
                color: '#34D399',
                fontSize: '0.78rem',
                fontWeight: 700
              }}>
                Speech is Clear
              </span>
            )}
          </div>
        </div>

        {isEmptySpeech ? (
          <div style={{ background: 'var(--bg-input)', border: '1px solid var(--border-glass)', borderRadius: '14px', padding: '24px' }}>
            <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              No speech was detected.
            </p>
            <p style={{ margin: '8px 0 16px', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
              There is no spoken response available for mistake analysis.
            </p>
            <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(99,102,241,0.08)', color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Lightbulb size={16} />
              <span>Tip: Speak clearly and continuously during your next session.</span>
            </div>
          </div>
        ) : mistakeAnalysis.length === 0 ? (
          /* Clean speech state */
          <div style={{ background: 'var(--bg-input)', border: '1px solid var(--border-glass)', borderRadius: '16px', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#34D399', fontWeight: 700, fontSize: '1.05rem', marginBottom: '12px' }}>
              <CheckCircle2 size={22} />
              <span>No significant grammar or word-usage mistakes were detected in the available speech.</span>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '16px', lineHeight: 1.5 }}>
              Your speech transcript demonstrated good language control and clear expression.
            </p>

            <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '12px', padding: '16px' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#34D399', textTransform: 'uppercase', display: 'block', marginBottom: '8px', letterSpacing: '0.04em' }}>
                🌟 Positive Language Observations
              </span>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {(positiveObservations.length > 0 ? positiveObservations : [
                  'Good sentence construction and natural phrasing',
                  'Correct verb tense usage throughout your speech',
                  'Appropriate word selection and clear subject-verb agreement'
                ]).map((obs, idx) => (
                  <li key={idx} style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: '#34D399', fontWeight: 800 }}>✔</span>
                    <span>{obs}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
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
                const isStyleOnly = m.isStyleOnly === true;

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
                    {/* Header Row: Category Badge + Error Type Pill */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          padding: '3px 10px',
                          borderRadius: '6px',
                          background: `${categoryColor}22`,
                          border: `1px solid ${categoryColor}44`,
                          color: categoryColor,
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em'
                        }}>
                          {m.category || 'Grammar'}
                        </span>

                        {m.errorType && (
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                            • {m.errorType}
                          </span>
                        )}
                      </div>

                      {isStyleOnly && (
                        <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(59,130,246,0.15)', color: '#60A5FA', fontWeight: 600 }}>
                          Optional Style Suggestion
                        </span>
                      )}
                    </div>

                    {/* Original sentence/phrase */}
                    {(m.original || m.youSaid) && (
                      <div style={{ marginBottom: '10px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', padding: '10px 14px', borderRadius: '10px' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#FCA5A5', textTransform: 'uppercase', display: 'block', marginBottom: '2px', letterSpacing: '0.04em' }}>
                          ❌ Original Speech
                        </span>
                        <p style={{ margin: 0, fontSize: '0.92rem', color: '#FCA5A5', fontWeight: 600 }}>
                          "{m.original || m.youSaid}"
                        </p>
                      </div>
                    )}

                    {/* Correction */}
                    {m.correction && (
                      <div style={{ marginBottom: '10px', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', padding: '10px 14px', borderRadius: '10px' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#86EFAC', textTransform: 'uppercase', display: 'block', marginBottom: '2px', letterSpacing: '0.04em' }}>
                          ✅ Correction
                        </span>
                        <p style={{ margin: 0, fontSize: '0.92rem', color: '#86EFAC', fontWeight: 700 }}>
                          "{m.correction}"
                        </p>
                      </div>
                    )}

                    {/* Explanation */}
                    {m.explanation && (
                      <div style={{ marginTop: '8px' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '2px', letterSpacing: '0.04em' }}>
                          💡 Explanation &amp; Rule
                        </span>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                          {m.explanation}
                        </p>
                      </div>
                    )}

                    {/* Better Alternative (if different from correction) */}
                    {m.betterAlternative && m.betterAlternative !== m.correction && (
                      <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed var(--border-glass)' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#A5B4FC', textTransform: 'uppercase', display: 'block', marginBottom: '2px', letterSpacing: '0.04em' }}>
                          🌟 Natural Alternative
                        </span>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                          "{m.betterAlternative}"
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

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
