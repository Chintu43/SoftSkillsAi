import { Store } from '../services/store.js';

export const getProfile = async (req, res) => {
  try {
    const user = await Store.findUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Strip the password — handle both Mongoose documents (.toObject/_doc) and plain objects
    const raw = user._doc ? { ...user._doc } : { ...user };
    delete raw.password;

    // Ensure every score field is present (defaults to 0 for brand-new accounts)
    const profile = {
      id: raw._id,
      name: raw.name,
      email: raw.email,
      level: raw.level || 'Beginner',
      overallScore: raw.overallScore || 0,
      communicationScore: raw.communicationScore || 0,
      confidenceScore: raw.confidenceScore || 0,
      fluencyScore: raw.fluencyScore || 0,
      grammarScore: raw.grammarScore || 0,
      vocabularyScore: raw.vocabularyScore || 0,
      leadershipScore: raw.leadershipScore || 0,
      listeningScore: raw.listeningScore || 0,
      clarityScore: raw.clarityScore || 0,
      teamworkScore: raw.teamworkScore || 0,
      criticalThinkingScore: raw.criticalThinkingScore || 0,
      topicRelevanceScore: raw.topicRelevanceScore || 0,
      sessionsCompleted: raw.sessionsCompleted || 0,
      groupSessions: raw.groupSessions || 0,
      individualSessions: raw.individualSessions || 0,
      improvementPercentage: raw.improvementPercentage || 0,
      createdAt: raw.createdAt
    };

    res.json(profile);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Error retrieving profile' });
  }
};
