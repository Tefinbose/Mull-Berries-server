import { Response } from "express";
import mongoose from "mongoose";

import NDR from "../models/NDR";
import { NDRStatus } from "../models/NDR";
import Shipment from "../models/Shipment";
import Order from "../models/Order";
import { AuthRequest } from "../middleware/authMiddleware";

const allowedStatuses = [
  "open",
  "contacted",
  "reattempt_scheduled",
  "reattempted",
  "resolved",
  "rto_initiated",
  "closed",
];

export const getStaffNdrs = async (
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
        message: "You do not have permission to view NDR",
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
      filter.status = status;
    }

    if (search && typeof search === "string") {
      const searchRegex = {
        $regex: search,
        $options: "i",
      };

      const matchingOrders = await Order.find({
        $or: [
          { _id: search },
        ],
      })
        .select("_id")
        .lean()
        .catch(() => []);

      const matchingUsers = await import("../models/User").then(
        async ({ default: User }) =>
          User.find({
            $or: [
              { name: searchRegex },
              { email: searchRegex },
              { phone: searchRegex },
            ],
          })
            .select("_id")
            .lean()
      );

      filter.$or = [
        { reason: searchRegex },
        { description: searchRegex },
        { customerResponse: searchRegex },
        {
          order: {
            $in: matchingOrders.map((order) => order._id),
          },
        },
        {
          user: {
            $in: matchingUsers.map((user) => user._id),
          },
        },
      ];
    }

    const [ndrs, total] = await Promise.all([
      NDR.find(filter)
        .populate(
          "shipment",
          "courierName courierProvider courierService awbNumber trackingNumber shipmentStatus"
        )
        .populate(
          "order",
          "orderStatus totalAmount paymentStatus createdAt updatedAt"
        )
        .populate(
          "user",
          "name email phone"
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNumber)
        .lean(),

      NDR.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limitNumber);

    res.status(200).json({
      success: true,
      ndrs,
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
    console.error("GET STAFF NDR ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to load NDR cases",
    });
  }
};

export const getStaffNdrById = async (
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
        message: "You do not have permission to view NDR",
      });
      return;
    }

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid NDR ID",
      });
      return;
    }

    const ndr = await NDR.findById(id)
      .populate(
        "shipment",
        "courierName courierProvider courierService awbNumber trackingNumber shipmentStatus"
      )
      .populate(
        "order",
        "orderStatus totalAmount paymentStatus createdAt updatedAt"
      )
      .populate(
        "user",
        "name email phone"
      )
      .lean();

    if (!ndr) {
      res.status(404).json({
        success: false,
        message: "NDR case not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      ndr,
    });
  } catch (error) {
    console.error("GET STAFF NDR BY ID ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to load NDR case",
    });
  }
};

export const updateStaffNdrStatus = async (
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

    if (req.role !== "staff" && req.role !== "superadmin") {
      res.status(403).json({
        success: false,
        message: "Staff access required",
      });
      return;
    }

    const { id } = req.params;

    const {
      status,
      customerResponse,
      nextAttemptDate,
      resolution,
      notes,
    } = req.body;

    const allowedStatuses: NDRStatus[] = [
      "open",
      "contacted",
      "reattempt_scheduled",
      "reattempted",
      "resolved",
      "rto_initiated",
      "closed",
    ];

    if (!status || !allowedStatuses.includes(status)) {
      res.status(400).json({
        success: false,
        message: "Invalid NDR status",
        allowedStatuses,
      });
      return;
    }

    const updateData: Record<string, unknown> = {
      status,
    };

    /*
     * CONTACTED
     */
    if (status === "contacted") {
      updateData.customerContacted = true;

      if (customerResponse !== undefined) {
        updateData.customerResponse = customerResponse;
      }
    }

    /*
     * REATTEMPT SCHEDULED
     */
    if (status === "reattempt_scheduled") {
      if (!nextAttemptDate) {
        res.status(400).json({
          success: false,
          message:
            "nextAttemptDate is required when scheduling a reattempt",
        });
        return;
      }

      const parsedDate = new Date(nextAttemptDate);

      if (Number.isNaN(parsedDate.getTime())) {
        res.status(400).json({
          success: false,
          message: "Invalid nextAttemptDate",
        });
        return;
      }

      updateData.nextAttemptDate = parsedDate;
    }

    /*
     * REATTEMPTED
     */
    if (status === "reattempted") {
      updateData.attemptNumber = 1;
    }

    /*
     * RESOLVED
     */
    if (status === "resolved") {
      if (!resolution || !String(resolution).trim()) {
        res.status(400).json({
          success: false,
          message: "Resolution is required when resolving an NDR",
        });
        return;
      }

      updateData.resolution = String(resolution).trim();
    }

    /*
     * NOTES
     */
    if (notes !== undefined) {
      updateData.notes = notes;
    }

    const updatedNdr = await NDR.findByIdAndUpdate(
      id,
      {
        $set: updateData,
      },
      {
        new: true,
        runValidators: true,
      }
    )
      .populate(
        "shipment",
        "_id courierName courierProvider courierService shipmentStatus"
      )
      .populate(
        "order",
        "_id totalAmount paymentStatus orderStatus createdAt updatedAt"
      )
      .populate(
        "user",
        "_id name email phone"
      );

    if (!updatedNdr) {
      res.status(404).json({
        success: false,
        message: "NDR not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "NDR status updated successfully",
      ndr: updatedNdr,
    });
  } catch (error) {
    console.error("UPDATE STAFF NDR STATUS ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update NDR status",
    });
  }
};