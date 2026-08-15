import express from 'express';
import { analyzeTranscript, getCoachFeedback, getInterviewQuestions, validateTopicController } from '../controllers/aiController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/validate-topic', protect, validateTopicController);
router.post('/analyze', protect, analyzeTranscript);
router.post('/feedback', protect, getCoachFeedback);
router.get('/interview', protect, getInterviewQuestions);

export default router;
