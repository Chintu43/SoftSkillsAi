import React from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
  useParams
} from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { api } from './services/api';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { LandingPage } from './pages/LandingPage';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { IndividualPractice } from './pages/IndividualPractice';
import { ActivitySession } from './pages/ActivitySession';
import { AIVoiceDebateSession } from './pages/AIVoiceDebateSession';
import { GroupPractice } from './pages/GroupPractice';
import { VoiceRoomSession } from './pages/VoiceRoomSession';
import { ResultsPage } from './pages/ResultsPage';
import { ProgressDashboard } from './pages/ProgressDashboard';
import { ActivityHistory } from './pages/ActivityHistory';
import { AICoach } from './pages/AICoach';
import { Profile } from './pages/Profile';

// ── Tab-name → route path mapping (same IDs Navbar used before) ──────────────
const TAB_TO_PATH = {
  landing:       '/',
  login:         '/login',
  register:      '/register',
  dashboard:     '/dashboard',
  individual:    '/practice',
  group:         '/group',
  progress:      '/progress',
  history:       '/history',
  aicoach:       '/coach',
  profile:       '/profile',
};

// ── Require authentication; redirect to landing if not logged-in ─────────────
function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? children : <Navigate to="/" replace />;
}

// ── Redirect logged-in users away from auth pages ───────────────────────────
function RequireGuest({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return !user ? children : <Navigate to="/dashboard" replace />;
}

// ── ActivitySession wrapper: reads activity from router location.state ───────
function ActivitySessionRoute() {
  const navigate = useNavigate();
  const location = useLocation();
  const activity = location.state?.activity;

  // If someone navigates directly to /practice/:activity without state, go back to /practice
  if (!activity) return <Navigate to="/practice" replace />;

  const handleComplete = (session) => {
    navigate(`/results/${session._id || session.id || 'latest'}`, {
      state: { session }
    });
  };

  return (
    <ActivitySession
      activity={activity}
      onBack={() => navigate('/practice')}
      onComplete={handleComplete}
    />
  );
}

// ── AIVoiceDebateSession wrapper ─────────────────────────────────────────────
function AIVoiceDebateRoute() {
  const navigate = useNavigate();

  const handleComplete = (session) => {
    navigate(`/results/${session._id || session.id || 'latest'}`, {
      state: { session }
    });
  };

  return (
    <AIVoiceDebateSession
      onBack={() => navigate('/practice')}
      onComplete={handleComplete}
    />
  );
}

// ── VoiceRoomSession wrapper: reads room from location.state ─────────────────
function VoiceRoomRoute() {
  const navigate = useNavigate();
  const location = useLocation();
  const room = location.state?.room;

  if (!room) return <Navigate to="/group" replace />;

  const handleComplete = (session) => {
    navigate(`/results/${session._id || session.id || 'latest'}`, {
      state: { session }
    });
  };

  return (
    <VoiceRoomSession
      initialRoom={room}
      onLeaveRoom={() => navigate('/group')}
      onSessionFinished={handleComplete}
    />
  );
}

// ── GroupPractice wrapper: passes onEnterRoom that navigates to voice-room ───
function GroupPracticeRoute() {
  const navigate = useNavigate();

  const handleEnterRoom = (room) => {
    navigate('/voice-room', { state: { room } });
  };

  return <GroupPractice onEnterRoom={handleEnterRoom} />;
}

// ── IndividualPractice wrapper: navigates to the correct session route ────────
function IndividualPracticeRoute() {
  const navigate = useNavigate();

  const handleStartSession = (activity) => {
    if (activity.id === 'ai-voice-debate') {
      navigate('/practice/ai-voice-debate');
    } else {
      navigate(`/practice/${activity.id}`, { state: { activity } });
    }
  };

  return <IndividualPractice onStartSession={handleStartSession} />;
}

// ── ResultsPage wrapper: reads session from location.state or fetches by id ──
function ResultsPageRoute() {
  const navigate = useNavigate();
  const location = useLocation();
  const { sessionId } = useParams();
  const { refreshUser } = useAuth();

  const [session, setSession] = React.useState(location.state?.session || null);
  const [loading, setLoading] = React.useState(!session);

  React.useEffect(() => {
    // Refresh user stats whenever results page mounts
    refreshUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (!session && sessionId && sessionId !== 'latest') {
      api.getSessionById(sessionId)
        .then(data => { setSession(data); setLoading(false); })
        .catch(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [session, sessionId]);

  if (loading && !session) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: 'var(--text-muted)' }}>
        Loading session results…
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <ResultsPage
      session={session}
      onDashboard={() => navigate('/dashboard')}
      onNewSession={() => navigate('/practice')}
    />
  );
}

// ── ActivityHistory: view a past session's results ───────────────────────────
function ActivityHistoryRoute() {
  const navigate = useNavigate();

  const handleViewSession = (sess) => {
    navigate(`/results/${sess._id || sess.id || 'latest'}`, { state: { session: sess } });
  };

  return <ActivityHistory onViewSession={handleViewSession} />;
}

// ── Dashboard wrapper: convert tab names → paths ────────────────────────────
function DashboardRoute() {
  const navigate = useNavigate();

  const handleNavigate = (tab) => {
    const path = TAB_TO_PATH[tab] || '/dashboard';
    navigate(path);
  };

  return <Dashboard onNavigate={handleNavigate} />;
}

// ── Main routed app layout ────────────────────────────────────────────────────
function MainApp() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', color: 'var(--text-muted)' }}>
        Loading SkillForge AI Platform…
      </div>
    );
  }

  // Derive activeTab from current path so Navbar highlights correctly
  const pathToTab = {
    '/':                  'landing',
    '/login':             'login',
    '/register':          'register',
    '/dashboard':         'dashboard',
    '/practice':          'individual',
    '/group':             'group',
    '/voice-room':        'group',
    '/progress':          'progress',
    '/history':           'history',
    '/coach':             'aicoach',
    '/profile':           'profile',
  };
  const currentPath = '/' + location.pathname.split('/')[1];
  const activeTab = pathToTab[currentPath] || 'dashboard';

  const handleNavbarNavigate = (tab) => {
    const path = TAB_TO_PATH[tab] || '/dashboard';
    navigate(path);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
      <Navbar activeTab={activeTab} setActiveTab={handleNavbarNavigate} />

      <main style={{ flex: 1, paddingBottom: '20px' }}>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={
            user ? <Navigate to="/dashboard" replace /> : <LandingPage onNavigate={handleNavbarNavigate} />
          } />
          <Route path="/login" element={
            <RequireGuest><Login onNavigate={handleNavbarNavigate} /></RequireGuest>
          } />
          <Route path="/register" element={
            <RequireGuest><Register onNavigate={handleNavbarNavigate} /></RequireGuest>
          } />

          {/* Protected routes */}
          <Route path="/dashboard"          element={<RequireAuth><DashboardRoute /></RequireAuth>} />
          <Route path="/practice"           element={<RequireAuth><IndividualPracticeRoute /></RequireAuth>} />
          <Route path="/practice/ai-voice-debate" element={<RequireAuth><AIVoiceDebateRoute /></RequireAuth>} />
          <Route path="/practice/:activity" element={<RequireAuth><ActivitySessionRoute /></RequireAuth>} />
          <Route path="/group"              element={<RequireAuth><GroupPracticeRoute /></RequireAuth>} />
          <Route path="/voice-room"         element={<RequireAuth><VoiceRoomRoute /></RequireAuth>} />
          <Route path="/results/:sessionId" element={<RequireAuth><ResultsPageRoute /></RequireAuth>} />
          <Route path="/progress"           element={<RequireAuth><ProgressDashboard /></RequireAuth>} />
          <Route path="/history"            element={<RequireAuth><ActivityHistoryRoute /></RequireAuth>} />
          <Route path="/coach"              element={<RequireAuth><AICoach /></RequireAuth>} />
          <Route path="/profile"            element={<RequireAuth><Profile /></RequireAuth>} />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to={user ? '/dashboard' : '/'} replace />} />
        </Routes>
      </main>

      <Footer />
    </div>
  );
}

// ── Root export with providers ────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <MainApp />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
