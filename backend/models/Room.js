import mongoose from 'mongoose';

const roomSchema = new mongoose.Schema({
  roomId: { type: String, required: true, unique: true }, // e.g. SKILL-4829
  activityType: { type: String, required: true }, // Group Discussion, Debate, etc.
  topic: { type: String, required: true },
  maxMembers: { type: Number, default: 4, max: 4 },
  hostId: { type: String, required: true },
  hostName: { type: String, required: true },
  status: { type: String, enum: ['waiting', 'active', 'completed'], default: 'waiting' },
  participants: [
    {
      userId: String,
      userName: String,
      socketId: String,
      joinedAt: { type: Date, default: Date.now }
    }
  ],
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Room', roomSchema);
