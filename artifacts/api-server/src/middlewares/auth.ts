import { type Request, type Response, type NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env["JWT_SECRET"] ?? "storeinsight-secret-key";

export interface AuthRequest extends Request {
  user?: { email: string };
}

// Middleware to verify JWT on protected routes
export function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    res.status(401).json({ error: "Access denied. No token provided." });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { email: string };
    req.user = { email: decoded.email };
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token." });
  }
}

export { JWT_SECRET };
