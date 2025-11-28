import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../services/database.service';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    permissions: string[];
  };
}

export const authenticateToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Token de acceso requerido' });
  }

  try {
    // Verificar si la sesión existe
    const session = await prisma.session.findFirst({
      where: { 
        token,
        expiresAt: { gt: new Date() }
      },
      include: {
        user: {
          include: { role: true }
        }
      }
    });

    if (!session) {
      return res.status(403).json({ message: 'Sesión expirada o inválida' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      permissions: decoded.permissions
    };
    
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Token inválido' });
  }
};

export const requirePermission = (permission: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'No autenticado' });
    }

    // Admin tiene todos los permisos
    if (req.user.role === 'admin' || req.user.permissions.includes('*')) {
      return next();
    }

    if (!req.user.permissions.includes(permission)) {
      return res.status(403).json({ message: 'Permisos insuficientes' });
    }

    next();
  };
};