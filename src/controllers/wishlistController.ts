import { Response } from "express";
import mongoose from "mongoose";

import Wishlist from "../models/Wishlist";
import Product from "../models/Product";
import { AuthRequest } from "../middleware/authMiddleware";

/* =========================================================
   GET WISHLIST
   GET /api/wishlist
========================================================= */

export const getWishlist = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    let wishlist = await Wishlist.findOne({
      user: req.userId,
    }).populate("products");

    if (!wishlist) {
      wishlist = await Wishlist.create({
        user: req.userId,
        products: [],
      });
    }

    res.status(200).json({
      success: true,
      wishlist,
    });
  } catch (error) {
    console.error("GET WISHLIST ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to get wishlist",
    });
  }
};

/* =========================================================
   ADD TO WISHLIST
   POST /api/wishlist/:productId
========================================================= */

export const addToWishlist = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const { productId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
      return;
    }

    const product = await Product.findById(productId);

    if (!product) {
      res.status(404).json({
        success: false,
        message: "Product not found",
      });
      return;
    }

    if (!product.isActive) {
      res.status(400).json({
        success: false,
        message: "Product is not available",
      });
      return;
    }

    let wishlist = await Wishlist.findOne({
      user: req.userId,
    });

    if (!wishlist) {
      wishlist = new Wishlist({
        user: req.userId,
        products: [],
      });
    }

    const alreadyExists = wishlist.products.some(
      (id) => id.toString() === productId
    );

    if (alreadyExists) {
      res.status(409).json({
        success: false,
        message: "Product is already in wishlist",
      });
      return;
    }

    wishlist.products.push(product._id);

    await wishlist.save();

    await wishlist.populate("products");

    res.status(200).json({
      success: true,
      message: "Product added to wishlist",
      wishlist,
    });
  } catch (error) {
    console.error("ADD WISHLIST ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to add product to wishlist",
    });
  }
};

/* =========================================================
   REMOVE FROM WISHLIST
   DELETE /api/wishlist/:productId
========================================================= */

export const removeFromWishlist = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const { productId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
      return;
    }

    const wishlist = await Wishlist.findOne({
      user: req.userId,
    });

    if (!wishlist) {
      res.status(404).json({
        success: false,
        message: "Wishlist not found",
      });
      return;
    }

    const originalLength = wishlist.products.length;

    wishlist.products = wishlist.products.filter(
      (id) => id.toString() !== productId
    );

    if (wishlist.products.length === originalLength) {
      res.status(404).json({
        success: false,
        message: "Product not found in wishlist",
      });
      return;
    }

    await wishlist.save();

    await wishlist.populate("products");

    res.status(200).json({
      success: true,
      message: "Product removed from wishlist",
      wishlist,
    });
  } catch (error) {
    console.error("REMOVE WISHLIST ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to remove product from wishlist",
    });
  }
};

/* =========================================================
   CHECK WISHLIST
   GET /api/wishlist/check/:productId
========================================================= */

export const checkWishlist = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const { productId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
      return;
    }

    const wishlist = await Wishlist.findOne({
      user: req.userId,
    });

    if (!wishlist) {
      res.status(200).json({
        success: true,
        inWishlist: false,
      });
      return;
    }

    const inWishlist = wishlist.products.some(
      (id) => id.toString() === productId
    );

    res.status(200).json({
      success: true,
      inWishlist,
    });
  } catch (error) {
    console.error("CHECK WISHLIST ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to check wishlist",
    });
  }
};