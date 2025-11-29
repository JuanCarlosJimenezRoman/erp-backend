import { Router } from 'express';
import { getRoles, getRoleById } from '../controllers/role.controller';
import { authenticateToken, requirePermission } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticateToken);

router.get('/', requirePermission('users:read'), getRoles);
router.get('/:id', requirePermission('users:read'), getRoleById);

export default router;