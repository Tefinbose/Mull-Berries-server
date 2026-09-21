import { Response } from "express";
import Order from "../models/Order";
import { AuthRequest } from "../middleware/authMiddleware";

/*
|--------------------------------------------------------------------------
| GET ALL STAFF ORDERS
|--------------------------------------------------------------------------
| Permission:
| orders.view
|
| Supports:
| ?status=pending
| ?search=customer@email.com
| ?page=1
| ?limit=20
|--------------------------------------------------------------------------
*/

export const getStaffOrders = async (
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

    const permissions = req.permissions || [];

    const canViewOrders =
      req.role === "superadmin" ||
      permissions.includes("orders.view");

    if (!canViewOrders) {
      res.status(403).json({
        success: false,
        message: "You do not have permission to view orders",
      });
      return;
    }

    const {
      status,
      search,
      page = "1",
      limit = "20",
    } = req.query;

    const pageNumber = Math.max(Number(page) || 1, 1);
    const limitNumber = Math.min(
      Math.max(Number(limit) || 20, 1),
      100
    );

    const skip = (pageNumber - 1) * limitNumber;

    const filter: Record<string, any> = {};

    /*
    |--------------------------------------------------------------------------
    | STATUS FILTER
    |--------------------------------------------------------------------------
    */

    if (status && typeof status === "string") {
      filter.orderStatus = status;
    }

    /*
    |--------------------------------------------------------------------------
    | SEARCH
    |--------------------------------------------------------------------------
    | Search customer name/email/phone.
    |
    | Customer information is stored through the populated user relation,
    | so we first find matching users.
    |--------------------------------------------------------------------------
    */

    if (search && typeof search === "string") {
      const User = (await import("../models/User")).default;

      const matchingUsers = await User.find({
        $or: [
          {
            name: {
              $regex: search,
              $options: "i",
            },
          },
          {
            email: {
              $regex: search,
              $options: "i",
            },
          },
          {
            phone: {
              $regex: search,
              $options: "i",
            },
          },
        ],
      }).select("_id");

      filter.user = {
        $in: matchingUsers.map((user) => user._id),
      };
    }

    /*
    |--------------------------------------------------------------------------
    | FETCH ORDERS
    |--------------------------------------------------------------------------
    */

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .populate("user", "name email phone")
        .sort({
          createdAt: -1,
        })
        .skip(skip)
        .limit(limitNumber)
        .lean(),

      Order.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limitNumber);

    res.status(200).json({
      success: true,

      orders,

      pagination: {
        total,
        page: pageNumber,
        limit: limitNumber,
        totalPages,
        hasNextPage: pageNumber < totalPages,
        hasPreviousPage: pageNumber > 1,
      },
    });
  } catch (error) {
    console.error("GET STAFF ORDERS ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to load staff orders",
    });
  }
};


/*
|--------------------------------------------------------------------------
| GET SINGLE STAFF ORDER
|--------------------------------------------------------------------------
| Permission:
| orders.view
|--------------------------------------------------------------------------
*/

export const getStaffOrderById = async (
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

    const permissions = req.permissions || [];

    const canViewOrders =
      req.role === "superadmin" ||
      permissions.includes("orders.view");

    if (!canViewOrders) {
      res.status(403).json({
        success: false,
        message: "You do not have permission to view orders",
      });
      return;
    }

    const { id } = req.params;

    const order = await Order.findById(id)
      .populate("user", "name email phone")
      .populate("items.product", "name slug images price stock")
      .lean();

    if (!order) {
      res.status(404).json({
        success: false,
        message: "Order not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      order,
    });
  } catch (error) {
    console.error("GET STAFF ORDER ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to load order",
    });
  }
};


/*
|--------------------------------------------------------------------------
| UPDATE ORDER STATUS
|--------------------------------------------------------------------------
| Permission:
| orders.update_status
|--------------------------------------------------------------------------
*/

export const updateStaffOrderStatus = async (
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

    const permissions = req.permissions || [];

    const canUpdateStatus =
      req.role === "superadmin" ||
      permissions.includes("orders.update_status");

    if (!canUpdateStatus) {
      res.status(403).json({
        success: false,
        message: "You do not have permission to update order status",
      });
      return;
    }

    const { id } = req.params;

    const { orderStatus } = req.body;

    const allowedStatuses = [
      "pending",
      "confirmed",
      "processing",
      "shipped",
      "out_for_delivery",
      "delivered",
      "cancelled",
      "returned",
    ];

    if (!orderStatus) {
      res.status(400).json({
        success: false,
        message: "Order status is required",
      });
      return;
    }

    if (!allowedStatuses.includes(orderStatus)) {
      res.status(400).json({
        success: false,
        message: "Invalid order status",
        allowedStatuses,
      });
      return;
    }

    const order = await Order.findById(id);

    if (!order) {
      res.status(404).json({
        success: false,
        message: "Order not found",
      });
      return;
    }

    /*
    |--------------------------------------------------------------------------
    | UPDATE STATUS
    |--------------------------------------------------------------------------
    */

    order.orderStatus = orderStatus;

    await order.save();

    const updatedOrder = await Order.findById(order._id)
      .populate("user", "name email phone")
      .populate("items.product", "name slug images price stock")
      .lean();

    res.status(200).json({
      success: true,
      message: "Order status updated successfully",
      order: updatedOrder,
    });
  } catch (error) {
    console.error("UPDATE STAFF ORDER STATUS ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update order status",
    });
  }
};