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
        permissions: ['dashboard:read', 'contabilidad:read', 'contabilidad:write', 'reportes:read', 'users:read'] // contabilidad
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