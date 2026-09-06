import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Store } from '../services/store.js';

const JWT_SECRET = process.env.JWT_SECRET || 'softskills_ai_jwt_secret_key_2026_super_secure';

export const adminLogin = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Please provide both username and password' });
    }

    const expectedUsername = (process.env.ADMIN_USERNAME || 'adminlogin').trim();
    const expectedPassword = (process.env.ADMIN_PASSWORD || 'adminnenu@123').trim();

    const inputUser = String(username).trim();
    const inputPass = String(password).trim();

    const isUserValid = inputUser.length === expectedUsername.length &&
      crypto.timingSafeEqual(Buffer.from(inputUser), Buffer.from(expectedUsername));

    const isPassValid = inputPass.length === expectedPassword.length &&
      crypto.timingSafeEqual(Buffer.from(inputPass), Buffer.from(expectedPassword));

    if (!isUserValid || !isPassValid) {
      return res.status(401).json({ message: 'Invalid admin credentials' });
    }

    const token = jwt.sign(
      {
        id: 'admin_root',
        name: 'Administrator',
        username: expectedUsername,
        role: 'admin'
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Admin authentication successful',
      token,
      user: {
        id: 'admin_root',
        name: 'Administrator',
        username: expectedUsername,
        role: 'admin'
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ message: 'Internal server error during admin authentication' });
  }
};

export const getAdminStats = async (req, res) => {
  try {
    const stats = await Store.getAdminStats();
    res.json(stats);
  } catch (error) {
    console.error('Get admin stats error:', error);
    res.status(500).json({ message: 'Error retrieving admin statistics' });
  }
};
