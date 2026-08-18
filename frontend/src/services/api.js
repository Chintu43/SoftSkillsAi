const API_BASE = `${import.meta.env.VITE_API_URL}/api`;

const getHeaders = () => {
  const token = localStorage.getItem('skillforge_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
};

export const api = {
  async register(name, email, password) {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Registration failed');
    return data;
  },

  async login(email, password) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Login failed');
    return data;
  },

  async getProfile() {
    const res = await fetch(`${API_BASE}/user/profile`, {
      headers: getHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to fetch profile');
    return data;
  },

  async validateTopic(topic, activityName) {
    try {
      const res = await fetch(`${API_BASE}/ai/validate-topic`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ topic, activityName })
      });

      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server returned non-JSON response');
      }

      const data = await res.json();
      return {
        valid: data.valid !== undefined ? data.valid : data.isValid,
        topic: data.topic || data.approvedTopic || topic,
        message: data.message || 'Topic check complete'
      };
    } catch (err) {
      console.warn('Validate topic network/parse exception:', err.message);
      throw new Error('⚠️ Unable to validate topic. Please try again.');
    }
  },

  async createSession(sessionData) {
    const res = await fetch(`${API_BASE}/sessions`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(sessionData)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to save session');
    return data;
  },

  async getUserSessions() {
    const res = await fetch(`${API_BASE}/sessions`, {
      headers: getHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to fetch sessions');
    return data;
  },

  async getSessionById(id) {
    const res = await fetch(`${API_BASE}/sessions/${id}`, {
      headers: getHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to fetch session');
    return data;
  },

  async createRoom(activityType, topic, maxMembers) {
    const res = await fetch(`${API_BASE}/rooms/create`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ activityType, topic, maxMembers })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to create room');
    return data;
  },

  async joinRoom(roomId) {
    const res = await fetch(`${API_BASE}/rooms/join`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ roomId })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to join room');
    return data;
  },

  async getRoom(roomId) {
    const res = await fetch(`${API_BASE}/rooms/${roomId}`, {
      headers: getHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to fetch room');
    return data;
  },

  async getAICoachFeedback(question) {
    const res = await fetch(`${API_BASE}/ai/feedback`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ question })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to get AI response');
    return data;
  },

  async getInterviewQuestions() {
    const res = await fetch(`${API_BASE}/ai/interview`, {
      headers: getHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to fetch interview questions');
    return data;
  },

  async getDebateCounterargument(topic, userArgument, conversationHistory, roundNumber) {
    const res = await fetch(`${API_BASE}/ai/debate-counterargument`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ topic, userArgument, conversationHistory, roundNumber })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to generate debate counterargument');
    return data;
  }
};
