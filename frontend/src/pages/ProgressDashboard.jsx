import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { getSessionScore, getSessionCategoryScores, calcImprovementPct, formatImprovementPct } from '../utils/sessionScores';
import { TrendingUp, BarChart3, History } from 'lucide-react';

export const ProgressDashboard = () => {
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const data = await api.getUserSessions();
        setSessions(data);
      } catch (err) {
        console.warn('Fetch history error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  // Compute progression timeline points directly from actual user session records
  const progressionData = sessions.slice().reverse().map((s, idx) => {
    const score = getSessionScore(s);
    const catScores = getSessionCategoryScores(s);

    return {
      label: `Session ${idx + 1}`,
      activity: s.activityName,
      score: score !== null ? score : 0,
      communication: catScores.communication ?? (score !== null ? score : 0),
      confidence: catScores.confidence ?? (score !== null ? score : 0),
      fluency: catScores.fluency ?? (score !== null ? score : 0),
      grammar: catScores.grammar ?? (score !== null ? score : 0),
      date: new Date(s.createdAt).toLocaleDateString()
    };
  });

  const hasSessions = progressionData.length > 0;
  const initialScore = hasSessions ? progressionData[0].score : null;
  const currentScore = hasSessions ? progressionData[progressionData.length - 1].score : null;

  const rawImprovementPct = hasSessions && progressionData.length > 1
    ? calcImprovementPct(initialScore, currentScore)
    : (user?.improvementPercentage ?? null);

  const displayImprovementPct = formatImprovementPct(rawImprovementPct);

  // Skill matrix scores read from user object or average across sessions
  const skillMatrix = [
    { label: 'Communication Score', current: user?.communicationScore ?? (hasSessions ? currentScore : null) },
    { label: 'Confidence Score',    current: user?.confidenceScore ?? (hasSessions ? currentScore : null) },
    { label: 'Fluency Score',       current: user?.fluencyScore ?? (hasSessions ? currentScore : null) },
    { label: 'Grammar Score',       current: user?.grammarScore ?? (hasSessions ? currentScore : null) },
    { label: 'Vocabulary Score',    current: user?.vocabularyScore ?? (hasSessions ? currentScore : null) },
    { label: 'Leadership Score',    current: user?.leadershipScore ?? (hasSessions ? currentScore : null) }
  ];

  return (
    <div style={{ maxWidth: '1150px', margin: '0 auto', padding: '30px 20px' }}>
      
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '2.2rem', fontWeight: 800 }}>Progress & Growth Dashboard</h1>
        <p style={{ color: '#9CA3AF', fontSize: '1rem', marginTop: '6px' }}>
          Track your soft skills development, metric trends, and evaluation history over time.
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#9CA3AF' }}>Loading progress data...</div>
      ) : (
        <>
          {/* Highlights Banner */}
          <div className="glass-card" style={{ padding: '32px', marginBottom: '32px', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(17, 24, 39, 0.9))', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
              <div style={{ padding: '16px', borderRadius: '16px', background: 'rgba(16, 185, 129, 0.2)', color: '#34D399' }}>
                <TrendingUp size={36} />
              </div>
              <div>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#34D399', textTransform: 'uppercase' }}>Growth Highlight</span>
                <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#F3F4F6', marginTop: '4px' }}>
                  {hasSessions 
                    ? <>Your overall evaluation score trend: <span style={{ color: '#34D399' }}>{displayImprovementPct}</span></>
                    : <>No sessions recorded yet</>
                  }
                </h2>
                <p style={{ color: '#9CA3AF', fontSize: '0.92rem', marginTop: '4px' }}>
                  {hasSessions
                    ? `Based on ${progressionData.length} evaluated session run${progressionData.length > 1 ? 's' : ''}.`
                    : 'Complete your first practice session to start recording score trends over time.'}
                </p>
              </div>
            </div>
          </div>

          {/* Visual Progression Chart */}
          <div className="glass-card" style={{ padding: '32px', marginBottom: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BarChart3 size={20} color="#6366F1" /> Overall Score Progress Over Time
              </h3>
              <span style={{ fontSize: '0.85rem', color: '#9CA3AF' }}>{progressionData.length} Evaluated Runs</span>
            </div>

            {!hasSessions ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9CA3AF' }}>
                <History size={32} style={{ marginBottom: '12px', opacity: 0.5 }} />
                <p>No evaluated sessions found. Complete a practice session to view your progress chart.</p>
              </div>
            ) : (
              /* Visual Bar Chart */
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '24px', height: '220px', padding: '20px 10px 0 10px', borderBottom: '1px solid rgba(255,255,255,0.1)', overflowX: 'auto' }}>
                {progressionData.map((item, idx) => (
                  <div key={idx} style={{ flex: 1, minWidth: '70px', display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                    <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#818CF8', marginBottom: '8px' }}>
                      {item.score}
                    </span>
                    <div style={{
                      width: '100%',
                      maxWidth: '48px',
                      height: `${(item.score / 100) * 160}px`,
                      background: 'linear-gradient(180deg, #6366F1 0%, #8B5CF6 100%)',
                      borderRadius: '8px 8px 0 0',
                      transition: 'all 0.5s ease',
                      boxShadow: '0 4px 15px rgba(99, 102, 241, 0.3)'
                    }} />
                    <span style={{ fontSize: '0.78rem', color: '#9CA3AF', marginTop: '10px', fontWeight: 600 }}>
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Dimension Trend Breakdown */}
          <div className="glass-card" style={{ padding: '32px' }}>
            <h3 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '24px' }}>
              Skill Matrix Growth Trends
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
              {skillMatrix.map((skill, idx) => {
                const val = skill.current;
                const displayVal = val !== null && val !== undefined ? val : '—';

                return (
                  <div key={idx} style={{ background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ fontSize: '0.88rem', color: '#9CA3AF', fontWeight: 600 }}>{skill.label}</span>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: '10px' }}>
                      <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#F3F4F6' }}>{displayVal}</span>
                      <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#10B981', background: 'rgba(16, 185, 129, 0.15)', padding: '4px 10px', borderRadius: '8px' }}>
                        {val !== null ? 'Evaluated' : 'Pending'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

    </div>
  );
};
