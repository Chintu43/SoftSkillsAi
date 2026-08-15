import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  userName: { type: String, required: true },
  activityType: { type: String, required: true }, // individual or group
  activityName: { type: String, required: true }, // e.g. JAM Session, Interview Practice, Group Discussion
  topic: { type: String },
  durationSeconds: { type: Number, default: 0 },
  transcript: { type: String, default: '' },
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
    leadership: { type: Number, default: 0 }
  },
  strengths: [{ type: String }],
  areasToImprove: [{ type: String }],
  mistakes: [
    {
      original: String,
      better: String,
      reason: String
    }
  ],
  aiFeedback: { type: String },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Session', sessionSchema);
