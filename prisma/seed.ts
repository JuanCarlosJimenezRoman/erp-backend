import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Primero limpiar la base de datos
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  await prisma.role.deleteMany();

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