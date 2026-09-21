import { Router } from "express";

import { getStaffProfile } from "../controllers/staffController";
import { getStaffDashboard } from "../controllers/staffDashboardController";
import {
  getStaffOrders,
  getStaffOrderById,
  updateStaffOrderStatus,
} from "../controllers/staffOrderController";

import {
  getStaffInventory,
  getStaffInventoryProduct,
  updateStaffInventoryStock,
} from "../controllers/staffInventoryController";

import {
  getStaffShipments,
  getStaffShipmentById,
  createStaffShipment,
  updateStaffShipmentStatus,
} from "../controllers/staffShipmentController";

import {
  getStaffNdrs,
  getStaffNdrById,
  updateStaffNdrStatus,
} from "../controllers/staffNdrController";

import {
  getStaffReturns,
  getStaffReturnById,
  createStaffReturn,
  updateStaffReturnStatus,
} from "../controllers/staffReturnController";

import { getStaffAnalytics } from "../controllers/staffAnalyticsController";

import {
  protect,
  authorize,
} from "../middleware/authMiddleware";

const router = Router();

/*
|--------------------------------------------------------------------------
| STAFF AUTH
|--------------------------------------------------------------------------
*/

router.use(protect);

router.use(
  authorize("staff", "superadmin")
);

/*
|--------------------------------------------------------------------------
| PROFILE
|--------------------------------------------------------------------------
*/

router.get(
  "/profile",
  getStaffProfile
);

/*
|--------------------------------------------------------------------------
| DASHBOARD
|--------------------------------------------------------------------------
*/

router.get(
  "/dashboard",
  getStaffDashboard
);

/*
|--------------------------------------------------------------------------
| ANALYTICS
|--------------------------------------------------------------------------
*/

router.get(
  "/analytics",
  getStaffAnalytics
);

/*
|--------------------------------------------------------------------------
| ORDERS
|--------------------------------------------------------------------------
*/

router.get(
  "/orders",
  getStaffOrders
);

router.get(
  "/orders/:id",
  getStaffOrderById
);

router.patch(
  "/orders/:id/status",
  updateStaffOrderStatus
);

/*
|--------------------------------------------------------------------------
| INVENTORY
|--------------------------------------------------------------------------
*/

router.get(
  "/inventory",
  getStaffInventory
);

router.get(
  "/inventory/:id",
  getStaffInventoryProduct
);

router.patch(
  "/inventory/:id/stock",
  updateStaffInventoryStock
);

/*
|--------------------------------------------------------------------------
| SHIPPING
|--------------------------------------------------------------------------
*/

router.get(
  "/shipments",
  getStaffShipments
);

router.get(
  "/shipments/:id",
  getStaffShipmentById
);

router.post(
  "/shipments",
  createStaffShipment
);

router.patch(
  "/shipments/:id/status",
  updateStaffShipmentStatus
);

/*
|--------------------------------------------------------------------------
| NDR
|--------------------------------------------------------------------------
*/

router.get(
  "/ndr",
  getStaffNdrs
);

router.get(
  "/ndr/:id",
  getStaffNdrById
);

router.patch(
  "/ndr/:id/status",
  updateStaffNdrStatus
);

/*
|--------------------------------------------------------------------------
| RETURNS
|--------------------------------------------------------------------------
*/

router.get(
  "/returns",
  getStaffReturns
);

router.get(
  "/returns/:id",
  getStaffReturnById
);

router.post(
  "/returns",
  createStaffReturn
);

router.patch(
  "/returns/:id/status",
  updateStaffReturnStatus
);

export default router;