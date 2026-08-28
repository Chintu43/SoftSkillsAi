import React from 'react';
import {
  Brain, Target, Rocket, Trophy, Sparkles, RefreshCw,
  Volume2, MessageSquare, BookOpen, PenTool, Lightbulb, Mic
} from 'lucide-react';

/**
 * ScoreCoaching — Add-only Score Explanation & "How to Reach 80+" Coaching component.
 * Reads existing session evaluation data to provide personalized speaking feedback.
 */
export const ScoreCoaching = ({ session, onNewSession }) => {
  if (!session) return null;

  const finalScore = session.finalScore ?? session.scores?.overall ?? 0;

  // ── 1. Determine Tier Level Feedback ────────────────────────────────────────
  let tierInfo = {
    badge: '🔴 Major Improvement Needed',
    badgeClass: 'badge-major',
    badgeColor: '#EF4444',
    badgeBg: 'rgba(239, 68, 68, 0.12)',
    badgeBorder: 'rgba(239, 68, 68, 0.3)',
    summary: 'Your current performance shows several areas that need improvement. Focus on the fundamentals first, especially fluency, grammar, pronunciation, and sentence formation.',
    whyHeading: '🧠 Why Your Score Is Low',
    tipsHeading: '🎯 How to Reach 80+'
  };

  if (finalScore >= 90) {
    tierInfo = {
      badge: '🏆 Excellent Performance',
      badgeClass: 'badge-excellent',
      badgeColor: '#A855F7',
      badgeBg: 'rgba(168, 85, 247, 0.12)',
      badgeBorder: 'rgba(168, 85, 247, 0.3)',
      summary: 'Excellent speaking performance. Continue practising to maintain consistency, natural delivery, accuracy, and executive confidence.',
      whyHeading: '🧠 Master Level Communication',
      tipsHeading: '🏆 Maintain Your Performance'
    };
  } else if (finalScore >= 80) {
    tierInfo = {
      badge: '🔵 Strong Performance',
      badgeClass: 'badge-strong',
      badgeColor: '#3B82F6',
      badgeBg: 'rgba(59, 130, 246, 0.12)',
      badgeBorder: 'rgba(59, 130, 246, 0.3)',
      summary: 'You are performing well. Focus on polishing your weaker areas and developing more natural, confident, and precise communication.',
      whyHeading: '🧠 Polish Your Delivery',
      tipsHeading: '🚀 How to Reach 90+'
    };
  } else if (finalScore >= 70) {
    tierInfo = {
      badge: '🟢 Good Performance',
      badgeClass: 'badge-good',
      badgeColor: '#10B981',
      badgeBg: 'rgba(16, 185, 129, 0.12)',
      badgeBorder: 'rgba(16, 185, 129, 0.3)',
      summary: 'You are close to the 80+ level. Focus on refining your weaker areas, improving fluency, pronunciation, sentence accuracy, and confidence.',
      whyHeading: '🧠 Refine Your Speaking Skills',
      tipsHeading: '🎯 How to Reach 80+'
    };
  } else if (finalScore >= 60) {
    tierInfo = {
      badge: '🟡 Good Start — Keep Improving',
      badgeClass: 'badge-start',
      badgeColor: '#F59E0B',
      badgeBg: 'rgba(245, 158, 11, 0.12)',
      badgeBorder: 'rgba(245, 158, 11, 0.3)',
      summary: 'You have a good foundation, but there are still areas preventing you from reaching 80+. Focus on your weakest speaking skills and practise them consistently.',
      whyHeading: '🧠 Why Your Score Is Below 70',
      tipsHeading: '🎯 How to Reach 80+'
    };
  } else if (finalScore >= 40) {
    tierInfo = {
      badge: '🟠 Significant Improvement Needed',
      badgeClass: 'badge-significant',
      badgeColor: '#F97316',
      badgeBg: 'rgba(249, 115, 22, 0.12)',
      badgeBorder: 'rgba(249, 115, 22, 0.3)',
      summary: 'You have a foundation, but several speaking skills are affecting your overall performance. Your score is not necessarily a reflection of your topic knowledge. Focus on improving your spoken English accuracy, pronunciation, fluency, and sentence formation.',
      whyHeading: '🧠 Why Your Score Is Affected',
      tipsHeading: '🎯 How to Reach 80+'
    };
  }

  // ── 2. Extract & Analyze Dimension Data (READ-ONLY) ─────────────────────────
  const dimensionAdvice = [];

  // Extract from session.criteria (primary rubric)
  if (Array.isArray(session.criteria) && session.criteria.length > 0) {
    session.criteria.forEach(c => {
      if (!c.key) return;
      const pct = c.weight > 0 ? Math.round((c.weightedScore / c.weight) * 100) : 0;
      dimensionAdvice.push({
        key: c.key,
        label: c.label || c.name || c.key,
        pct,
        rating: c.rating ?? Math.round((pct / 100) * 5),
        evidence: c.evidence,
        improvement: c.improvement
      });
    });
  }

  // Extract from session.scores (fallback flat scores)
  const scores = session.scores || {};
  const addFlatIfMissing = (key, label, val) => {
    if (typeof val === 'number' && !dimensionAdvice.some(d => d.key === key)) {
      dimensionAdvice.push({
        key,
        label,
        pct: val,
        rating: Math.round((val / 100) * 5),
        evidence: null,
        improvement: null
      });
    }
  };

  addFlatIfMissing('grammar', 'Grammar & Sentence Accuracy', scores.grammar);
  addFlatIfMissing('fluency', 'Fluency & Pacing', scores.fluency);
  addFlatIfMissing('pronunciation', 'Pronunciation & Speech Clarity', scores.pronunciation || scores.clarity);
  addFlatIfMissing('vocabulary', 'Vocabulary Variety', scores.vocabulary);
  addFlatIfMissing('topicRelevance', 'Content & Topic Relevance', scores.topicRelevance || scores.communication);
  addFlatIfMissing('confidence', 'Speaking Confidence', scores.confidence);

  // Filter weakest dimensions (score < 70 or lowest ratings)
  const sortedWeakest = dimensionAdvice
    .filter(d => d.pct !== null && d.pct !== undefined)
    .sort((a, b) => a.pct - b.pct);

  const weakestAreas = sortedWeakest.filter(d => d.pct < 75).slice(0, 3);

  // Mapping domain-specific coaching guidance
  const coachingMap = {
    pronunciation: {
      icon: <Volume2 size={20} color="#06B6D4" />,
      title: 'Pronunciation & Speech Clarity',
      whyText: 'Your pronunciation or vocal clarity appears to be one of the main factors affecting your score. Practise difficult words slowly and clearly before increasing your speaking speed.',
      tips: [
        'Practise difficult words individually before attempting whole sentences.',
        'Focus on speaking clearly rather than quickly to avoid slurring word endings.',
        'Repeat problematic words identified in the Mistake Analysis section.',
        'Use earphones with a clean microphone in a quiet environment when recording.'
      ]
    },
    fluency: {
      icon: <MessageSquare size={20} color="#8B5CF6" />,
      title: 'Fluency & Speaking Pacing',
      whyText: 'Your fluency needs improvement. Try speaking in shorter, well-formed sentences and use natural pauses instead of rushing through your ideas.',
      tips: [
        'Speak slightly slower to maintain a comfortable, consistent speaking rhythm.',
        'Avoid rushing to finish your sentence before your thought is complete.',
        'Use short sentences to maintain vocal control and accuracy.',
        'Pause naturally between major points instead of using filler sounds (uh, um).',
        'Practise speaking continuously for 1–3 minutes on familiar topics.'
      ]
    },
    grammar: {
      icon: <PenTool size={20} color="#10B981" />,
      title: 'Grammar & Sentence Accuracy',
      whyText: 'Grammar and sentence structure are affecting your overall performance. Focus on simple, correct sentence structures before attempting complex phrasing.',
      tips: [
        'Focus on simple, accurate sentence structures.',
        'Pay close attention to subject-verb agreement and correct verb tenses.',
        'Avoid incomplete or fragmented sentences when answering.',
        'Review sentence corrections provided in the Detailed Speech Analysis.'
      ]
    },
    vocabulary: {
      icon: <BookOpen size={20} color="#F59E0B" />,
      title: 'Vocabulary & Word Variety',
      whyText: 'Your vocabulary can be expanded. Try learning useful topic-specific words and use them naturally instead of repeating the same phrases.',
      tips: [
        'Learn 5–10 useful vocabulary words related to common practice topics.',
        'Avoid repeating the same descriptive word multiple times in one session.',
        'Use new vocabulary words naturally in complete, contextual sentences.'
      ]
    },
    topicRelevance: {
      icon: <Lightbulb size={20} color="#3B82F6" />,
      title: 'Content Development & Topic Relevance',
      whyText: 'Your content and topic development can be expanded further. Try using a clear structure: Introduction → Main Point → Example → Conclusion.',
      tips: [
        'Use a simple 5-step structure for your speech:\nIntroduction → Main Point → Example → Counter Point → Conclusion',
        'Elaborate on your main points with specific, real-world examples.',
        'Ensure your opening sentence directly addresses the given topic prompt.'
      ]
    },
    confidence: {
      icon: <Mic size={20} color="#EC4899" />,
      title: 'Speaking Confidence & Delivery',
      whyText: 'Your delivery and vocal confidence can be strengthened. Speak with steady projection and take brief pauses to collect your thoughts.',
      tips: [
        'Maintain a steady, confident speaking pace throughout.',
        'Avoid excessive filler words when transitioning between ideas.',
        'Take a short, silent breath when you need to gather your thoughts.',
        'Focus on communicating your core idea rather than trying to sound perfect.'
      ]
    }
  };

  const getCoachingDetails = (key, label) => {
    const k = (key || '').toLowerCase();
    if (k.includes('pronunciation') || k.includes('clarity')) return coachingMap.pronunciation;
    if (k.includes('fluency')) return coachingMap.fluency;
    if (k.includes('grammar')) return coachingMap.grammar;
    if (k.includes('vocabulary')) return coachingMap.vocabulary;
    if (k.includes('topic') || k.includes('content') || k.includes('relevance') || k.includes('communication')) return coachingMap.topicRelevance;
    if (k.includes('confidence') || k.includes('leadership')) return coachingMap.confidence;

    return {
      icon: <Brain size={20} color="#6366F1" />,
      title: label || 'Speaking Performance',
      whyText: `Your ${label?.toLowerCase() || 'speaking accuracy'} can be improved with consistent daily practice.`,
      tips: [
        `Focus on refining your ${label?.toLowerCase() || 'accuracy'} during your next practice.`,
        'Speak clearly and maintain a natural delivery pace.',
        'Review detailed AI feedback for specific sentence improvements.'
      ]
    };
  };

  return (
    <div className="glass-card" style={{ padding: '32px 36px', marginBottom: '28px', border: '1px solid var(--border-glass)' }}>
      
      {/* ── Section Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ padding: '10px', borderRadius: '12px', background: 'rgba(99, 102, 241, 0.15)', color: '#818CF8' }}>
            <Brain size={26} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              Understand Your Score
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: '2px' }}>
              Personalized speaking analysis & actionable coaching roadmap
            </p>
          </div>
        </div>

        <div style={{
          padding: '6px 16px',
          borderRadius: '20px',
          background: tierInfo.badgeBg,
          border: `1px solid ${tierInfo.badgeBorder}`,
          color: tierInfo.badgeColor,
          fontWeight: 700,
          fontSize: '0.85rem'
        }}>
          {tierInfo.badge}
        </div>
      </div>

      {/* ── Summary Box ── */}
      <div style={{
        background: 'var(--bg-input)',
        border: '1px solid var(--border-glass)',
        borderRadius: '14px',
        padding: '20px 24px',
        marginBottom: '28px'
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '8px' }}>
          <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            Why Your Score Is {finalScore}/100
          </span>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.94rem', lineHeight: 1.6, margin: 0 }}>
          {tierInfo.summary}
        </p>
      </div>

      {/* ── Personalized "Why Your Score Is Affected" Breakdown ── */}
      {weakestAreas.length > 0 && finalScore < 80 && (
        <div style={{ marginBottom: '30px' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Target size={20} color="#F59E0B" /> {tierInfo.whyHeading}
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {weakestAreas.map((area, idx) => {
              const details = getCoachingDetails(area.key, area.label);
              return (
                <div key={idx} style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-glass)',
                  borderRadius: '14px',
                  padding: '18px 22px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {details.icon}
                      <span style={{ fontWeight: 700, fontSize: '0.98rem', color: 'var(--text-primary)' }}>
                        {details.title}
                      </span>
                    </div>
                    <span style={{
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      padding: '4px 10px',
                      borderRadius: '8px',
                      background: area.pct < 50 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                      color: area.pct < 50 ? '#F87171' : '#FBBF24'
                    }}>
                      Score: {area.pct}/100 ({area.pct < 50 ? 'Needs Attention' : 'Area for Growth'})
                    </span>
                  </div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5, margin: 0 }}>
                    {area.improvement || details.whyText}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── "How to Reach 80+" / 90+ / Maintain Section ── */}
      <div style={{ marginBottom: '28px' }}>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          {finalScore >= 90 ? <Trophy size={20} color="#A855F7" /> : finalScore >= 80 ? <Rocket size={20} color="#3B82F6" /> : <Target size={20} color="#10B981" />}
          {tierInfo.tipsHeading}
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          {(weakestAreas.length > 0 ? weakestAreas : sortedWeakest.slice(0, 3)).map((area, idx) => {
            const details = getCoachingDetails(area.key, area.label);
            return (
              <div key={idx} style={{
                background: 'var(--bg-input)',
                border: '1px solid var(--border-glass)',
                borderRadius: '14px',
                padding: '20px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                  {details.icon}
                  <span style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                    {details.title} Tips
                  </span>
                </div>
                <ul style={{ margin: 0, paddingLeft: '18px', color: 'var(--text-secondary)', fontSize: '0.86rem', lineHeight: 1.6 }}>
                  {details.tips.map((tip, tIdx) => (
                    <li key={tIdx} style={{ marginBottom: '6px' }}>
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Content Structure Recommendation ── */}
      {finalScore < 80 && (
        <div style={{
          background: 'rgba(99, 102, 241, 0.06)',
          border: '1px solid rgba(99, 102, 241, 0.2)',
          borderRadius: '14px',
          padding: '20px 24px',
          marginBottom: '28px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: '#818CF8', fontWeight: 700, fontSize: '0.92rem' }}>
            <Sparkles size={18} /> Recommended Speech Formula for High Scores
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '10px' }}>
            <span style={{ padding: '4px 10px', background: 'var(--bg-input)', borderRadius: '6px', fontWeight: 600, color: 'var(--text-primary)' }}>1. Introduction</span> →
            <span style={{ padding: '4px 10px', background: 'var(--bg-input)', borderRadius: '6px', fontWeight: 600, color: 'var(--text-primary)' }}>2. Main Point</span> →
            <span style={{ padding: '4px 10px', background: 'var(--bg-input)', borderRadius: '6px', fontWeight: 600, color: 'var(--text-primary)' }}>3. Example</span> →
            <span style={{ padding: '4px 10px', background: 'var(--bg-input)', borderRadius: '6px', fontWeight: 600, color: 'var(--text-primary)' }}>4. Counter Point</span> →
            <span style={{ padding: '4px 10px', background: 'var(--bg-input)', borderRadius: '6px', fontWeight: 600, color: 'var(--text-primary)' }}>5. Conclusion</span>
          </div>
        </div>
      )}

     

    </div>
  );
};
