import { Router } from "express";

import {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
} from "../controllers/cartController";

import { protect } from "../middleware/authMiddleware";

const router = Router();

router.use(protect);

router.get("/", getCart);

router.post("/", addToCart);

router.put("/:productId", updateCartItem);

router.delete("/:productId", removeFromCart);

router.delete("/", clearCart);

export default router;