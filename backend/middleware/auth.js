import express from 'express';
import { 
  register, 
  login, 
  forgotPassword, 
  resetPassword, 
  verifyResetToken 
} from '../controllers/authController.js';

const router = express.Router();

// Existing routes
router.post('/register', register);
router.post('/login', login);

// Password reset routes
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/verify-reset-token/:token', verifyResetToken);

export default router;