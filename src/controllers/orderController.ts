import { Response } from "express";
import mongoose from "mongoose";

import Order from "../models/Order";
import Cart from "../models/Cart";
import Address from "../models/Address";
import Product from "../models/Product";
import User from "../models/User";
import Shipment from "../models/Shipment";


import { AuthRequest } from "../middleware/authMiddleware";

const DEFAULT_SHIPPING_FEE = 100;

// ============================================================
// CREATE ORDER - LOGGED IN USER
// ============================================================

export const createOrder = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const { addressId, paymentMethod } = req.body;

    if (!addressId) {
      res.status(400).json({
        success: false,
        message: "Address ID is required",
      });
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(addressId)) {
      res.status(400).json({
        success: false,
        message: "Invalid address ID",
      });
      return;
    }

    if (!paymentMethod) {
      res.status(400).json({
        success: false,
        message: "Payment method is required",
      });
      return;
    }

    if (!["cod", "razorpay"].includes(paymentMethod)) {
      res.status(400).json({
        success: false,
        message: "Invalid payment method",
      });
      return;
    }

    // Get user
    const user = await User.findById(req.userId).select("-password");

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({
        success: false,
        message: "User account is inactive",
      });
      return;
    }

    const customerName = user.name?.trim();
    const customerEmail = user.email?.trim().toLowerCase();

    if (!customerName) {
      res.status(400).json({
        success: false,
        message: "User name is required to create an order",
      });
      return;
    }

    if (!customerEmail) {
      res.status(400).json({
        success: false,
        message: "User email is required to create an order",
      });
      return;
    }

    // Get address
    const address = await Address.findOne({
      _id: addressId,
      user: req.userId,
    });

    if (!address) {
      res.status(404).json({
        success: false,
        message: "Address not found",
      });
      return;
    }

    const customerPhone = address.phone?.trim() || user.phone?.trim();

    if (!customerPhone) {
      res.status(400).json({
        success: false,
        message: "Phone number is required to create an order",
      });
      return;
    }

    // Get cart
    const cart = await Cart.findOne({
      user: req.userId,
    });

    if (!cart || !cart.items || cart.items.length === 0) {
      res.status(400).json({
        success: false,
        message: "Cart is empty",
      });
      return;
    }

    // Build order items
    const orderItems: Array<{
      product: mongoose.Types.ObjectId;
      name: string;
      image?: string;
      quantity: number;
      price: number;
      variantId?: string;
      color?: string;
      size?: string;
    }> = [];

    let subtotal = 0;

    for (const cartItem of cart.items) {
      const product = await Product.findById(cartItem.product);

      if (!product) {
        res.status(400).json({
          success: false,
          message: `Product ${cartItem.product} no longer exists`,
        });
        return;
      }

      if (!product.isActive) {
        res.status(400).json({
          success: false,
          message: `${product.name} is no longer available`,
        });
        return;
      }

      if (!cartItem.quantity || cartItem.quantity <= 0) {
        res.status(400).json({
          success: false,
          message: `Invalid quantity for ${product.name}`,
        });
        return;
      }

      let itemPrice = Number(cartItem.price);

      if (!Number.isFinite(itemPrice) || itemPrice < 0) {
        itemPrice = Number(product.price);
      }

      // Variant
      if (cartItem.variantId) {
        const variant = product.variants?.find(
          (item: any) =>
            item._id?.toString() === cartItem.variantId ||
            item.sku === cartItem.variantId,
        );

        if (!variant) {
          if (product.stock < cartItem.quantity) {
            res.status(400).json({
              success: false,
              message: `Insufficient stock for ${product.name}`,
            });
            return;
          }
        } else {
          const effectiveStock = Math.max(
            Number(variant.stock) || 0,
            Number(product.stock) || 0
          );

          if (effectiveStock < cartItem.quantity) {
            res.status(400).json({
              success: false,
              message: `Insufficient stock for ${product.name}`,
            });
            return;
          }

          itemPrice = Number(variant.price) || itemPrice;
        }
      } else {
        if (product.stock < cartItem.quantity) {
          res.status(400).json({
            success: false,
            message: `Insufficient stock for ${product.name}`,
          });
          return;
        }
      }

      const itemTotal = itemPrice * cartItem.quantity;

      subtotal += itemTotal;

      orderItems.push({
        product: product._id,
        name: product.name,
        image: product.images?.[0],
        quantity: cartItem.quantity,
        price: itemPrice,
        variantId: cartItem.variantId,
      });
    }

    // Shipping
    const shippingCharge = subtotal >= 5000 ? 0 : DEFAULT_SHIPPING_FEE;

    const discount = 0;

    const totalAmount = subtotal + shippingCharge - discount;

    // Create order
    const order = await Order.create({
      user: req.userId,

      customer: {
        name: customerName,
        email: customerEmail,
        phone: customerPhone,
      },

      items: orderItems,

      shippingAddress: {
        name:
          (address as any).name?.trim() ||
          (address as any).fullName?.trim() ||
          customerName,

        phone: customerPhone,

        addressLine1: address.addressLine1?.trim(),

        addressLine2: address.addressLine2?.trim() || undefined,

        city: address.city?.trim(),

        state: address.state?.trim(),

        pincode: String(address.pincode).trim(),

        country: address.country?.trim() || "India",
      },

      subtotal,
      shippingCharge,
      discount,
      totalAmount,

      paymentMethod,

      paymentStatus: "pending",

      orderStatus: paymentMethod === "cod" ? "confirmed" : "pending",
    });

    // Reduce stock
    for (const cartItem of cart.items) {
      const product = await Product.findById(cartItem.product);

      if (!product) continue;

      if (cartItem.variantId) {
        const variant = product.variants?.find(
          (item: any) =>
            item._id?.toString() === cartItem.variantId ||
            item.sku === cartItem.variantId,
        );

        if (variant) {
          variant.stock = Math.max(0, (Number(variant.stock) || 0) - cartItem.quantity);
        }
      }

      product.stock = Math.max(0, (Number(product.stock) || 0) - cartItem.quantity);

      await product.save();
    }

    // Clear cart
    cart.items = [];
    await cart.save();

    // Populate order
    const populatedOrder = await Order.findById(order._id)
      .populate("items.product", "name slug images price")
      .populate("user", "name email phone");

    res.status(201).json({
      success: true,
      message: "Order created successfully",
      order: populatedOrder,
    });
  } catch (error) {
    console.error("CREATE ORDER ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create order",
    });
  }
};

