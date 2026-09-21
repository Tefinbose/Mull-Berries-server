import { Router } from "express";

import {
  getAdminSettings,
  updateAdminSettings,
} from "../controllers/adminSettingsController";

import {
  protect,
  authorize,
} from "../middleware/authMiddleware";

const router = Router();

router.use(protect);

router.use(
  authorize(
    "admin",
    "manager",
    "superadmin"
  )
);

router.get("/", getAdminSettings);

router.put("/", updateAdminSettings);

export default router;