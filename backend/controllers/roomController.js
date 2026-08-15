import { Store } from '../services/store.js';

export const createRoom = async (req, res) => {
  try {
    const { activityType, topic, maxMembers } = req.body;
    if (!activityType || !topic) {
      return res.status(400).json({ message: 'Activity type and topic are required' });
    }

    // Limit maximum participants selection to 2, 3, or 4
    let parsedMax = parseInt(maxMembers, 10);
    if (isNaN(parsedMax) || parsedMax < 2 || parsedMax > 4) {
      parsedMax = 4;
    }

    // Generate Room ID in format SKL-XXXX
    const randomCode = Math.floor(1000 + Math.random() * 9000);
    const roomId = `SKL-${randomCode}`;

    const roomData = {
      roomId,
      activityType,
      topic,
      maxMembers: parsedMax,
      hostId: req.user.id,
      hostName: req.user.name,
      status: 'waiting',
      participants: [
        {
          userId: req.user.id,
          userName: req.user.name,
          joinedAt: new Date().toISOString()
        }
      ]
    };

    const room = await Store.createRoom(roomData);
    res.status(201).json(room);
  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ message: 'Error creating group practice room' });
  }
};

export const joinRoom = async (req, res) => {
  try {
    const { roomId } = req.body;
    if (!roomId) {
      return res.status(400).json({ message: 'Room ID is required' });
    }

    const room = await Store.findRoomById(roomId);
    if (!room) {
      return res.status(404).json({ message: 'Room not found. Please verify the Room ID.' });
    }

    const maxLimit = room.maxMembers || 4;
    const currentCount = room.participants ? room.participants.length : 0;
    const alreadyJoined = room.participants.some(p => p.userId.toString() === req.user.id.toString());

    if (!alreadyJoined && currentCount >= maxLimit) {
      return res.status(400).json({ message: `⚠️ Room Full: This room has reached its maximum limit of ${maxLimit} participants.` });
    }

    if (!alreadyJoined) {
      await Store.updateRoom(roomId, (roomDoc) => {
        roomDoc.participants.push({
          userId: req.user.id,
          userName: req.user.name,
          joinedAt: new Date().toISOString()
        });
      });
    }

    const updatedRoom = await Store.findRoomById(roomId);
    res.json(updatedRoom);
  } catch (error) {
    console.error('Join room error:', error);
    res.status(500).json({ message: 'Error joining room' });
  }
};

export const getRoom = async (req, res) => {
  try {
    const room = await Store.findRoomById(req.params.roomId);
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }
    res.json(room);
  } catch (error) {
    console.error('Get room error:', error);
    res.status(500).json({ message: 'Error retrieving room' });
  }
};
