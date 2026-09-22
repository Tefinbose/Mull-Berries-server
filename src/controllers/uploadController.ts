import { Request, Response } from "express";
import { UploadApiResponse } from "cloudinary";

import cloudinary from "../config/cloudinary";

function uploadBuffer(
  buffer: Buffer,
  folder: string
): Promise<UploadApiResponse> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
      },
      (error, result) => {
        if (error || !result) {
          reject(error || new Error("Cloudinary upload failed"));
          return;
        }

        resolve(result);
      }
    );

    stream.end(buffer);
  });
}

export const uploadProductImages = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!process.env.CLOUDINARY_CLOUD_NAME) {
      res.status(503).json({
        success: false,
        message: "Cloudinary is not configured on the server",
      });
      return;
    }

    const files = (req.files as Express.Multer.File[]) || [];

    if (files.length === 0) {
      res.status(400).json({
        success: false,
        message: "At least one image is required",
      });
      return;
    }

    const uploads = await Promise.all(
      files.map((file) => uploadBuffer(file.buffer, "mulberries/products"))
    );

    res.status(201).json({
      success: true,
      images: uploads.map((upload) => ({
        url: upload.secure_url,
        publicId: upload.public_id,
      })),
    });
  } catch (error) {
    console.error("UPLOAD PRODUCT IMAGES ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to upload product images",
    });
  }
};