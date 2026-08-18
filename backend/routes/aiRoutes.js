import express from 'express';
import {
  analyzeTranscript,
  getCoachFeedback,
  getInterviewQuestions,
  validateTopicController,
  getDebateCounterargument
} from '../controllers/aiController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/validate-topic', protect, validateTopicController);
router.post('/analyze', protect, analyzeTranscript);
router.post('/feedback', protect, getCoachFeedback);
router.get('/interview', protect, getInterviewQuestions);
router.post('/debate-counterargument', protect, getDebateCounterargument);

export default router;
