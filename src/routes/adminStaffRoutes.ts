import { Router } from "express";

import {
  getAdminStaff,
  getAdminStaffById,
  createAdminStaff,
  updateAdminStaff,
  updateAdminStaffStatus,
  updateAdminStaffPermissions,
} from "../controllers/adminStaffController";

import {
  protect,
  authorize,
} from "../middleware/authMiddleware";

const router = Router();

router.use(protect);

/*
  Only admin and superadmin can manage staff.
  Managers can view staff but cannot create/change staff accounts.
*/

router.get(
  "/",
  authorize("admin", "manager", "superadmin"),
  getAdminStaff
);

router.get(
  "/:id",
  authorize("admin", "manager", "superadmin"),
  getAdminStaffById
);

router.post(
  "/",
  authorize("admin", "superadmin"),
  createAdminStaff
);

router.put(
  "/:id",
  authorize("admin", "superadmin"),
  updateAdminStaff
);

router.patch(
  "/:id/status",
  authorize("admin", "superadmin"),
  updateAdminStaffStatus
);

router.patch(
  "/:id/permissions",
  authorize("admin", "superadmin"),
  updateAdminStaffPermissions
);

export default router;