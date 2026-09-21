import { Response } from "express";
import mongoose from "mongoose";

import Shipment from "../models/Shipment";
import Order from "../models/Order";
import { AuthRequest } from "../middleware/authMiddleware";

const allowedShipmentStatuses = [
  "shipment_created",
  "courier_assigned",
  "awb_generated",
  "label_generated",
  "pickup_scheduled",
  "picked_up",
  "in_transit",
  "out_for_delivery",
  "delivered",
  "ndr",
  "rto",
  "return_requested",
  "returned",
  "cancelled",
];

export const getStaffShipments = async (
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

    const canViewShipping =
      req.role === "superadmin" ||
      permissions.includes("shipping.view");

    if (!canViewShipping) {
      res.status(403).json({
        success: false,
        message: "You do not have permission to view shipments",
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

    if (status && typeof status === "string") {
      filter.shipmentStatus = status;
    }

    if (search && typeof search === "string") {
      filter.$or = [
        {
          awbNumber: {
            $regex: search,
            $options: "i",
          },
        },
        {
          trackingNumber: {
            $regex: search,
            $options: "i",
          },
        },
        {
          courierName: {
            $regex: search,
            $options: "i",
          },
        },
        {
          courierProvider: {
            $regex: search,
            $options: "i",
          },
        },
      ];
    }

    const [shipments, total] = await Promise.all([
      Shipment.find(filter)
        .populate(
          "order",
          "orderStatus totalAmount paymentStatus createdAt"
        )
        .populate(
          "user",
          "name email phone"
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNumber)
        .lean(),

      Shipment.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limitNumber);

    res.status(200).json({
      success: true,
      shipments,

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
    console.error("GET STAFF SHIPMENTS ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to load shipments",
    });
  }
};


export const getStaffShipmentById = async (
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

    const canViewShipping =
      req.role === "superadmin" ||
      permissions.includes("shipping.view");

    if (!canViewShipping) {
      res.status(403).json({
        success: false,
        message: "You do not have permission to view shipments",
      });
      return;
    }

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid shipment ID",
      });
      return;
    }

    const shipment = await Shipment.findById(id)
      .populate(
        "order",
        "orderStatus totalAmount paymentStatus items shippingAddress createdAt updatedAt"
      )
      .populate(
        "user",
        "name email phone"
      )
      .lean();

    if (!shipment) {
      res.status(404).json({
        success: false,
        message: "Shipment not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      shipment,
    });
  } catch (error) {
    console.error("GET STAFF SHIPMENT ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to load shipment",
    });
  }
};


export const createStaffShipment = async (
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

    const canPrepareShipping =
      req.role === "superadmin" ||
      permissions.includes("shipping.prepare");

    if (!canPrepareShipping) {
      res.status(403).json({
        success: false,
        message: "You do not have permission to prepare shipments",
      });
      return;
    }

    const {
      orderId,
      courierName,
      courierProvider,
      courierService,
      estimatedDeliveryDate,
      notes,
    } = req.body;

    if (!orderId) {
      res.status(400).json({
        success: false,
        message: "Order ID is required",
      });
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
      return;
    }

    const order = await Order.findById(orderId);

    if (!order) {
      res.status(404).json({
        success: false,
        message: "Order not found",
      });
      return;
    }

    const existingShipment = await Shipment.findOne({
      order: order._id,
      shipmentStatus: {
        $nin: ["cancelled", "returned"],
      },
    });

    if (existingShipment) {
      res.status(409).json({
        success: false,
        message: "An active shipment already exists for this order",
        shipment: existingShipment,
      });
      return;
    }

    const shipment = await Shipment.create({
      order: order._id,
      ...(order.user ? { user: order.user } : {}),

      courierName,
      courierProvider,
      courierService,

      estimatedDeliveryDate,
      notes,

      shipmentStatus: "shipment_created",
    });

    const populatedShipment = await Shipment.findById(shipment._id)
      .populate(
        "order",
        "orderStatus totalAmount paymentStatus createdAt updatedAt"
      )
      .populate(
        "user",
        "name email phone"
      )
      .lean();

    res.status(201).json({
      success: true,
      message: "Shipment created successfully",
      shipment: populatedShipment,
    });
  } catch (error) {
    console.error("CREATE STAFF SHIPMENT ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create shipment",
    });
  }
};


export const updateStaffShipmentStatus = async (
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

    const canPrepareShipping =
      req.role === "superadmin" ||
      permissions.includes("shipping.prepare");

    if (!canPrepareShipping) {
      res.status(403).json({
        success: false,
        message: "You do not have permission to update shipment status",
      });
      return;
    }

    const { id } = req.params;
    const { shipmentStatus } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid shipment ID",
      });
      return;
    }

    if (!shipmentStatus) {
      res.status(400).json({
        success: false,
        message: "Shipment status is required",
      });
      return;
    }

    if (!allowedShipmentStatuses.includes(shipmentStatus)) {
      res.status(400).json({
        success: false,
        message: "Invalid shipment status",
        allowedStatuses: allowedShipmentStatuses,
      });
      return;
    }

    const shipment = await Shipment.findById(id);

    if (!shipment) {
      res.status(404).json({
        success: false,
        message: "Shipment not found",
      });
      return;
    }

    shipment.shipmentStatus = shipmentStatus;

    const now = new Date();

    if (shipmentStatus === "picked_up") {
      shipment.pickedUpAt = now;
    }

    if (shipmentStatus === "delivered") {
      shipment.deliveredAt = now;
    }

    if (shipmentStatus === "pickup_scheduled") {
      shipment.pickupScheduledAt =
        shipment.pickupScheduledAt || now;
    }

    await shipment.save();

    const updatedShipment = await Shipment.findById(shipment._id)
      .populate(
        "order",
        "orderStatus totalAmount paymentStatus createdAt updatedAt"
      )
      .populate(
        "user",
        "name email phone"
      )
      .lean();

    res.status(200).json({
      success: true,
      message: "Shipment status updated successfully",
      shipment: updatedShipment,
    });
  } catch (error) {
    console.error(
      "UPDATE STAFF SHIPMENT STATUS ERROR:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Failed to update shipment status",
    });
  }
};
