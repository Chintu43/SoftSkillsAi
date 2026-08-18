import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { getSocket } from '../services/socket';
import { webrtcService } from '../services/webrtc';
import { speechService } from '../services/speechRecognition';
import { api } from '../services/api';
import { AudioVisualizer } from '../components/AudioVisualizer';
import { WarningBanner } from '../components/WarningBanner';
import { Users, Copy, Check, Clock, Square, ArrowLeft, ShieldCheck, AlertOctagon, Sparkles, Play, AlertCircle, MicOff } from 'lucide-react';

export const VoiceRoomSession = ({ initialRoom, onLeaveRoom, onSessionFinished }) => {
  const { user } = useAuth();

  const [room, setRoom] = useState(initialRoom || null);
  const [sessionActive, setSessionActive] = useState(false);
  const [copied, setCopied] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [warningInfo, setWarningInfo] = useState(null);
  const [ejectedMsg, setEjectedMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [speechSupported, setSpeechSupported] = useState(true);

  const [liveTranscript, setLiveTranscript] = useState('');
  const [participantTranscripts, setParticipantTranscripts] = useState([]);
  
  const timerRef = useRef(null);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!initialRoom || !initialRoom.roomId || !user) {
      setErrorMsg('Room or user data is missing. Unable to join voice session.');
      return;
    }

    setRoom(initialRoom);
    setSpeechSupported(speechService.isSupported());

    socketRef.current = getSocket();
    const socket = socketRef.current;

    const initVoiceRoom = async () => {
      try {
        // Step 1: Initialize local audio stream (VOICE ONLY)
        await webrtcService.initLocalMicrophone();
        
        // Step 2: Setup socket WebRTC signaling
        webrtcService.setupSocketSignaling(socket);

        // Step 3: Join socket room
        socket.emit('join-room', { roomId: initialRoom.roomId, user });

        // Step 4: Start Web Speech API continuous recognition
        if (speechService.isSupported()) {
          speechService.start(
            (text) => {
              setLiveTranscript(text);
              // Broadcast live speech to server for AI moderation & peers
              socket.emit('speech-transcript', {
                roomId: initialRoom.roomId,
                transcript: text,
                topic: initialRoom.topic
              });
            },
            (err) => console.warn('Room speech notice:', err)
          );
        }

      } catch (err) {
        console.error('Room init error:', err);
        setErrorMsg(err.message || '🎙️ Microphone permission is required to transcribe your speech.');
      }
    };

    initVoiceRoom();

    // Socket Event Listeners
    socket.on('room-updated', (updatedRoom) => {
      if (updatedRoom) {
        setRoom(updatedRoom);
      }
    });

    socket.on('participant-transcript', ({ userName, transcript }) => {
      if (userName && transcript) {
        setParticipantTranscripts(prev => {
          const existing = prev.filter(p => p.userName !== userName);
          return [...existing, { userName, transcript, time: new Date().toLocaleTimeString() }];
        });
      }
    });

    socket.on('ai-warning', ({ warningCount, message }) => {
      setWarningInfo({ warningCount, message });
    });

    socket.on('session-terminated-violation', ({ message }) => {
      setEjectedMsg(message);
      speechService.stop();
      webrtcService.stopAll();
    });

    socket.on('session-started', () => {
      setSessionActive(true);
      startTimer();
    });

    socket.on('session-ended', () => {
      handleCompleteGroupSession();
    });

    socket.on('error-message', (msg) => {
      setErrorMsg(msg);
    });

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      speechService.stop();
      webrtcService.stopAll();
      if (socket && initialRoom && initialRoom.roomId) {
        socket.emit('leave-room', { roomId: initialRoom.roomId });
        socket.off('room-updated');
        socket.off('participant-transcript');
        socket.off('ai-warning');
        socket.off('session-terminated-violation');
        socket.off('session-started');
        socket.off('session-ended');
        socket.off('error-message');
      }
    };
  }, [initialRoom, user]);

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimerSeconds(prev => prev + 1);
    }, 1000);
  };

  const handleCopyRoomId = () => {
    if (room && room.roomId) {
      navigator.clipboard.writeText(room.roomId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleStartSession = () => {
    if (socketRef.current && room && room.roomId) {
      socketRef.current.emit('start-session', { roomId: room.roomId });
      setSessionActive(true);
      startTimer();
    }
  };

  const handleHostEndSession = () => {
    if (socketRef.current && room && room.roomId) {
      socketRef.current.emit('end-session', { roomId: room.roomId });
    }
    handleCompleteGroupSession();
  };

  const handleCompleteGroupSession = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    const finalSpeech = speechService.stop();
    webrtcService.stopAll();

    const cleanMySpeech = (finalSpeech || liveTranscript || '').trim();
    const fullTranscript = `Topic: ${room?.topic || 'Group Discussion'}\n` + 
      (cleanMySpeech ? `My Speech: ${cleanMySpeech}\n` : '') + 
      participantTranscripts.map(pt => `${pt.userName}: ${pt.transcript}`).join('\n');

    try {
      const savedSession = await api.createSession({
        activityType: 'group',
        activityName: room?.activityType || 'Group Discussion',
        topic: room?.topic || 'Group Practice Topic',
        durationSeconds: timerSeconds > 0 ? timerSeconds : 60,
        transcript: fullTranscript
      });

      onSessionFinished(savedSession);
    } catch (err) {
      console.error('Error saving group session results:', err);
      onLeaveRoom();
    }
  };

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (errorMsg) {
    return (
      <div style={{ maxWidth: '600px', margin: '80px auto', padding: '0 20px', textAlign: 'center' }}>
        <div className="glass-card" style={{ padding: '40px', border: '1px solid rgba(239, 68, 68, 0.4)' }}>
          <div style={{ padding: '16px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.2)', color: '#EF4444', display: 'inline-flex', marginBottom: '20px' }}>
            <AlertCircle size={40} />
          </div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#FCA5A5' }}>Voice Room Notice</h2>
          <p style={{ color: '#D1D5DB', margin: '16px 0 24px 0', lineHeight: 1.5 }}>{errorMsg}</p>
          <button onClick={onLeaveRoom} className="btn-primary">
            Return to Group Practice
          </button>
        </div>
      </div>
    );
  }

  if (ejectedMsg) {
    return (
      <div style={{ maxWidth: '600px', margin: '80px auto', padding: '0 20px', textAlign: 'center' }}>
        <div className="glass-card" style={{ padding: '40px', border: '1px solid rgba(239, 68, 68, 0.4)', background: 'rgba(239, 68, 68, 0.08)' }}>
          <div style={{ padding: '16px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.2)', color: '#EF4444', display: 'inline-flex', marginBottom: '20px' }}>
            <AlertOctagon size={48} />
          </div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#FCA5A5' }}>Session Terminated</h2>
          <p style={{ color: '#F3F4F6', fontSize: '1.05rem', margin: '16px 0 28px 0', lineHeight: 1.5 }}>
            {ejectedMsg}
          </p>
          <button onClick={onLeaveRoom} className="btn-primary">
            Return to Group Practice
          </button>
        </div>
      </div>
    );
  }

  if (!room || !user) {
    return (
      <div style={{ maxWidth: '600px', margin: '80px auto', padding: '0 20px', textAlign: 'center' }}>
        <div className="glass-card" style={{ padding: '40px' }}>
          <h3 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Opening Waiting Room...</h3>
        </div>
      </div>
    );
  }

  const participantsList = Array.isArray(room.participants) ? room.participants : [];
  const maxLimit = room.maxMembers || 4;
  const isHost = room.hostId && user.id && room.hostId.toString() === user.id.toString();
  const isFull = participantsList.length >= maxLimit;

  return (
    <div style={{ maxWidth: '1150px', margin: '0 auto', padding: '30px 20px' }}>
      
      {/* Speech Support Warning Banner if Browser Unsupported */}
      {!speechSupported && (
        <div style={{ margin: '0 0 20px 0', padding: '12px 20px', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#FCD34D', fontSize: '0.88rem' }}>
          ⚠️ Speech recognition is not supported in this browser. Please use Google Chrome or another supported browser for live voice transcription.
        </div>
      )}

      {/* Navigation & Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
        <button onClick={onLeaveRoom} className="btn-secondary" style={{ padding: '8px 16px' }}>
          <ArrowLeft size={18} /> Leave Room
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.3)', padding: '6px 14px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.85rem', color: '#9CA3AF', fontWeight: 600 }}>Room ID:</span>
            <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#A5B4FC', letterSpacing: '0.05em' }}>{room.roomId}</span>
            <button onClick={handleCopyRoomId} style={{ background: 'none', border: 'none', color: '#818CF8', cursor: 'pointer', display: 'flex', padding: '2px' }}>
              {copied ? <Check size={16} color="#10B981" /> : <Copy size={16} />}
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.05)', padding: '6px 16px', borderRadius: '10px' }}>
            <Clock size={16} color="#6366F1" />
            <span style={{ fontSize: '1rem', fontWeight: 800, fontFamily: 'monospace', color: '#F3F4F6' }}>
              {formatTimer(timerSeconds)}
            </span>
          </div>
        </div>
      </div>

      {/* AI Violation Warning Banner */}
      {warningInfo && (
        <WarningBanner warningCount={warningInfo.warningCount} message={warningInfo.message} />
      )}

      {/* Main Room Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        
        {/* Left Column: Room Overview & Active Participants */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Header Card */}
          <div className="glass-card" style={{ padding: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.88rem', color: '#A5B4FC', fontWeight: 700, textTransform: 'uppercase' }}>
                🎤 {room.activityType || 'Group Discussion'}
              </span>
              <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.2)', color: '#34D399', fontWeight: 700 }}>
                {!sessionActive ? 'Room Created Successfully' : '🔴 Live Session Active'}
              </span>
            </div>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#F3F4F6', marginBottom: '14px', lineHeight: 1.3 }}>
              "{room.topic || 'Group Topic'}"
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.82rem', color: '#9CA3AF' }}>
              <span>Host: <strong style={{ color: '#E5E7EB' }}>{room.hostName || 'Host'}</strong></span>
              <span>•</span>
              <span>Selected Limit: {maxLimit} Participants</span>
            </div>
          </div>

          {/* Participant Cards (Waiting Room & Active) */}
          <div className="glass-card" style={{ padding: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={18} color="#6366F1" /> Active Participants ({participantsList.length} / {maxLimit})
              </h3>
              {isFull ? (
                <span style={{ fontSize: '0.75rem', padding: '4px 10px', borderRadius: '20px', background: 'rgba(16, 185, 129, 0.15)', color: '#34D399', fontWeight: 700 }}>
                  ✅ Everyone is Ready ({participantsList.length}/{maxLimit})
                </span>
              ) : (
                <span style={{ fontSize: '0.75rem', padding: '4px 10px', borderRadius: '20px', background: 'rgba(245, 158, 11, 0.15)', color: '#F59E0B', fontWeight: 700 }}>
                  ⏳ Waiting for participants...
                </span>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
              {participantsList.map((p, idx) => {
                const isHostParticipant = room.hostId && p.userId && room.hostId.toString() === p.userId.toString();
                return (
                  <div key={idx} style={{
                    padding: '16px',
                    borderRadius: '14px',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}>
                    <div style={{ position: 'relative' }}>
                      <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1rem' }}>
                        {p.userName ? p.userName[0].toUpperCase() : 'P'}
                      </div>
                      <span style={{ position: 'absolute', bottom: 0, right: 0, width: '12px', height: '12px', borderRadius: '50%', background: '#10B981', border: '2px solid #111827' }} />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                      <span style={{ fontSize: '0.92rem', fontWeight: 700, color: '#F3F4F6', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        🟢 {isHostParticipant ? 'Host - ' : ''}{p.userName}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: '#10B981', fontWeight: 600 }}>
                        Microphone Active
                      </span>
                    </div>
                  </div>
                );
              })}

              {/* Empty Slots up to maxLimit */}
              {Array.from({ length: Math.max(0, maxLimit - participantsList.length) }).map((_, idx) => (
                <div key={idx} style={{
                  padding: '16px',
                  borderRadius: '14px',
                  border: '1px dashed rgba(255,255,255,0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justify: 'center',
                  color: '#6B7280',
                  fontSize: '0.8rem',
                  fontWeight: 600
                }}>
                  + Waiting for participant
                </div>
              ))}
            </div>

            {/* Audio Visualizer */}
            <div style={{ marginTop: '24px', textAlign: 'center' }}>
              <AudioVisualizer isActive={true} label="Microphone Active (Voice Only)" />
            </div>
          </div>

          {/* Host / Participant Session Controls */}
          <div className="glass-card" style={{ padding: '20px' }}>
            {isHost && !sessionActive && (
              <div>
                <button
                  onClick={handleStartSession}
                  disabled={!isFull}
                  className="btn-primary"
                  style={{ width: '100%', padding: '14px', justifyContent: 'center', opacity: !isFull ? 0.5 : 1, cursor: !isFull ? 'not-allowed' : 'pointer' }}
                >
                  <Play size={18} /> {isFull ? 'Start Discussion Session' : `Waiting for Participants (${participantsList.length} / ${maxLimit})`}
                </button>
                {!isFull && (
                  <span style={{ fontSize: '0.78rem', color: '#9CA3AF', display: 'block', textAlign: 'center', marginTop: '8px' }}>
                    Start Session button will enable once all {maxLimit} participants join.
                  </span>
                )}
              </div>
            )}

            {isHost && sessionActive && (
              <button onClick={handleHostEndSession} className="btn-danger" style={{ width: '100%', padding: '14px', justifyContent: 'center' }}>
                <Square size={18} /> End Discussion & Evaluate Group
              </button>
            )}

            {!isHost && (
              <button onClick={handleCompleteGroupSession} className="btn-primary" style={{ width: '100%', padding: '14px', justifyContent: 'center' }}>
                Finish My Response & Get AI Score
              </button>
            )}
          </div>

        </div>

        {/* Right Column: AI Live Speech & Read-Only Transcript Stream */}
        <div className="glass-card" style={{ padding: '28px', display: 'flex', flexDirection: 'column' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={18} color="#818CF8" /> AI Live Transcript Stream
            </h3>
            <span style={{ fontSize: '0.75rem', color: '#10B981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <ShieldCheck size={14} /> AI Moderation Active
            </span>
          </div>

          {/* STRICTLY READ-ONLY LIVE SPEECH TRANSCRIPT */}
          <div style={{ margin: '12px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#A5B4FC' }}>
                Your Spoken Text (READ-ONLY)
              </label>
              <span style={{ fontSize: '0.72rem', color: '#9CA3AF' }}>🔒 Driven by Microphone</span>
            </div>
            
            <div
              className="glass-input"
              style={{
                minHeight: '100px',
                maxHeight: '150px',
                overflowY: 'auto',
                lineHeight: 1.5,
                color: liveTranscript ? '#F3F4F6' : '#6B7280',
                userSelect: 'none',
                WebkitUserSelect: 'none',
                cursor: 'default',
                background: 'rgba(15, 23, 42, 0.9)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                padding: '14px'
              }}
            >
              {liveTranscript || 'Speak clearly into your microphone... Your spoken text will appear here automatically.'}
            </div>
          </div>

          {/* Read-Only Participant Transcript Stream */}
          <div style={{ flex: 1, marginTop: '16px', display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#9CA3AF', marginBottom: '8px' }}>
              Peer Speech Activity Stream (Read-Only)
            </span>
            <div style={{
              flex: 1,
              minHeight: '220px',
              maxHeight: '340px',
              overflowY: 'auto',
              background: 'rgba(0,0,0,0.3)',
              borderRadius: '12px',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              userSelect: 'none',
              WebkitUserSelect: 'none'
            }}>
              {participantTranscripts.length === 0 ? (
                <span style={{ color: '#6B7280', fontSize: '0.85rem', fontStyle: 'italic', textAlign: 'center', marginTop: '40px' }}>
                  Live speech transcripts from participants will stream here...
                </span>
              ) : (
                participantTranscripts.map((pt, idx) => (
                  <div key={idx} style={{ background: 'rgba(255,255,255,0.04)', padding: '10px 14px', borderRadius: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#818CF8', fontWeight: 700, marginBottom: '4px' }}>
                      <span>🗣 {pt.userName}</span>
                      <span style={{ color: '#6B7280' }}>{pt.time}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.88rem', color: '#E5E7EB', lineHeight: 1.4 }}>
                      "{pt.transcript}"
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
