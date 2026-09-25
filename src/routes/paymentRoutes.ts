import { Router } from "express";

import {
  createRazorpayOrder,
  verifyRazorpayPayment,
} from "../controllers/paymentController";

import { optionalProtect } from "../middleware/authMiddleware";

const router = Router();

router.post(
  "/create-order",
  optionalProtect,
  createRazorpayOrder
);

router.post(
  "/verify",
  verifyRazorpayPayment
);

export default router;