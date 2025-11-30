import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../services/database.service';
import { AuthRequest } from '../middleware/auth.middleware';

export const getDashboard = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    // Obtener total de ingresos (transacciones de crédito en cuentas de INCOME)
    const incomeResult = await prisma.transaction.aggregate({
      where: {
        account: {
          type: 'INCOME'
        },
        date: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) // Mes actual
        }
      },
      _sum: {
        amount: true
      }
    });

    // Obtener total de gastos (transacciones de débito en cuentas de EXPENSE)
    const expensesResult = await prisma.transaction.aggregate({
      where: {
        account: {
          type: 'EXPENSE'
        },
        date: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        }
      },
      _sum: {
        amount: true
      }
    });

    // Obtener resumen de cuentas
    const accounts = await prisma.account.findMany({
      where: { isActive: true },
      include: {
        transactions: {
          where: {
            date: {
              gte: new Date(new Date().getFullYear(), 0, 1) // Año actual
            }
          }
        }
      }
    });

    const accountsSummary = accounts.map(account => {
      const balance = account.transactions.reduce((sum, transaction) => {
        if (transaction.type === 'DEBIT') {
          return sum + Number(transaction.amount);
        } else {
          return sum - Number(transaction.amount);
        }
      }, 0);

      return {
        accountId: account.id,
        accountName: account.name,
        balance,
        type: account.type
      };
    });

    // Obtener transacciones recientes
    const recentTransactions = await prisma.transaction.findMany({
      take: 10,
      orderBy: { date: 'desc' },
      include: {
        account: {
          select: {
            name: true,
            code: true
          }
        }
      }
    });

    // Obtener facturas pendientes
    const pendingInvoices = await prisma.invoice.count({
      where: {
        status: 'ISSUED'
      }
    });

    const dashboard = {
      totalIncome: Number(incomeResult._sum.amount) || 0,
      totalExpenses: Number(expensesResult._sum.amount) || 0,
      netProfit: (Number(incomeResult._sum.amount) || 0) - (Number(expensesResult._sum.amount) || 0),
      accountsSummary,
      recentTransactions: recentTransactions.map(t => ({
        ...t,
        amount: Number(t.amount)
      })),
      pendingInvoices
    };

    res.json(dashboard);
  } catch (error) {
    console.error('Error obteniendo dashboard contable:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

export const getAccounts = async (req: Request, res: Response) => {
  try {
    const { type } = req.query;

    const where: any = { isActive: true };
    if (type) {
      where.type = type;
    }

    const accounts = await prisma.account.findMany({
      where,
      orderBy: [{ type: 'asc' }, { code: 'asc' }]
    });

    const accountsWithNumbers = accounts.map(account => ({
      ...account,
      balance: 0 // Se calcularía en una función separada
    }));

    res.json(accountsWithNumbers);
  } catch (error) {
    console.error('Error obteniendo cuentas:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

export const getAccount = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const account = await prisma.account.findUnique({
      where: { id },
      include: {
        transactions: {
          orderBy: { date: 'desc' },
          take: 50,
          include: {
            invoice: {
              select: {
                number: true,
                type: true
              }
            }
          }
        }
      }
    });

    if (!account) {
      return res.status(404).json({ message: 'Cuenta no encontrada' });
    }

    // Calcular balance de la cuenta
    const balance = account.transactions.reduce((sum, transaction) => {
      const amount = Number(transaction.amount);
      return transaction.type === 'DEBIT' ? sum + amount : sum - amount;
    }, 0);

    res.json({
      ...account,
      balance,
      transactions: account.transactions.map(t => ({
        ...t,
        amount: Number(t.amount)
      }))
    });
  } catch (error) {
    console.error('Error obteniendo cuenta:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

export const createAccount = async (req: AuthRequest, res: Response) => {
  try {
    const { code, name, type, description } = req.body;
    const userId = req.user!.id;

    if (!code || !name || !type) {
      return res.status(400).json({ 
        message: 'Código, nombre y tipo son requeridos' 
      });
    }

    // Verificar que el código no exista
    const existingAccount = await prisma.account.findUnique({
      where: { code }
    });

    if (existingAccount) {
      return res.status(400).json({ message: 'El código de cuenta ya existe' });
    }

    const account = await prisma.account.create({
      data: {
        code,
        name,
        type,
        description
      }
    });

    res.status(201).json(account);
  } catch (error) {
    console.error('Error creando cuenta:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

export const updateAccount = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { code, name, type, description, isActive } = req.body;

    const account = await prisma.account.findUnique({
      where: { id }
    });

    if (!account) {
      return res.status(404).json({ message: 'Cuenta no encontrada' });
    }

    // Verificar código único si se está cambiando
    if (code && code !== account.code) {
      const existingAccount = await prisma.account.findUnique({
        where: { code }
      });
      if (existingAccount) {
        return res.status(400).json({ message: 'El código de cuenta ya existe' });
      }
    }

    const updatedAccount = await prisma.account.update({
      where: { id },
      data: {
        ...(code && { code }),
        ...(name && { name }),
        ...(type && { type }),
        ...(description !== undefined && { description }),
        ...(typeof isActive === 'boolean' && { isActive })
      }
    });

    res.json(updatedAccount);
  } catch (error) {
    console.error('Error actualizando cuenta:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

export const getTransactions = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 20, accountId } = req.query;
    
    const skip = (Number(page) - 1) * Number(limit);
    
    const where: any = {};
    if (accountId) {
      where.accountId = accountId;
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: {
          account: {
            select: {
              name: true,
              code: true,
              type: true
            }
          },
          invoice: {
            select: {
              number: true,
              type: true
            }
          }
        },
        orderBy: { date: 'desc' },
        skip,
        take: Number(limit)
      }),
      prisma.transaction.count({ where })
    ]);

    const transactionsWithNumbers = transactions.map(transaction => ({
      ...transaction,
      amount: Number(transaction.amount)
    }));

    res.json({
      transactions: transactionsWithNumbers,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    console.error('Error obteniendo transacciones:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

export const createTransaction = async (req: AuthRequest, res: Response) => {
  try {
    const { date, description, amount, type, accountId, reference } = req.body;
    const userId = req.user!.id;

    if (!date || !description || !amount || !type || !accountId) {
      return res.status(400).json({ 
        message: 'Fecha, descripción, monto, tipo y cuenta son requeridos' 
      });
    }

    // Verificar que la cuenta existe
    const account = await prisma.account.findUnique({
      where: { id: accountId }
    });

    if (!account) {
      return res.status(400).json({ message: 'Cuenta no válida' });
    }

    const transaction = await prisma.transaction.create({
      data: {
        date: new Date(date),
        description,
        amount: new Prisma.Decimal(amount),
        type,
        accountId,
        reference,
        createdBy: userId
      },
      include: {
        account: {
          select: {
            name: true,
            code: true
          }
        }
      }
    });

    res.status(201).json({
      ...transaction,
      amount: Number(transaction.amount)
    });
  } catch (error) {
    console.error('Error creando transacción:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

export const getInvoices = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 20, type, status } = req.query;
    
    const skip = (Number(page) - 1) * Number(limit);
    
    const where: any = {};
    if (type) where.type = type;
    if (status) where.status = status;

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: {
          transactions: {
            include: {
              account: {
                select: {
                  name: true,
                  code: true
                }
              }
            }
          }
        },
        orderBy: { date: 'desc' },
        skip,
        take: Number(limit)
      }),
      prisma.invoice.count({ where })
    ]);

    const invoicesWithNumbers = invoices.map(invoice => ({
      ...invoice,
      subtotal: Number(invoice.subtotal),
      tax: Number(invoice.tax),
      total: Number(invoice.total),
      transactions: invoice.transactions.map(t => ({
        ...t,
        amount: Number(t.amount)
      }))
    }));

    res.json({
      invoices: invoicesWithNumbers,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    console.error('Error obteniendo facturas:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

export const getInvoice = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        transactions: {
          include: {
            account: {
              select: {
                name: true,
                code: true,
                type: true
              }
            }
          }
        }
      }
    });

    if (!invoice) {
      return res.status(404).json({ message: 'Factura no encontrada' });
    }

    res.json({
      ...invoice,
      subtotal: Number(invoice.subtotal),
      tax: Number(invoice.tax),
      total: Number(invoice.total),
      transactions: invoice.transactions.map(t => ({
        ...t,
        amount: Number(t.amount)
      }))
    });
  } catch (error) {
    console.error('Error obteniendo factura:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

export const createInvoice = async (req: AuthRequest, res: Response) => {
  try {
    const {
      number,
      type,
      date,
      dueDate,
      clientName,
      clientEmail,
      clientTaxId,
      subtotal,
      tax,
      total,
      notes,
      transactions
    } = req.body;

    const userId = req.user!.id;

    if (!number || !type || !date || !clientName || !subtotal || !tax || !total) {
      return res.status(400).json({ 
        message: 'Número, tipo, fecha, cliente, subtotal, impuesto y total son requeridos' 
      });
    }

    // Verificar que el número de factura no exista
    const existingInvoice = await prisma.invoice.findUnique({
      where: { number }
    });

    if (existingInvoice) {
      return res.status(400).json({ message: 'El número de factura ya existe' });
    }

    // Crear la factura y las transacciones en una transacción de base de datos
    const invoice = await prisma.$transaction(async (tx) => {
      const newInvoice = await tx.invoice.create({
        data: {
          number,
          type,
          date: new Date(date),
          dueDate: dueDate ? new Date(dueDate) : null,
          clientName,
          clientEmail,
          clientTaxId,
          subtotal: new Prisma.Decimal(subtotal),
          tax: new Prisma.Decimal(tax),
          total: new Prisma.Decimal(total),
          status: 'DRAFT',
          notes,
          createdBy: userId
        }
      });

      // Crear las transacciones asociadas
      if (transactions && transactions.length > 0) {
        for (const transactionData of transactions) {
          await tx.transaction.create({
            data: {
              date: new Date(date),
              description: transactionData.description,
              amount: new Prisma.Decimal(transactionData.amount),
              type: transactionData.type,
              accountId: transactionData.accountId,
              invoiceId: newInvoice.id,
              reference: transactionData.reference,
              createdBy: userId
            }
          });
        }
      }

      return tx.invoice.findUnique({
        where: { id: newInvoice.id },
        include: {
          transactions: {
            include: {
              account: {
                select: {
                  name: true,
                  code: true
                }
              }
            }
          }
        }
      });
    });

    res.status(201).json({
      ...invoice!,
      subtotal: Number(invoice!.subtotal),
      tax: Number(invoice!.tax),
      total: Number(invoice!.total),
      transactions: invoice!.transactions.map(t => ({
        ...t,
        amount: Number(t.amount)
      }))
    });
  } catch (error) {
    console.error('Error creando factura:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

export const updateInvoiceStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user!.id;

    if (!status) {
      return res.status(400).json({ message: 'Estado es requerido' });
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id }
    });

    if (!invoice) {
      return res.status(404).json({ message: 'Factura no encontrada' });
    }

    const updatedInvoice = await prisma.invoice.update({
      where: { id },
      data: { status }
    });

    res.json({
      ...updatedInvoice,
      subtotal: Number(updatedInvoice.subtotal),
      tax: Number(updatedInvoice.tax),
      total: Number(updatedInvoice.total)
    });
  } catch (error) {
    console.error('Error actualizando estado de factura:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

export const getIncomeStatement = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ 
        message: 'Fecha de inicio y fecha de fin son requeridas' 
      });
    }

    // Obtener ingresos
    const income = await prisma.transaction.aggregate({
      where: {
        account: {
          type: 'INCOME'
        },
        date: {
          gte: new Date(startDate as string),
          lte: new Date(endDate as string)
        }
      },
      _sum: {
        amount: true
      }
    });

    // Obtener gastos
    const expenses = await prisma.transaction.aggregate({
      where: {
        account: {
          type: 'EXPENSE'
        },
        date: {
          gte: new Date(startDate as string),
          lte: new Date(endDate as string)
        }
      },
      _sum: {
        amount: true
      }
    });

    const netIncome = (Number(income._sum.amount) || 0) - (Number(expenses._sum.amount) || 0);

    res.json({
      period: {
        startDate,
        endDate
      },
      income: Number(income._sum.amount) || 0,
      expenses: Number(expenses._sum.amount) || 0,
      netIncome
    });
  } catch (error) {
    console.error('Error generando estado de resultados:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

export const getBalanceSheet = async (req: Request, res: Response) => {
  try {
    const { date } = req.query;
    const asOfDate = date ? new Date(date as string) : new Date();

    // Activos
    const assets = await prisma.account.findMany({
      where: {
        type: 'ASSET',
        isActive: true
      },
      include: {
        transactions: {
          where: {
            date: {
              lte: asOfDate
            }
          }
        }
      }
    });

    // Pasivos
    const liabilities = await prisma.account.findMany({
      where: {
        type: 'LIABILITY',
        isActive: true
      },
      include: {
        transactions: {
          where: {
            date: {
              lte: asOfDate
            }
          }
        }
      }
    });

    // Patrimonio
    const equity = await prisma.account.findMany({
      where: {
        type: 'EQUITY',
        isActive: true
      },
      include: {
        transactions: {
          where: {
            date: {
              lte: asOfDate
            }
          }
        }
      }
    });

    const calculateBalance = (accounts: any[]) => {
      return accounts.reduce((total, account) => {
        const accountBalance = account.transactions.reduce((sum: number, transaction: any) => {
          const amount = Number(transaction.amount);
          return transaction.type === 'DEBIT' ? sum + amount : sum - amount;
        }, 0);
        return total + accountBalance;
      }, 0);
    };

    const totalAssets = calculateBalance(assets);
    const totalLiabilities = calculateBalance(liabilities);
    const totalEquity = calculateBalance(equity);

    res.json({
      asOfDate: asOfDate.toISOString(),
      assets: {
        accounts: assets.map(account => ({
          ...account,
          balance: account.transactions.reduce((sum: number, transaction: any) => {
            const amount = Number(transaction.amount);
            return transaction.type === 'DEBIT' ? sum + amount : sum - amount;
          }, 0)
        })),
        total: totalAssets
      },
      liabilities: {
        accounts: liabilities.map(account => ({
          ...account,
          balance: account.transactions.reduce((sum: number, transaction: any) => {
            const amount = Number(transaction.amount);
            return transaction.type === 'DEBIT' ? sum + amount : sum - amount;
          }, 0)
        })),
        total: totalLiabilities
      },
      equity: {
        accounts: equity.map(account => ({
          ...account,
          balance: account.transactions.reduce((sum: number, transaction: any) => {
            const amount = Number(transaction.amount);
            return transaction.type === 'DEBIT' ? sum + amount : sum - amount;
          }, 0)
        })),
        total: totalEquity
      },
      balance: totalAssets - (totalLiabilities + totalEquity)
    });
  } catch (error) {
    console.error('Error generando balance general:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};