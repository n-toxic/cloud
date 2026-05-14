import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../lib/auth.js";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userRole?: string;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const token = authHeader.slice(7);
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }
  req.userId = payload.userId;
  req.userRole = payload.role;
  next();
}

// Admin email restriction - only whytoxicz@gmail.com
const ADMIN_EMAIL = "whytoxicz@gmail.com";

export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (req.userRole !== "ADMIN") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  // Additional email check for extra security
  const { User } = await import("../db/index.js");
  const user = await User.findById(req.userId);
  if (!user || user.email !== ADMIN_EMAIL) {
    res.status(403).json({ error: "Unauthorized: restricted admin access" });
    return;
  }
  next();
}
