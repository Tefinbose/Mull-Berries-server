import { Response } from "express";

import Order from "../models/Order";
import Product from "../models/Product";
import { AuthRequest } from "../middleware/authMiddleware";

export const getStaffAnalytics = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    /*
     * ========================================
     * AUTHENTICATION CHECK
     * ========================================
     */

    if (!req.userId || !req.role) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    /*
     * ========================================
     * STAFF ACCESS CHECK
     * ========================================
     */

    if (req.role !== "staff" && req.role !== "superadmin") {
      res.status(403).json({
        success: false,
        message: "Staff access required",
      });
      return;
    }

    /*
     * ========================================
     * ANALYTICS PERIOD
     * ========================================
     *
     * Examples:
     *
     * /api/staff/analytics?days=7
     * /api/staff/analytics?days=30
     * /api/staff/analytics?days=90
     *
     * Default: 30 days
     */

    const requestedDays = Number(req.query.days);

    const days = Math.min(
      Math.max(
        Number.isFinite(requestedDays) && requestedDays > 0
          ? requestedDays
          : 30,
        1
      ),
      365
    );

    const endDate = new Date();

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    /*
     * ========================================
     * ORDER FILTER
     * ========================================
     */

    const orderFilter = {
      createdAt: {
        $gte: startDate,
        $lte: endDate,
      },
    };

    /*
     * ========================================
     * ORDER STATISTICS
     * ========================================
     */

    const [
      totalOrders,
      confirmedOrders,
      processingOrders,
      shippedOrders,
      outForDeliveryOrders,
      deliveredOrders,
      cancelledOrders,
    ] = await Promise.all([
      Order.countDocuments(orderFilter),

      Order.countDocuments({
        ...orderFilter,
        orderStatus: "confirmed",
      }),

      Order.countDocuments({
        ...orderFilter,
        orderStatus: "processing",
      }),

      Order.countDocuments({
        ...orderFilter,
        orderStatus: "shipped",
      }),

      Order.countDocuments({
        ...orderFilter,
        orderStatus: "out_for_delivery",
      }),

      Order.countDocuments({
        ...orderFilter,
        orderStatus: "delivered",
      }),

      Order.countDocuments({
        ...orderFilter,
        orderStatus: "cancelled",
      }),
    ]);

    /*
     * ========================================
     * SALES ANALYTICS
     * ========================================
     *
     * Only delivered orders are treated
     * as completed sales.
     */

    const salesResult = await Order.aggregate([
      {
        $match: {
          ...orderFilter,
          orderStatus: "delivered",
        },
      },

      {
        $group: {
          _id: null,

          totalSales: {
            $sum: "$totalAmount",
          },

          averageOrderValue: {
            $avg: "$totalAmount",
          },

          deliveredOrders: {
            $sum: 1,
          },
        },
      },
    ]);

    const sales = salesResult[0] || {
      totalSales: 0,
      averageOrderValue: 0,
      deliveredOrders: 0,
    };

    /*
     * ========================================
     * DAILY SALES
     * ========================================
     */

    const dailySales = await Order.aggregate([
      {
        $match: {
          ...orderFilter,
          orderStatus: "delivered",
        },
      },

      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt",
            },
          },

          sales: {
            $sum: "$totalAmount",
          },

          orders: {
            $sum: 1,
          },
        },
      },

      {
        $sort: {
          _id: 1,
        },
      },
    ]);

    /*
     * ========================================
     * PAYMENT STATUS
     * ========================================
     */

    const paymentStats = await Order.aggregate([
      {
        $match: orderFilter,
      },

      {
        $group: {
          _id: "$paymentStatus",

          count: {
            $sum: 1,
          },
        },
      },

      {
        $sort: {
          count: -1,
        },
      },
    ]);

    /*
     * ========================================
     * PAYMENT METHODS
     * ========================================
     */

    const paymentMethods = await Order.aggregate([
      {
        $match: orderFilter,
      },

      {
        $group: {
          _id: "$paymentMethod",

          count: {
            $sum: 1,
          },

          amount: {
            $sum: "$totalAmount",
          },
        },
      },

      {
        $sort: {
          count: -1,
        },
      },
    ]);

    /*
     * ========================================
     * TOP PRODUCTS
     * ========================================
     *
     * Revenue is calculated using:
     *
     * price × quantity
     *
     * instead of items.total.
     */

    const topProducts = await Order.aggregate([
      {
        $match: {
          ...orderFilter,
          orderStatus: "delivered",
        },
      },

      {
        $unwind: "$items",
      },

      {
        $group: {
          _id: "$items.product",

          productName: {
            $first: "$items.name",
          },

          quantitySold: {
            $sum: "$items.quantity",
          },

          revenue: {
            $sum: {
              $multiply: [
                {
                  $ifNull: ["$items.price", 0],
                },
                {
                  $ifNull: ["$items.quantity", 0],
                },
              ],
            },
          },
        },
      },

      {
        $sort: {
          quantitySold: -1,
          revenue: -1,
        },
      },

      {
        $limit: 10,
      },
    ]);

    /*
     * ========================================
     * LOW STOCK PRODUCTS
     * ========================================
     */

    const lowStockProducts = await Product.find({
      stock: {
        $lte: 10,
      },

      isActive: true,
    })
      .select("_id name stock price images")
      .sort({
        stock: 1,
      })
      .limit(10)
      .lean();

    /*
     * ========================================
     * INVENTORY SUMMARY
     * ========================================
     */

    const inventoryResult = await Product.aggregate([
      {
        $match: {
          isActive: true,
        },
      },

      {
        $group: {
          _id: null,

          totalProducts: {
            $sum: 1,
          },

          totalStock: {
            $sum: "$stock",
          },

          lowStock: {
            $sum: {
              $cond: [
                {
                  $and: [
                    {
                      $gt: ["$stock", 0],
                    },
                    {
                      $lte: ["$stock", 10],
                    },
                  ],
                },
                1,
                0,
              ],
            },
          },

          outOfStock: {
            $sum: {
              $cond: [
                {
                  $lte: ["$stock", 0],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    const inventory = inventoryResult[0] || {
      totalProducts: 0,
      totalStock: 0,
      lowStock: 0,
      outOfStock: 0,
    };

    /*
     * ========================================
     * RECENT ORDERS
     * ========================================
     */

    const recentOrders = await Order.find(orderFilter)
      .select(
        "_id totalAmount paymentStatus orderStatus createdAt shippingAddress"
      )
      .sort({
        createdAt: -1,
      })
      .limit(10)
      .lean();

    /*
     * ========================================
     * RESPONSE
     * ========================================
     */

    res.status(200).json({
      success: true,

      analytics: {
        period: {
          days,
          startDate,
          endDate,
        },

        orders: {
          total: totalOrders,
          confirmed: confirmedOrders,
          processing: processingOrders,
          shipped: shippedOrders,
          outForDelivery: outForDeliveryOrders,
          delivered: deliveredOrders,
          cancelled: cancelledOrders,
        },

        sales: {
          totalSales: sales.totalSales || 0,
          averageOrderValue: sales.averageOrderValue || 0,
          deliveredOrders: sales.deliveredOrders || 0,
        },

        dailySales,

        paymentStats,

        paymentMethods,

        topProducts,

        inventory: {
          totalProducts: inventory.totalProducts || 0,
          totalStock: inventory.totalStock || 0,
          lowStock: inventory.lowStock || 0,
          outOfStock: inventory.outOfStock || 0,
        },

        lowStockProducts,

        recentOrders,
      },
    });
  } catch (error) {
    console.error("STAFF ANALYTICS ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to generate staff analytics",
    });
  }
};