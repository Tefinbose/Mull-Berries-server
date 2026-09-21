import mongoose, { Document, Schema, Types } from "mongoose";

export type ShipmentStatus =
  | "shipment_created"
  | "courier_assigned"
  | "awb_generated"
  | "label_generated"
  | "pickup_scheduled"
  | "picked_up"
  | "in_transit"
  | "out_for_delivery"
  | "delivered"
  | "ndr"
  | "rto"
  | "return_requested"
  | "returned"
  | "cancelled";

export interface IShipment extends Document {
  order: Types.ObjectId;
  user?: Types.ObjectId;

  courierName?: string;
  courierProvider?: string;
  courierService?: string;

  awbNumber?: string;
  trackingNumber?: string;
  labelUrl?: string;

  shipmentStatus: ShipmentStatus;

  pickupScheduledAt?: Date;
  pickedUpAt?: Date;
  deliveredAt?: Date;
  estimatedDeliveryDate?: Date;

  notes?: string;

  createdAt: Date;
  updatedAt: Date;
}

const shipmentSchema = new Schema<IShipment>(
  {
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

    courierName: {
      type: String,
      trim: true,
    },

    courierProvider: {
      type: String,
      trim: true,
    },

    courierService: {
      type: String,
      trim: true,
    },

    awbNumber: {
      type: String,
      trim: true,
      index: true,
      sparse: true,
    },

    trackingNumber: {
      type: String,
      trim: true,
      index: true,
      sparse: true,
    },

    labelUrl: {
      type: String,
      trim: true,
    },

    shipmentStatus: {
      type: String,
      enum: [
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
      ],
      default: "shipment_created",
      index: true,
    },

    pickupScheduledAt: {
      type: Date,
    },

    pickedUpAt: {
      type: Date,
    },

    deliveredAt: {
      type: Date,
    },

    estimatedDeliveryDate: {
      type: Date,
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

const Shipment = mongoose.model<IShipment>("Shipment", shipmentSchema);

export default Shipment;