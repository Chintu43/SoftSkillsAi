import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  userName: { type: String, required: true },
  activityType: { type: String, required: true }, // individual or group
  activityName: { type: String, required: true }, // e.g. JAM Session, Interview Practice, Group Discussion
  topic: { type: String },
  durationSeconds: { type: Number, default: 0 },
  transcript: { type: String, default: '' },
  criteria: { type: Array, default: [] },
  finalScore: { type: Number, default: 0 },
  performanceLevel: { type: String, default: 'Good' },
  isEmptySpeech: { type: Boolean, default: false },
  scores: {
    overall: { type: Number, default: 0 },
    communication: { type: Number, default: 0 },
    fluency: { type: Number, default: 0 },
    confidence: { type: Number, default: 0 },
    grammar: { type: Number, default: 0 },
    vocabulary: { type: Number, default: 0 },
    clarity: { type: Number, default: 0 },
    topicRelevance: { type: Number, default: 0 },
    professionalism: { type: Number, default: 0 },
    leadership: { type: Number, default: 0 },
    listening: { type: Number, default: 0 },
    teamwork: { type: Number, default: 0 }
  },
  strengths: [{ type: String }],
  areasToImprove: [{ type: String }],
  positiveObservations: [{ type: String }],
  mistakeAnalysis: { type: mongoose.Schema.Types.Mixed, default: {} },
  mistakes: { type: Array, default: [] },
  wordMistakes: { type: Array, default: [] },
  wordAnalysis: { type: Array, default: [] },
  sentenceAnalysis: { type: Array, default: [] },
  correctedSpeech: { type: String, default: '' },
  summary: { type: String, default: '' },
  hasSpeech: { type: Boolean, default: true },
  speechDetected: { type: Boolean, default: true },
  confidence: { type: Number, default: 0 },
  pronunciationAnalysis: { type: String, default: '' },
  fluencyDelivery: { type: String, default: '' },
  topicRelevance: { type: String, default: '' },
  mentorAdvice: [{ type: String }],
  errorSummary: { type: mongoose.Schema.Types.Mixed, default: {} },
  categoryBreakdown: { type: mongoose.Schema.Types.Mixed, default: {} },
  aiFeedback: { type: String },
  createdAt: { type: Date, default: Date.now }
}, { strict: false });

export default mongoose.model('Session', sessionSchema);
