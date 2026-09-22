import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config({ path: ".env" });

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

const app = express();

const PORT = process.env.PORT || 5000;

const allowedOrigins = [
  "http://localhost:3000",
  "https://mul-berries-client.vercel.app",
  ...(process.env.CLIENT_URLS || process.env.CLIENT_URL || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
];

// --------------------
// Middleware
// --------------------

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);
app.use(express.json());

// --------------------
// API Routes
// --------------------

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

// --------------------
// Health Check
// --------------------

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Mulberries backend is running",
  });
});
app.use(
  "/api/admin/customers",
  adminCustomerRoutes
);
app.use("/api/admin/staff", adminStaffRoutes);
app.use("/api/uploads", uploadRoutes);

// --------------------
// Start Server
// --------------------

const startServer = async (): Promise<void> => {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Server failed to start:", error);
  }
};

startServer();