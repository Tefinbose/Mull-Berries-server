import mongoose, { Document, Schema, Types } from "mongoose";

export type NDRStatus =
  | "open"
  | "contacted"
  | "reattempt_scheduled"
  | "reattempted"
  | "resolved"
  | "rto_initiated"
  | "closed";

export interface INDR extends Document {
  shipment: Types.ObjectId;
  order: Types.ObjectId;
  user?: Types.ObjectId;

  reason: string;
  description?: string;

  status: NDRStatus;

  attemptNumber?: number;

  customerContacted?: boolean;
  customerResponse?: string;

  nextAttemptDate?: Date;

  resolution?: string;
  notes?: string;

  createdAt: Date;
  updatedAt: Date;
}

const ndrSchema = new Schema<INDR>(
  {
    shipment: {
      type: Schema.Types.ObjectId,
      ref: "Shipment",
      required: true,
      index: true,
    },

    order: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: true,
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
        "open",
        "contacted",
        "reattempt_scheduled",
        "reattempted",
        "resolved",
        "rto_initiated",
        "closed",
      ],
      default: "open",
      index: true,
    },

    attemptNumber: {
      type: Number,
      default: 1,
      min: 1,
    },

    customerContacted: {
      type: Boolean,
      default: false,
    },

    customerResponse: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    nextAttemptDate: {
      type: Date,
    },

    resolution: {
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

const NDR = mongoose.model<INDR>("NDR", ndrSchema);

export default NDR; 