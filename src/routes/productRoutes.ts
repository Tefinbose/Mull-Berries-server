import { Router } from "express";

import {
  createProduct,
  getProducts,
  getProductBySlug,
  updateProduct,
  deleteProduct,
} from "../controllers/productController";

import {
  protect,
  authorize,
} from "../middleware/authMiddleware";

const router = Router();

// ==========================================
// PUBLIC ROUTES
// ==========================================

// Get all products
router.get("/", getProducts);

// Get product by slug
router.get("/:slug", getProductBySlug);


// ==========================================
// PROTECTED ADMIN ROUTES
// ==========================================

// Create product
router.post(
  "/",
  protect,
  authorize("admin", "superadmin"),
  createProduct
);

// Update product
router.put(
  "/:id",
  protect,
  authorize("admin", "superadmin"),
  updateProduct
);

// Delete product
router.delete(
  "/:id",
  protect,
  authorize("admin", "superadmin"),
  deleteProduct
);

export default router;