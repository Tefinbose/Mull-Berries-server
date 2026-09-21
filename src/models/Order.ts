import mongoose, {
  Document,
  Schema,
  Types,
} from "mongoose";

/* =========================================================
   ORDER STATUS
========================================================= */

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "shipped"
  | "out_for_delivery"
  | "delivered"
  | "cancelled"
  | "returned";

/* =========================================================
   PAYMENT
========================================================= */

export type PaymentMethod =
  | "cod"
  | "razorpay";

export type PaymentStatus =
  | "pending"
  | "paid"
  | "failed"
  | "refunded";

/* =========================================================
   CUSTOMER SNAPSHOT
========================================================= */

export interface IOrderCustomer {
  name: string;
  email: string;
  phone: string;
}

/* =========================================================
   SHIPPING ADDRESS SNAPSHOT
========================================================= */

export interface IOrderAddress {
  name: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  country?: string;
}

/* =========================================================
   ORDER ITEM
========================================================= */

export interface IOrderItem {
  product: Types.ObjectId;
  name: string;
  image?: string;

  quantity: number;

  price: number;

  variantId?: string;
  color?: string;
  size?: string;
}

/* =========================================================
   ORDER DOCUMENT
========================================================= */

export interface IOrder extends Document {
  /*
   * Optional because guest orders do not have
   * a registered User document.
   */
  user?: Types.ObjectId | null;

  /*
   * Customer snapshot.
   *
   * We store this even for logged-in users because
   * the customer may later change their profile.
   */
  customer: IOrderCustomer;

  /*
   * Product snapshot.
   */
  items: IOrderItem[];

  /*
   * Shipping address snapshot.
   */
  shippingAddress: IOrderAddress;

  subtotal: number;
  shippingCharge: number;
  discount: number;
  totalAmount: number;

  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;

  razorpayOrderId?: string;
  razorpayPaymentId?: string;

  orderStatus: OrderStatus;

  couponCode?: string;

  createdAt: Date;
  updatedAt: Date;
}

/* =========================================================
   CUSTOMER SCHEMA
========================================================= */

const customerSchema = new Schema<IOrderCustomer>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    _id: false,
  }
);

/* =========================================================
   ADDRESS SCHEMA
========================================================= */

const orderAddressSchema = new Schema<IOrderAddress>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
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
    },

    addressLine2: {
      type: String,
      trim: true,
    },

    city: {
      type: String,
      required: true,
      trim: true,
    },

    state: {
      type: String,
      required: true,
      trim: true,
    },

    pincode: {
      type: String,
      required: true,
      trim: true,
    },

    country: {
      type: String,
      default: "India",
      trim: true,
    },
  },
  {
    _id: false,
  }
);

/* =========================================================
   ORDER ITEM SCHEMA
========================================================= */

const orderItemSchema = new Schema<IOrderItem>(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    image: {
      type: String,
      trim: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    variantId: {
      type: String,
      trim: true,
    },

    color: {
      type: String,
      trim: true,
    },

    size: {
      type: String,
      trim: true,
    },
  },
  {
    _id: false,
  }
);

/* =========================================================
   ORDER SCHEMA
========================================================= */

const orderSchema = new Schema<IOrder>(
  {
    /*
     * IMPORTANT:
     * user is NOT required.
     *
     * Logged-in:
     * user = ObjectId
     *
     * Guest:
     * user = null
     */
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
      default: null,
      index: true,
    },

    customer: {
      type: customerSchema,
      required: true,
    },

    items: {
      type: [orderItemSchema],
      required: true,
      validate: {
        validator: (items: IOrderItem[]) =>
          Array.isArray(items) && items.length > 0,
        message: "Order must contain at least one item",
      },
    },

    shippingAddress: {
      type: orderAddressSchema,
      required: true,
    },

    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },

    shippingCharge: {
      type: Number,
      default: 0,
      min: 0,
    },

    discount: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    paymentMethod: {
      type: String,
      enum: ["cod", "razorpay"],
      required: true,
    },

    paymentStatus: {
      type: String,
      enum: [
        "pending",
        "paid",
        "failed",
        "refunded",
      ],
      default: "pending",
    },

    razorpayOrderId: {
      type: String,
      trim: true,
    },

    razorpayPaymentId: {
      type: String,
      trim: true,
    },

    orderStatus: {
      type: String,
      enum: [
        "pending",
        "confirmed",
        "processing",
        "shipped",
        "out_for_delivery",
        "delivered",
        "cancelled",
        "returned",
      ],
      default: "pending",
      index: true,
    },

    couponCode: {
      type: String,
      trim: true,
      uppercase: true,
    },
  },
  {
    timestamps: true,
  }
);

/* =========================================================
   MODEL
========================================================= */

const Order = mongoose.model<IOrder>(
  "Order",
  orderSchema
);

export default Order;