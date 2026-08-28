import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { getSessionScore } from '../utils/sessionScores';
import { History, Calendar, Clock, Eye } from 'lucide-react';

export const ActivityHistory = ({ onViewSession }) => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const data = await api.getUserSessions();
        setSessions(data);
      } catch (err) {
        console.warn('Fetch history notice:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSessions();
  }, []);

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '30px 20px' }}>
      
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '2.2rem', fontWeight: 800 }}>Activity History</h1>
        <p style={{ color: '#9CA3AF', fontSize: '1rem', marginTop: '6px' }}>
          Review all your previous solo and group evaluation runs, scores, and AI feedback.
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#9CA3AF' }}>Loading session history...</div>
      ) : sessions.length === 0 ? (
        <div className="glass-card" style={{ padding: '60px 20px', textAlign: 'center' }}>
          <div style={{ padding: '16px', borderRadius: '50%', background: 'rgba(99, 102, 241, 0.15)', color: '#818CF8', display: 'inline-flex', marginBottom: '16px' }}>
            <History size={32} />
          </div>
          <h3 style={{ fontSize: '1.4rem', fontWeight: 800 }}>No Sessions Recorded Yet</h3>
          <p style={{ color: '#9CA3AF', marginTop: '8px', maxWidth: '440px', margin: '8px auto 0 auto' }}>
            Start practicing in Individual or Group mode to generate your first AI evaluation report.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {sessions.map((sess) => {
            // Use the authoritative score from the session.
            // 0 is a real, valid score — do NOT fall back to any default number.
            const score = getSessionScore(sess);
            const displayScore = score !== null ? score : '—';
            const mainStrength = sess.strengths?.[0] || 'Clear topic focus';
            const mainImprovement = sess.areasToImprove?.[0] || 'Reduce filler words';

            return (
              <div 
                key={sess._id} 
                className="glass-card glass-card-interactive" 
                style={{ padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px' }}
                onClick={() => onViewSession(sess)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ width: '50px', height: '50px', borderRadius: '14px', background: 'rgba(99, 102, 241, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818CF8', fontWeight: 800, fontSize: '1.2rem' }}>
                    {displayScore}
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#F3F4F6' }}>
                      {sess.activityName}
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '0.82rem', color: '#9CA3AF', marginTop: '4px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Calendar size={14} /> {new Date(sess.createdAt).toLocaleDateString()}
                      </span>
                      <span style={{ textTransform: 'capitalize', color: sess.activityType === 'group' ? '#C084FC' : '#38BDF8', fontWeight: 700 }}>
                        • {sess.activityType}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '280px' }}>
                    <span style={{ fontSize: '0.78rem', color: '#34D399', fontWeight: 600 }}>
                      ✔ {mainStrength}
                    </span>
                    <span style={{ fontSize: '0.78rem', color: '#FBBF24', fontWeight: 600 }}>
                      ⚠️ {mainImprovement}
                    </span>
                  </div>

                  <button className="btn-secondary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                    <Eye size={16} /> View Results
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
