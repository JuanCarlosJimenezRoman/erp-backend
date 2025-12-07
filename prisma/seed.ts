import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Primero limpiar la base de datos
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  await prisma.role.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.account.deleteMany();

  // Crear roles iniciales - SIN JSON.stringify porque es tipo Json
  const roles = await prisma.role.createMany({
    data: [
      {
        name: 'admin',
        description: 'Administrador del sistema',
        permissions: ['*', 'users:read', 'users:write', 'users:delete'] // Array directo, no stringify
      },

      {
        name: 'usuario',
        description: 'Usuario básico',
        permissions: ['dashboard:read', 'profile:read', 'profile:write'] // usuario
      },
      {
        name: 'contabilidad',
        description: 'Departamento de contabilidad',
        permissions: [
          'dashboard:read', 
          'contabilidad:read', 
          'contabilidad:write', 
          'reportes:read',
          'accounts:read',
          'accounts:write',
          'transactions:read', 
          'transactions:write',
          'invoices:read',
          'invoices:write'
        ]
      },
      {
        name: 'almacen',
        description: 'Departamento de almacén',
        permissions: ['dashboard:read', 'almacen:read', 'almacen:write', 'inventario:read', 'inventario:write'] // Array directo
      }
    ],
    skipDuplicates: true
  });

  // Crear usuario administrador
  const hashedPassword = await bcrypt.hash('admin123', 12);
  
  const adminRole = await prisma.role.findFirst({
    where: { name: 'admin' }
  });

  if (!adminRole) {
    throw new Error('Rol admin no encontrado');
  }

  await prisma.user.create({
    data: {
      email: 'admin@erp.com',
      password: hashedPassword,
      name: 'Administrador Principal',
      roleId: adminRole.id
    }
  });

  // Crear usuario de almacen
  const hashedPasswordAlmacen = await bcrypt.hash('almacen123', 12);

  const almacenRole = await prisma.role.findFirst({
    where: { name: 'almacen' }
  });
  
  if (!almacenRole) {
    throw new Error('Rol almacen no encontrado');
  }
  
  await prisma.user.create({
    data: {
      email: 'almacen@erp.com',
      password: hashedPasswordAlmacen,
      name: 'Encargado de Almacen',
      roleId: almacenRole.id,
    }
  });

  // Crear cuentas contables básicas
await prisma.account.createMany({
  data: [
    // Activos
    { code: '1001', name: 'Caja', type: 'ASSET', description: 'Efectivo en caja' },
    { code: '1002', name: 'Bancos', type: 'ASSET', description: 'Cuentas bancarias' },
    { code: '1101', name: 'Cuentas por Cobrar', type: 'ASSET', description: 'Clientes por cobrar' },
    { code: '1201', name: 'Inventario', type: 'ASSET', description: 'Mercadería en stock' },
    
    // Pasivos
    { code: '2001', name: 'Cuentas por Pagar', type: 'LIABILITY', description: 'Proveedores por pagar' },
    { code: '2101', name: 'Préstamos Bancarios', type: 'LIABILITY', description: 'Préstamos a corto plazo' },
    
    // Patrimonio
    { code: '3001', name: 'Capital Social', type: 'EQUITY', description: 'Capital de los accionistas' },
    { code: '3101', name: 'Utilidades Retenidas', type: 'EQUITY', description: 'Ganancias acumuladas' },
    
    // Ingresos
    { code: '4001', name: 'Ventas', type: 'INCOME', description: 'Ingresos por ventas' },
    { code: '4101', name: 'Ingresos por Servicios', type: 'INCOME', description: 'Ingresos por servicios prestados' },
    
    // Gastos
    { code: '5001', name: 'Costo de Ventas', type: 'EXPENSE', description: 'Costo de mercadería vendida' },
    { code: '5101', name: 'Gastos de Nómina', type: 'EXPENSE', description: 'Salarios y beneficios' },
    { code: '5201', name: 'Gastos de Alquiler', type: 'EXPENSE', description: 'Alquiler de oficinas' },
    { code: '5301', name: 'Gastos de Servicios', type: 'EXPENSE', description: 'Agua, luz, internet' }
  ],
  skipDuplicates: true
});

// Crear categorías de inventario
await prisma.category.createMany({
  data: [
    { name: 'Electrónicos', description: 'Dispositivos electrónicos y gadgets' },
    { name: 'Ropa', description: 'Prendas de vestir y accesorios' },
    { name: 'Hogar', description: 'Artículos para el hogar' },
    { name: 'Deportes', description: 'Equipamiento deportivo' },
    { name: 'Libros', description: 'Libros y material de lectura' }
  ],
  skipDuplicates: true
});

// Crear proveedores
await prisma.supplier.createMany({
  data: [
    { 
      name: 'TecnoImport S.A.', 
      email: 'ventas@tecnoimport.com',
      phone: '+1234567890',
      address: 'Av. Tecnológica 123, Ciudad',
      taxId: '12345678901'
    },
    { 
      name: 'ModaStyle Ltda.', 
      email: 'contacto@modastyle.com',
      phone: '+0987654321',
      address: 'Calle Moda 456, Ciudad',
      taxId: '98765432109'
    },
    { 
      name: 'HogarConfort S.A.', 
      email: 'info@hogarconfort.com',
      phone: '+1122334455',
      address: 'Plaza Hogar 789, Ciudad'
    }
  ],
  skipDuplicates: true
});

// Crear algunos productos de ejemplo
const electronicsCategory = await prisma.category.findFirst({ where: { name: 'Electrónicos' } });
const clothingCategory = await prisma.category.findFirst({ where: { name: 'Ropa' } });
const homeCategory = await prisma.category.findFirst({ where: { name: 'Hogar' } });

const tecnoSupplier = await prisma.supplier.findFirst({ where: { name: 'TecnoImport S.A.' } });
const modaSupplier = await prisma.supplier.findFirst({ where: { name: 'ModaStyle Ltda.' } });

if (electronicsCategory && tecnoSupplier) {
  await prisma.product.create({
    data: {
      sku: 'SMARTPHONE-001',
      name: 'Smartphone Android',
      description: 'Smartphone Android de última generación',
      price: 299.99,
      cost: 199.99,
      categoryId: electronicsCategory.id,
      supplierId: tecnoSupplier.id,
      minStock: 5,
      maxStock: 50
    }
  });

  await prisma.product.create({
    data: {
      sku: 'LAPTOP-001',
      name: 'Laptop Business',
      description: 'Laptop para negocios',
      price: 899.99,
      cost: 649.99,
      categoryId: electronicsCategory.id,
      supplierId: tecnoSupplier.id,
      minStock: 3,
      maxStock: 20
    }
  });
}

if (clothingCategory && modaSupplier) {
  await prisma.product.create({
    data: {
      sku: 'TSHIRT-001',
      name: 'Camiseta Básica',
      description: 'Camiseta de algodón 100%',
      price: 19.99,
      cost: 9.99,
      categoryId: clothingCategory.id,
      supplierId: modaSupplier.id,
      minStock: 10,
      maxStock: 100
    }
  });
}

if (homeCategory) {
  await prisma.product.create({
    data: {
      sku: 'COFFEE-001',
      name: 'Cafetera Programable',
      description: 'Cafetera automática con programador',
      price: 79.99,
      cost: 49.99,
      categoryId: homeCategory.id,
      minStock: 2,
      maxStock: 25
    }
  });
}

console.log('📦 Datos de inventario creados');


  console.log('✅ Base de datos inicializada correctamente');
  console.log('👤 Usuario admin: admin@erp.com / admin123');
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });