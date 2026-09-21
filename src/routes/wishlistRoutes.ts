import { Router } from "express";

import {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  checkWishlist,
} from "../controllers/wishlistController";

import { protect } from "../middleware/authMiddleware";

const router = Router();

router.use(protect);

router.get("/", getWishlist);

router.get(
  "/check/:productId",
  checkWishlist
);

router.post(
  "/:productId",
  addToWishlist
);

router.delete(
  "/:productId",
  removeFromWishlist
);

export default router;