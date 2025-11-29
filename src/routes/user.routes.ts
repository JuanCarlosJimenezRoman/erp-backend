import { Router } from 'express';
import { 
  getUsers, 
  getUserById, 
  createUser, 
  updateUser, 
  deleteUser,
  updateUserProfile 
} from '../controllers/user.controller';
import { authenticateToken, requirePermission } from '../middleware/auth.middleware';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// Rutas públicas (perfil propio)
router.get('/profile', getProfile);
router.put('/profile', updateUserProfile);

// Rutas administrativas
router.get('/', requirePermission('users:read'), getUsers);
router.get('/:id', requirePermission('users:read'), getUserById);
router.post('/', requirePermission('users:write'), createUser);
router.put('/:id', requirePermission('users:write'), updateUser);
router.delete('/:id', requirePermission('users:delete'), deleteUser);

// Función getProfile local
async function getProfile(req: any, res: any) {
  const { getProfile } = await import('../controllers/user.controller');
  return getProfile(req, res);
}

export default router;