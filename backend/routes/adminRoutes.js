import express from 'express';
import { adminLogin, getAdminStats, deleteFeedback, clearQuotaAlert, getUserResultsFeedback } from '../controllers/adminController.js';
import { protect, adminOnly } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/login', adminLogin);
router.get('/stats', protect, adminOnly, getAdminStats);
router.delete('/feedback/:id', protect, adminOnly, deleteFeedback);
router.post('/clear-quota-alert', protect, adminOnly, clearQuotaAlert);
router.get('/user-results-feedback', protect, adminOnly, getUserResultsFeedback);

export default router;