// ============================================================
// GET MY ORDERS
// ============================================================

export const getMyOrders = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const orders = await Order.find({
      user: req.userId,
    })
      .populate("items.product", "name slug images price")
      .sort({
        createdAt: -1,
      });

    res.status(200).json({
      success: true,
      count: orders.length,
      orders,
    });
  } catch (error) {
    console.error("GET MY ORDERS ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to get orders",
    });
  }
};

// ============================================================
// GET MY ORDER BY ID
// ============================================================

export const getMyOrderById = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
      return;
    }

    const order = await Order.findOne({
      _id: id,
      user: req.userId,
    })
      .populate("items.product", "name slug images price")
      .populate("user", "name email phone");

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
    console.error("GET MY ORDER ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to get order",
    });
  }
};

// ============================================================
// CANCEL MY ORDER
// ============================================================

export const cancelMyOrder = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
      return;
    }

    const order = await Order.findOne({
      _id: id,
      user: req.userId,
    });

    if (!order) {
      res.status(404).json({
        success: false,
        message: "Order not found",
      });
      return;
    }

    if (!["pending", "confirmed", "processing"].includes(order.orderStatus)) {
      res.status(400).json({
        success: false,
        message: "This order cannot be cancelled",
      });
      return;
    }

    // Restore stock
    for (const orderItem of order.items) {
      const product = await Product.findById(orderItem.product);

      if (!product) continue;

      if (orderItem.variantId) {
        const variant = product.variants?.find(
          (item: any) =>
            item._id?.toString() === orderItem.variantId ||
            item.sku === orderItem.variantId,
        );

        if (variant) {
          variant.stock += orderItem.quantity;
        }
      } else {
        product.stock += orderItem.quantity;
      }

      await product.save();
    }

    order.orderStatus = "cancelled";

    await order.save();

    res.status(200).json({
      success: true,
      message: "Order cancelled successfully",
      order,
    });
  } catch (error) {
    console.error("CANCEL ORDER ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to cancel order",
    });
  }
};

