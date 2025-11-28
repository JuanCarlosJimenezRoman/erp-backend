import { Router } from 'express';
import { getUsers, getUserById, updateUser, deleteUser } from '../controllers/user.controller';
import { authenticateToken, requirePermission } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticateToken);

router.get('/', requirePermission('users:read'), getUsers);
router.get('/:id', requirePermission('users:read'), getUserById);
router.put('/:id', requirePermission('users:write'), updateUser);
router.delete('/:id', requirePermission('users:delete'), deleteUser);

export default router;