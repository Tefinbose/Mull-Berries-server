import multer from "multer";

// =====================================================
// MEMORY STORAGE
// =====================================================

const storage = multer.memoryStorage();

// =====================================================
// MULTER CONFIGURATION
// =====================================================

export const uploadImages = multer({
  storage,

  limits: {
    files: 8,

    fileSize: 5 * 1024 * 1024,
  },

  fileFilter: (_req, file, callback) => {
    // Only images
    if (file.mimetype.startsWith("image/")) {
      callback(null, true);
      return;
    }

    callback(
      new Error(
        "Only image files are allowed"
      )
    );
  },
});