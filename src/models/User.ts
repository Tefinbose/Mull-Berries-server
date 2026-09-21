import mongoose, { Document, Schema } from "mongoose";

export type UserRole =
  | "user"
  | "admin"
  | "manager"
  | "staff"
  | "superadmin";

export type StaffPermission =
  | "orders.view"
  | "orders.process"
  | "orders.update_status"
  | "orders.prepare"
  | "inventory.view"
  | "inventory.update"
  | "shipping.view"
  | "shipping.prepare"
  | "shipping.print_labels"
  | "customers.view";

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  phone?: string;

  role: UserRole;

  permissions: StaffPermission[];

  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false,
    },

    phone: {
      type: String,
      trim: true,
    },

    role: {
      type: String,
      enum: [
        "user",
        "admin",
        "manager",
        "staff",
        "superadmin",
      ],
      default: "user",
    },

    permissions: {
      type: [String],
      enum: [
        "orders.view",
        "orders.process",
        "orders.update_status",
        "orders.prepare",
        "inventory.view",
        "inventory.update",
        "shipping.view",
        "shipping.prepare",
        "shipping.print_labels",
        "customers.view",
      ],
      default: [],
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const User = mongoose.model<IUser>("User", userSchema);

export default User;