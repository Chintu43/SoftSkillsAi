import express from 'express';
import { createSession, getUserSessions, getSessionById, submitSessionFeedback } from '../controllers/sessionController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/', protect, createSession);
router.get('/', protect, getUserSessions);
router.post('/feedback', protect, submitSessionFeedback);
router.post('/:id/feedback', protect, submitSessionFeedback);
router.get('/:id', protect, getSessionById);

export default router;
