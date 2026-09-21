import { Response } from "express";
import mongoose from "mongoose";

import ReturnModel from "../models/Return";
import { AuthRequest } from "../middleware/authMiddleware";

const allowedStatuses = [
  "requested",
  "approved",
  "pickup_scheduled",
  "picked_up",
  "in_transit",
  "received",
  "inspecting",
  "refund_pending",
  "refunded",
  "rejected",
  "cancelled",
];

/* =========================================================
   GET ALL STAFF RETURNS
========================================================= */

export const getStaffReturns = async (
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

    const canView =
      req.role === "superadmin" ||
      permissions.includes("shipping.view");

    if (!canView) {
      res.status(403).json({
        success: false,
        message: "You do not have permission to view returns",
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

    /* ---------- STATUS FILTER ---------- */

    if (status && typeof status === "string") {
      filter.status = status;
    }

    /* ---------- SEARCH ---------- */

    if (search && typeof search === "string") {
      const searchRegex = {
        $regex: search,
        $options: "i",
      };

      const User = (await import("../models/User")).default;

      const matchingUsers = await User.find({
        $or: [
          { name: searchRegex },
          { email: searchRegex },
          { phone: searchRegex },
        ],
      })
        .select("_id")
        .lean();

      filter.$or = [
        { reason: searchRegex },
        { description: searchRegex },
        { notes: searchRegex },
        {
          user: {
            $in: matchingUsers.map((user) => user._id),
          },
        },
      ];
    }

    /* ---------- FETCH RETURNS ---------- */

    const [returns, total] = await Promise.all([
      ReturnModel.find(filter)
        .populate(
          "order",
          "orderStatus totalAmount paymentStatus createdAt updatedAt"
        )
        .populate(
          "shipment",
          "courierName courierProvider courierService awbNumber trackingNumber shipmentStatus"
        )
        .populate(
          "user",
          "name email phone"
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNumber)
        .lean(),

      ReturnModel.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limitNumber);

    res.status(200).json({
      success: true,
      returns,
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
    console.error("GET STAFF RETURNS ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to load returns",
    });
  }
};

/* =========================================================
   GET STAFF RETURN BY ID
========================================================= */

export const getStaffReturnById = async (
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

    const canView =
      req.role === "superadmin" ||
      permissions.includes("shipping.view");

    if (!canView) {
      res.status(403).json({
        success: false,
        message: "You do not have permission to view returns",
      });
      return;
    }

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid return ID",
      });
      return;
    }

    const returnRequest = await ReturnModel.findById(id)
      .populate(
        "order",
        "orderStatus totalAmount paymentStatus createdAt updatedAt"
      )
      .populate(
        "shipment",
        "courierName courierProvider courierService awbNumber trackingNumber shipmentStatus"
      )
      .populate(
        "user",
        "name email phone"
      )
      .lean();

    if (!returnRequest) {
      res.status(404).json({
        success: false,
        message: "Return not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      return: returnRequest,
    });
  } catch (error) {
    console.error("GET STAFF RETURN BY ID ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to load return",
    });
  }
};

/* =========================================================
   CREATE STAFF RETURN
========================================================= */

export const createStaffReturn = async (
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

    const canCreate =
      req.role === "superadmin" ||
      permissions.includes("shipping.prepare");

    if (!canCreate) {
      res.status(403).json({
        success: false,
        message: "You do not have permission to create returns",
      });
      return;
    }

    const {
      order,
      shipment,
      reason,
      description,
      returnType,
      refundAmount,
      refundMethod,
      notes,
    } = req.body;

    /* ---------- VALIDATE ORDER ---------- */

    if (
      !order ||
      !mongoose.Types.ObjectId.isValid(order)
    ) {
      res.status(400).json({
        success: false,
        message: "Valid order ID is required",
      });
      return;
    }

    /* ---------- VALIDATE SHIPMENT ---------- */

    if (
      !shipment ||
      !mongoose.Types.ObjectId.isValid(shipment)
    ) {
      res.status(400).json({
        success: false,
        message: "Valid shipment ID is required",
      });
      return;
    }

    /* ---------- VALIDATE REASON ---------- */

    if (!reason || !String(reason).trim()) {
      res.status(400).json({
        success: false,
        message: "Return reason is required",
      });
      return;
    }

    /* ---------- VALIDATE REFUND ---------- */

    let numericRefundAmount: number | undefined;

    if (refundAmount !== undefined) {
      numericRefundAmount = Number(refundAmount);

      if (
        !Number.isFinite(numericRefundAmount) ||
        numericRefundAmount < 0
      ) {
        res.status(400).json({
          success: false,
          message: "Invalid refund amount",
        });
        return;
      }
    }

    /* ---------- CREATE RETURN ---------- */

    const returnRequest = await ReturnModel.create({
      order,
      shipment,
      user: req.userId,
      reason: String(reason).trim(),
      description,
      returnType,
      status: "requested",
      refundAmount: numericRefundAmount,
      refundMethod,
      notes,
    });

    /* ---------- POPULATE CREATED RETURN ---------- */

    const createdReturn = await ReturnModel.findById(
      returnRequest._id
    )
      .populate(
        "order",
        "orderStatus totalAmount paymentStatus createdAt updatedAt"
      )
      .populate(
        "shipment",
        "courierName courierProvider courierService awbNumber trackingNumber shipmentStatus"
      )
      .populate(
        "user",
        "name email phone"
      )
      .lean();

    res.status(201).json({
      success: true,
      message: "Return created successfully",
      return: createdReturn,
    });
  } catch (error) {
    console.error("CREATE STAFF RETURN ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create return",
    });
  }
};

