import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { MessageSquareText, Send, Sparkles, User, Bot, Lightbulb } from 'lucide-react';

export const AICoach = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState([
    {
      sender: 'ai',
      text: `Hello ${user?.name || 'there'}! 👋 I am your personal AI Soft Skills & Communication Coach. Ask me anything about improving your confidence, vocal fluency, interview responses, or group discussion strategies!`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const sampleQuestions = [
    "How can I improve my confidence during public speaking?",
    "How do I eliminate filler words like 'um' and 'basically'?",
    "What are the best strategies to perform better in Group Discussions (GD)?",
    "How can I structure my interview answers using the STAR format?"
  ];

  const handleSend = async (questionText) => {
    const q = questionText || input;
    if (!q || !q.trim()) return;

    const userMsg = {
      sender: 'user',
      text: q,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    if (!questionText) setInput('');
    setLoading(true);

    try {
      const data = await api.getAICoachFeedback(q);
      const aiMsg = {
        sender: 'ai',
        text: data.answer,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      setMessages(prev => [...prev, {
        sender: 'ai',
        text: 'I encountered an error processing your query. Please try asking again!',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '30px 20px' }}>
      
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '2.2rem', fontWeight: 800 }}>AI Soft Skills Coach</h1>
        <p style={{ color: '#9CA3AF', fontSize: '1rem', marginTop: '6px' }}>
          Interactive mentor powered by Gemini AI. Contextualized to your past evaluation history.
        </p>
      </div>

      {/* Suggested Prompt Chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '24px' }}>
        {sampleQuestions.map((q, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(q)}
            style={{
              padding: '8px 14px',
              borderRadius: '20px',
              background: 'rgba(99, 102, 241, 0.1)',
              border: '1px solid rgba(99, 102, 241, 0.25)',
              color: '#A5B4FC',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Lightbulb size={14} /> {q}
          </button>
        ))}
      </div>

      {/* Chat Container */}
      <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', height: '580px' }}>
        
        {/* Messages Stream */}
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '10px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {messages.map((msg, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                gap: '12px',
                alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '82%'
              }}
            >
              {msg.sender === 'ai' && (
                <div style={{ width: '38px', height: '38px', borderRadius: '12px', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexShrink: 0 }}>
                  <Bot size={20} />
                </div>
              )}

              <div style={{
                background: msg.sender === 'user' ? 'linear-gradient(135deg, #6366F1, #4F46E5)' : 'rgba(255, 255, 255, 0.05)',
                border: msg.sender === 'user' ? 'none' : '1px solid rgba(255, 255, 255, 0.08)',
                padding: '14px 18px',
                borderRadius: '16px',
                color: '#F3F4F6'
              }}>
                <p style={{ margin: 0, fontSize: '0.94rem', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                  {msg.text}
                </p>
                <span style={{ fontSize: '0.7rem', color: msg.sender === 'user' ? '#C7D2FE' : '#9CA3AF', marginTop: '6px', display: 'block', textAlign: 'right' }}>
                  {msg.time}
                </span>
              </div>

              {msg.sender === 'user' && (
                <div style={{ width: '38px', height: '38px', borderRadius: '12px', background: 'linear-gradient(135deg, #06B6D4, #3B82F6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexShrink: 0 }}>
                  <User size={20} />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div style={{ display: 'flex', gap: '12px', alignSelf: 'flex-start' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '12px', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                <Bot size={20} />
              </div>
              <div className="glass-card" style={{ padding: '12px 20px', color: '#9CA3AF', fontSize: '0.9rem' }}>
                AI Coach is crafting personalized advice...
              </div>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          style={{ display: 'flex', gap: '12px', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.08)' }}
        >
          <input
            type="text"
            className="glass-input"
            placeholder="Ask AI Coach a question..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button type="submit" disabled={loading || !input.trim()} className="btn-primary" style={{ padding: '12px 24px' }}>
            <Send size={18} />
          </button>
        </form>

      </div>

    </div>
  );
};
