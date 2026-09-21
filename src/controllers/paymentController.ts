import crypto from "crypto";
import { Response } from "express";
import mongoose from "mongoose";

import razorpay from "../config/razorpay";

import Order from "../models/Order";
import Payment from "../models/Payment";

import { AuthRequest } from "../middleware/authMiddleware";

export const createRazorpayOrder =
  async (
    req: AuthRequest,
    res: Response
  ): Promise<void> => {
    try {
      if (!req.userId) {
        res.status(401).json({
          success: false,
          message:
            "Authentication required",
        });
        return;
      }

      const { orderId } = req.body;

      if (!orderId) {
        res.status(400).json({
          success: false,
          message: "Order ID is required",
        });
        return;
      }

      if (
        !mongoose.Types.ObjectId.isValid(
          orderId
        )
      ) {
        res.status(400).json({
          success: false,
          message: "Invalid order ID",
        });
        return;
      }

      const order =
        await Order.findOne({
          _id: orderId,
          user: req.userId,
        });

      if (!order) {
        res.status(404).json({
          success: false,
          message: "Order not found",
        });
        return;
      }

      if (
        order.paymentMethod !==
        "razorpay"
      ) {
        res.status(400).json({
          success: false,
          message:
            "This order is not configured for Razorpay",
        });
        return;
      }

      if (
        order.paymentStatus === "paid"
      ) {
        res.status(400).json({
          success: false,
          message: "Order is already paid",
        });
        return;
      }

      const existingPayment =
        await Payment.findOne({
          order: order._id,
          status: {
            $in: [
              "created",
              "authorized",
            ],
          },
        });

      if (existingPayment) {
        res.status(200).json({
          success: true,
          message:
            "Existing Razorpay order returned",
          payment: {
            _id: existingPayment._id,
            razorpayOrderId:
              existingPayment.razorpayOrderId,
            amount:
              Math.round(
                existingPayment.amount *
                  100
              ),
            currency:
              existingPayment.currency,
            status:
              existingPayment.status,
          },
          order: {
            _id: order._id,
            totalAmount:
              order.totalAmount,
          },
          keyId:
            process.env.RAZORPAY_KEY_ID,
        });

        return;
      }

      const amountInPaise =
        Math.round(
          order.totalAmount * 100
        );

      const razorpayOrder =
        await razorpay.orders.create({
          amount: amountInPaise,
          currency: "INR",
          receipt: `order_${order._id.toString()}`,
          notes: {
            orderId:
              order._id.toString(),
            userId: req.userId,
          },
        });

      const payment =
        await Payment.create({
          user: req.userId,
          order: order._id,
          razorpayOrderId:
            razorpayOrder.id,
          amount:
            order.totalAmount,
          currency: "INR",
          status: "created",
        });

      order.razorpayOrderId =
        razorpayOrder.id;

      await order.save();

      res.status(201).json({
        success: true,
        message:
          "Razorpay order created successfully",

        payment: {
          _id: payment._id,
          razorpayOrderId:
            razorpayOrder.id,
          amount:
            razorpayOrder.amount,
          currency:
            razorpayOrder.currency,
          status:
            payment.status,
        },

        order: {
          _id: order._id,
          totalAmount:
            order.totalAmount,
        },

        keyId:
          process.env.RAZORPAY_KEY_ID,
      });
    } catch (error) {
      console.error(
        "CREATE RAZORPAY ORDER ERROR:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Failed to create Razorpay order",
      });
    }
  };

export const verifyRazorpayPayment =
  async (
    req: AuthRequest,
    res: Response
  ): Promise<void> => {
    try {
      const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
      } = req.body;

      if (
        !razorpay_order_id ||
        !razorpay_payment_id ||
        !razorpay_signature
      ) {
        res.status(400).json({
          success: false,
          message:
            "Razorpay payment details are required",
        });
        return;
      }

      const secret =
        process.env.RAZORPAY_KEY_SECRET;

      if (!secret) {
        res.status(500).json({
          success: false,
          message:
            "Razorpay secret is not configured",
        });
        return;
      }

      const expectedSignature =
        crypto
          .createHmac(
            "sha256",
            secret
          )
          .update(
            `${razorpay_order_id}|${razorpay_payment_id}`
          )
          .digest("hex");

      if (
        expectedSignature !==
        razorpay_signature
      ) {
        res.status(400).json({
          success: false,
          message:
            "Invalid Razorpay signature",
        });
        return;
      }

      const payment =
        await Payment.findOne({
          razorpayOrderId:
            razorpay_order_id,
        });

      if (!payment) {
        res.status(404).json({
          success: false,
          message:
            "Payment record not found",
        });
        return;
      }

      if (
        req.userId &&
        payment.user.toString() !==
          req.userId
      ) {
        res.status(403).json({
          success: false,
          message:
            "You are not authorized to verify this payment",
        });
        return;
      }

      const order =
        await Order.findById(
          payment.order
        );

      if (!order) {
        res.status(404).json({
          success: false,
          message: "Order not found",
        });
        return;
      }

      payment.razorpayPaymentId =
        razorpay_payment_id;

      payment.razorpaySignature =
        razorpay_signature;

      payment.status = "captured";

      await payment.save();

      order.paymentStatus = "paid";
      order.orderStatus = "confirmed";
      order.razorpayPaymentId =
        razorpay_payment_id;
      order.razorpayOrderId =
        razorpay_order_id;

      await order.save();

      res.status(200).json({
        success: true,
        message:
          "Payment verified successfully",

        payment: {
          _id: payment._id,
          razorpayOrderId:
            payment.razorpayOrderId,
          razorpayPaymentId:
            payment.razorpayPaymentId,
          status: payment.status,
          amount: payment.amount,
          currency: payment.currency,
        },

        order: {
          _id: order._id,
          totalAmount:
            order.totalAmount,
          paymentStatus:
            order.paymentStatus,
          orderStatus:
            order.orderStatus,
        },
      });
    } catch (error) {
      console.error(
        "VERIFY RAZORPAY PAYMENT ERROR:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Failed to verify Razorpay payment",
      });
    }
  };