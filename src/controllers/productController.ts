import { Request, Response } from "express";
import mongoose from "mongoose";

import Product from "../models/Product";
import Category from "../models/Category";

// ==========================================
// CREATE PRODUCT
// ==========================================

export const createProduct = async (
  req: Request<Record<string, string>>,
  res: Response
): Promise<void> => {
  try {
    const {
      name,
      slug,
      description,
      price,
      compareAtPrice,
      category,
      images,
      variants,
      stock,
      isActive,
    } = req.body;

    // Check required fields
    if (
      !name ||
      !slug ||
      !description ||
      price === undefined ||
      !category
    ) {
      res.status(400).json({
        success: false,
        message:
          "Name, slug, description, price and category are required",
      });

      return;
    }

    // Validate category ID
    if (!mongoose.Types.ObjectId.isValid(category)) {
      res.status(400).json({
        success: false,
        message: "Invalid category ID",
      });

      return;
    }

    // Check whether category exists
    const categoryExists = await Category.findById(category);

    if (!categoryExists) {
      res.status(404).json({
        success: false,
        message: "Category not found",
      });

      return;
    }

    // Check duplicate slug
    const existingProduct = await Product.findOne({ slug });

    if (existingProduct) {
      res.status(409).json({
        success: false,
        message: "A product with this slug already exists",
      });

      return;
    }

    // Create product
    const product = await Product.create({
      name,
      slug,
      description,
      price,
      compareAtPrice,
      category,
      images: images || [],
      variants: variants || [],
      stock: stock || 0,
      isActive: isActive ?? true,
    });

    res.status(201).json({
      success: true,
      message: "Product created successfully",
      product,
    });
  } catch (error) {
    console.error("Create product error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create product",
    });
  }
};

// ==========================================
// GET ALL PRODUCTS
// ==========================================

export const getProducts = async (
  req: Request<Record<string, string>>,
  res: Response
): Promise<void> => {
  try {
    const products = await Product.find()
      .populate("category", "name slug")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: products.length,
      products,
    });
  } catch (error) {
    console.error("Get products error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch products",
    });
  }
};

// ==========================================
// GET SINGLE PRODUCT BY SLUG
// ==========================================

export const getProductBySlug = async (
  req: Request<Record<string, string>>,
  res: Response
): Promise<void> => {
  try {
    const { slug } = req.params;

    // Make sure slug is a string
    if (typeof slug !== "string") {
      res.status(400).json({
        success: false,
        message: "Invalid product slug",
      });

      return;
    }

    const product = await Product.findOne({
      slug,
      isActive: true,
    }).populate("category", "name slug");

    if (!product) {
      res.status(404).json({
        success: false,
        message: "Product not found",
      });

      return;
    }

    res.status(200).json({
      success: true,
      product,
    });
  } catch (error) {
    console.error("Get product error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch product",
    });
  }
};

// ==========================================
// UPDATE PRODUCT
// ==========================================

export const updateProduct = async (
  req: Request<Record<string, string>>,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    // Make sure ID is a string
    if (typeof id !== "string") {
      res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });

      return;
    }

    // Validate product ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });

      return;
    }

    // Check product exists
    const product = await Product.findById(id);

    if (!product) {
      res.status(404).json({
        success: false,
        message: "Product not found",
      });

      return;
    }

    // ==========================================
    // Validate category if category is updated
    // ==========================================

    if (req.body.category) {
      if (!mongoose.Types.ObjectId.isValid(req.body.category)) {
        res.status(400).json({
          success: false,
          message: "Invalid category ID",
        });

        return;
      }

      const categoryExists = await Category.findById(
        req.body.category
      );

      if (!categoryExists) {
        res.status(404).json({
          success: false,
          message: "Category not found",
        });

        return;
      }
    }

    // ==========================================
    // Check duplicate slug if slug is updated
    // ==========================================

    if (req.body.slug && req.body.slug !== product.slug) {
      const existingProduct = await Product.findOne({
        slug: req.body.slug,
        _id: { $ne: id },
      });

      if (existingProduct) {
        res.status(409).json({
          success: false,
          message: "A product with this slug already exists",
        });

        return;
      }
    }

    // ==========================================
    // Sync variants stock if stock is updated
    // ==========================================

    if (req.body.stock !== undefined) {
      const newStock = Math.max(0, Number(req.body.stock) || 0);
      req.body.stock = newStock;

      if (!req.body.variants) {
        if (product.variants && product.variants.length > 0) {
          const variants = product.variants.map((v: any) =>
            v.toObject ? v.toObject() : { ...v }
          );

          if (variants.length === 1) {
            variants[0].stock = newStock;
          } else {
            const currentSum = variants.reduce(
              (sum: number, v: any) => sum + (Number(v.stock) || 0),
              0
            );

            if (currentSum === 0 && newStock > 0) {
              const perVariant = Math.floor(newStock / variants.length);
              const rem = newStock % variants.length;
              variants.forEach((v: any, idx: number) => {
                v.stock = perVariant + (idx === 0 ? rem : 0);
              });
            } else if (newStock === 0) {
              variants.forEach((v: any) => {
                v.stock = 0;
              });
            } else if (currentSum > 0) {
              const factor = newStock / currentSum;
              let allocated = 0;
              variants.forEach((v: any, idx: number) => {
                if (idx === variants.length - 1) {
                  v.stock = Math.max(0, newStock - allocated);
                } else {
                  const s = Math.round((Number(v.stock) || 0) * factor);
                  v.stock = s;
                  allocated += s;
                }
              });
            }
          }

          req.body.variants = variants;
        } else {
          req.body.variants = [
            {
              name: "Standard",
              sku: `${product.slug || product._id}-default`,
              price: product.price,
              stock: newStock,
              attributes: { size: "Free Size", color: "Standard" },
            },
          ];
        }
      }
    } else if (req.body.variants && req.body.stock === undefined) {
      req.body.stock = req.body.variants.reduce(
        (sum: number, v: any) => sum + (Number(v.stock) || 0),
        0
      );
    }

    // ==========================================
    // Update product
    // ==========================================

    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      req.body,
      {
        new: true,
        runValidators: true,
      }
    ).populate("category", "name slug");

    res.status(200).json({
      success: true,
      message: "Product updated successfully",
      product: updatedProduct,
    });
  } catch (error) {
    console.error("Update product error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update product",
    });
  }
};

// ==========================================
// DELETE PRODUCT
// ==========================================

export const deleteProduct = async (
  req: Request<Record<string, string>>,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    // Make sure ID is a string
    if (typeof id !== "string") {
      res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });

      return;
    }

    // Validate product ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });

      return;
    }

    // Check product exists
    const product = await Product.findById(id);

    if (!product) {
      res.status(404).json({
        success: false,
        message: "Product not found",
      });

      return;
    }

    // Delete product
    await Product.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (error) {
    console.error("Delete product error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to delete product",
    });
  }
};