import express from 'express';
import { createSession, getUserSessions, getSessionById } from '../controllers/sessionController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/', protect, createSession);
router.get('/', protect, getUserSessions);
router.get('/:id', protect, getSessionById);

export default router;
