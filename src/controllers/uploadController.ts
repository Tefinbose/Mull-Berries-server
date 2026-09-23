import { Request, Response } from "express";
import { UploadApiResponse } from "cloudinary";

import cloudinary from "../config/cloudinary";

// =====================================================
// UPLOAD BUFFER TO CLOUDINARY
// =====================================================

const uploadBuffer = (
  buffer: Buffer,
  folder: string
): Promise<UploadApiResponse> => {
  return new Promise((resolve, reject) => {
    const stream =
      cloudinary.uploader.upload_stream(
        {
          folder,

          resource_type: "image",
        },

        (error, result) => {
          if (error) {
            console.error(
              "CLOUDINARY ERROR:",
              error
            );

            reject(error);

            return;
          }

          if (!result) {
            reject(
              new Error(
                "Cloudinary did not return an upload result"
              )
            );

            return;
          }

          resolve(result);
        }
      );

    stream.end(buffer);
  });
};

// =====================================================
// UPLOAD PRODUCT IMAGES
// =====================================================

export const uploadProductImages = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // =================================================
    // CHECK CLOUDINARY CONFIGURATION
    // =================================================

    if (
      !process.env.CLOUDINARY_CLOUD_NAME ||
      !process.env.CLOUDINARY_API_KEY ||
      !process.env.CLOUDINARY_API_SECRET
    ) {
      res.status(503).json({
        success: false,

        message:
          "Cloudinary is not fully configured on the server",
      });

      return;
    }

    // =================================================
    // GET FILES
    // =================================================

    const files =
      (req.files as Express.Multer.File[]) || [];

    // =================================================
    // CHECK FILES
    // =================================================

    if (files.length === 0) {
      res.status(400).json({
        success: false,

        message:
          "At least one image is required",
      });

      return;
    }

    // =================================================
    // UPLOAD TO CLOUDINARY
    // =================================================

    const uploads = await Promise.all(
      files.map((file) => {
        return uploadBuffer(
          file.buffer,
          "mulberries/products"
        );
      })
    );

    // =================================================
    // RESPONSE
    // =================================================

    res.status(201).json({
      success: true,

      message:
        "Product images uploaded successfully",

      images: uploads.map((upload) => ({
        url: upload.secure_url,

        publicId: upload.public_id,
      })),
    });
  } catch (error) {
    console.error(
      "UPLOAD PRODUCT IMAGES ERROR:",
      error
    );

    let message =
      "Failed to upload product images";

    if (error instanceof Error) {
      message = error.message;
    }

    // Cloudinary errors can contain http_code
    const cloudinaryError =
      error as {
        http_code?: number;
        message?: string;
      };

    res.status(
      cloudinaryError.http_code || 500
    ).json({
      success: false,

      message,
    });
  }
};