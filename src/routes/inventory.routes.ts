import { Router } from 'express';
import {
  getDashboard,
  getCategories,
  getCategory,
  createCategory,
  updateCategory,
  getSuppliers,
  getSupplier,
  createSupplier,
  updateSupplier,
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  getMovements,
  createMovement,
  getAlerts,
  resolveAlert,
  getStockLevels,
  getLowStockItems
} from '../controllers/inventory.controller';
import { authenticateToken, requirePermission } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticateToken);

// Dashboard
router.get('/dashboard', requirePermission('almacen:read'), getDashboard);

// Categorías
router.get('/categories', requirePermission('almacen:read'), getCategories);
router.get('/categories/:id', requirePermission('almacen:read'), getCategory);
router.post('/categories', requirePermission('almacen:write'), createCategory);
router.put('/categories/:id', requirePermission('almacen:write'), updateCategory);

// Proveedores
router.get('/suppliers', requirePermission('almacen:read'), getSuppliers);
router.get('/suppliers/:id', requirePermission('almacen:read'), getSupplier);
router.post('/suppliers', requirePermission('almacen:write'), createSupplier);
router.put('/suppliers/:id', requirePermission('almacen:write'), updateSupplier);

// Productos
router.get('/products', requirePermission('almacen:read'), getProducts);
router.get('/products/:id', requirePermission('almacen:read'), getProduct);
router.post('/products', requirePermission('almacen:write'), createProduct);
router.put('/products/:id', requirePermission('almacen:write'), updateProduct);

// Movimientos
router.get('/movements', requirePermission('almacen:read'), getMovements);
router.post('/movements', requirePermission('almacen:write'), createMovement);

// Alertas
router.get('/alerts', requirePermission('almacen:read'), getAlerts);
router.patch('/alerts/:id/resolve', requirePermission('almacen:write'), resolveAlert);

// Reportes
router.get('/reports/stock-levels', requirePermission('almacen:read'), getStockLevels);
router.get('/reports/low-stock', requirePermission('almacen:read'), getLowStockItems);

export default router;