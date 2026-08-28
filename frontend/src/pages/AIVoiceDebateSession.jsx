import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft, Search, Mic, Volume2, VolumeX, Play, Square,
  Settings, Send, Award, Clock, RefreshCw, AlertCircle, Sparkles, User, Bot
} from 'lucide-react';
import { recommendedTopics } from '../utils/topics';
import { speechService } from '../services/speechRecognition';
import { aiVoiceService } from '../services/aiVoice';
import { api } from '../services/api';

/**
 * AIVoiceDebateSession — Individual AI Voice Debate Activity.
 * Reuses Group Debate topics from recommendedTopics.debate.
 * Strict audio synchronization state machine:
 *   AI_SPEAKING   → Mic OFF, AI Voice ON, ➜ Button Disabled
 *   USER_LISTENING → Mic ON, AI Voice OFF, ➜ Button Enabled ("🎤 Now it's your turn")
 *   PROCESSING     → Mic OFF, AI Voice OFF, ➜ Button Disabled ("⏳ AI is thinking...")
 */
export const AIVoiceDebateSession = ({ onBack, onComplete }) => {
  // Phase & Topic Selection
  const [phase, setPhase] = useState('topic-select'); // 'topic-select' | 'debating' | 'analyzing'
  const [currentTopic, setCurrentTopic] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Debate State Machine
  const [turnState, setTurnState] = useState('AI_SPEAKING'); // 'AI_SPEAKING' | 'USER_LISTENING' | 'PROCESSING'
  const [roundNumber, setRoundNumber] = useState(1);
  const maxRounds = 5;

  // History & Transcripts
  const [history, setHistory] = useState([]); // [{ speaker: 'AI'|'USER', text: '...', time: '...' }]
  const [latestAIArgument, setLatestAIArgument] = useState('');
  const [liveTranscript, setLiveTranscript] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [durationSeconds, setDurationSeconds] = useState(0);

  // AI Voice Settings
  const [showSettings, setShowSettings] = useState(false);
  const [availableVoices, setAvailableVoices] = useState([]);
  const [selectedVoiceName, setSelectedVoiceName] = useState('');
  const [speechRate, setSpeechRate] = useState(1.0);
  const [speechPitch, setSpeechPitch] = useState(1.0);
  const [speechVolume, setSpeechVolume] = useState(100);

  const timerRef = useRef(null);

  // Topics: Reuse exact Group Debate topics
  const debateTopics = recommendedTopics.debate || [];
  const filteredTopics = debateTopics.filter(t =>
    t.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Load Voices on Mount
  useEffect(() => {
    const loadVoices = () => {
      const voices = aiVoiceService.getAvailableVoices();
      setAvailableVoices(voices);
      if (voices.length > 0 && !selectedVoiceName) {
        setSelectedVoiceName(voices[0].name);
        aiVoiceService.selectedVoice = voices[0];
      }
    };
    loadVoices();
    if (window.speechSynthesis && window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  // Sync Voice Settings
  useEffect(() => {
    aiVoiceService.rate = speechRate;
    aiVoiceService.pitch = speechPitch;
    aiVoiceService.volume = speechVolume / 100;
    if (selectedVoiceName) {
      aiVoiceService.setVoiceByName(selectedVoiceName);
    }
  }, [selectedVoiceName, speechRate, speechPitch, speechVolume]);

  // Clean up speech recognition & TTS on unmount
  useEffect(() => {
    return () => {
      stopAllServices();
    };
  }, []);

  const stopAllServices = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    speechService.stop();
    aiVoiceService.stop();
  };

  const startDebateTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setDurationSeconds(prev => prev + 1);
    }, 1000);
  };

  /* ── 1. START DEBATE SESSION ── */
  const handleSelectTopicAndStart = async (topic) => {
    setCurrentTopic(topic);
    setPhase('debating');
    setRoundNumber(1);
    setHistory([]);
    setLiveTranscript('');
    setErrorMsg('');
    startDebateTimer();

    // Initial AI Opening Argument
    setTurnState('PROCESSING');
    try {
      const res = await api.getDebateCounterargument(
        topic,
        `I am ready to debate on topic: "${topic}".`,
        [],
        1
      );
      const openingStatement = res.counterargument || `I take the opposing position on "${topic}". Present your opening argument.`;
      
      const newHistory = [{ speaker: 'AI', text: openingStatement, time: new Date().toLocaleTimeString() }];
      setHistory(newHistory);
      setLatestAIArgument(openingStatement);

      speakAIArgument(openingStatement, newHistory, 1);
    } catch (err) {
      console.warn('Debate opening error:', err.message);
      const fallbackOpening = `I take the opposing position on "${topic}". Present your opening argument.`;
      const newHistory = [{ speaker: 'AI', text: fallbackOpening, time: new Date().toLocaleTimeString() }];
      setHistory(newHistory);
      setLatestAIArgument(fallbackOpening);
      speakAIArgument(fallbackOpening, newHistory, 1);
    }
  };

  /* ── 2. SPEAK AI ARGUMENT (STRICT MIC MUTED) ── */
  const speakAIArgument = (aiText, currentHistory, round) => {
    setTurnState('AI_SPEAKING');
    speechService.stop(); // GUARANTEE MIC IS OFF WHILE AI SPEAKS

    aiVoiceService.speak(
      aiText,
      () => {
        // onStart: Mic stays off
        speechService.stop();
      },
      () => {
        // onEnd: Transition to USER_LISTENING & enable Mic
        activateUserTurn(currentHistory, round);
      },
      (err) => {
        console.warn('TTS Notice:', err);
        activateUserTurn(currentHistory, round);
      }
    );
  };

  /* ── 3. ACTIVATE USER TURN ("Now it's your turn") ── */
  const activateUserTurn = (currentHistory, round) => {
    setTurnState('USER_LISTENING');
    setLiveTranscript('');

    if (speechService.isSupported()) {
      speechService.start(
        (text) => setLiveTranscript(text),
        (err) => console.warn('Debate speech recognition notice:', err)
      );
    } else {
      setErrorMsg('Live speech recognition is not supported in this browser. Please use Chrome or Edge.');
    }
  };

  /* ── 4. USER PRESSES ➜ SUBMIT ARGUMENT ── */
  const handleSubmitUserArgument = async () => {
    if (turnState !== 'USER_LISTENING') return;

    // Immediately stop speech recognition & mute mic
    const capturedText = speechService.stop();
    const finalUserSpeech = (capturedText || liveTranscript).trim();

    if (!finalUserSpeech) {
      setErrorMsg('Please speak your argument before pressing the submit button.');
      setTimeout(() => setErrorMsg(''), 3000);
      // Restart speech listening
      speechService.start(
        (text) => setLiveTranscript(text),
        (err) => console.warn('Debate speech notice:', err)
      );
      return;
    }

    setTurnState('PROCESSING');
    setErrorMsg('');

    const userEntry = { speaker: 'USER', text: finalUserSpeech, time: new Date().toLocaleTimeString() };
    const updatedHistoryWithUser = [...history, userEntry];
    setHistory(updatedHistoryWithUser);
    setLiveTranscript('');

    try {
      const res = await api.getDebateCounterargument(
        currentTopic,
        finalUserSpeech,
        updatedHistoryWithUser,
        roundNumber
      );

      const aiCounter = res.counterargument || 'That is an interesting claim, but what evidence supports your reasoning?';
      const aiEntry = { speaker: 'AI', text: aiCounter, time: new Date().toLocaleTimeString() };
      const fullHistory = [...updatedHistoryWithUser, aiEntry];
      setHistory(fullHistory);
      setLatestAIArgument(aiCounter);

      if (roundNumber < maxRounds) {
        setRoundNumber(prev => prev + 1);
        speakAIArgument(aiCounter, fullHistory, roundNumber + 1);
      } else {
        // Final round complete -> finish debate
        speakAIArgument(aiCounter, fullHistory, roundNumber);
      }

    } catch (err) {
      console.error('Debate submission error:', err);
      const fallbackCounter = 'I understand your point, but consider the alternative perspective. How do you respond?';
      const aiEntry = { speaker: 'AI', text: fallbackCounter, time: new Date().toLocaleTimeString() };
      const fullHistory = [...updatedHistoryWithUser, aiEntry];
      setHistory(fullHistory);
      setLatestAIArgument(fallbackCounter);
      speakAIArgument(fallbackCounter, fullHistory, roundNumber);
    }
  };

  /* ── 5. CONTROL BUTTONS: REPLAY & STOP AI VOICE ── */
  const handleReplayAIArgument = () => {
    if (!latestAIArgument) return;
    setTurnState('AI_SPEAKING');
    speechService.stop();
    aiVoiceService.speak(
      latestAIArgument,
      () => speechService.stop(),
      () => activateUserTurn(history, roundNumber),
      () => activateUserTurn(history, roundNumber)
    );
  };

  const handleStopAIVoice = () => {
    aiVoiceService.stop();
    activateUserTurn(history, roundNumber);
  };

  /* ── 6. END DEBATE & ANALYZE ── */
  const handleFinishDebate = async () => {
    if (phase === 'analyzing') return;
    stopAllServices();
    setPhase('analyzing');

    // Build complete formatted transcript for evaluation
    const fullTranscript = `Topic: ${currentTopic}\n\n` +
      history.map(item => `${item.speaker === 'USER' ? 'Human Debater' : 'AI Opponent'}: ${item.text}`).join('\n\n');

    try {
      const savedSession = await api.createSession({
        activityType: 'individual',
        activityName: 'AI Voice Debate',
        topic: currentTopic,
        durationSeconds: durationSeconds > 0 ? durationSeconds : 60,
        transcript: fullTranscript
      });
      onComplete(savedSession);
    } catch (err) {
      console.error('Error ending debate session:', err);
      setErrorMsg(err.message || 'Error saving debate evaluation.');
      setPhase('debating');
    }
  };

  const formatTimer = (s) => {
    const m = Math.floor(s / 60);
    return `${String(m).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;
  };

  // ── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: '1050px', margin: '0 auto', padding: '30px 20px 60px' }}>

      {/* Navigation Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <button
          onClick={() => { stopAllServices(); onBack(); }}
          className="btn-secondary"
          style={{ padding: '8px 16px' }}
        >
          <ArrowLeft size={18} /> Back to Individual Practice
        </button>
        <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 600 }}>
          Individual Practice • AI Voice Debate
        </span>
      </div>

      {/* ── PHASE 1: TOPIC SELECTION ───────────────────────────────────────── */}
      {phase === 'topic-select' && (
        <div className="glass-card" style={{ padding: '36px' }}>
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <span style={{ fontSize: '3rem' }}>⚔️</span>
            <h1 style={{ fontSize: '2.2rem', fontWeight: 800, marginTop: '8px' }}>AI Voice Debate</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '1rem', marginTop: '6px', maxWidth: '640px', margin: '6px auto 0' }}>
              Engage in a live, turn-based spoken debate against an AI opponent. Challenge claims, defend your position, and get evaluated on debate logic, reasoning, and rebuttal skills.
            </p>
          </div>

          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 20px', borderRadius: '9999px', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#A5B4FC', fontWeight: 700, fontSize: '0.9rem', marginBottom: '10px' }}>
              🎯 Recommended Debate Topics
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
              Select a debate topic to start your session. ({debateTopics.length} topics available)
            </p>
          </div>

          {/* Search bar */}
          <div style={{ position: 'relative', marginBottom: '20px', maxWidth: '480px', margin: '0 auto 24px' }}>
            <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input
              type="text"
              className="glass-input"
              placeholder="Search debate topics..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '40px' }}
            />
          </div>

          {/* Topic Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '14px', maxHeight: '420px', overflowY: 'auto', paddingRight: '6px' }}>
            {filteredTopics.map((top, idx) => (
              <div
                key={idx}
                onClick={() => handleSelectTopicAndStart(top)}
                className="glass-card glass-card-interactive"
                style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}
              >
                <span style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                  {top}
                </span>
                <span style={{ color: '#818CF8', fontSize: '1.2rem', fontWeight: 800 }}>➜</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── PHASE 2: ACTIVE DEBATE SESSION ───────────────────────────────── */}
      {phase === 'debating' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* Header Card: Topic, Round Counter & Timer */}
          <div className="glass-card" style={{ padding: '24px 32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <span style={{ fontSize: '0.78rem', color: '#A5B4FC', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Debate Topic
                </span>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: '4px 0 0', color: 'var(--text-primary)' }}>
                  {currentTopic}
                </h2>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ padding: '6px 16px', borderRadius: '9999px', background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)', color: '#A5B4FC', fontWeight: 800, fontSize: '0.9rem' }}>
                  Round {roundNumber} / {maxRounds}
                </div>
                <div style={{ padding: '6px 14px', borderRadius: '10px', background: 'var(--bg-input)', border: '1px solid var(--border-glass)', color: 'var(--text-muted)', fontSize: '0.88rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clock size={15} /> {formatTimer(durationSeconds)}
                </div>
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="btn-secondary"
                  style={{ padding: '8px 12px' }}
                  title="Voice Settings"
                >
                  <Settings size={16} /> Settings
                </button>
              </div>
            </div>

            {/* Collapsible Voice Settings Panel */}
            {showSettings && (
              <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--border-glass)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
                    🤖 AI Voice
                  </label>
                  <select
                    className="glass-input"
                    value={selectedVoiceName}
                    onChange={e => setSelectedVoiceName(e.target.value)}
                    style={{ fontSize: '0.85rem' }}
                  >
                    {availableVoices.map(v => (
                      <option key={v.name} value={v.name}>
                        {v.name} ({v.lang})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
                    Speed ({speechRate}x)
                  </label>
                  <input
                    type="range"
                    min="0.7"
                    max="1.5"
                    step="0.1"
                    value={speechRate}
                    onChange={e => setSpeechRate(parseFloat(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
                    Pitch ({speechPitch})
                  </label>
                  <input
                    type="range"
                    min="0.7"
                    max="1.3"
                    step="0.1"
                    value={speechPitch}
                    onChange={e => setSpeechPitch(parseFloat(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
                    Volume ({speechVolume}%)
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={speechVolume}
                    onChange={e => setSpeechVolume(parseInt(e.target.value, 10))}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* AI Opponent Card */}
          <div className="glass-card" style={{ padding: '28px', borderTop: '4px solid #8B5CF6' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '12px', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                  <Bot size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>🤖 AI Opponent</h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Opposing Debater Stance</span>
                </div>
              </div>

              {/* Controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {turnState === 'AI_SPEAKING' ? (
                  <button
                    onClick={handleStopAIVoice}
                    className="btn-danger"
                    style={{ padding: '6px 14px', fontSize: '0.82rem' }}
                  >
                    <Square size={14} /> Stop AI Voice
                  </button>
                ) : (
                  <button
                    onClick={handleReplayAIArgument}
                    className="btn-secondary"
                    style={{ padding: '6px 14px', fontSize: '0.82rem' }}
                  >
                    <Volume2 size={14} /> Replay Argument
                  </button>
                )}
              </div>
            </div>

            {/* Latest AI Argument Text */}
            <div style={{ background: 'var(--bg-input)', border: '1px solid var(--border-glass)', borderRadius: '14px', padding: '20px', minHeight: '80px' }}>
              <p style={{ margin: 0, fontSize: '0.98rem', color: 'var(--text-primary)', lineHeight: 1.6 }}>
                {latestAIArgument || 'Preparing opening debate statement...'}
              </p>
            </div>

            {/* Speaking animation indicator */}
            {turnState === 'AI_SPEAKING' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '14px', color: '#A5B4FC', fontSize: '0.88rem', fontWeight: 700 }}>
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center', height: '20px' }}>
                  <div className="wave-bar" style={{ animationDelay: '0s' }} />
                  <div className="wave-bar" style={{ animationDelay: '0.2s' }} />
                  <div className="wave-bar" style={{ animationDelay: '0.4s' }} />
                </div>
                <span>🔊 AI is speaking... (Microphone Muted)</span>
              </div>
            )}
          </div>

          {/* ── STATE NOTIFICATION BANNER ── */}
          {turnState === 'USER_LISTENING' && (
            <div style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(6,182,212,0.15))', border: '1px solid rgba(16,185,129,0.4)', borderRadius: '16px', padding: '20px', textAlign: 'center' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#34D399', margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <Mic size={24} color="#34D399" /> 🎤 NOW IT'S YOUR TURN
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', margin: '6px 0 0' }}>
                Speak your counterargument clearly into your microphone and press <strong style={{ color: '#818CF8' }}>➜</strong> when finished.
              </p>
            </div>
          )}

          {turnState === 'PROCESSING' && (
            <div style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '16px', padding: '20px', textAlign: 'center' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#A5B4FC', margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <Sparkles size={20} className="pulse-glow" /> ⏳ AI is analyzing your argument and formulating a counterargument...
              </h3>
            </div>
          )}

          {errorMsg && (
            <div style={{ padding: '12px 16px', borderRadius: '12px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#FCA5A5', fontSize: '0.88rem' }}>
              ⚠️ {errorMsg}
            </div>
          )}

          {/* User Live Transcript & Submit Arrow */}
          <div className="glass-card" style={{ padding: '28px', borderTop: '4px solid #10B981' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, #06B6D4, #6366F1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '0.85rem' }}>
                  <User size={18} />
                </div>
                <span style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  🎤 Your Speech (Live Transcript)
                </span>
              </div>
              <span style={{ fontSize: '0.78rem', color: turnState === 'USER_LISTENING' ? '#34D399' : 'var(--text-dim)', fontWeight: 700 }}>
                {turnState === 'USER_LISTENING' ? '● Microphone Active' : '○ Microphone Muted'}
              </span>
            </div>

            {/* Live Read-Only Transcript + Submit Arrow Button */}
            <div style={{ display: 'flex', gap: '14px', alignItems: 'stretch' }}>
              <div style={{ flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border-glass)', borderRadius: '14px', padding: '18px', minHeight: '110px', maxHeight: '180px', overflowY: 'auto' }}>
                <p style={{ margin: 0, fontSize: '0.95rem', color: liveTranscript ? 'var(--text-primary)' : 'var(--text-placeholder)', fontStyle: liveTranscript ? 'normal' : 'italic', lineHeight: 1.5 }}>
                  {liveTranscript || (turnState === 'USER_LISTENING' ? 'Speak now... Your speech will appear live here.' : 'Waiting for AI to finish speaking...')}
                </p>
              </div>

              <button
                onClick={handleSubmitUserArgument}
                disabled={turnState !== 'USER_LISTENING'}
                title="Submit your argument (End Turn)"
                style={{
                  width: '64px',
                  borderRadius: '14px',
                  border: 'none',
                  background: turnState === 'USER_LISTENING'
                    ? 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)'
                    : 'var(--bg-input)',
                  color: turnState === 'USER_LISTENING' ? 'white' : 'var(--text-dim)',
                  fontSize: '1.8rem',
                  fontWeight: 800,
                  cursor: turnState === 'USER_LISTENING' ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: turnState === 'USER_LISTENING' ? '0 4px 20px rgba(99,102,241,0.45)' : 'none',
                  transition: 'all 0.2s ease'
                }}
              >
                ➜
              </button>
            </div>
          </div>

          {/* Conversation History Drawer */}
          {history.length > 0 && (
            <div className="glass-card" style={{ padding: '24px' }}>
              <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '14px', color: 'var(--text-muted)' }}>
                📜 Debate History ({history.length} exchanges)
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '220px', overflowY: 'auto' }}>
                {history.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '12px 16px',
                      borderRadius: '10px',
                      background: item.speaker === 'USER' ? 'rgba(16,185,129,0.06)' : 'rgba(99,102,241,0.06)',
                      borderLeft: `3px solid ${item.speaker === 'USER' ? '#10B981' : '#6366F1'}`
                    }}
                  >
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: item.speaker === 'USER' ? '#34D399' : '#A5B4FC' }}>
                      {item.speaker === 'USER' ? '👤 You' : '🤖 AI Opponent'} ({item.time})
                    </span>
                    <p style={{ margin: '4px 0 0', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                      {item.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* End Debate Action */}
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '10px' }}>
            <button
              onClick={handleFinishDebate}
              className="btn-secondary"
              style={{ padding: '12px 28px', border: '1px solid rgba(239,68,68,0.3)', color: '#FCA5A5' }}
            >
              ⏹ End Debate &amp; Analyze Results
            </button>
          </div>

        </div>
      )}

      {/* ── PHASE 3: ANALYZING ─────────────────────────────────────────────── */}
      {phase === 'analyzing' && (
        <div className="glass-card" style={{ padding: '60px 40px', textAlign: 'center' }}>
          <div style={{ margin: '0 auto 20px', width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818CF8' }}>
            <Sparkles size={36} className="pulse-glow" />
          </div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            Analyzing Your Voice Debate Performance...
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: '8px', maxWidth: '500px', margin: '8px auto 0' }}>
            Evaluating argument logic, rebuttal skills, counterargument quality, vocabulary, and grammar using Gemini AI.
          </p>
        </div>
      )}

    </div>
  );
};