// ============================================================
// CREATE GUEST ORDER
// ============================================================

export const createGuestOrder = async (
  req: any,
  res: Response,
): Promise<void> => {
  try {
    const {
      customer,
      items,
      shippingAddress,
      paymentMethod = "cod",
      shippingCharge = 0,
      discount = 0,
      couponCode,
    } = req.body;

    // --------------------------------------------------------
    // CUSTOMER VALIDATION
    // --------------------------------------------------------

    if (!customer) {
      res.status(400).json({
        success: false,
        message: "Customer details are required",
      });
      return;
    }

    if (!customer.name || !customer.email || !customer.phone) {
      res.status(400).json({
        success: false,
        message: "Customer name, email and phone are required",
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(customer.email)) {
      res.status(400).json({
        success: false,
        message: "Invalid email address",
      });
      return;
    }

    // --------------------------------------------------------
    // ITEMS VALIDATION
    // --------------------------------------------------------

    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({
        success: false,
        message: "Order items are required",
      });
      return;
    }

    // --------------------------------------------------------
    // SHIPPING ADDRESS VALIDATION
    // --------------------------------------------------------

    if (!shippingAddress) {
      res.status(400).json({
        success: false,
        message: "Shipping address is required",
      });
      return;
    }

    const requiredAddressFields = [
      "name",
      "phone",
      "addressLine1",
      "city",
      "state",
      "pincode",
    ];

    for (const field of requiredAddressFields) {
      if (!shippingAddress[field]) {
        res.status(400).json({
          success: false,
          message: `${field} is required`,
        });
        return;
      }
    }

    if (!/^\d{6}$/.test(String(shippingAddress.pincode))) {
      res.status(400).json({
        success: false,
        message: "Invalid pincode",
      });
      return;
    }

    // --------------------------------------------------------
    // PAYMENT METHOD
    // --------------------------------------------------------

    if (!["cod", "razorpay"].includes(paymentMethod)) {
      res.status(400).json({
        success: false,
        message: "Invalid payment method",
      });
      return;
    }

    // --------------------------------------------------------
    // BUILD ORDER ITEMS
    // --------------------------------------------------------

    const orderItems: Array<{
      product: mongoose.Types.ObjectId;
      name: string;
      image?: string;
      quantity: number;
      price: number;
      variantId?: string;
      color?: string;
      size?: string;
    }> = [];

    let subtotal = 0;

    for (const item of items) {
      if (!item.product) {
        res.status(400).json({
          success: false,
          message: "Product ID is required",
        });
        return;
      }

      if (!mongoose.Types.ObjectId.isValid(item.product)) {
        res.status(400).json({
          success: false,
          message: `Invalid product ID: ${item.product}`,
        });
        return;
      }

      const quantity = Number(item.quantity);

      if (!Number.isInteger(quantity) || quantity <= 0) {
        res.status(400).json({
          success: false,
          message: "Invalid product quantity",
        });
        return;
      }

      const product = await Product.findById(item.product);

      if (!product) {
        res.status(404).json({
          success: false,
          message: "Product not found",
          productId: item.product,
        });
        return;
      }

      if ("isActive" in product && product.isActive === false) {
        res.status(400).json({
          success: false,
          message: `${product.name} is currently unavailable`,
        });
        return;
      }

      // Variant
      let price = Number(item.price ?? product.price);

      if (item.variantId) {
        const variant = product.variants?.find(
          (variantItem: any) =>
            variantItem._id?.toString() === item.variantId ||
            variantItem.sku === item.variantId,
        );

        if (!variant) {
          res.status(400).json({
            success: false,
            message: `Selected variant for ${product.name} is unavailable`,
          });
          return;
        }

        if (variant.stock < quantity) {
          res.status(400).json({
            success: false,
            message: `Insufficient stock for ${product.name}`,
          });
          return;
        }

        price = Number(variant.price);
      } else {
        const currentStock = Number(product.stock || 0);

        if (currentStock < quantity) {
          res.status(400).json({
            success: false,
            message: `Insufficient stock for ${product.name}`,
            availableStock: currentStock,
          });
          return;
        }

        // Always use database price
        price = Number(product.price);
      }

      if (!Number.isFinite(price) || price < 0) {
        res.status(400).json({
          success: false,
          message: `Invalid price for ${product.name}`,
        });
        return;
      }

      const itemTotal = price * quantity;

      subtotal += itemTotal;

      orderItems.push({
        product: product._id,
        name: product.name,
        image: item.image || product.images?.[0],
        quantity,
        price,
        variantId: item.variantId,
        color: item.color,
        size: item.size,
      });
    }

    // --------------------------------------------------------
    // TOTALS
    // --------------------------------------------------------

    const numericShippingCharge = Math.max(Number(shippingCharge) || 0, 0);

    const numericDiscount = Math.max(Number(discount) || 0, 0);

    const totalAmount = Math.max(
      subtotal + numericShippingCharge - numericDiscount,
      0,
    );

    // --------------------------------------------------------
    // CREATE GUEST ORDER
    // --------------------------------------------------------

    const order = await Order.create({
      user: null,

      customer: {
        name: customer.name.trim(),
        email: customer.email.trim().toLowerCase(),
        phone: customer.phone.trim(),
      },

      items: orderItems,

      shippingAddress: {
        name: shippingAddress.name.trim(),
        phone: shippingAddress.phone.trim(),
        addressLine1: shippingAddress.addressLine1.trim(),
        addressLine2: shippingAddress.addressLine2?.trim() || undefined,
        city: shippingAddress.city.trim(),
        state: shippingAddress.state.trim(),
        pincode: String(shippingAddress.pincode).trim(),
        country: shippingAddress.country?.trim() || "India",
      },

      subtotal,
      shippingCharge: numericShippingCharge,
      discount: numericDiscount,
      totalAmount,

      paymentMethod,

      paymentStatus: "pending",

      orderStatus: paymentMethod === "cod" ? "confirmed" : "pending",

      couponCode: couponCode?.trim() || undefined,
    });

    // --------------------------------------------------------
    // REDUCE STOCK
    // --------------------------------------------------------

    for (const item of items) {
      const product = await Product.findById(item.product);

      if (!product) continue;

      const quantity = Number(item.quantity);

      if (item.variantId) {
        const variant = product.variants?.find(
          (variantItem: any) =>
            variantItem._id?.toString() === item.variantId ||
            variantItem.sku === item.variantId,
        );

        if (variant) {
          variant.stock -= quantity;
        }
      } else {
        product.stock -= quantity;
      }

      await product.save();
    }

    // --------------------------------------------------------
    // POPULATE
    // --------------------------------------------------------

    const populatedOrder = await Order.findById(order._id).populate(
      "items.product",
      "name slug images price",
    );

    res.status(201).json({
      success: true,
      message: "Guest order created successfully",
      order: populatedOrder,
    });
  } catch (error) {
    console.error("CREATE GUEST ORDER ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create guest order",
    });
  }
};

