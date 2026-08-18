import React from 'react';
import { Mic, Clock, Zap, ArrowRight } from 'lucide-react';

export const IndividualPractice = ({ onStartSession }) => {
  const activities = [
    {
      id: 'ai-voice-debate',
      name: 'AI Voice Debate',
      icon: '⚔️',
      desc: 'Engage in a live, turn-based spoken debate against an AI opponent. Defend your claims, counter arguments, and get evaluated on debate logic and rebuttal.',
      difficulty: 'Hard',
      duration: '5 Rounds',
      topic: 'AI will replace more jobs than it creates in the next decade.'
    },
    {
      id: 'jam',
      name: 'JAM Session',
      icon: '🎤',
      desc: 'Just A Minute! Speak fluently on a given topic for 1-2 minutes without hesitation or excessive filler words.',
      difficulty: 'Medium',
      duration: '2 mins',
      topic: 'Impact of Social Media on Students'
    },
    {
      id: 'self-intro',
      name: 'Self Introduction',
      icon: '👤',
      desc: 'Master the guided professional introduction. Cover your education, key skills, projects, achievements, and career goals.',
      difficulty: 'Easy',
      duration: '3 mins',
      topic: 'Guided Professional Self-Introduction'
    },
    {
      id: 'interview',
      name: 'Interview Practice',
      icon: '💼',
      desc: 'AI Interviewer asks real job interview questions sequentially. Get evaluated on clarity, relevance, and professionalism.',
      difficulty: 'Hard',
      duration: '5 mins',
      topic: 'Behavioral & Technical Job Interview'
    },
    {
      id: 'storytelling',
      name: 'Storytelling',
      icon: '📖',
      desc: 'Narrate a compelling story based on a given scenario. AI evaluates structure, creativity, engagement, and vocabulary.',
      difficulty: 'Medium',
      duration: '3 mins',
      topic: 'Tell a story about a difficult challenge you overcame'
    },
    {
      id: 'impromptu',
      name: 'Impromptu Speaking',
      icon: '⚡',
      desc: 'Get a random topic with 30 seconds of prep time. Test your spontaneous thinking and structured delivery.',
      difficulty: 'Hard',
      duration: '2 mins',
      topic: 'Technology in Modern Education'
    },
    {
      id: 'communication',
      name: 'Communication Practice',
      icon: '🗣',
      desc: 'Simulate real-world workplace conversations: talking to a manager, asking for help, or handling disagreements.',
      difficulty: 'Medium',
      duration: '3 mins',
      topic: 'Explaining a complex technical project to non-technical stakeholders'
    },
    {
      id: 'vocabulary',
      name: 'Vocabulary Practice',
      icon: '📚',
      desc: 'Enhance word choice and articulate ideas with rich professional vocabulary and formal transition phrases.',
      difficulty: 'Easy',
      duration: '2 mins',
      topic: 'Expressing disagreement diplomatically in business'
    },
    {
      id: 'situational',
      name: 'Situational Speaking',
      icon: '🎯',
      desc: 'Respond to crisis management scenarios or high-stakes business environments with clarity and composure.',
      difficulty: 'Hard',
      duration: '3 mins',
      topic: 'Handling an urgent project delay notification to client'
    },
    {
      id: 'presentation',
      name: 'Presentation Practice',
      icon: '🎤',
      desc: 'Deliver a structured keynote presentation with an engaging opening hook, key supporting pillars, and strong closing summary.',
      difficulty: 'Hard',
      duration: '4 mins',
      topic: 'The Future of Renewable Energy'
    },
    {
      id: 'leadership',
      name: 'Leadership Practice',
      icon: '👑',
      desc: 'Practice motivating a team, delegating responsibilities, and setting visionary organizational goals.',
      difficulty: 'Medium',
      duration: '3 mins',
      topic: 'Inspiring a team after missing a quarter milestone'
    },
    {
      id: 'confidence',
      name: 'Confidence Practice',
      icon: '💖',
      desc: 'Focus on vocal projection, elimination of uncertainty markers, and calm, authoritative pacing.',
      difficulty: 'Easy',
      duration: '2 mins',
      topic: 'Pitching your personal career vision'
    },
    {
      id: 'pronunciation',
      name: 'Pronunciation Practice',
      icon: '🎯',
      desc: 'Sharpen phonetic clarity, word stress, and clear accent articulation for international professional standard.',
      difficulty: 'Easy',
      duration: '2 mins',
      topic: 'Clear articulation of challenging business & tech terminology'
    }
  ];

  const getDifficultyColor = (diff) => {
    switch (diff) {
      case 'Easy': return '#34D399';
      case 'Hard': return '#F43F5E';
      default: return '#F59E0B';
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '30px 20px' }}>
      
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '2.2rem', fontWeight: 800 }}>Individual Practice Activities</h1>
        <p style={{ color: '#9CA3AF', fontSize: '1rem', marginTop: '6px' }}>
          Select an activity, speak through your microphone, and receive detailed AI evaluation & mistakes analysis.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '24px' }}>
        {activities.map((act) => (
          <div key={act.id} className="glass-card" style={{ padding: '28px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <span style={{ fontSize: '2.2rem' }}>{act.icon}</span>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '4px 10px', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', color: getDifficultyColor(act.difficulty), border: `1px solid ${getDifficultyColor(act.difficulty)}40` }}>
                    {act.difficulty}
                  </span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '4px 10px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', color: '#9CA3AF', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={12} /> {act.duration}
                  </span>
                </div>
              </div>

              <h3 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '8px' }}>{act.name}</h3>
              <p style={{ color: '#9CA3AF', fontSize: '0.88rem', lineHeight: 1.5, marginBottom: '20px' }}>{act.desc}</p>
            </div>

            <button
              onClick={() => onStartSession(act)}
              className="btn-primary"
              style={{ width: '100%', padding: '12px' }}
            >
              Start Session <ArrowRight size={18} />
            </button>
          </div>
        ))}
      </div>

    </div>
  );
};
