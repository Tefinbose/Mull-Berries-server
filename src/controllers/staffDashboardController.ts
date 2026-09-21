import { Response } from "express";
import { AuthRequest } from "../middleware/authMiddleware";
import Order from "../models/Order";
import Product from "../models/Product";

export const getStaffDashboard = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    // -----------------------------------------
    // 1. Authentication check
    // -----------------------------------------
    if (!req.userId || !req.role) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    // -----------------------------------------
    // 2. Staff access check
    // -----------------------------------------
    if (req.role !== "staff" && req.role !== "superadmin") {
      res.status(403).json({
        success: false,
        message: "Staff access required",
      });
      return;
    }

    // -----------------------------------------
    // 3. Get permissions
    // -----------------------------------------
    const permissions = req.permissions || [];

    const canViewOrders =
      req.role === "superadmin" ||
      permissions.includes("orders.view");

    const canViewInventory =
      req.role === "superadmin" ||
      permissions.includes("inventory.view") ||
      permissions.includes("inventory.update");

    // -----------------------------------------
    // 4. Default dashboard data
    // -----------------------------------------
    let orderStats = {
      total: 0,
      pending: 0,
      confirmed: 0,
      processing: 0,
      shipped: 0,
      outForDelivery: 0,
      delivered: 0,
      cancelled: 0,
      returned: 0,
    };

    let recentOrders: unknown[] = [];

    let todayOrders = 0;
    let todayCompleted = 0;

    let lowStockProducts: unknown[] = [];

    // -----------------------------------------
    // 5. Order dashboard
    // -----------------------------------------
    if (canViewOrders) {
      const [
        total,
        pending,
        confirmed,
        processing,
        shipped,
        outForDelivery,
        delivered,
        cancelled,
        returned,
      ] = await Promise.all([
        Order.countDocuments(),

        Order.countDocuments({
          orderStatus: "pending",
        }),

        Order.countDocuments({
          orderStatus: "confirmed",
        }),

        Order.countDocuments({
          orderStatus: "processing",
        }),

        Order.countDocuments({
          orderStatus: "shipped",
        }),

        Order.countDocuments({
          orderStatus: "out_for_delivery",
        }),

        Order.countDocuments({
          orderStatus: "delivered",
        }),

        Order.countDocuments({
          orderStatus: "cancelled",
        }),

        Order.countDocuments({
          orderStatus: "returned",
        }),
      ]);

      orderStats = {
        total,
        pending,
        confirmed,
        processing,
        shipped,
        outForDelivery,
        delivered,
        cancelled,
        returned,
      };

      // -----------------------------------------
      // Recent orders
      // -----------------------------------------
      recentOrders = await Order.find()
        .populate("user", "name email phone")
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();

      // -----------------------------------------
      // Today's statistics
      // -----------------------------------------
      const now = new Date();

      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);

      [todayOrders, todayCompleted] = await Promise.all([
        Order.countDocuments({
          createdAt: {
            $gte: startOfDay,
            $lte: endOfDay,
          },
        }),

        Order.countDocuments({
          orderStatus: "delivered",
          updatedAt: {
            $gte: startOfDay,
            $lte: endOfDay,
          },
        }),
      ]);
    }

    // -----------------------------------------
    // 6. Inventory dashboard
    // -----------------------------------------
    if (canViewInventory) {
      lowStockProducts = await Product.find({
        stock: {
          $lte: 10,
        },
        isActive: true,
      })
        .select("_id name slug stock price images")
        .sort({
          stock: 1,
        })
        .limit(10)
        .lean();
    }

    // -----------------------------------------
    // 7. Response
    // -----------------------------------------
    res.status(200).json({
      success: true,

      dashboard: {
        orderStats,

        today: {
          orders: todayOrders,
          completed: todayCompleted,
        },

        recentOrders,

        lowStockProducts,

        permissions,
      },
    });
  } catch (error) {
    console.error("STAFF DASHBOARD ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to load staff dashboard",
    });
  }
};