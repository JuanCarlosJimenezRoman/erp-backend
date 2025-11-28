import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Crear roles iniciales
  await prisma.role.createMany({
    data: [
      {
        name: 'admin',
        description: 'Administrador del sistema',
        permissions: ['*']
      },
      {
        name: 'usuario',
        description: 'Usuario básico',
        permissions: ['dashboard:read', 'profile:read']
      },
      {
        name: 'contabilidad',
        description: 'Departamento de contabilidad',
        permissions: ['dashboard:read', 'contabilidad:read', 'contabilidad:write']
      },
      {
        name: 'almacen',
        description: 'Departamento de almacén',
        permissions: ['dashboard:read', 'almacen:read', 'almacen:write']
      }
    ],
    skipDuplicates: true
  });

  // Crear usuario administrador
  const hashedPassword = await bcrypt.hash('admin123', 12);

  await prisma.user.upsert({
    where: { email: 'admin@erp.com' },
    update: {},
    create: {
      email: 'admin@erp.com',
      password: hashedPassword,
      name: 'Administrador',
      role: {
        connect: { name: 'admin' }
      }
    }
  });

  console.log('✅ Base de datos inicializada');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
