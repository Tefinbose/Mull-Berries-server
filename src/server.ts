import dotenv from "dotenv";
import path from "path";

// =====================================================
// LOAD ENVIRONMENT VARIABLES FIRST
// =====================================================

dotenv.config({
  path: path.resolve(__dirname, "../.env"),
});

import express from "express";
import cors from "cors";

import connectDB from "./config/db";

import productRoutes from "./routes/productRoutes";
import categoryRoutes from "./routes/categoryRoutes";
import authRoutes from "./routes/authRoutes";
import cartRoutes from "./routes/cartRoutes";
import wishlistRoutes from "./routes/wishlistRoutes";
import addressRoutes from "./routes/addressRoutes";
import orderRoutes from "./routes/orderRoutes";
import paymentRoutes from "./routes/paymentRoutes";
import staffRoutes from "./routes/staffRoutes";
import adminRoutes from "./routes/adminRoutes";
import adminCustomerRoutes from "./routes/adminCustomerRoutes";
import adminSettingsRoutes from "./routes/adminSettingsRoutes";
import adminStaffRoutes from "./routes/adminStaffRoutes";
import uploadRoutes from "./routes/uploadRoutes";

// =====================================================
// APP
// =====================================================

const app = express();

const PORT = process.env.PORT || 5000;

// =====================================================
// CORS
// =====================================================

const allowedOrigins = [
  "http://localhost:3000",

  "https://mul-berries-client.vercel.app",

  ...(process.env.CLIENT_URLS ||
    process.env.CLIENT_URL ||
    "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

// =====================================================
// BODY PARSER
// =====================================================

app.use(express.json());

app.use(
  express.urlencoded({
    extended: true,
  })
);

// =====================================================
// API ROUTES
// =====================================================

app.use("/api/auth", authRoutes);

app.use("/api/products", productRoutes);

app.use("/api/categories", categoryRoutes);

app.use("/api/cart", cartRoutes);

app.use("/api/wishlist", wishlistRoutes);

app.use("/api/addresses", addressRoutes);

app.use("/api/orders", orderRoutes);

app.use("/api/payments", paymentRoutes);

app.use("/api/staff", staffRoutes);

app.use("/api/admin", adminRoutes);

app.use(
  "/api/admin/settings",
  adminSettingsRoutes
);

app.use(
  "/api/admin/customers",
  adminCustomerRoutes
);

app.use(
  "/api/admin/staff",
  adminStaffRoutes
);

// =====================================================
// UPLOAD ROUTES
// =====================================================

app.use(
  "/api/uploads",
  uploadRoutes
);

// =====================================================
// HEALTH CHECK
// =====================================================

app.get("/", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Mulberries backend is running",
  });
});

// =====================================================
// START SERVER
// =====================================================

const startServer = async (): Promise<void> => {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log(
        `Server running on http://localhost:${PORT}`
      );
    });
  } catch (error) {
    console.error(
      "Server failed to start:",
      error
    );
  }
};

startServer();