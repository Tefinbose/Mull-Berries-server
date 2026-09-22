import { Router } from "express";

import { uploadProductImages } from "../controllers/uploadController";
import { protect, authorize } from "../middleware/authMiddleware";
import { uploadImages } from "../middleware/uploadMiddleware";

const router = Router();

router.post(
  "/product-images",
  protect,
  authorize("admin", "superadmin"),
  (req, res, next) => {
    uploadImages.array("images", 8)(req, res, (error) => {
      if (error) {
        res.status(400).json({
          success: false,
          message:
            error instanceof Error
              ? error.message
              : "Invalid image upload",
        });
        return;
      }

      next();
    });
  },
  uploadProductImages
);

export default router;