import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../services/database.service';
import { AuthRequest } from '../middleware/auth.middleware';

export const getDashboard = async (req: AuthRequest, res: Response) => {
  try {
    // Obtener estadísticas generales
    const totalProducts = await prisma.product.count({
      where: { isActive: true }
    });

    // Productos con stock bajo
    const productsWithStock = await prisma.product.findMany({
      where: { isActive: true },
      include: {
        movements: true
      }
    });

    const lowStockItems = productsWithStock.filter(product => {
      const currentStock = product.movements.reduce((sum, movement) => {
        if (movement.type === 'IN') return sum + movement.quantity;
        if (movement.type === 'OUT') return sum - movement.quantity;
        return sum;
      }, 0);
      return currentStock <= product.minStock;
    }).length;

    // Valor total del inventario
    const totalInventoryValue = productsWithStock.reduce((total, product) => {
      const currentStock = product.movements.reduce((sum, movement) => {
        if (movement.type === 'IN') return sum + movement.quantity;
        if (movement.type === 'OUT') return sum - movement.quantity;
        return sum;
      }, 0);
      return total + (Number(product.cost) * currentStock);
    }, 0);

    // Movimientos recientes
    const recentMovements = await prisma.movement.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        product: {
          select: {
            name: true,
            sku: true
          }
        }
      }
    });

    // Alertas activas
    const activeAlerts = await prisma.inventoryAlert.findMany({
      where: { isResolved: false },
      include: {
        product: {
          select: {
            name: true,
            sku: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Resumen por categoría
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      include: {
        products: {
          where: { isActive: true },
          include: {
            movements: true
          }
        }
      }
    });

    const categorySummary = categories.map(category => {
      const totalValue = category.products.reduce((sum, product) => {
        const currentStock = product.movements.reduce((stockSum, movement) => {
          if (movement.type === 'IN') return stockSum + movement.quantity;
          if (movement.type === 'OUT') return stockSum - movement.quantity;
          return stockSum;
        }, 0);
        return sum + (Number(product.cost) * currentStock);
      }, 0);

      return {
        categoryId: category.id,
        categoryName: category.name,
        productCount: category.products.length,
        totalValue
      };
    });

    const dashboard = {
      totalProducts,
      lowStockItems,
      totalInventoryValue,
      recentMovements,
      activeAlerts,
      categorySummary
    };

    res.json(dashboard);
  } catch (error) {
    console.error('Error obteniendo dashboard de inventario:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

export const getCategories = async (req: Request, res: Response) => {
  try {
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      include: {
        _count: {
          select: {
            products: {
              where: { isActive: true }
            }
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    const categoriesWithCounts = categories.map(category => ({
      ...category,
      productsCount: category._count.products
    }));

    res.json(categoriesWithCounts);
  } catch (error) {
    console.error('Error obteniendo categorías:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

export const getCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        products: {
          where: { isActive: true },
          include: {
            supplier: {
              select: {
                name: true
              }
            },
            movements: true
          }
        }
      }
    });

    if (!category) {
      return res.status(404).json({ message: 'Categoría no encontrada' });
    }

    // Calcular stock para cada producto
    const productsWithStock = category.products.map(product => {
      const currentStock = product.movements.reduce((sum, movement) => {
        if (movement.type === 'IN') return sum + movement.quantity;
        if (movement.type === 'OUT') return sum - movement.quantity;
        return sum;
      }, 0);

      return {
        ...product,
        currentStock,
        price: Number(product.price),
        cost: Number(product.cost)
      };
    });

    res.json({
      ...category,
      products: productsWithStock
    });
  } catch (error) {
    console.error('Error obteniendo categoría:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

export const createCategory = async (req: AuthRequest, res: Response) => {
  try {
    const { name, description } = req.body;
    const userId = req.user!.id;

    if (!name) {
      return res.status(400).json({ message: 'El nombre es requerido' });
    }

    // Verificar que el nombre no exista
    const existingCategory = await prisma.category.findUnique({
      where: { name }
    });

    if (existingCategory) {
      return res.status(400).json({ message: 'El nombre de categoría ya existe' });
    }

    const category = await prisma.category.create({
      data: {
        name,
        description
      }
    });

    res.status(201).json(category);
  } catch (error) {
    console.error('Error creando categoría:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

export const updateCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, isActive } = req.body;

    const category = await prisma.category.findUnique({
      where: { id }
    });

    if (!category) {
      return res.status(404).json({ message: 'Categoría no encontrada' });
    }

    // Verificar nombre único si se está cambiando
    if (name && name !== category.name) {
      const existingCategory = await prisma.category.findUnique({
        where: { name }
      });
      if (existingCategory) {
        return res.status(400).json({ message: 'El nombre de categoría ya existe' });
      }
    }

    const updatedCategory = await prisma.category.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(typeof isActive === 'boolean' && { isActive })
      }
    });

    res.json(updatedCategory);
  } catch (error) {
    console.error('Error actualizando categoría:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

export const getSuppliers = async (req: Request, res: Response) => {
  try {
    const suppliers = await prisma.supplier.findMany({
      where: { isActive: true },
      include: {
        _count: {
          select: {
            products: {
              where: { isActive: true }
            }
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    const suppliersWithCounts = suppliers.map(supplier => ({
      ...supplier,
      productsCount: supplier._count.products
    }));

    res.json(suppliersWithCounts);
  } catch (error) {
    console.error('Error obteniendo proveedores:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

export const getSupplier = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: {
        products: {
          where: { isActive: true },
          include: {
            category: {
              select: {
                name: true
              }
            },
            movements: true
          }
        }
      }
    });

    if (!supplier) {
      return res.status(404).json({ message: 'Proveedor no encontrado' });
    }

    // Calcular stock para cada producto
    const productsWithStock = supplier.products.map(product => {
      const currentStock = product.movements.reduce((sum, movement) => {
        if (movement.type === 'IN') return sum + movement.quantity;
        if (movement.type === 'OUT') return sum - movement.quantity;
        return sum;
      }, 0);

      return {
        ...product,
        currentStock,
        price: Number(product.price),
        cost: Number(product.cost)
      };
    });

    res.json({
      ...supplier,
      products: productsWithStock
    });
  } catch (error) {
    console.error('Error obteniendo proveedor:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

export const createSupplier = async (req: AuthRequest, res: Response) => {
  try {
    const { name, email, phone, address, taxId } = req.body;
    const userId = req.user!.id;

    if (!name) {
      return res.status(400).json({ message: 'El nombre es requerido' });
    }

    const supplier = await prisma.supplier.create({
      data: {
        name,
        email,
        phone,
        address,
        taxId
      }
    });

    res.status(201).json(supplier);
  } catch (error) {
    console.error('Error creando proveedor:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

export const updateSupplier = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, email, phone, address, taxId, isActive } = req.body;

    const supplier = await prisma.supplier.findUnique({
      where: { id }
    });

    if (!supplier) {
      return res.status(404).json({ message: 'Proveedor no encontrado' });
    }

    const updatedSupplier = await prisma.supplier.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(email !== undefined && { email }),
        ...(phone !== undefined && { phone }),
        ...(address !== undefined && { address }),
        ...(taxId !== undefined && { taxId }),
        ...(typeof isActive === 'boolean' && { isActive })
      }
    });

    res.json(updatedSupplier);
  } catch (error) {
    console.error('Error actualizando proveedor:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

export const getProducts = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 20, categoryId, supplierId } = req.query;
    
    const skip = (Number(page) - 1) * Number(limit);
    
    const where: any = { isActive: true };
    if (categoryId) where.categoryId = categoryId;
    if (supplierId) where.supplierId = supplierId;

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          category: {
            select: {
              name: true
            }
          },
          supplier: {
            select: {
              name: true
            }
          },
          movements: true
        },
        orderBy: { name: 'asc' },
        skip,
        take: Number(limit)
      }),
      prisma.product.count({ where })
    ]);

    // Calcular stock actual para cada producto
    const productsWithStock = products.map(product => {
      const currentStock = product.movements.reduce((sum, movement) => {
        if (movement.type === 'IN') return sum + movement.quantity;
        if (movement.type === 'OUT') return sum - movement.quantity;
        return sum;
      }, 0);

      return {
        ...product,
        currentStock,
        price: Number(product.price),
        cost: Number(product.cost)
      };
    });

    res.json({
      products: productsWithStock,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    console.error('Error obteniendo productos:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

export const getProduct = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: {
          select: {
            name: true
          }
        },
        supplier: {
          select: {
            name: true,
            email: true,
            phone: true
          }
        },
        movements: {
          orderBy: { createdAt: 'desc' },
          take: 50
        }
      }
    });

    if (!product) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    // Calcular stock actual
    const currentStock = product.movements.reduce((sum, movement) => {
      if (movement.type === 'IN') return sum + movement.quantity;
      if (movement.type === 'OUT') return sum - movement.quantity;
      return sum;
    }, 0);

    res.json({
      ...product,
      currentStock,
      price: Number(product.price),
      cost: Number(product.cost)
    });
  } catch (error) {
    console.error('Error obteniendo producto:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

export const createProduct = async (req: AuthRequest, res: Response) => {
  try {
    const {
      sku,
      name,
      description,
      price,
      cost,
      categoryId,
      supplierId,
      minStock,
      maxStock
    } = req.body;

    const userId = req.user!.id;

    if (!sku || !name || !price || !cost || !categoryId) {
      return res.status(400).json({ 
        message: 'SKU, nombre, precio, costo y categoría son requeridos' 
      });
    }

    // Verificar que el SKU no exista
    const existingProduct = await prisma.product.findUnique({
      where: { sku }
    });

    if (existingProduct) {
      return res.status(400).json({ message: 'El SKU ya existe' });
    }

    // Verificar que la categoría existe
    const category = await prisma.category.findUnique({
      where: { id: categoryId }
    });

    if (!category) {
      return res.status(400).json({ message: 'Categoría no válida' });
    }

    // Verificar proveedor si se proporciona
    if (supplierId) {
      const supplier = await prisma.supplier.findUnique({
        where: { id: supplierId }
      });
      if (!supplier) {
        return res.status(400).json({ message: 'Proveedor no válido' });
      }
    }

    const product = await prisma.product.create({
      data: {
        sku,
        name,
        description,
        price: new Prisma.Decimal(price),
        cost: new Prisma.Decimal(cost),
        categoryId,
        supplierId,
        minStock: minStock || 0,
        maxStock
      },
      include: {
        category: {
          select: {
            name: true
          }
        },
        supplier: {
          select: {
            name: true
          }
        }
      }
    });

    res.status(201).json({
      ...product,
      price: Number(product.price),
      cost: Number(product.cost)
    });
  } catch (error) {
    console.error('Error creando producto:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

export const updateProduct = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      sku,
      name,
      description,
      price,
      cost,
      categoryId,
      supplierId,
      minStock,
      maxStock,
      isActive
    } = req.body;

    const product = await prisma.product.findUnique({
      where: { id }
    });

    if (!product) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    // Verificar SKU único si se está cambiando
    if (sku && sku !== product.sku) {
      const existingProduct = await prisma.product.findUnique({
        where: { sku }
      });
      if (existingProduct) {
        return res.status(400).json({ message: 'El SKU ya existe' });
      }
    }

    // Verificar categoría si se está cambiando
    if (categoryId) {
      const category = await prisma.category.findUnique({
        where: { id: categoryId }
      });
      if (!category) {
        return res.status(400).json({ message: 'Categoría no válida' });
      }
    }

    // Verificar proveedor si se está cambiando
    if (supplierId !== undefined) {
      if (supplierId) {
        const supplier = await prisma.supplier.findUnique({
          where: { id: supplierId }
        });
        if (!supplier) {
          return res.status(400).json({ message: 'Proveedor no válido' });
        }
      }
    }

    const updatedProduct = await prisma.product.update({
      where: { id },
      data: {
        ...(sku && { sku }),
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(price && { price: new Prisma.Decimal(price) }),
        ...(cost && { cost: new Prisma.Decimal(cost) }),
        ...(categoryId && { categoryId }),
        ...(supplierId !== undefined && { supplierId }),
        ...(minStock !== undefined && { minStock }),
        ...(maxStock !== undefined && { maxStock }),
        ...(typeof isActive === 'boolean' && { isActive })
      },
      include: {
        category: {
          select: {
            name: true
          }
        },
        supplier: {
          select: {
            name: true
          }
        }
      }
    });

    res.json({
      ...updatedProduct,
      price: Number(updatedProduct.price),
      cost: Number(updatedProduct.cost)
    });
  } catch (error) {
    console.error('Error actualizando producto:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

export const getMovements = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 20, productId, type } = req.query;
    
    const skip = (Number(page) - 1) * Number(limit);
    
    const where: any = {};
    if (productId) where.productId = productId;
    if (type) where.type = type;

    const [movements, total] = await Promise.all([
      prisma.movement.findMany({
        where,
        include: {
          product: {
            select: {
              name: true,
              sku: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit)
      }),
      prisma.movement.count({ where })
    ]);

    res.json({
      movements,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    console.error('Error obteniendo movimientos:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

// Función helper para verificar y crear alertas
const checkAndCreateAlerts = async (productId: string) => {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      movements: true
    }
  });

  if (!product) return;

  const currentStock = product.movements.reduce((sum, movement) => {
    if (movement.type === 'IN') return sum + movement.quantity;
    if (movement.type === 'OUT') return sum - movement.quantity;
    return sum;
  }, 0);

  // Verificar alerta de stock bajo
  if (currentStock <= product.minStock) {
    const existingAlert = await prisma.inventoryAlert.findFirst({
      where: {
        productId,
        type: 'LOW_STOCK',
        isResolved: false
      }
    });

    if (!existingAlert) {
      await prisma.inventoryAlert.create({
        data: {
          productId,
          type: 'LOW_STOCK',
          message: `Stock bajo para ${product.name}. Stock actual: ${currentStock}, Mínimo: ${product.minStock}`
        }
      });
    }
  }

  // Verificar alerta de sobre stock
  if (product.maxStock && currentStock > product.maxStock) {
    const existingAlert = await prisma.inventoryAlert.findFirst({
      where: {
        productId,
        type: 'OVER_STOCK',
        isResolved: false
      }
    });

    if (!existingAlert) {
      await prisma.inventoryAlert.create({
        data: {
          productId,
          type: 'OVER_STOCK',
          message: `Sobre stock para ${product.name}. Stock actual: ${currentStock}, Máximo: ${product.maxStock}`
        }
      });
    }
  }
};

export const createMovement = async (req: AuthRequest, res: Response) => {
  try {
    const { type, quantity, reason, reference, productId } = req.body;
    const userId = req.user!.id;

    if (!type || !quantity || !reason || !productId) {
      return res.status(400).json({ 
        message: 'Tipo, cantidad, razón y producto son requeridos' 
      });
    }

    if (quantity <= 0) {
      return res.status(400).json({ message: 'La cantidad debe ser mayor a 0' });
    }

    // Verificar que el producto existe
    const product = await prisma.product.findUnique({
      where: { id: productId }
    });

    if (!product) {
      return res.status(400).json({ message: 'Producto no válido' });
    }

    const movement = await prisma.movement.create({
      data: {
        type,
        quantity,
        reason,
        reference,
        productId,
        createdBy: userId
      },
      include: {
        product: {
          select: {
            name: true,
            sku: true
          }
        }
      }
    });

    // Verificar y crear alertas después del movimiento
    await checkAndCreateAlerts(productId);

    res.status(201).json(movement);
  } catch (error) {
    console.error('Error creando movimiento:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

export const getAlerts = async (req: Request, res: Response) => {
  try {
    const { resolved } = req.query;

    const where: any = {};
    if (resolved !== undefined) {
      where.isResolved = resolved === 'true';
    }

    const alerts = await prisma.inventoryAlert.findMany({
      where,
      include: {
        product: {
          select: {
            name: true,
            sku: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(alerts);
  } catch (error) {
    console.error('Error obteniendo alertas:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

export const resolveAlert = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const alert = await prisma.inventoryAlert.findUnique({
      where: { id }
    });

    if (!alert) {
      return res.status(404).json({ message: 'Alerta no encontrada' });
    }

    const updatedAlert = await prisma.inventoryAlert.update({
      where: { id },
      data: {
        isResolved: true,
        resolvedAt: new Date()
      },
      include: {
        product: {
          select: {
            name: true,
            sku: true
          }
        }
      }
    });

    res.json(updatedAlert);
  } catch (error) {
    console.error('Error resolviendo alerta:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

export const getStockLevels = async (req: Request, res: Response) => {
  try {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      include: {
        movements: true,
        category: {
          select: {
            name: true
          }
        }
      }
    });

    const stockLevels = products.map(product => {
      const currentStock = product.movements.reduce((sum, movement) => {
        if (movement.type === 'IN') return sum + movement.quantity;
        if (movement.type === 'OUT') return sum - movement.quantity;
        return sum;
      }, 0);

      let status: 'LOW' | 'NORMAL' | 'OVER' = 'NORMAL';
      if (currentStock <= product.minStock) {
        status = 'LOW';
      } else if (product.maxStock && currentStock > product.maxStock) {
        status = 'OVER';
      }

      return {
        productId: product.id,
        productName: product.name,
        categoryName: product.category.name,
        currentStock,
        minStock: product.minStock,
        maxStock: product.maxStock,
        status
      };
    });

    res.json(stockLevels);
  } catch (error) {
    console.error('Error obteniendo niveles de stock:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

export const getLowStockItems = async (req: Request, res: Response) => {
  try {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      include: {
        movements: true,
        category: {
          select: {
            name: true
          }
        },
        supplier: {
          select: {
            name: true
          }
        }
      }
    });

    const lowStockItems = products.filter(product => {
      const currentStock = product.movements.reduce((sum, movement) => {
        if (movement.type === 'IN') return sum + movement.quantity;
        if (movement.type === 'OUT') return sum - movement.quantity;
        return sum;
      }, 0);
      return currentStock <= product.minStock;
    }).map(product => {
      const currentStock = product.movements.reduce((sum, movement) => {
        if (movement.type === 'IN') return sum + movement.quantity;
        if (movement.type === 'OUT') return sum - movement.quantity;
        return sum;
      }, 0);

      return {
        ...product,
        currentStock,
        price: Number(product.price),
        cost: Number(product.cost)
      };
    });

    res.json(lowStockItems);
  } catch (error) {
    console.error('Error obteniendo productos con stock bajo:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};