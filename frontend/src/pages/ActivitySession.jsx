import React, { useState, useEffect, useRef } from 'react';
import { speechService } from '../services/speechRecognition';
import { api } from '../services/api';
import { AudioVisualizer } from '../components/AudioVisualizer';
import { recommendedTopics } from '../utils/topics';
import { Play, Square, ArrowLeft, Clock, Sparkles, Search, CheckCircle2 } from 'lucide-react';

// Strict activity-ID → topics-key mapping.
// Every key must resolve to its own dedicated array in topics.js.
// Do NOT use a generic fallback — if a key is missing we surface an error
// instead of silently showing the wrong activity's topics.
const ACTIVITY_TOPIC_KEY = {
  'jam':           'jam',
  'self-intro':    'selfIntroduction',
  'interview':     'interview',
  'storytelling':  'storytelling',
  'impromptu':     'impromptu',
  'communication': 'communication',
  'vocabulary':    'vocabulary',
  'situational':   'situational',
  'presentation':  'presentation',
  'leadership':    'leadership',
  'confidence':    'confidence',
  'pronunciation': 'pronunciation',
};

// Fixed HR/behavioral questions shown sequentially during an Interview session.
// These are DIFFERENT from the interview topic-picker list.
const INTERVIEW_SESSION_QUESTIONS = [
  "Tell me about yourself and your background.",
  "What are your top three professional strengths?",
  "What is your greatest weakness and how are you addressing it?",
  "Why should our organisation hire you over other candidates?",
  "Where do you see your career in five years?",
  "Describe a major challenge you faced and how you overcame it.",
  "Tell me about a time you worked successfully in a team.",
  "How do you handle pressure and tight deadlines?",
  "Describe a situation where you showed leadership.",
  "Do you have any questions for us?"
];

