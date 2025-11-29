import { Request, Response } from 'express';
import { prisma } from '../services/database.service';

export const getRoles = async (req: Request, res: Response) => {
  try {
    const roles = await prisma.role.findMany({
      where: {
        name: { not: 'admin' } // No mostrar rol admin por defecto
      },
      orderBy: { name: 'asc' }
    });

    res.json(roles);
  } catch (error) {
    console.error('Error obteniendo roles:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

export const getRoleById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const role = await prisma.role.findUnique({
      where: { id }
    });

    if (!role) {
      return res.status(404).json({ message: 'Rol no encontrado' });
    }

    res.json(role);
  } catch (error) {
    console.error('Error obteniendo rol:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};