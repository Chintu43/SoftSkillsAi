import React, { useState, useEffect, useRef } from 'react';
import {
  Mic, MicOff, Clock, AlertCircle, ArrowLeft,
  Sparkles, CheckCircle2, Square, Play, RefreshCw, Search
} from 'lucide-react';
import { speechService } from '../services/speechRecognition';
import { api } from '../services/api';
import { AudioVisualizer } from '../components/AudioVisualizer';
import { getActivityTopics } from '../utils/topics';

/**
 * ActivitySession — Handles individual practice activity lifecycle:
 *   1. topic-select — user chooses from dedicated recommended topics
 *   2. idle         — topic confirmed, user starts 30-sec prep or begins speaking
 *   3. prep         — optional 30-sec countdown
 *   4. speaking     — live speech recognition (READ-ONLY transcript), timer
 *   5. analyzing    — AI evaluates speech transcript
 */
export const ActivitySession = ({ activity, onBack, onComplete }) => {
  // Activity state machine
  const [phase, setPhase] = useState('topic-select'); // 'topic-select' | 'idle' | 'prep' | 'speaking' | 'analyzing'
  const [currentTopic, setCurrentTopic] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Practice session state
  const [transcript, setTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Timers
  const [prepTimeLeft, setPrepTimeLeft] = useState(30);
  const defaultSpeakSecs = (parseInt(activity.duration, 10) || 2) * 60;
  const [speakTimeLeft, setSpeakTimeLeft] = useState(defaultSpeakSecs);
  const [totalSpokenSeconds, setTotalSpokenSeconds] = useState(0);

  // Interview state
  const [interviewQuestions, setInterviewQuestions] = useState([]);
  const [interviewIndex, setInterviewIndex] = useState(0);
  const [interviewAnswers, setInterviewAnswers] = useState([]);

  // Dedicated topics for this specific activity
  const topicList = getActivityTopics(activity.name, activity.id);

  // Timers refs
  const prepTimerRef = useRef(null);
  const speakTimerRef = useRef(null);

  // Load interview questions if needed
  useEffect(() => {
    if (activity.id === 'interview') {
      api.getInterviewQuestions()
        .then(res => setInterviewQuestions(res.questions || []))
        .catch(() => setInterviewQuestions([
          "Tell me about yourself and your professional background.",
          "What are your core strengths and how do you apply them?",
          "What is your biggest professional weakness, and how are you working to overcome it?",
          "Why should our organization hire you over other candidates?",
          "Where do you see your career progressing in five years?"
        ]));
    }
  }, [activity.id]);

  // Clean up timers & speech recognition on unmount
  useEffect(() => {
    return () => {
      if (prepTimerRef.current) clearInterval(prepTimerRef.current);
      if (speakTimerRef.current) clearInterval(speakTimerRef.current);
      speechService.stop();
    };
  }, []);

  // ── 1. TOPIC SELECTION ──────────────────────────────────────────────────────
  const handleSelectTopic = (topic) => {
    setCurrentTopic(topic);
    setPhase('idle');
  };

  // ── 2. PREPARATION TIMER ────────────────────────────────────────────────────
  const handleStartPrep = () => {
    setPhase('prep');
    setPrepTimeLeft(30);
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

  // ── 3. SPEAKING PHASE ───────────────────────────────────────────────────────
  const handleStartSpeaking = () => {
    if (prepTimerRef.current) clearInterval(prepTimerRef.current);
    setPhase('speaking');
    setTranscript('');
    setErrorMsg('');
    setIsListening(true);
    setSpeakTimeLeft(defaultSpeakSecs);
    setTotalSpokenSeconds(0);

    // Start live speech recognition
    if (speechService.isSupported()) {
      speechService.start(
        (liveText) => setTranscript(liveText),
        (err) => {
          console.warn('Speech recognition notice:', err);
          if (err.includes('not-allowed')) {
            setErrorMsg('Microphone access was denied. Please allow microphone permissions.');
          }
        }
      );
    } else {
      setErrorMsg('Live Speech Recognition is not supported in this browser. Please use Chrome or Edge.');
    }

    // Start countdown timer
    speakTimerRef.current = setInterval(() => {
      setSpeakTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(speakTimerRef.current);
          handleAutoEndSpeaking();
          return 0;
        }
        return prev - 1;
      });
      setTotalSpokenSeconds(prev => prev + 1);
    }, 1000);
  };

  const handleAutoEndSpeaking = () => {
    if (activity.id === 'interview' && interviewIndex + 1 < interviewQuestions.length) {
      handleNextInterviewQuestion();
    } else {
      handleEndSession();
    }
  };

  // ── 4. INTERVIEW QUESTION ADVANCE ───────────────────────────────────────────
  const handleNextInterviewQuestion = () => {
    const capturedAnswer = speechService.stop();
    const finalAnswer = capturedAnswer || transcript;

    const updatedAnswers = [
      ...interviewAnswers,
      {
        question: interviewQuestions[interviewIndex],
        answer: finalAnswer.trim() || '[No answer recorded]'
      }
    ];
    setInterviewAnswers(updatedAnswers);

    if (interviewIndex + 1 < interviewQuestions.length) {
      setInterviewIndex(prev => prev + 1);
      setTranscript('');
      setSpeakTimeLeft(defaultSpeakSecs);
      setTimeout(() => {
        speechService.start(
          (text) => setTranscript(text),
          (err) => console.warn('Interview speech notice:', err)
        );
      }, 300);
    } else {
      finalizeInterviewSession(updatedAnswers);
    }
  };

  const finalizeInterviewSession = async (allAnswers) => {
    if (speakTimerRef.current) clearInterval(speakTimerRef.current);
    speechService.stop();
    setIsListening(false);
    setPhase('analyzing');

    const formattedTranscript = allAnswers
      .map((a, i) => `Q${i + 1}: ${a.question}\nA${i + 1}: ${a.answer}`)
      .join('\n\n');

    try {
      const savedSession = await api.createSession({
        activityType: 'individual',
        activityName: activity.name,
        topic: currentTopic || 'Behavioral & Technical Job Interview',
        durationSeconds: totalSpokenSeconds > 0 ? totalSpokenSeconds : 60,
        transcript: formattedTranscript
      });
      onComplete(savedSession);
    } catch (err) {
      console.error('Error saving interview session:', err);
      setErrorMsg(err.message || 'Error saving session. Please try again.');
      setPhase('speaking');
    }
  };

  // ── 5. FINISH NORMAL SESSION ────────────────────────────────────────────────
  const handleEndSession = async () => {
    if (speakTimerRef.current) clearInterval(speakTimerRef.current);
    const finalSpeech = speechService.stop();
    setIsListening(false);
    setPhase('analyzing');

    const finalTranscript = finalSpeech || transcript;

    try {
      const savedSession = await api.createSession({
        activityType: 'individual',
        activityName: activity.name,
        topic: currentTopic,
        durationSeconds: totalSpokenSeconds > 0 ? totalSpokenSeconds : (defaultSpeakSecs - speakTimeLeft),
        transcript: finalTranscript
      });
      onComplete(savedSession);
    } catch (err) {
      console.error('Error saving session:', err);
      setErrorMsg(err.message || 'Error saving session. Please try again.');
      setPhase('speaking');
    }
  };

  const formatTimer = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
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
        <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 600 }}>
          Individual Session • {activity.name}
        </span>
      </div>

      {/* Activity banner */}
      <div className="glass-card" style={{ padding: '32px 40px' }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <span style={{ fontSize: '3rem' }}>{activity.icon}</span>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, marginTop: '10px', color: 'var(--text-primary)' }}>{activity.name}</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '1rem', marginTop: '6px', maxWidth: '600px', margin: '6px auto 0' }}>
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
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Choose a topic to begin your practice. ({topicList.length} topics available)
              </p>
            </div>

            {/* Search bar */}
            <div style={{ position: 'relative', marginBottom: '20px', maxWidth: '480px', margin: '0 auto 20px auto' }}>
              <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
              <input
                type="text"
                className="glass-input"
                placeholder={`Search ${activity.name} topics...`}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '40px', width: '100%' }}
              />
            </div>

            {/* Topic grid — High-contrast Theme-Aware Styling */}
            <div style={{
              maxHeight: '420px',
              overflowY: 'auto',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '12px',
              paddingRight: '4px'
            }}>
              {filteredTopics.length === 0 ? (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0', fontSize: '0.92rem' }}>
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
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-glass)',
                      color: 'var(--text-primary)',
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      lineHeight: 1.45,
                      cursor: 'pointer',
                      transition: 'all 0.18s ease',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'rgba(99,102,241,0.15)';
                      e.currentTarget.style.borderColor = 'var(--primary)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'var(--bg-input)';
                      e.currentTarget.style.borderColor = 'var(--border-glass)';
                    }}
                  >
                    <span style={{ color: 'var(--primary)', fontWeight: 800, flexShrink: 0, marginTop: '1px', fontSize: '0.82rem' }}>
                      {String(idx + 1).padStart(2, '0')}.
                    </span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{topic}</span>
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
              <h3 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.4 }}>
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
              <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
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
              <p style={{ margin: '4px 0 0', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>"{currentTopic}"</p>
            </div>

            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <span style={{ fontSize: '0.9rem', color: '#F59E0B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Preparation Time Remaining
              </span>
              <div style={{ fontSize: '4rem', fontWeight: 800, color: '#F59E0B', margin: '10px 0 20px', fontFamily: 'monospace' }}>
                {formatTimer(prepTimeLeft)}
              </div>
              <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>Organize your thoughts. Speaking phase will auto-start.</p>
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
                  <p style={{ margin: '6px 0 0', fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                    "{interviewQuestions[interviewIndex]}"
                  </p>
                </div>
              ) : (
                <div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#A5B4FC', textTransform: 'uppercase' }}>Session Topic</span>
                  <p style={{ margin: '4px 0 0', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>"{currentTopic}"</p>
                </div>
              )}
            </div>

            {/* Timer + Visualizer row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
              <AudioVisualizer isActive={true} label="Microphone Active & Recording" />
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-input)', border: '1px solid var(--border-glass)', padding: '10px 20px', borderRadius: '12px' }}>
                <Clock size={18} color="var(--primary)" />
                <span style={{ fontSize: '1.2rem', fontWeight: 800, fontFamily: 'monospace', color: 'var(--text-primary)' }}>
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
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>🔒 Non-Editable • Driven by Microphone</span>
              </div>
              <div
                className="glass-input"
                style={{
                  minHeight: '130px',
                  maxHeight: '200px',
                  overflowY: 'auto',
                  lineHeight: 1.6,
                  color: transcript ? 'var(--text-primary)' : 'var(--text-placeholder)',
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                  cursor: 'default',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-glass)',
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
            <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>Analyzing Your Speech Performance…</h2>
            <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>
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
