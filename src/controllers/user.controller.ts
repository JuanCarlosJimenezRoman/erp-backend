import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../services/database.service';
import { AuthRequest } from '../middleware/auth.middleware';

export const getUsers = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    
    const skip = (Number(page) - 1) * Number(limit);
    
    // Construir where clause para búsqueda
    const where: any = {
      isActive: true
    };

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: {
          role: {
            select: {
              name: true,
              description: true
            }
          }
        },
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.user.count({ where })
    ]);

    const usersWithoutPassword = users.map(user => ({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role.name,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    }));

    res.json({
      users: usersWithoutPassword,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
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
            id: true,
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
      roleId: user.role.id,
      permissions: user.role.permissions as string[],
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

export const createUser = async (req: Request, res: Response) => {
  try {
    const { email, password, name, roleId } = req.body;

    if (!email || !password || !name || !roleId) {
      return res.status(400).json({ 
        message: 'Email, contraseña, nombre y rol son requeridos' 
      });
    }

    // Verificar si el usuario ya existe
    const existingUser = await prisma.user.findUnique({ 
      where: { email } 
    });
    
    if (existingUser) {
      return res.status(400).json({ message: 'El email ya está registrado' });
    }

    // Verificar que el rol existe
    const role = await prisma.role.findUnique({
      where: { id: roleId }
    });

    if (!role) {
      return res.status(400).json({ message: 'Rol no válido' });
    }

    // Hash de la contraseña
    const hashedPassword = await bcrypt.hash(password, 12);

    // Crear usuario
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        roleId
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
      createdAt: user.createdAt
    };

    res.status(201).json({
      message: 'Usuario creado exitosamente',
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Error creando usuario:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

export const updateUser = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, email, roleId, isActive, password } = req.body;

    // Verificar que el usuario existe
    const existingUser = await prisma.user.findUnique({
      where: { id }
    });

    if (!existingUser) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Verificar email único si se está cambiando
    if (email && email !== existingUser.email) {
      const emailExists = await prisma.user.findUnique({
        where: { email }
      });
      if (emailExists) {
        return res.status(400).json({ message: 'El email ya está en uso' });
      }
    }

    // Verificar rol si se está cambiando
    if (roleId) {
      const role = await prisma.role.findUnique({
        where: { id: roleId }
      });
      if (!role) {
        return res.status(400).json({ message: 'Rol no válido' });
      }
    }

    // Preparar datos para actualizar
    const updateData: any = {
      ...(name && { name }),
      ...(email && { email }),
      ...(roleId && { roleId }),
      ...(typeof isActive === 'boolean' && { isActive })
    };

    // Actualizar contraseña si se proporciona
    if (password) {
      updateData.password = await bcrypt.hash(password, 12);
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
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

    // Verificar que no sea el propio usuario
    const authReq = req as AuthRequest;
    if (authReq.user?.id === id) {
      return res.status(400).json({ 
        message: 'No puedes desactivar tu propio usuario' 
      });
    }

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

export const updateUserProfile = async (req: AuthRequest, res: Response) => {
  try {
    const { name, email, password } = req.body;
    const userId = req.user!.id;

    const updateData: any = {
      ...(name && { name }),
      ...(email && { email })
    };

    // Verificar email único si se está cambiando
    if (email) {
      const existingUser = await prisma.user.findUnique({
        where: { id: userId }
      });
      
      if (existingUser && email !== existingUser.email) {
        const emailExists = await prisma.user.findUnique({
          where: { email }
        });
        if (emailExists) {
          return res.status(400).json({ message: 'El email ya está en uso' });
        }
      }
    }

    // Actualizar contraseña si se proporciona
    if (password) {
      updateData.password = await bcrypt.hash(password, 12);
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
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
      message: 'Perfil actualizado exitosamente',
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Error actualizando perfil:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

export const getProfile = async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
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

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role.name,
        permissions: user.role.permissions as string[],
        isActive: user.isActive,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Error obteniendo perfil:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};