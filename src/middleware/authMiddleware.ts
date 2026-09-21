import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
  userId?: string;
  role?: string;
  permissions?: string[];
}

interface JwtPayload {
  userId: string;
  role: string;
  permissions?: string[];
}

export const protect = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    // 1. Get Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    // 2. Extract token
    const token = authHeader.substring(7).trim();

    if (!token) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    // 3. Get JWT secret
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      console.error("JWT_SECRET is not configured");

      res.status(500).json({
        success: false,
        message: "JWT secret is not configured",
      });
      return;
    }

    // 4. Verify JWT
    const decoded = jwt.verify(token, secret) as JwtPayload;

    // 5. DEBUG LOGS
    console.log("=================================");
    console.log("AUTHENTICATION DEBUG");
    console.log("JWT USER ID:", decoded.userId);
    console.log("JWT ROLE:", decoded.role);
    console.log("JWT PERMISSIONS:", decoded.permissions);
    console.log("=================================");

    // 6. Store authentication data in request
    req.userId = decoded.userId;
    req.role = decoded.role;
    req.permissions = decoded.permissions || [];

    // 7. Continue
    next();
  } catch (error) {
    console.error("JWT ERROR:", error);

    res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

export const authorize = (...allowedRoles: string[]) => {
  return (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): void => {
    if (!req.userId || !req.role) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    console.log("AUTHORIZE ROLE:", req.role);
    console.log("ALLOWED ROLES:", allowedRoles);

    if (!allowedRoles.includes(req.role)) {
      res.status(403).json({
        success: false,
        message: "You do not have permission to perform this action",
      });
      return;
    }

    next();
  };
};

export const requirePermission = (...requiredPermissions: string[]) => {
  return (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): void => {
    // User must be authenticated
    if (!req.userId || !req.role) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    // Superadmin has all permissions
    if (req.role === "superadmin") {
      next();
      return;
    }

    // Get user's permissions
    const userPermissions = req.permissions || [];

    // Check all required permissions
    const hasPermission = requiredPermissions.every(
      (permission) => userPermissions.includes(permission)
    );

    if (!hasPermission) {
      res.status(403).json({
        success: false,
        message: "You do not have permission to perform this action",
        requiredPermissions,
        userPermissions,
      });
      return;
    }

    next();
  };
};