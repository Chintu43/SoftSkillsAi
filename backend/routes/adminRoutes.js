import express from 'express';
import { adminLogin, getAdminStats } from '../controllers/adminController.js';
import { protect, adminOnly } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/login', adminLogin);
router.get('/stats', protect, adminOnly, getAdminStats);

export default router;
