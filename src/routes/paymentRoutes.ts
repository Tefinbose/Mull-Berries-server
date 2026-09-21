import { Router } from "express";

import {
  createRazorpayOrder,
  verifyRazorpayPayment,
} from "../controllers/paymentController";

import { protect } from "../middleware/authMiddleware";

const router = Router();

router.post(
  "/create-order",
  protect,
  createRazorpayOrder
);

router.post(
  "/verify",
  verifyRazorpayPayment
);

export default router;