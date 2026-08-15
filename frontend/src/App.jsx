import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { LandingPage } from './pages/LandingPage';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { IndividualPractice } from './pages/IndividualPractice';
import { ActivitySession } from './pages/ActivitySession';
import { GroupPractice } from './pages/GroupPractice';
import { VoiceRoomSession } from './pages/VoiceRoomSession';
import { ResultsPage } from './pages/ResultsPage';
import { ProgressDashboard } from './pages/ProgressDashboard';
import { ActivityHistory } from './pages/ActivityHistory';
import { AICoach } from './pages/AICoach';
import { Profile } from './pages/Profile';

function MainApp() {
  const { user, loading, refreshUser } = useAuth();
  const [activeTab, setActiveTab] = useState('landing');
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [activeRoom, setActiveRoom] = useState(null);
  const [sessionResults, setSessionResults] = useState(null);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', color: '#9CA3AF' }}>
        Loading SoftSkill AI Platform...
      </div>
    );
  }

  // Handle default tab for logged-in vs non-logged-in users
  const currentTab = (!user && ['dashboard', 'individual', 'group', 'progress', 'history', 'aicoach', 'profile'].includes(activeTab))
    ? 'landing'
    : (user && activeTab === 'landing' ? 'dashboard' : activeTab);

  const handleStartSoloActivity = (activity) => {
    setSelectedActivity(activity);
    setActiveTab('active-session');
  };

  const handleEnterRoom = (room) => {
    setActiveRoom(room);
    setActiveTab('voice-room');
  };

  const handleCompleteSession = (session) => {
    setSessionResults(session);
    refreshUser();
    setActiveTab('results');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* Top Navbar */}
      <Navbar activeTab={currentTab} setActiveTab={setActiveTab} />

      {/* Main Content Area */}
      <main style={{ flex: 1, paddingBottom: '60px' }}>
        {currentTab === 'landing' && (
          <LandingPage onNavigate={(tab) => setActiveTab(tab)} />
        )}

        {currentTab === 'login' && (
          <Login onNavigate={(tab) => setActiveTab(tab)} />
        )}

        {currentTab === 'register' && (
          <Register onNavigate={(tab) => setActiveTab(tab)} />
        )}

        {currentTab === 'dashboard' && user && (
          <Dashboard onNavigate={(tab) => setActiveTab(tab)} />
        )}

        {currentTab === 'individual' && user && (
          <IndividualPractice onStartSession={handleStartSoloActivity} />
        )}

        {currentTab === 'active-session' && selectedActivity && user && (
          <ActivitySession
            activity={selectedActivity}
            onBack={() => setActiveTab('individual')}
            onComplete={handleCompleteSession}
          />
        )}

        {currentTab === 'group' && user && (
          <GroupPractice onEnterRoom={handleEnterRoom} />
        )}

        {currentTab === 'voice-room' && activeRoom && user && (
          <VoiceRoomSession
            initialRoom={activeRoom}
            onLeaveRoom={() => setActiveTab('group')}
            onSessionFinished={handleCompleteSession}
          />
        )}

        {currentTab === 'results' && sessionResults && (
          <ResultsPage
            session={sessionResults}
            onDashboard={() => setActiveTab('dashboard')}
            onNewSession={() => setActiveTab('individual')}
          />
        )}

        {currentTab === 'progress' && user && (
          <ProgressDashboard />
        )}

        {currentTab === 'history' && user && (
          <ActivityHistory onViewSession={(sess) => handleCompleteSession(sess)} />
        )}

        {currentTab === 'aicoach' && user && (
          <AICoach />
        )}

        {currentTab === 'profile' && user && (
          <Profile />
        )}
      </main>

    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