// ============================================================
// GET GUEST ORDER BY ID
// ============================================================

export const getGuestOrderById = async (
  req: any,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
      return;
    }

    const order = await Order.findOne({
      _id: id,
      $or: [{ user: null }, { user: { $exists: false } }],
    }).populate("items.product", "name slug images price");

    if (!order) {
      res.status(404).json({
        success: false,
        message: "Guest order not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      order,
    });
  } catch (error) {
    console.error("GET GUEST ORDER ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to get guest order",
    });
  }
};

export const getMyOrderShipment = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
      return;
    }

    // First verify that this order belongs to the logged-in user
    const order = await Order.findOne({
      _id: id,
      user: req.userId,
    })
      .select("_id user orderStatus createdAt")
      .lean();

    if (!order) {
      res.status(404).json({
        success: false,
        message: "Order not found",
      });
      return;
    }

    // Find the shipment belonging to this order
    const shipment = await Shipment.findOne({
      order: order._id,
      user: req.userId,
      shipmentStatus: {
        $ne: "cancelled",
      },
    })
      .select(
        "order user courierName courierProvider courierService awbNumber trackingNumber labelUrl shipmentStatus pickupScheduledAt pickedUpAt deliveredAt estimatedDeliveryDate createdAt updatedAt",
      )
      .lean();

    if (!shipment) {
      res.status(404).json({
        success: false,
        message: "Shipment has not been created for this order yet",
      });
      return;
    }

    res.status(200).json({
      success: true,
      shipment,
    });
  } catch (error) {
    console.error("GET MY ORDER SHIPMENT ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to load shipment details",
    });
  }
};
// =====================================================
// ADMIN - GET ALL ORDERS
// =====================================================

