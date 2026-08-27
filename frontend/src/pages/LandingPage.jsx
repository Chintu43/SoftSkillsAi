import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, Users, Award, TrendingUp, Sparkles, CheckCircle2, ArrowRight, Zap } from 'lucide-react';

export const LandingPage = ({ onNavigate }) => {
  const navigate = useNavigate();
  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px 80px 20px' }}>
      
      {/* Hero Section */}
      <section style={{ textAlign: 'center', padding: '60px 20px 80px 20px', position: 'relative' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '9999px', background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.3)', color: '#A5B4FC', fontWeight: 600, fontSize: '0.85rem', marginBottom: '24px' }}>
          <Sparkles size={16} /> SkillForge AI • Soft Skills Training & Evaluation Platform
        </div>

        <h1 style={{ fontSize: '3.6rem', fontWeight: 800, lineHeight: 1.1, marginBottom: '20px' }}>
          Master Communication & Soft Skills with <span className="text-gradient">SkillForge AI</span>
        </h1>

        <p style={{ fontSize: '1.3rem', color: '#9CA3AF', maxWidth: '680px', margin: '0 auto 36px auto', fontWeight: 500 }}>
          Practice. Speak. Get evaluated. Improve.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <button onClick={() => navigate('/register')} className="btn-primary" style={{ padding: '16px 36px', fontSize: '1.05rem' }}>
            Start Practicing <ArrowRight size={20} />
          </button>
          <button onClick={() => navigate('/register')} className="btn-secondary" style={{ padding: '16px 36px', fontSize: '1.05rem' }}>
            <Users size={20} /> Join a Group
          </button>
        </div>
      </section>

      {/* Why Soft Skills? Section */}
      <section style={{ marginBottom: '80px' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h2 style={{ fontSize: '2.2rem', fontWeight: 700 }}>Why Soft Skills Matter?</h2>
          <p style={{ color: '#9CA3AF', fontSize: '1rem', marginTop: '8px' }}>
            Technical competence gets you interviewed. Exceptional soft skills get you hired and promoted.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
          {[
            { icon: Zap, title: '85% Career Success', desc: 'Studies show 85% of job success comes from well-developed soft skills and communication abilities.' },
            { icon: Users, title: 'Group & Leadership Dynamics', desc: 'Excel in Group Discussions, Debates, and Team Problem Solving with real-time peer interactions.' },
            { icon: Award, title: 'Objective AI Evaluation', desc: 'Receive instant, unbiased feedback on fluency, confidence, filler words, grammar, and topic relevance.' }
          ].map((item, idx) => {
            const Icon = item.icon;
            return (
              <div key={idx} className="glass-card" style={{ padding: '30px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(99, 102, 241, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818CF8', marginBottom: '20px' }}>
                  <Icon size={24} />
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '10px' }}>{item.title}</h3>
                <p style={{ color: '#9CA3AF', fontSize: '0.92rem', lineHeight: 1.6 }}>{item.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Individual Practice Section */}
      <section style={{ marginBottom: '80px' }}>
        <div className="glass-card" style={{ padding: '40px', background: 'linear-gradient(135deg, rgba(17, 24, 39, 0.9), rgba(30, 27, 75, 0.6))' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#A5B4FC', fontWeight: 700, marginBottom: '12px' }}>
            <Mic size={24} /> INDIVIDUAL PRACTICE MODES
          </div>
          <h2 style={{ fontSize: '2.2rem', fontWeight: 800, marginBottom: '20px' }}>12+ Tailored Solo Speech Activities</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px', marginTop: '24px' }}>
            {[
              '🎤 JAM Session', '👤 Self Introduction', '💼 Interview Practice',
              '📖 Storytelling', '⚡ Impromptu Speaking', '🗣 Communication Practice',
              '📚 Vocabulary Practice', '🎯 Situational Speaking', '🎤 Presentation Practice',
              '👑 Leadership Practice', '💖 Confidence Practice', '🎯 Pronunciation'
            ].map((act, i) => (
              <div key={i} style={{ padding: '14px 18px', borderRadius: '12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', fontWeight: 600, fontSize: '0.95rem' }}>
                {act}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Group Practice & Real-Time Audio */}
      <section style={{ marginBottom: '80px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '30px' }}>
          <div className="glass-card" style={{ padding: '36px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(6, 182, 212, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#06B6D4', marginBottom: '20px' }}>
              <Users size={26} />
            </div>
            <h3 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '12px' }}>Real-Time Group Practice</h3>
            <p style={{ color: '#9CA3AF', lineHeight: 1.6, marginBottom: '20px' }}>
              Participate in live audio meetings (Group Discussion, Debate, Team Discussion, Collaborative Problem Solving) with 2, 3, or 4 participants.
            </p>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', color: '#D1D5DB' }}>
                <CheckCircle2 size={18} color="#10B981" /> Peer-to-Peer WebRTC Voice Mesh
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', color: '#10B981' }}>
                <CheckCircle2 size={18} color="#10B981" /> Host Selects Max 2, 3, or 4 Participants
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', color: '#D1D5DB' }}>
                <CheckCircle2 size={18} color="#10B981" /> AI Moderation & Warning Safety System
              </li>
            </ul>
          </div>

          <div className="glass-card" style={{ padding: '36px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(139, 92, 246, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#C084FC', marginBottom: '20px' }}>
              <TrendingUp size={26} />
            </div>
            <h3 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '12px' }}>Comprehensive AI Analytics</h3>
            <p style={{ color: '#9CA3AF', lineHeight: 1.6, marginBottom: '20px' }}>
              Gemini AI evaluates speech transcripts across 10 vital dimensions to guide your continuous improvement.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {['Fluency', 'Grammar', 'Confidence', 'Vocabulary', 'Clarity', 'Topic Relevance', 'Professionalism', 'Leadership'].map((tag, i) => (
                <span key={i} style={{ padding: '6px 12px', borderRadius: '8px', background: 'rgba(139, 92, 246, 0.15)', color: '#C084FC', fontSize: '0.8rem', fontWeight: 600 }}>
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Footer */}
      <section style={{ textAlign: 'center', padding: '60px 20px' }} className="glass-card">
        <h2 style={{ fontSize: '2.4rem', fontWeight: 800, marginBottom: '16px' }}>Ready to Master Soft Skills?</h2>
        <p style={{ color: '#9CA3AF', fontSize: '1.1rem', marginBottom: '28px' }}>Join thousands of students and professionals advancing their career communication skills.</p>
        <button onClick={() => navigate('/register')} className="btn-primary" style={{ padding: '16px 40px', fontSize: '1.1rem' }}>
          Get Started Now <ArrowRight size={20} />
        </button>
      </section>

    </div>
  );
};
