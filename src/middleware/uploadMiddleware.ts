import multer from "multer";

const storage = multer.memoryStorage();

export const uploadImages = multer({
  storage,
  limits: {
    files: 8,
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (_req, file, callback) => {
    if (file.mimetype.startsWith("image/")) {
      callback(null, true);
      return;
    }

    callback(new Error("Only image files are allowed"));
  },
});