export const getAdminOrders = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const {
      search = "",
      status = "all",
      paymentStatus = "all",
    } = req.query;

    const filter: Record<string, any> = {};

    // Status filter
    if (
      typeof status === "string" &&
      status !== "all"
    ) {
      filter.orderStatus = status;
    }

    // Payment filter
    if (
      typeof paymentStatus === "string" &&
      paymentStatus !== "all"
    ) {
      filter.paymentStatus = paymentStatus;
    }

    // Search
    if (
      typeof search === "string" &&
      search.trim()
    ) {
      const searchRegex = {
        $regex: search.trim(),
        $options: "i",
      };

      filter.$or = [
        { orderNumber: searchRegex },
        { "shippingAddress.name": searchRegex },
        { "shippingAddress.email": searchRegex },
        { "shippingAddress.phone": searchRegex },
      ];
    }

    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    const totalOrders = orders.length;

    const pendingOrders = orders.filter(
      (order: any) =>
        order.orderStatus === "pending" ||
        order.orderStatus === "processing"
    ).length;

    const shippedOrders = orders.filter(
      (order: any) =>
        order.orderStatus === "shipped"
    ).length;

    const deliveredOrders = orders.filter(
      (order: any) =>
        order.orderStatus === "delivered"
    ).length;

    const totalRevenue = orders
      .filter(
        (order: any) =>
          order.paymentStatus === "paid"
      )
      .reduce(
        (total: number, order: any) =>
          total +
          Number(order.totalAmount || 0),
        0
      );

    res.status(200).json({
      success: true,
      orders,
      summary: {
        totalOrders,
        pendingOrders,
        shippedOrders,
        deliveredOrders,
        totalRevenue,
      },
    });
  } catch (error) {
    console.error(
      "GET ADMIN ORDERS ERROR:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Failed to fetch admin orders",
    });
  }
};


// =====================================================
// ADMIN - GET SINGLE ORDER
// =====================================================

export const getAdminOrderById = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    if (
      typeof id !== "string" ||
      !mongoose.Types.ObjectId.isValid(id)
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
      return;
    }

    const order = await Order.findById(id).lean();

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
    console.error(
      "GET ADMIN ORDER ERROR:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Failed to fetch order",
    });
  }
};


// =====================================================
// ADMIN - UPDATE ORDER STATUS
// =====================================================

export const updateAdminOrderStatus = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { orderStatus } = req.body;

    if (
      typeof id !== "string" ||
      !mongoose.Types.ObjectId.isValid(id)
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
      return;
    }

    const allowedStatuses = [
      "pending",
      "confirmed",
      "processing",
      "shipped",
      "out_for_delivery",
      "delivered",
      "cancelled",
    ];

    if (
      !allowedStatuses.includes(orderStatus)
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid order status",
        allowedStatuses,
      });
      return;
    }

    const order =
      await Order.findByIdAndUpdate(
        id,
        {
          orderStatus,
        },
        {
          new: true,
          runValidators: true,
        }
      ).lean();

    if (!order) {
      res.status(404).json({
        success: false,
        message: "Order not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message:
        "Order status updated successfully",
      order,
    });
  } catch (error) {
    console.error(
      "UPDATE ADMIN ORDER STATUS ERROR:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Failed to update order status",
    });
  }
};


// =====================================================
// ADMIN - CANCEL ORDER
// =====================================================

export const cancelAdminOrder = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    if (
      typeof id !== "string" ||
      !mongoose.Types.ObjectId.isValid(id)
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
      return;
    }

    const order =
      await Order.findByIdAndUpdate(
        id,
        {
          orderStatus: "cancelled",
        },
        {
          new: true,
        }
      ).lean();

    if (!order) {
      res.status(404).json({
        success: false,
        message: "Order not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Order cancelled successfully",
      order,
    });
  } catch (error) {
    console.error(
      "CANCEL ADMIN ORDER ERROR:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Failed to cancel order",
    });
  }
};
