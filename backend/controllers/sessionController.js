import { Store } from '../services/store.js';
import { analyzeTranscriptWithGemini } from '../services/geminiService.js';

export const createSession = async (req, res) => {
  try {
    const { activityType, activityName, topic, durationSeconds, transcript } = req.body;
    const userId = req.user.id;
    const userName = req.user.name;

    // Perform AI analysis on speech transcript
    const aiAnalysis = await analyzeTranscriptWithGemini({
      transcript,
      activityName,
      topic,
      activityType
    });

    const sessionData = {
      userId,
      userName,
      activityType: activityType || 'individual',
      activityName: activityName || 'Practice Session',
      topic: topic || 'General Topic',
      durationSeconds: durationSeconds || 60,
      transcript: transcript || '',
      scores: aiAnalysis.scores,
      strengths: aiAnalysis.strengths,
      areasToImprove: aiAnalysis.areasToImprove,
      mistakes: aiAnalysis.mistakes,
      aiFeedback: aiAnalysis.aiFeedback
    };

    const session = await Store.createSession(sessionData);

    // Update user profile statistics
    await Store.updateUserStats(userId, sessionData);

    res.status(201).json(session);
  } catch (error) {
    console.error('Create session error:', error);
    res.status(500).json({ message: 'Error analyzing and saving session' });
  }
};

export const getUserSessions = async (req, res) => {
  try {
    const sessions = await Store.getUserSessions(req.user.id);
    res.json(sessions);
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({ message: 'Error retrieving sessions' });
  }
};

export const getSessionById = async (req, res) => {
  try {
    const session = await Store.getSessionById(req.params.id);
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }
    res.json(session);
  } catch (error) {
    console.error('Get session by ID error:', error);
    res.status(500).json({ message: 'Error retrieving session' });
  }
};
