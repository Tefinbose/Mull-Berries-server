import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import User, { UserRole, StaffPermission } from "../models/User";

const STAFF_ROLES: UserRole[] = ["staff", "manager", "admin", "superadmin"];

const ALL_PERMISSIONS: StaffPermission[] = [
  "orders.view",
  "orders.process",
  "orders.update_status",
  "orders.prepare",
  "inventory.view",
  "inventory.update",
  "shipping.view",
  "shipping.prepare",
  "shipping.print_labels",
  "customers.view",
];

function sanitizeStaff(user: any) {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    permissions: user.permissions || [],
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

/**
 * GET /api/admin/staff
 */
export const getAdminStaff = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const staff = await User.find({
      role: { $in: STAFF_ROLES },
    })
      .select("-password")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      staff: staff.map(sanitizeStaff),
      total: staff.length,
    });
  } catch (error) {
    console.error("GET ADMIN STAFF ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch staff members",
    });
  }
};

/**
 * GET /api/admin/staff/:id
 */
export const getAdminStaffById = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;

    const staff = await User.findOne({
      _id: id,
      role: { $in: STAFF_ROLES },
    }).select("-password");

    if (!staff) {
      res.status(404).json({
        success: false,
        message: "Staff member not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      staff: sanitizeStaff(staff),
    });
  } catch (error) {
    console.error("GET STAFF BY ID ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch staff member",
    });
  }
};

/**
 * POST /api/admin/staff
 */
export const createAdminStaff = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { name, email, password, phone, role, permissions } = req.body;

    if (!name || !email || !password || !role) {
      res.status(400).json({
        success: false,
        message: "Name, email, password and role are required",
      });
      return;
    }

    if (!STAFF_ROLES.includes(role)) {
      res.status(400).json({
        success: false,
        message: "Invalid staff role",
      });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({
        success: false,
        message: "Password must contain at least 6 characters",
      });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      res.status(409).json({
        success: false,
        message:
          "An account with this email already exists. Edit that account instead.",
      });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const validPermissions = Array.isArray(permissions)
      ? permissions.filter((permission: string) =>
          ALL_PERMISSIONS.includes(permission as StaffPermission),
        )
      : [];

    const newStaff = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      phone: phone?.trim() || "",
      role,
      permissions: role === "superadmin" ? ALL_PERMISSIONS : validPermissions,
      isActive: true,
    });

    res.status(201).json({
      success: true,
      message: "Staff member created successfully",
      staff: sanitizeStaff(newStaff),
    });
  } catch (error) {
    console.error("CREATE ADMIN STAFF ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create staff member",
    });
  }
};

/**
 * PUT /api/admin/staff/:id
 */
export const updateAdminStaff = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;

    const { name, email, password, phone, role, permissions } = req.body;

    const staff = await User.findById(id).select("+password");

    if (!staff) {
      res.status(404).json({
        success: false,
        message: "Staff member not found",
      });
      return;
    }

    if (!STAFF_ROLES.includes(role)) {
      res.status(400).json({
        success: false,
        message: "Invalid staff role",
      });
      return;
    }

    if (email) {
      const normalizedEmail = email.trim().toLowerCase();

      const emailExists = await User.findOne({
        email: normalizedEmail,
        _id: { $ne: id },
      });

      if (emailExists) {
        res.status(409).json({
          success: false,
          message: "Another user already uses this email",
        });
        return;
      }

      staff.email = normalizedEmail;
    }

    if (name) {
      staff.name = name.trim();
    }

    if (phone !== undefined) {
      staff.phone = phone.trim();
    }

    staff.role = role;

    if (role === "superadmin") {
      staff.permissions = ALL_PERMISSIONS;
    } else if (Array.isArray(permissions)) {
      staff.permissions = permissions.filter((permission: string) =>
        ALL_PERMISSIONS.includes(permission as StaffPermission),
      ) as StaffPermission[];
    }

    if (password) {
      if (password.length < 6) {
        res.status(400).json({
          success: false,
          message: "Password must contain at least 6 characters",
        });
        return;
      }

      staff.password = await bcrypt.hash(password, 10);
    }

    await staff.save();

    res.status(200).json({
      success: true,
      message: "Staff member updated successfully",
      staff: sanitizeStaff(staff),
    });
  } catch (error) {
    console.error("UPDATE ADMIN STAFF ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update staff member",
    });
  }
};

/**
 * PATCH /api/admin/staff/:id/status
 */
export const updateAdminStaffStatus = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== "boolean") {
      res.status(400).json({
        success: false,
        message: "isActive must be true or false",
      });
      return;
    }

    const staff = await User.findById(id);

    if (!staff) {
      res.status(404).json({
        success: false,
        message: "Staff member not found",
      });
      return;
    }

    if (staff.role === "superadmin" && !isActive) {
      res.status(403).json({
        success: false,
        message: "Super Admin cannot be deactivated",
      });
      return;
    }

    staff.isActive = isActive;

    await staff.save();

    res.status(200).json({
      success: true,
      message: isActive ? "Staff member activated" : "Staff member deactivated",
      staff: sanitizeStaff(staff),
    });
  } catch (error) {
    console.error("UPDATE STAFF STATUS ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update staff status",
    });
  }
};

/**
 * PATCH /api/admin/staff/:id/permissions
 */
export const updateAdminStaffPermissions = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const { permissions } = req.body;

    if (!Array.isArray(permissions)) {
      res.status(400).json({
        success: false,
        message: "permissions must be an array",
      });
      return;
    }

    const staff = await User.findById(id);

    if (!staff) {
      res.status(404).json({
        success: false,
        message: "Staff member not found",
      });
      return;
    }

    if (staff.role === "superadmin") {
      res.status(403).json({
        success: false,
        message: "Super Admin permissions cannot be restricted",
      });
      return;
    }

    const validPermissions = permissions.filter((permission: string) =>
      ALL_PERMISSIONS.includes(permission as StaffPermission),
    ) as StaffPermission[];

    staff.permissions = validPermissions;

    await staff.save();

    res.status(200).json({
      success: true,
      message: "Staff permissions updated successfully",
      staff: sanitizeStaff(staff),
    });
  } catch (error) {
    console.error("UPDATE STAFF PERMISSIONS ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update staff permissions",
    });
  }
};
