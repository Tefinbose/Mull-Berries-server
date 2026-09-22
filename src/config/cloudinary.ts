import { v2 as cloudinary } from "cloudinary";

console.log("========== CLOUDINARY CONFIG ==========");

console.log(
  "CLOUDINARY_CLOUD_NAME:",
  process.env.CLOUDINARY_CLOUD_NAME || "MISSING"
);

console.log(
  "CLOUDINARY_API_KEY:",
  process.env.CLOUDINARY_API_KEY || "MISSING"
);

console.log(
  "CLOUDINARY_API_SECRET:",
  process.env.CLOUDINARY_API_SECRET
    ? "LOADED"
    : "MISSING"
);

console.log("========================================");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export default cloudinary;