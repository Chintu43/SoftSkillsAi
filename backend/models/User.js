import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  overallScore: { type: Number, default: 0 },
  communicationScore: { type: Number, default: 0 },
  confidenceScore: { type: Number, default: 0 },
  fluencyScore: { type: Number, default: 0 },
  grammarScore: { type: Number, default: 0 },
  vocabularyScore: { type: Number, default: 0 },
  leadershipScore: { type: Number, default: 0 },
  listeningScore: { type: Number, default: 0 },
  clarityScore: { type: Number, default: 0 },
  teamworkScore: { type: Number, default: 0 },
  criticalThinkingScore: { type: Number, default: 0 },
  topicRelevanceScore: { type: Number, default: 0 },
  sessionsCompleted: { type: Number, default: 0 },
  groupSessions: { type: Number, default: 0 },
  individualSessions: { type: Number, default: 0 },
  improvementPercentage: { type: Number, default: 0 },
  level: { type: String, enum: ['Beginner', 'Intermediate', 'Advanced', 'Excellent'], default: 'Beginner' },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('User', userSchema);
