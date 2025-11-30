import { Router } from 'express';
import {
  getDashboard,
  getAccounts,
  getAccount,
  createAccount,
  updateAccount,
  getTransactions,
  createTransaction,
  getInvoices,
  getInvoice,
  createInvoice,
  updateInvoiceStatus,
  getIncomeStatement,
  getBalanceSheet
} from '../controllers/accounting.controller';
import { authenticateToken, requirePermission } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticateToken);

// Dashboard
router.get('/dashboard', requirePermission('contabilidad:read'), getDashboard);

// Cuentas
router.get('/accounts', requirePermission('contabilidad:read'), getAccounts);
router.get('/accounts/:id', requirePermission('contabilidad:read'), getAccount);
router.post('/accounts', requirePermission('contabilidad:write'), createAccount);
router.put('/accounts/:id', requirePermission('contabilidad:write'), updateAccount);

// Transacciones
router.get('/transactions', requirePermission('contabilidad:read'), getTransactions);
router.post('/transactions', requirePermission('contabilidad:write'), createTransaction);

// Facturas
router.get('/invoices', requirePermission('contabilidad:read'), getInvoices);
router.get('/invoices/:id', requirePermission('contabilidad:read'), getInvoice);
router.post('/invoices', requirePermission('contabilidad:write'), createInvoice);
router.patch('/invoices/:id/status', requirePermission('contabilidad:write'), updateInvoiceStatus);

// Reportes
router.get('/reports/income-statement', requirePermission('contabilidad:read'), getIncomeStatement);
router.get('/reports/balance-sheet', requirePermission('contabilidad:read'), getBalanceSheet);

export default router;