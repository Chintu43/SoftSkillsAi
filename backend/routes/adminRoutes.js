import express from 'express';
import { adminLogin, getAdminStats, deleteFeedback, clearQuotaAlert } from '../controllers/adminController.js';
import { protect, adminOnly } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/login', adminLogin);
router.get('/stats', protect, adminOnly, getAdminStats);
router.delete('/feedback/:id', protect, adminOnly, deleteFeedback);
router.post('/clear-quota-alert', protect, adminOnly, clearQuotaAlert);

export default router;

