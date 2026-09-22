import { Router } from "express";

import {
  uploadProductImages,
} from "../controllers/uploadController";

import {
  protect,
  authorize,
} from "../middleware/authMiddleware";

import {
  uploadImages,
} from "../middleware/uploadMiddleware";

const router = Router();

// =====================================================
// PRODUCT IMAGE UPLOAD
// =====================================================

router.post(
  "/product-images",

  // Authentication
  protect,

  // Authorization
  authorize(
    "admin",
    "superadmin"
  ),

  // Multer
  (req, res, next) => {
    uploadImages.array(
      "images",
      8
    )(req, res, (error) => {
      if (error) {
        console.error(
          "MULTER ERROR:",
          error
        );

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

  // Controller
  uploadProductImages
);

export default router;