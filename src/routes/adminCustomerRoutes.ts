import { Router } from "express";

import {
  getAdminCustomers,
  getAdminCustomerById,
  updateAdminCustomerStatus,
} from "../controllers/adminCustomerController";

import {
  protect,
  authorize,
} from "../middleware/authMiddleware";

const router = Router();

router.use(protect);

router.use(
  authorize("admin", "manager", "superadmin")
);

router.get("/", getAdminCustomers);

router.get("/:id", getAdminCustomerById);

router.patch(
  "/:id/status",
  updateAdminCustomerStatus
);

export default router;