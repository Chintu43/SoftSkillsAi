import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Store } from '../services/store.js';

const JWT_SECRET = process.env.JWT_SECRET || 'softskills_ai_jwt_secret_key_2026_super_secure';

const generateToken = (id, name, email) => {
  return jwt.sign({ id, name, email }, JWT_SECRET, { expiresIn: '7d' });
};

// Return the full user profile object (all scores, sessions, etc.)
// We deliberately exclude the password hash from the response.
const buildUserProfile = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  level: user.level || 'Beginner',
  overallScore: user.overallScore || 0,
  communicationScore: user.communicationScore || 0,
  confidenceScore: user.confidenceScore || 0,
  fluencyScore: user.fluencyScore || 0,
  grammarScore: user.grammarScore || 0,
  vocabularyScore: user.vocabularyScore || 0,
  leadershipScore: user.leadershipScore || 0,
  listeningScore: user.listeningScore || 0,
  clarityScore: user.clarityScore || 0,
  teamworkScore: user.teamworkScore || 0,
  criticalThinkingScore: user.criticalThinkingScore || 0,
  topicRelevanceScore: user.topicRelevanceScore || 0,
  sessionsCompleted: user.sessionsCompleted || 0,
  groupSessions: user.groupSessions || 0,
  individualSessions: user.individualSessions || 0,
  improvementPercentage: user.improvementPercentage || 0,
  createdAt: user.createdAt
});

export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }

    const existingUser = await Store.findUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await Store.createUser({ name, email, password: hashedPassword });

    const token = generateToken(user._id, user.name, user.email);

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: buildUserProfile(user)
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Please enter email and password' });
    }

    const user = await Store.findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = generateToken(user._id, user.name, user.email);

    // Return the FULL persisted profile so the dashboard immediately shows
    // correct scores and session counts without needing a second round-trip.
    res.json({
      message: 'Login successful',
      token,
      user: buildUserProfile(user)
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
};
