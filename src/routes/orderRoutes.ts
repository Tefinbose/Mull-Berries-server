import { Router } from "express";

import {
  createOrder,
  getMyOrders,
  getMyOrderById,
  cancelMyOrder,
  createGuestOrder,
  getGuestOrderById,
  getMyOrderShipment,
} from "../controllers/orderController";
import {
  getAdminOrders,
  getAdminOrderById,
  updateAdminOrderStatus,
  cancelAdminOrder,
} from "../controllers/orderController";

import {
  protect,
  authorize,
} from "../middleware/authMiddleware";



const router = Router();

router.post("/guest", createGuestOrder);
router.get("/guest/:id", getGuestOrderById);

router.use(protect);

router.post("/", createOrder);

router.get("/", getMyOrders);

router.get("/:id/shipment", getMyOrderShipment);

router.get("/:id", getMyOrderById);

router.patch("/:id/cancel", cancelMyOrder);

export default router;

// =====================================================
// ADMIN ORDER ROUTES
// =====================================================

router.get(
  "/admin/all",
  protect,
  authorize("admin", "manager", "superadmin"),
  getAdminOrders
);

router.get(
  "/admin/:id",
  protect,
  authorize("admin", "manager", "superadmin"),
  getAdminOrderById
);

router.patch(
  "/admin/:id/status",
  protect,
  authorize("admin", "manager", "superadmin"),
  updateAdminOrderStatus
);

router.patch(
  "/admin/:id/cancel",
  protect,
  authorize("admin", "manager", "superadmin"),
  cancelAdminOrder
);