export const ActivitySession = ({ activity, onBack, onComplete }) => {
  const topicsKey = ACTIVITY_TOPIC_KEY[activity.id];
  // Strict guard: never fall back to another activity's topics
  const topicList = topicsKey && recommendedTopics[topicsKey]
    ? recommendedTopics[topicsKey]
    : [];
  const topicsNotFound = !topicsKey || !recommendedTopics[topicsKey];

  const [phase, setPhase]               = useState('topic-select');
  const [searchQuery, setSearchQuery]   = useState('');
  const [currentTopic, setCurrentTopic] = useState('');

  const [prepTimeLeft,  setPrepTimeLeft]  = useState(30);
  const [speakTimeLeft, setSpeakTimeLeft] = useState(120);
  const [transcript,    setTranscript]    = useState('');
  const [errorMsg,      setErrorMsg]      = useState('');

  // Interview-specific state — uses the fixed session question queue,
  // NOT the topic-picker list.
  const [interviewIndex,       setInterviewIndex]       = useState(0);
  const [interviewTranscripts, setInterviewTranscripts] = useState([]);
  const interviewQuestions = INTERVIEW_SESSION_QUESTIONS;

  const prepTimerRef  = useRef(null);
  const speakTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      stopAllTimers();
      speechService.stop();
    };
  }, []);

  const stopAllTimers = () => {
    if (prepTimerRef.current)  clearInterval(prepTimerRef.current);
    if (speakTimerRef.current) clearInterval(speakTimerRef.current);
  };

  /* ── Topic selection ── */
  const handleSelectTopic = (topic) => {
    setCurrentTopic(topic);
    // For interview, seed first question from selected topic as context
    setPhase('idle');
  };

  /* ── Prep countdown ── */
  const handleStartPrep = () => {
    setPhase('prep');
    setPrepTimeLeft(30);
    stopAllTimers();
    prepTimerRef.current = setInterval(() => {
      setPrepTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(prepTimerRef.current);
          handleStartSpeaking();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  /* ── Speaking ── */
  const handleStartSpeaking = () => {
    stopAllTimers();
    setPhase('speaking');
    setSpeakTimeLeft(120);

    speechService.start(
      (text) => setTranscript(text),
      (err)  => console.warn('Speech notice:', err)
    );

    speakTimerRef.current = setInterval(() => {
      setSpeakTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(speakTimerRef.current);
          handleEndSession();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  /* ── Interview: next question ── */
  const handleNextInterviewQuestion = () => {
    const currentAnswer = transcript;
    setInterviewTranscripts(prev => [
      ...prev,
      `Q: ${interviewQuestions[interviewIndex]}\nA: ${currentAnswer}`
    ]);
    setTranscript('');

    if (interviewIndex + 1 < interviewQuestions.length) {
      setInterviewIndex(prev => prev + 1);
    } else {
      handleEndSession();
    }
  };

  /* ── End & analyze ── */
  const handleEndSession = async () => {
    stopAllTimers();
    setPhase('analyzing');

    const finalSpeech =
      activity.id === 'interview'
        ? [...interviewTranscripts, `Q: ${interviewQuestions[interviewIndex]}\nA: ${transcript}`].join('\n\n')
        : transcript; // empty string ⇒ backend returns 0-scores (no fake fallback)

    speechService.stop();

    try {
      const duration      = 120 - speakTimeLeft;
      const savedSession  = await api.createSession({
        activityType:    'individual',
        activityName:    activity.name,
        topic:           currentTopic,
        durationSeconds: duration > 0 ? duration : 60,
        transcript:      finalSpeech
      });
      onComplete(savedSession);
    } catch (err) {
      setErrorMsg(err.message || 'Error running AI analysis');
      setPhase('speaking');
    }
  };

  const formatTimer = (s) => {
    const m = Math.floor(s / 60);
    return `${String(m).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;
  };

  const filteredTopics = topicList.filter(t =>
    t.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '30px 20px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <button onClick={onBack} className="btn-secondary" style={{ padding: '8px 16px' }}>
          <ArrowLeft size={18} /> Back to Activities
        </button>
        <span style={{ fontSize: '0.9rem', color: '#9CA3AF', fontWeight: 600 }}>
          Individual Session • {activity.name}
        </span>
      </div>

      {/* Activity banner */}
      <div className="glass-card" style={{ padding: '32px 40px' }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <span style={{ fontSize: '3rem' }}>{activity.icon}</span>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, marginTop: '10px' }}>{activity.name}</h1>
          <p style={{ color: '#9CA3AF', fontSize: '1rem', marginTop: '6px', maxWidth: '600px', margin: '6px auto 0' }}>
            {activity.desc}
          </p>
        </div>

        {/* ── PHASE: topic-select ─────────────────────────────────────────── */}
        {phase === 'topic-select' && (
          <div>
            {/* Section heading */}
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 20px', borderRadius: '9999px', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#A5B4FC', fontWeight: 700, fontSize: '0.9rem', marginBottom: '10px' }}>
                🎯 Recommended Topics
              </div>
              <p style={{ color: '#9CA3AF', fontSize: '0.9rem' }}>
                Choose a topic to begin your practice. ({topicList.length} topics available)
              </p>
            </div>

            {/* Search bar */}
            <div style={{ position: 'relative', marginBottom: '20px', maxWidth: '480px', margin: '0 auto 20px auto' }}>
              <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }} />
              <input
                type="text"
                className="glass-input"
                placeholder={`Search ${activity.name} topics...`}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '40px', width: '100%' }}
              />
            </div>

            {/* Topic grid */}
            <div style={{
              maxHeight: '420px',
              overflowY: 'auto',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '12px',
              paddingRight: '4px'
            }}>
              {filteredTopics.length === 0 ? (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#6B7280', padding: '40px 0', fontSize: '0.92rem' }}>
                  No topics match your search. Try a different keyword.
                </div>
              ) : (
                filteredTopics.map((topic, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSelectTopic(topic)}
                    style={{
                      textAlign: 'left',
                      padding: '14px 18px',
                      borderRadius: '12px',
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      color: '#E5E7EB',
                      fontSize: '0.88rem',
                      fontWeight: 500,
                      lineHeight: 1.45,
                      cursor: 'pointer',
                      transition: 'all 0.18s ease',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'rgba(99,102,241,0.18)';
                      e.currentTarget.style.borderColor = 'rgba(99,102,241,0.5)';
                      e.currentTarget.style.color = '#A5B4FC';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                      e.currentTarget.style.color = '#E5E7EB';
                    }}
                  >
                    <span style={{ color: '#6366F1', fontWeight: 700, flexShrink: 0, marginTop: '1px' }}>
                      {String(idx + 1).padStart(2, '0')}.
                    </span>
                    <span>{topic}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* ── PHASE: idle (topic confirmed, not yet speaking) ─────────────── */}
        {phase === 'idle' && (
          <div>
            {/* Selected topic display */}
            <div style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.35)', borderRadius: '16px', padding: '22px 28px', marginBottom: '28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#A5B4FC', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Selected Topic
                </span>
                <span style={{ fontSize: '0.75rem', padding: '2px 10px', borderRadius: '6px', background: 'rgba(16,185,129,0.2)', color: '#34D399', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <CheckCircle2 size={13} /> Ready to Practice
                </span>
              </div>
              <h3 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#F3F4F6', lineHeight: 1.4 }}>
                "{currentTopic}"
              </h3>
              <button
                onClick={() => { setPhase('topic-select'); setTranscript(''); setSearchQuery(''); }}
                style={{ marginTop: '12px', background: 'none', border: 'none', color: '#818CF8', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', padding: 0 }}
              >
                ← Choose a different topic
              </button>
            </div>

            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <p style={{ color: '#9CA3AF', marginBottom: '24px' }}>
                Make sure your microphone is ready, then start preparation or begin speaking directly.
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <button onClick={handleStartPrep} className="btn-secondary" style={{ padding: '14px 28px' }}>
                  <Clock size={20} /> Start Preparation (30s)
                </button>
                <button onClick={handleStartSpeaking} className="btn-primary" style={{ padding: '14px 32px' }}>
                  <Play size={20} /> Start Speaking Now
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── PHASE: prep ────────────────────────────────────────────────── */}
        {phase === 'prep' && (
          <div>
            {/* Topic reminder */}
            <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: '14px', padding: '16px 22px', marginBottom: '24px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#A5B4FC', textTransform: 'uppercase' }}>Your Topic</span>
              <p style={{ margin: '4px 0 0', fontSize: '1.1rem', fontWeight: 700, color: '#F3F4F6' }}>"{currentTopic}"</p>
            </div>

            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <span style={{ fontSize: '0.9rem', color: '#F59E0B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Preparation Time Remaining
              </span>
              <div style={{ fontSize: '4rem', fontWeight: 800, color: '#F59E0B', margin: '10px 0 20px', fontFamily: 'monospace' }}>
                {formatTimer(prepTimeLeft)}
              </div>
              <p style={{ color: '#9CA3AF', marginBottom: '24px' }}>Organize your thoughts. Speaking phase will auto-start.</p>
              <button onClick={handleStartSpeaking} className="btn-primary" style={{ padding: '12px 28px' }}>
                Skip Prep & Speak Now
              </button>
            </div>
          </div>
        )}

        {/* ── PHASE: speaking ────────────────────────────────────────────── */}
        {phase === 'speaking' && (
          <div>
            {/* Topic reminder */}
            <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: '14px', padding: '16px 22px', marginBottom: '20px' }}>
              {activity.id === 'interview' ? (
                <div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#A5B4FC', textTransform: 'uppercase' }}>
                    AI Interviewer • Question {interviewIndex + 1} of {interviewQuestions.length}
                  </span>
                  <p style={{ margin: '6px 0 0', fontSize: '1.2rem', fontWeight: 700, color: '#F3F4F6', lineHeight: 1.4 }}>
                    "{interviewQuestions[interviewIndex]}"
                  </p>
                </div>
              ) : (
                <div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#A5B4FC', textTransform: 'uppercase' }}>Session Topic</span>
                  <p style={{ margin: '4px 0 0', fontSize: '1.1rem', fontWeight: 700, color: '#F3F4F6' }}>"{currentTopic}"</p>
                </div>
              )}
            </div>

            {/* Timer + Visualizer row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
              <AudioVisualizer isActive={true} label="Microphone Active & Recording" />
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.05)', padding: '10px 20px', borderRadius: '12px' }}>
                <Clock size={18} color="#6366F1" />
                <span style={{ fontSize: '1.2rem', fontWeight: 800, fontFamily: 'monospace', color: '#F3F4F6' }}>
                  {formatTimer(speakTimeLeft)}
                </span>
              </div>
            </div>

            {/* READ-ONLY transcript */}
            <div style={{ margin: '0 0 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#A5B4FC' }}>
                  Live Speech Transcript (READ-ONLY)
                </label>
                <span style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>🔒 Non-Editable • Driven by Microphone</span>
              </div>
              <div
                className="glass-input"
                style={{
                  minHeight: '130px',
                  maxHeight: '200px',
                  overflowY: 'auto',
                  lineHeight: 1.6,
                  color: transcript ? '#F3F4F6' : '#6B7280',
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                  cursor: 'default',
                  background: 'rgba(15,23,42,0.9)',
                  border: '1px solid rgba(99,102,241,0.3)',
                  padding: '16px'
                }}
              >
                {transcript || 'Speak clearly into your microphone… Spoken text will appear here automatically.'}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              {activity.id === 'interview' ? (
                <button onClick={handleNextInterviewQuestion} className="btn-primary" style={{ padding: '12px 24px' }}>
                  {interviewIndex + 1 < interviewQuestions.length ? 'Next Question →' : 'Finish Interview & Analyze'}
                </button>
              ) : <div />}

              <button onClick={handleEndSession} className="btn-danger">
                <Square size={18} /> End Session & Get AI Score
              </button>
            </div>
          </div>
        )}

        {/* ── PHASE: analyzing ───────────────────────────────────────────── */}
        {phase === 'analyzing' && (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(99,102,241,0.2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#818CF8', marginBottom: '20px' }} className="pulse-glow">
              <Sparkles size={32} />
            </div>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 800 }}>Analyzing Your Speech Performance…</h2>
            <p style={{ color: '#9CA3AF', marginTop: '8px' }}>
              Gemini AI is evaluating fluency, grammar, vocabulary, confidence, and topic relevance against "{currentTopic}".
            </p>
          </div>
        )}

        {errorMsg && (
          <div style={{ marginTop: '20px', padding: '12px', borderRadius: '10px', background: 'rgba(239,68,68,0.15)', color: '#FCA5A5', fontSize: '0.9rem' }}>
            {errorMsg}
          </div>
        )}
      </div>
    </div>
  );
};
