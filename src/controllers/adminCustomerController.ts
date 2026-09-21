import { Request, Response } from "express";
import mongoose from "mongoose";

import User from "../models/User";
import Order from "../models/Order";
import { AuthRequest } from "../middleware/authMiddleware";

/**
 * GET /api/admin/customers
 *
 * Returns customers with:
 * - basic user information
 * - order count
 * - total spent
 * - last order date
 */
export const getAdminCustomers = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.userId || !req.role) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const users = await User.find({
      role: "user",
    })
      .select(
        "_id name email phone role isActive createdAt updatedAt"
      )
      .sort({ createdAt: -1 })
      .lean();

    if (users.length === 0) {
      res.status(200).json({
        success: true,
        customers: [],
        count: 0,
      });
      return;
    }

    /*
     * Get order statistics.
     *
     * We use shippingAddress.email because your existing
     * Order data contains the customer's email there.
     */
    const customerEmails = users
      .map((user) => user.email)
      .filter(Boolean);

    const orderStats = await Order.aggregate([
      {
        $match: {
          "shippingAddress.email": {
            $in: customerEmails,
          },
        },
      },
      {
        $group: {
          _id: "$shippingAddress.email",

          orderCount: {
            $sum: 1,
          },

          totalSpent: {
            $sum: {
              $cond: [
                {
                  $eq: ["$paymentStatus", "paid"],
                },
                {
                  $ifNull: ["$totalAmount", 0],
                },
                0,
              ],
            },
          },

          lastOrder: {
            $max: "$createdAt",
          },
        },
      },
    ]);

    const statsMap = new Map<
      string,
      {
        orderCount: number;
        totalSpent: number;
        lastOrder?: Date;
      }
    >();

    for (const stat of orderStats) {
      statsMap.set(stat._id, {
        orderCount: stat.orderCount || 0,
        totalSpent: stat.totalSpent || 0,
        lastOrder: stat.lastOrder,
      });
    }

    const customers = users.map((user) => {
      const stats = statsMap.get(user.email);

      return {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,

        orderCount: stats?.orderCount || 0,
        totalSpent: stats?.totalSpent || 0,
        lastOrder: stats?.lastOrder || null,
      };
    });

    res.status(200).json({
      success: true,
      customers,
      count: customers.length,
    });
  } catch (error) {
    console.error("GET ADMIN CUSTOMERS ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch customers",
    });
  }
};

/**
 * GET /api/admin/customers/:id
 */
export const getAdminCustomerById = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.userId || !req.role) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const { id } = req.params;

    if (
      typeof id !== "string" ||
      !mongoose.Types.ObjectId.isValid(id)
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid customer ID",
      });
      return;
    }

    const customer = await User.findOne({
      _id: id,
      role: "user",
    })
      .select(
        "_id name email phone role isActive createdAt updatedAt"
      )
      .lean();

    if (!customer) {
      res.status(404).json({
        success: false,
        message: "Customer not found",
      });
      return;
    }

    const orders = await Order.find({
      "shippingAddress.email": customer.email,
    })
      .sort({ createdAt: -1 })
      .lean();

    const totalSpent = orders
      .filter(
        (order: any) => order.paymentStatus === "paid"
      )
      .reduce(
        (total: number, order: any) =>
          total + Number(order.totalAmount || 0),
        0
      );

    res.status(200).json({
      success: true,
      customer: {
        ...customer,
        orderCount: orders.length,
        totalSpent,
        lastOrder: orders[0]?.createdAt || null,
        orders,
      },
    });
  } catch (error) {
    console.error(
      "GET ADMIN CUSTOMER ERROR:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Failed to fetch customer",
    });
  }
};

/**
 * PATCH /api/admin/customers/:id/status
 *
 * Block / unblock customer.
 */
export const updateAdminCustomerStatus = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.userId || !req.role) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const { id } = req.params;
    const { isActive } = req.body;

    if (
      typeof id !== "string" ||
      !mongoose.Types.ObjectId.isValid(id)
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid customer ID",
      });
      return;
    }

    if (typeof isActive !== "boolean") {
      res.status(400).json({
        success: false,
        message: "isActive must be a boolean",
      });
      return;
    }

    const customer = await User.findOneAndUpdate(
      {
        _id: id,
        role: "user",
      },
      {
        isActive,
      },
      {
        new: true,
        runValidators: true,
      }
    )
      .select(
        "_id name email phone role isActive createdAt updatedAt"
      )
      .lean();

    if (!customer) {
      res.status(404).json({
        success: false,
        message: "Customer not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: isActive
        ? "Customer activated successfully"
        : "Customer blocked successfully",
      customer,
    });
  } catch (error) {
    console.error(
      "UPDATE ADMIN CUSTOMER STATUS ERROR:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Failed to update customer status",
    });
  }
};