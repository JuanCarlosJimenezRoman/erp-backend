import { Router } from 'express';
import { login, register, logout, getProfile } from '../controllers/auth.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

router.post('/login', login);
router.post('/register', register);
router.post('/logout', logout);
router.get('/profile', authenticateToken, getProfile);

export default router;

//esto es solo un comentario de prueba