import { Request, Response } from 'express';
import { prisma } from '../services/database.service';
import { AuthRequest } from '../middleware/auth.middleware';

export const getUsers = async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      include: {
        role: {
          select: {
            name: true,
            description: true
          }
        }
      },
      where: {
        isActive: true
      }
    });

    const usersWithoutPassword = users.map(user => ({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role.name,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    }));

    res.json(usersWithoutPassword);
  } catch (error) {
    console.error('Error obteniendo usuarios:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

export const getUserById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        role: {
          select: {
            name: true,
            description: true,
            permissions: true
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    const userWithoutPassword = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role.name,
      permissions: JSON.parse(user.role.permissions),
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };

    res.json(userWithoutPassword);
  } catch (error) {
    console.error('Error obteniendo usuario:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

export const updateUser = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, email, roleId, isActive } = req.body;

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(email && { email }),
        ...(roleId && { roleId }),
        ...(typeof isActive === 'boolean' && { isActive })
      },
      include: {
        role: {
          select: {
            name: true,
            description: true
          }
        }
      }
    });

    const userWithoutPassword = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role.name,
      isActive: user.isActive,
      updatedAt: user.updatedAt
    };

    res.json({
      message: 'Usuario actualizado exitosamente',
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Error actualizando usuario:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.user.update({
      where: { id },
      data: { isActive: false }
    });

    res.json({ message: 'Usuario desactivado exitosamente' });
  } catch (error) {
    console.error('Error eliminando usuario:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};