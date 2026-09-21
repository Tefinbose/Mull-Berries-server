import { Router } from "express";

import {
  createCategory,
  getCategories,
  getActiveCategories,
  getCategoryById,
  getCategoryBySlug,
  updateCategory,
  deleteCategory,
} from "../controllers/categoryController";

import {
  protect,
  authorize,
} from "../middleware/authMiddleware";

const router = Router();

// ==========================================
// PUBLIC ROUTES
// ==========================================

// Get all categories
router.get("/", getCategories);

// Get active categories
router.get("/active", getActiveCategories);

// Get category by ID
router.get("/id/:id", getCategoryById);

// Get category by slug
router.get("/:slug", getCategoryBySlug);


// ==========================================
// PROTECTED ADMIN ROUTES
// ==========================================

// Create category
router.post(
  "/",
  protect,
  authorize("admin", "superadmin"),
  createCategory
);

// Update category
router.put(
  "/:id",
  protect,
  authorize("admin", "superadmin"),
  updateCategory
);

// Delete category
router.delete(
  "/:id",
  protect,
  authorize("admin", "superadmin"),
  deleteCategory
);

export default router;