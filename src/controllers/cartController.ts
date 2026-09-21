import { Response } from "express";
import mongoose from "mongoose";

import Cart from "../models/Cart";
import Product from "../models/Product";
import { AuthRequest } from "../middleware/authMiddleware";

/* =========================================================
   GET CART
   GET /api/cart
========================================================= */

export const getCart = async (
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

    let cart = await Cart.findOne({
      user: req.userId,
    }).populate("items.product");

    // Create empty cart if user doesn't have one
    if (!cart) {
      cart = await Cart.create({
        user: req.userId,
        items: [],
      });
    }

    res.status(200).json({
      success: true,
      cart,
    });
  } catch (error) {
    console.error("GET CART ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to get cart",
    });
  }
};

/* =========================================================
   ADD TO CART
   POST /api/cart
========================================================= */

export const addToCart = async (
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

    const {
      productId,
      variantId,
      quantity = 1,
    } = req.body;

    // Validate product ID
    if (!productId) {
      res.status(400).json({
        success: false,
        message: "Product ID is required",
      });
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
      return;
    }

    // Validate quantity
    if (
      typeof quantity !== "number" ||
      quantity < 1 ||
      !Number.isInteger(quantity)
    ) {
      res.status(400).json({
        success: false,
        message: "Quantity must be a positive integer",
      });
      return;
    }

    // Find product
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

    /*
      Determine price.

      If variantId is supplied, find the matching variant.
      Otherwise use product price.
    */

    let itemPrice = product.price;

    if (variantId) {
      const variant = product.variants.find(
        (item: any) =>
          item._id?.toString() === variantId ||
          item.sku === variantId
      );

      if (!variant) {
        res.status(404).json({
          success: false,
          message: "Product variant not found",
        });
        return;
      }

      itemPrice = variant.price;

      if (variant.stock < quantity) {
        res.status(400).json({
          success: false,
          message: "Insufficient variant stock",
        });
        return;
      }
    } else {
      if (product.stock < quantity) {
        res.status(400).json({
          success: false,
          message: "Insufficient product stock",
        });
        return;
      }
    }

    // Find user's cart
    let cart = await Cart.findOne({
      user: req.userId,
    });

    // Create cart if it doesn't exist
    if (!cart) {
      cart = new Cart({
        user: req.userId,
        items: [],
      });
    }

    // Find existing item
    const existingItem = cart.items.find(
      (item) =>
        item.product.toString() === productId &&
        item.variantId === variantId
    );

    if (existingItem) {
      const newQuantity =
        existingItem.quantity + quantity;

      // Check stock again
      if (variantId) {
        const variant = product.variants.find(
          (item: any) =>
            item._id?.toString() === variantId ||
            item.sku === variantId
        );

        if (variant && newQuantity > variant.stock) {
          res.status(400).json({
            success: false,
            message: "Requested quantity exceeds available stock",
          });
          return;
        }
      } else if (newQuantity > product.stock) {
        res.status(400).json({
          success: false,
          message: "Requested quantity exceeds available stock",
        });
        return;
      }

      existingItem.quantity = newQuantity;
      existingItem.price = itemPrice;
    } else {
      cart.items.push({
        product: product._id,
        variantId,
        quantity,
        price: itemPrice,
      });
    }

    await cart.save();

    await cart.populate("items.product");

    res.status(200).json({
      success: true,
      message: "Product added to cart",
      cart,
    });
  } catch (error) {
    console.error("ADD TO CART ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to add product to cart",
    });
  }
};

/* =========================================================
   UPDATE CART ITEM
   PUT /api/cart/:productId
========================================================= */

export const updateCartItem = async (
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
    const { quantity, variantId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
      return;
    }

    if (
      typeof quantity !== "number" ||
      quantity < 1 ||
      !Number.isInteger(quantity)
    ) {
      res.status(400).json({
        success: false,
        message: "Quantity must be a positive integer",
      });
      return;
    }

    const cart = await Cart.findOne({
      user: req.userId,
    });

    if (!cart) {
      res.status(404).json({
        success: false,
        message: "Cart not found",
      });
      return;
    }

    const item = cart.items.find(
      (cartItem) =>
        cartItem.product.toString() === productId &&
        cartItem.variantId === variantId
    );

    if (!item) {
      res.status(404).json({
        success: false,
        message: "Cart item not found",
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

    if (variantId) {
      const variant = product.variants.find(
        (item: any) =>
          item._id?.toString() === variantId ||
          item.sku === variantId
      );

      if (!variant) {
        res.status(404).json({
          success: false,
          message: "Variant not found",
        });
        return;
      }

      if (quantity > variant.stock) {
        res.status(400).json({
          success: false,
          message: "Requested quantity exceeds stock",
        });
        return;
      }

      item.price = variant.price;
    } else {
      if (quantity > product.stock) {
        res.status(400).json({
          success: false,
          message: "Requested quantity exceeds stock",
        });
        return;
      }

      item.price = product.price;
    }

    item.quantity = quantity;

    await cart.save();

    await cart.populate("items.product");

    res.status(200).json({
      success: true,
      message: "Cart updated",
      cart,
    });
  } catch (error) {
    console.error("UPDATE CART ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update cart",
    });
  }
};

/* =========================================================
   REMOVE FROM CART
   DELETE /api/cart/:productId
========================================================= */

export const removeFromCart = async (
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
    const { variantId } = req.query;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
      return;
    }

    const cart = await Cart.findOne({
      user: req.userId,
    });

    if (!cart) {
      res.status(404).json({
        success: false,
        message: "Cart not found",
      });
      return;
    }

    const originalLength = cart.items.length;

    cart.items = cart.items.filter(
      (item) =>
        !(
          item.product.toString() === productId &&
          item.variantId === variantId
        )
    ) as typeof cart.items;

    if (cart.items.length === originalLength) {
      res.status(404).json({
        success: false,
        message: "Cart item not found",
      });
      return;
    }

    await cart.save();

    await cart.populate("items.product");

    res.status(200).json({
      success: true,
      message: "Product removed from cart",
      cart,
    });
  } catch (error) {
    console.error("REMOVE CART ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to remove cart item",
    });
  }
};

/* =========================================================
   CLEAR CART
   DELETE /api/cart
========================================================= */

export const clearCart = async (
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

    const cart = await Cart.findOne({
      user: req.userId,
    });

    if (!cart) {
      res.status(404).json({
        success: false,
        message: "Cart not found",
      });
      return;
    }

    cart.items = [];

    await cart.save();

    res.status(200).json({
      success: true,
      message: "Cart cleared",
      cart,
    });
  } catch (error) {
    console.error("CLEAR CART ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to clear cart",
    });
  }
};