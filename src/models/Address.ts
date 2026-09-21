import mongoose, { Document, Schema, Types } from "mongoose";

export type AddressType = "home" | "work" | "other";

export interface IAddress extends Document {
  user: Types.ObjectId;

  name: string;
  phone: string;

  addressLine1: string;
  addressLine2?: string;
  landmark?: string;

  city: string;
  state: string;
  pincode: string;
  country: string;

  type: AddressType;
  isDefault: boolean;

  createdAt: Date;
  updatedAt: Date;
}

const addressSchema = new Schema<IAddress>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
    },

    addressLine1: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    addressLine2: {
      type: String,
      trim: true,
      maxlength: 200,
    },

    landmark: {
      type: String,
      trim: true,
      maxlength: 150,
    },

    city: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    state: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    pincode: {
      type: String,
      required: true,
      trim: true,
      match: /^\d{6}$/,
    },

    country: {
      type: String,
      default: "India",
      trim: true,
    },

    type: {
      type: String,
      enum: ["home", "work", "other"],
      default: "home",
    },

    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

addressSchema.index({
  user: 1,
  isDefault: 1,
});

const Address = mongoose.model<IAddress>(
  "Address",
  addressSchema
);

export default Address;