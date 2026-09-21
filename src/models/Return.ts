import mongoose, { Document, Schema, Types } from "mongoose";

export type ReturnStatus =
  | "requested"
  | "approved"
  | "pickup_scheduled"
  | "picked_up"
  | "in_transit"
  | "received"
  | "inspecting"
  | "refund_pending"
  | "refunded"
  | "rejected"
  | "cancelled";

export interface IReturn extends Document {
  order: Types.ObjectId;
  shipment?: Types.ObjectId;
  user?: Types.ObjectId;

  reason: string;
  description?: string;

  status: ReturnStatus;

  refundAmount?: number;
  refundMethod?: string;

  pickupScheduledAt?: Date;
  pickedUpAt?: Date;
  receivedAt?: Date;

  inspectionNotes?: string;
  rejectionReason?: string;

  notes?: string;

  createdAt: Date;
  updatedAt: Date;
}

const returnSchema = new Schema<IReturn>(
  {
    order: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },

    shipment: {
      type: Schema.Types.ObjectId,
      ref: "Shipment",
      index: true,
    },

    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },

    reason: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 1000,
    },

    status: {
      type: String,
      enum: [
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
      ],
      default: "requested",
      index: true,
    },

    refundAmount: {
      type: Number,
      min: 0,
    },

    refundMethod: {
      type: String,
      trim: true,
    },

    pickupScheduledAt: {
      type: Date,
    },

    pickedUpAt: {
      type: Date,
    },

    receivedAt: {
      type: Date,
    },

    inspectionNotes: {
      type: String,
      trim: true,
      maxlength: 1000,
    },

    rejectionReason: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
  },
  {
    timestamps: true,
  }
);

const ReturnModel = mongoose.model<IReturn>("Return", returnSchema);

export default ReturnModel;