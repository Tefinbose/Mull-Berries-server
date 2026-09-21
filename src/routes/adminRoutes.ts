import { Router } from "express";

import { getAdminDashboard } from "../controllers/adminDashboardController";

import {
  protect,
  authorize,
} from "../middleware/authMiddleware";

const router = Router();

/*
 * All admin routes require authentication.
 */
router.use(protect);

/*
 * Admin dashboard can be accessed by:
 *
 * admin
 * manager
 * superadmin
 */
router.use(
  authorize(
    "admin",
    "manager",
    "superadmin"
  )
);

/*
 * GET /api/admin/dashboard
 *
 * Examples:
 *
 * /api/admin/dashboard?days=7
 * /api/admin/dashboard?days=30
 * /api/admin/dashboard?days=90
 */
router.get(
  "/dashboard",
  getAdminDashboard
);

export default router;