/* =========================================================
   UPDATE STAFF RETURN STATUS
========================================================= */

export const updateStaffReturnStatus = async (
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

    const canUpdate =
      req.role === "superadmin" ||
      permissions.includes("shipping.prepare");

    if (!canUpdate) {
      res.status(403).json({
        success: false,
        message: "You do not have permission to update returns",
      });
      return;
    }

    const { id } = req.params;

    const {
      status,
      refundAmount,
      refundMethod,
      pickupScheduledAt,
      inspectionNotes,
      rejectionReason,
      notes,
    } = req.body;

    /* ---------- VALIDATE ID ---------- */

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid return ID",
      });
      return;
    }

    /* ---------- VALIDATE STATUS ---------- */

    if (
      !status ||
      !allowedStatuses.includes(status)
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid return status",
        allowedStatuses,
      });
      return;
    }

    /* ---------- FIND RETURN ---------- */

    const returnRequest = await ReturnModel.findById(id);

    if (!returnRequest) {
      res.status(404).json({
        success: false,
        message: "Return not found",
      });
      return;
    }

    /* ---------- UPDATE STATUS ---------- */

    returnRequest.status = status;

    /* ---------- REFUND AMOUNT ---------- */

    if (refundAmount !== undefined) {
      const numericRefund = Number(refundAmount);

      if (
        !Number.isFinite(numericRefund) ||
        numericRefund < 0
      ) {
        res.status(400).json({
          success: false,
          message: "Invalid refund amount",
        });
        return;
      }

      returnRequest.refundAmount = numericRefund;
    }

    /* ---------- REFUND METHOD ---------- */

    if (refundMethod !== undefined) {
      returnRequest.refundMethod = refundMethod;
    }

    /* ---------- PICKUP DATE ---------- */

    if (pickupScheduledAt !== undefined) {
      returnRequest.pickupScheduledAt =
        pickupScheduledAt
          ? new Date(pickupScheduledAt)
          : undefined;
    }

    /* ---------- INSPECTION NOTES ---------- */

    if (inspectionNotes !== undefined) {
      returnRequest.inspectionNotes = inspectionNotes;
    }

    /* ---------- REJECTION REASON ---------- */

    if (rejectionReason !== undefined) {
      returnRequest.rejectionReason =
        rejectionReason;
    }

    /* ---------- NOTES ---------- */

    if (notes !== undefined) {
      returnRequest.notes = notes;
    }

    /* ---------- AUTOMATIC TIMESTAMPS ---------- */

    if (
      status === "picked_up" &&
      !returnRequest.pickedUpAt
    ) {
      returnRequest.pickedUpAt = new Date();
    }

    if (
      status === "received" &&
      !returnRequest.receivedAt
    ) {
      returnRequest.receivedAt = new Date();
    }

    /* ---------- SAVE ---------- */

    await returnRequest.save();

    /* ---------- POPULATE UPDATED RETURN ---------- */

    const updatedReturn =
      await ReturnModel.findById(
        returnRequest._id
      )
        .populate(
          "order",
          "orderStatus totalAmount paymentStatus createdAt updatedAt"
        )
        .populate(
          "shipment",
          "courierName courierProvider courierService awbNumber trackingNumber shipmentStatus"
        )
        .populate(
          "user",
          "name email phone"
        )
        .lean();

    res.status(200).json({
      success: true,
      message: "Return status updated successfully",
      return: updatedReturn,
    });
  } catch (error) {
    console.error(
      "UPDATE STAFF RETURN STATUS ERROR:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Failed to update return status",
    });
  }
};