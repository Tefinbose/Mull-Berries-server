import { Response } from "express";

import Order from "../models/Order";
import Product from "../models/Product";
import User from "../models/User";
import { AuthRequest } from "../middleware/authMiddleware";

export const getAdminDashboard = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    /* =====================================================
       AUTHORIZATION
    ===================================================== */

    if (!req.userId || !req.role) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const allowedRoles = [
      "admin",
      "manager",
      "superadmin",
    ];

    if (!allowedRoles.includes(req.role)) {
      res.status(403).json({
        success: false,
        message: "Admin access required",
      });
      return;
    }

    /* =====================================================
       DATE RANGE
    ===================================================== */

    const requestedDays = Number(req.query.days);

    const days = Math.min(
      Math.max(
        Number.isFinite(requestedDays) && requestedDays > 0
          ? requestedDays
          : 7,
        1
      ),
      365
    );

    const endDate = new Date();

    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - days);

    /*
     * Previous period.
     *
     * Example:
     * Current = last 7 days
     * Previous = 7 days before that
     */
    const previousEndDate = new Date(startDate);

    const previousStartDate = new Date(previousEndDate);
    previousStartDate.setDate(
      previousStartDate.getDate() - days
    );

    const currentDateFilter = {
      createdAt: {
        $gte: startDate,
        $lte: endDate,
      },
    };

    const previousDateFilter = {
      createdAt: {
        $gte: previousStartDate,
        $lt: previousEndDate,
      },
    };

    /* =====================================================
       BASIC COUNTS
    ===================================================== */

    const [
      totalOrders,
      previousOrders,

      totalCustomers,
      previousCustomers,

      totalProducts,

      deliveredOrders,
      confirmedOrders,
      processingOrders,
      shippedOrders,
      outForDeliveryOrders,
      cancelledOrders,
      returnedOrders,
    ] = await Promise.all([
      // Current orders
      Order.countDocuments(currentDateFilter),

      // Previous orders
      Order.countDocuments(previousDateFilter),

      // Registered customers
      User.countDocuments({
        role: "user",
        ...currentDateFilter,
      }),

      // Previous registered customers
      User.countDocuments({
        role: "user",
        ...previousDateFilter,
      }),

      // Current active products
      Product.countDocuments({
        isActive: true,
      }),

      // Order statuses
      Order.countDocuments({
        ...currentDateFilter,
        orderStatus: "delivered",
      }),

      Order.countDocuments({
        ...currentDateFilter,
        orderStatus: "confirmed",
      }),

      Order.countDocuments({
        ...currentDateFilter,
        orderStatus: "processing",
      }),

      Order.countDocuments({
        ...currentDateFilter,
        orderStatus: "shipped",
      }),

      Order.countDocuments({
        ...currentDateFilter,
        orderStatus: "out_for_delivery",
      }),

      Order.countDocuments({
        ...currentDateFilter,
        orderStatus: "cancelled",
      }),

      Order.countDocuments({
        ...currentDateFilter,
        orderStatus: "returned",
      }),
    ]);

    /* =====================================================
       REVENUE
       
       Revenue is calculated from delivered orders.
    ===================================================== */

    const revenueResult = await Order.aggregate([
      {
        $match: {
          ...currentDateFilter,
          orderStatus: "delivered",
        },
      },
      {
        $group: {
          _id: null,

          totalRevenue: {
            $sum: "$totalAmount",
          },

          averageOrderValue: {
            $avg: "$totalAmount",
          },
        },
      },
    ]);

    const previousRevenueResult = await Order.aggregate([
      {
        $match: {
          ...previousDateFilter,
          orderStatus: "delivered",
        },
      },
      {
        $group: {
          _id: null,

          totalRevenue: {
            $sum: "$totalAmount",
          },
        },
      },
    ]);

    const totalRevenue =
      revenueResult[0]?.totalRevenue || 0;

    const averageOrderValue =
      revenueResult[0]?.averageOrderValue || 0;

    const previousRevenue =
      previousRevenueResult[0]?.totalRevenue || 0;

    /* =====================================================
       PERCENTAGE CHANGE
    ===================================================== */

    const calculatePercentageChange = (
      current: number,
      previous: number
    ): number => {
      if (previous === 0) {
        return current > 0 ? 100 : 0;
      }

      return Number(
        (((current - previous) / previous) * 100).toFixed(1)
      );
    };

    const revenueChange = calculatePercentageChange(
      totalRevenue,
      previousRevenue
    );

    const ordersChange = calculatePercentageChange(
      totalOrders,
      previousOrders
    );

    const customersChange = calculatePercentageChange(
      totalCustomers,
      previousCustomers
    );

    /* =====================================================
       DAILY SALES
    ===================================================== */

    const dailySales = await Order.aggregate([
      {
        $match: {
          ...currentDateFilter,
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

          value: {
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

    /* =====================================================
       RECENT ORDERS
    ===================================================== */

    const recentOrders = await Order.find(
      currentDateFilter
    )
      .select(
        "_id customer items totalAmount paymentMethod paymentStatus orderStatus createdAt"
      )
      .sort({
        createdAt: -1,
      })
      .limit(5)
      .lean();

    /* =====================================================
       TOP PRODUCTS
       
       Uses delivered orders only.
    ===================================================== */

    const topProducts = await Order.aggregate([
      {
        $match: {
          ...currentDateFilter,
          orderStatus: "delivered",
        },
      },

      {
        $unwind: "$items",
      },

      {
        $group: {
          _id: "$items.product",

          name: {
            $first: "$items.name",
          },

          sold: {
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
          sold: -1,
          revenue: -1,
        },
      },

      {
        $limit: 5,
      },
    ]);

    /* =====================================================
       LOW STOCK
    ===================================================== */

    const lowStockProducts = await Product.find({
      isActive: true,

      stock: {
        $lte: 10,
      },
    })
      .select("_id name stock price images")
      .sort({
        stock: 1,
      })
      .limit(5)
      .lean();

    /* =====================================================
       INVENTORY SUMMARY
    ===================================================== */

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

    /* =====================================================
       RESPONSE
    ===================================================== */

    res.status(200).json({
      success: true,

      dashboard: {
        period: {
          days,

          startDate,

          endDate,

          previousStartDate,

          previousEndDate,
        },

        stats: {
          totalRevenue,

          totalOrders,

          totalCustomers,

          totalProducts,

          revenueChange,

          ordersChange,

          customersChange,
        },

        sales: {
          totalRevenue,

          averageOrderValue,

          deliveredOrders,

          dailySales,
        },

        orders: {
          total: totalOrders,

          confirmed: confirmedOrders,

          processing: processingOrders,

          shipped: shippedOrders,

          outForDelivery: outForDeliveryOrders,

          delivered: deliveredOrders,

          cancelled: cancelledOrders,

          returned: returnedOrders,
        },

        recentOrders,

        topProducts,

        lowStockProducts,

        inventory,
      },
    });
  } catch (error) {
    console.error(
      "GET ADMIN DASHBOARD ERROR:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Failed to load admin dashboard",
    });
  }
};