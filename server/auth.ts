import { Request, Response, NextFunction } from "express";
import { storage } from "./storage";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username: string;
      };
    }
  }
}

export async function isAuthenticated(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const sessionUser = (req.session as any)?.user;

  if (!sessionUser) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  req.user = sessionUser;
  next();
}

export async function isAdmin(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!req.user) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  // All authenticated users are admins in this setup
  next();
}

export async function login(username: string, password: string) {
  const user = await storage.getAdminUser(username);

  if (!user || user.password !== password) {
    return null;
  }

  return {
    id: user.id,
    username: user.username,
  };
}
