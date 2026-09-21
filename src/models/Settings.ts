import mongoose, { Document, Schema } from "mongoose";

export interface ISettings extends Document {
  storeName: string;
  storeEmail: string;
  storePhone: string;
  currency: string;

  notifications: {
    orders: boolean;
    payments: boolean;
    inventory: boolean;
    shipping: boolean;
    returns: boolean;
    abandoned: boolean;
  };

  shipping: {
    freeShipping: boolean;
    threshold: number;
    defaultPackageWeight: number;
  };

  payments: {
    razorpay: boolean;
    cod: boolean;
    codLimit: number;
  };

  rolePermissions: {
    "Super Admin": string[];
    Manager: string[];
    Staff: string[];
  };
}

const settingsSchema = new Schema<ISettings>(
  {
    storeName: {
      type: String,
      default: "Mulberries",
      trim: true,
    },

    storeEmail: {
      type: String,
      default: "support@mulberries.shop",
      trim: true,
      lowercase: true,
    },

    storePhone: {
      type: String,
      default: "+91 98765 43210",
      trim: true,
    },

    currency: {
      type: String,
      default: "INR",
      trim: true,
    },

    notifications: {
      orders: { type: Boolean, default: true },
      payments: { type: Boolean, default: true },
      inventory: { type: Boolean, default: true },
      shipping: { type: Boolean, default: true },
      returns: { type: Boolean, default: true },
      abandoned: { type: Boolean, default: false },
    },

    shipping: {
      freeShipping: { type: Boolean, default: true },
      threshold: { type: Number, default: 999 },
      defaultPackageWeight: { type: Number, default: 500 },
    },

    payments: {
      razorpay: { type: Boolean, default: true },
      cod: { type: Boolean, default: true },
      codLimit: { type: Number, default: 50000 },
    },

    rolePermissions: {
      "Super Admin": {
        type: [String],
        default: [],
      },

      Manager: {
        type: [String],
        default: [],
      },

      Staff: {
        type: [String],
        default: [],
      },
    },
  },
  {
    timestamps: true,
  }
);

const Settings = mongoose.model<ISettings>("Settings", settingsSchema);

export default Settings;