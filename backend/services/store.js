import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getMongoStatus } from '../config/db.js';
import User from '../models/User.js';
import Session from '../models/Session.js';
import Room from '../models/Room.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadFallbackDB() {
  if (!fs.existsSync(DB_FILE)) {
    const initial = { users: [], sessions: [], rooms: [] };
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2));
    return initial;
  }
  try {
    const content = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(content);
  } catch (e) {
    return { users: [], sessions: [], rooms: [] };
  }
}

function saveFallbackDB(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Error saving fallback DB:', e);
  }
}

export const Store = {
  // --- USERS ---
  async createUser(userData) {
    if (getMongoStatus()) {
      const user = new User(userData);
      return await user.save();
    } else {
      const db = loadFallbackDB();
      const newUser = {
        _id: 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        ...userData,
        overallScore: 0,
        communicationScore: 0,
        confidenceScore: 0,
        fluencyScore: 0,
        grammarScore: 0,
        vocabularyScore: 0,
        leadershipScore: 0,
        listeningScore: 0,
        clarityScore: 0,
        teamworkScore: 0,
        criticalThinkingScore: 0,
        topicRelevanceScore: 0,
        sessionsCompleted: 0,
        groupSessions: 0,
        individualSessions: 0,
        improvementPercentage: 0,
        level: 'Beginner',
        createdAt: new Date().toISOString()
      };
      db.users.push(newUser);
      saveFallbackDB(db);
      return newUser;
    }
  },

  async findUserByEmail(email) {
    if (getMongoStatus()) {
      return await User.findOne({ email });
    } else {
      const db = loadFallbackDB();
      return db.users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
    }
  },

  async findUserById(id) {
    if (getMongoStatus()) {
      return await User.findById(id);
    } else {
      const db = loadFallbackDB();
      return db.users.find(u => u._id.toString() === id.toString()) || null;
    }
  },

  async updateUserStats(userId, sessionData) {
    const updateStatsForUserObj = (user) => {
      user.sessionsCompleted = (user.sessionsCompleted || 0) + 1;
      if (sessionData.activityType === 'group') {
        user.groupSessions = (user.groupSessions || 0) + 1;
      } else {
        user.individualSessions = (user.individualSessions || 0) + 1;
      }
      const scores = sessionData.scores || {};
      const count = user.sessionsCompleted;
      
      // Update running averages ONLY when sessions exist
      if (scores.overall !== undefined) {
        user.overallScore = count === 1 ? scores.overall : Math.round((user.overallScore * (count - 1) + scores.overall) / count);
      }
      if (scores.communication) user.communicationScore = count === 1 ? scores.communication : Math.round((user.communicationScore + scores.communication) / 2);
      if (scores.confidence) user.confidenceScore = count === 1 ? scores.confidence : Math.round((user.confidenceScore + scores.confidence) / 2);
      if (scores.fluency) user.fluencyScore = count === 1 ? scores.fluency : Math.round((user.fluencyScore + scores.fluency) / 2);
      if (scores.grammar) user.grammarScore = count === 1 ? scores.grammar : Math.round((user.grammarScore + scores.grammar) / 2);
      if (scores.vocabulary) user.vocabularyScore = count === 1 ? scores.vocabulary : Math.round((user.vocabularyScore + scores.vocabulary) / 2);
      if (scores.leadership) user.leadershipScore = count === 1 ? scores.leadership : Math.round((user.leadershipScore + scores.leadership) / 2);
      if (scores.clarity) user.clarityScore = count === 1 ? scores.clarity : Math.round(((user.clarityScore || scores.clarity) + scores.clarity) / 2);
      if (scores.topicRelevance) user.topicRelevanceScore = count === 1 ? scores.topicRelevance : Math.round(((user.topicRelevanceScore || scores.topicRelevance) + scores.topicRelevance) / 2);

      // Determine level
      if (user.overallScore >= 88) user.level = 'Excellent';
      else if (user.overallScore >= 78) user.level = 'Advanced';
      else if (user.overallScore >= 65) user.level = 'Intermediate';
      else user.level = 'Beginner';

      user.improvementPercentage = Math.min(35, Math.round((user.sessionsCompleted * 3.5)));
    };

    if (getMongoStatus()) {
      const user = await User.findById(userId);
      if (!user) return null;
      updateStatsForUserObj(user);
      await user.save();
      return user;
    } else {
      const db = loadFallbackDB();
      const user = db.users.find(u => u._id.toString() === userId.toString());
      if (!user) return null;
      updateStatsForUserObj(user);
      saveFallbackDB(db);
      return user;
    }
  },

  // --- SESSIONS ---
  async createSession(sessionData) {
    if (getMongoStatus()) {
      const session = new Session(sessionData);
      return await session.save();
    } else {
      const db = loadFallbackDB();
      const newSession = {
        _id: 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        ...sessionData,
        createdAt: new Date().toISOString()
      };
      db.sessions.push(newSession);
      saveFallbackDB(db);
      return newSession;
    }
  },

  async getUserSessions(userId) {
    if (getMongoStatus()) {
      return await Session.find({ userId }).sort({ createdAt: -1 });
    } else {
      const db = loadFallbackDB();
      return db.sessions
        .filter(s => s.userId.toString() === userId.toString())
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
  },

  async getSessionById(sessionId) {
    if (getMongoStatus()) {
      return await Session.findById(sessionId);
    } else {
      const db = loadFallbackDB();
      return db.sessions.find(s => s._id.toString() === sessionId.toString()) || null;
    }
  },

  // --- ROOMS ---
  async createRoom(roomData) {
    if (getMongoStatus()) {
      const room = new Room(roomData);
      return await room.save();
    } else {
      const db = loadFallbackDB();
      const newRoom = {
        _id: 'room_' + Date.now(),
        ...roomData,
        participants: roomData.participants || [],
        createdAt: new Date().toISOString()
      };
      db.rooms.push(newRoom);
      saveFallbackDB(db);
      return newRoom;
    }
  },

  async findRoomById(roomId) {
    if (getMongoStatus()) {
      return await Room.findOne({ roomId: roomId.toUpperCase() });
    } else {
      const db = loadFallbackDB();
      return db.rooms.find(r => r.roomId.toUpperCase() === roomId.toUpperCase()) || null;
    }
  },

  async updateRoom(roomId, updateFn) {
    if (getMongoStatus()) {
      const room = await Room.findOne({ roomId: roomId.toUpperCase() });
      if (!room) return null;
      updateFn(room);
      return await room.save();
    } else {
      const db = loadFallbackDB();
      const room = db.rooms.find(r => r.roomId.toUpperCase() === roomId.toUpperCase());
      if (!room) return null;
      updateFn(room);
      saveFallbackDB(db);
      return room;
    }
  }
};
