import { Response } from "express";
import User from "../models/User";
import { AuthRequest } from "../middleware/authMiddleware";

export const getStaffProfile = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const staff = await User.findById(req.userId).select("-password");

    if (!staff) {
      res.status(404).json({
        success: false,
        message: "Staff account not found",
      });
      return;
    }

    if (staff.role !== "staff" && staff.role !== "superadmin") {
      res.status(403).json({
        success: false,
        message: "Staff access required",
      });
      return;
    }

    if (!staff.isActive) {
      res.status(403).json({
        success: false,
        message: "Your staff account is inactive",
      });
      return;
    }

    res.status(200).json({
      success: true,
      staff: {
        id: staff._id,
        name: staff.name,
        email: staff.email,
        phone: staff.phone,
        role: staff.role,
        permissions: staff.permissions || [],
        isActive: staff.isActive,
      },
    });
  } catch (error) {
    console.error("GET STAFF PROFILE ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to get staff profile",
    });
  }
};