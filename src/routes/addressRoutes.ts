import { Router } from "express";

import {
  getMyAddresses,
  getAddressById,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
} from "../controllers/addressController";

import { protect } from "../middleware/authMiddleware";

const router = Router();

router.use(protect);

router.get("/", getMyAddresses);
router.get("/:id", getAddressById);

router.post("/", createAddress);

router.patch("/:id", updateAddress);

router.patch(
  "/:id/default",
  setDefaultAddress
);

router.delete("/:id", deleteAddress);

export default router;