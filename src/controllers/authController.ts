import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import User from "../models/User";
import { AuthRequest } from "../middleware/authMiddleware";

/* =========================================================
   JWT TOKEN GENERATOR
========================================================= */

const generateToken = (
  userId: string,
  role: string,
  permissions: string[] = [],
): string => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }

  return jwt.sign(
    {
      userId,
      role,
      permissions,
    },
    secret,
    {
      expiresIn: "7d",
    },
  );
};

/* =========================================================
   REGISTER
   POST /api/auth/register
========================================================= */

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log("REGISTER REQUEST:", req.body);

    const { name, email, password, phone } = req.body;

    // 1. Validate input
    if (!name || !email || !password) {
      res.status(400).json({
        success: false,
        message: "Name, email and password are required",
      });
      return;
    }

    // 2. Validate password
    if (password.length < 6) {
      res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    // 3. Check existing user
    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      res.status(409).json({
        success: false,
        message: "User already exists with this email",
      });
      return;
    }

    console.log("Creating user...");

    // 4. Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 5. Create user
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      phone: phone?.trim(),
      role: "user",
      isActive: true,
    });

    console.log("USER CREATED:", user._id.toString());

    // 6. Generate JWT
    console.log("Generating token...");

    const token = generateToken(user._id.toString(), user.role);

    console.log("TOKEN GENERATED");

    // 7. Send response
    res.status(201).json({
      success: true,
      message: "Registration successful",
      token,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isActive: user.isActive,
      },
    });

    console.log("REGISTRATION RESPONSE SENT");
  } catch (error) {
    console.error("REGISTER ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Registration failed",
    });
  }
};

/* =========================================================
   LOGIN
   POST /api/auth/login
========================================================= */

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Validate request body
    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
      return;
    }

    // Normalize email
    const normalizedEmail = email.trim().toLowerCase();

    // Find user
    // password is select:false in User model,
    // so we explicitly include it here.
    const user = await User.findOne({
      email: normalizedEmail,
    }).select("+password");

    // User doesn't exist
    if (!user) {
      res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
      return;
    }

    // Check whether account is active
    if (!user.isActive) {
      res.status(403).json({
        success: false,
        message: "Your account is inactive",
      });
      return;
    }

    // Compare password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
      return;
    }

    // Generate JWT
    const token = generateToken(
      user._id.toString(),
      user.role,
      user.permissions || [],
    );

    // Send response
    res.status(200).json({
      success: true,
      message: "Login successful",

      token,

      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isActive: user.isActive,
      },
    });
  } catch (error) {
    console.error("LOGIN ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Login failed",
    });
  }
};

/* =========================================================
   GET CURRENT USER
   GET /api/auth/me
========================================================= */

export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // protect middleware should set this
    if (!req.userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    // Find current user
    const user = await User.findById(req.userId).select("-password");

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    // Return user
    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("GET ME ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to get current user",
    });
  }
};
