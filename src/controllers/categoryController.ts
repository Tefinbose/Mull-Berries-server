import { Request, Response } from "express";
import mongoose from "mongoose";
import Category from "../models/Category";

// ==========================================
// CREATE CATEGORY
// POST /api/categories
// ==========================================
export const createCategory = async (
  req: Request<Record<string, string>>,
  res: Response
): Promise<void> => {
  try {
    const { name, slug, description, image, isActive } = req.body;

    // Required fields
    if (!name || !slug) {
      res.status(400).json({
        success: false,
        message: "Name and slug are required",
      });
      return;
    }

    // Check duplicate name
    const existingName = await Category.findOne({
      name: name.trim(),
    });

    if (existingName) {
      res.status(409).json({
        success: false,
        message: "Category name already exists",
      });
      return;
    }

    // Check duplicate slug
    const existingSlug = await Category.findOne({
      slug: slug.trim().toLowerCase(),
    });

    if (existingSlug) {
      res.status(409).json({
        success: false,
        message: "Category slug already exists",
      });
      return;
    }

    const category = await Category.create({
      name: name.trim(),
      slug: slug.trim().toLowerCase(),
      description: description?.trim(),
      image: image?.trim(),
      isActive: isActive !== undefined ? isActive : true,
    });

    res.status(201).json({
      success: true,
      message: "Category created successfully",
      category,
    });
  } catch (error) {
    console.error("Create category error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create category",
    });
  }
};

// ==========================================
// GET ALL CATEGORIES
// GET /api/categories
// ==========================================
export const getCategories = async (
  req: Request<Record<string, string>>,
  res: Response
): Promise<void> => {
  try {
    const categories = await Category.find()
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: categories.length,
      categories,
    });
  } catch (error) {
    console.error("Get categories error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch categories",
    });
  }
};

// ==========================================
// GET ACTIVE CATEGORIES
// GET /api/categories/active
// ==========================================
export const getActiveCategories = async (
  req: Request<Record<string, string>>,
  res: Response
): Promise<void> => {
  try {
    const categories = await Category.find({
      isActive: true,
    })
      .sort({ name: 1 })
      .lean();

    res.status(200).json({
      success: true,
      count: categories.length,
      categories,
    });
  } catch (error) {
    console.error("Get active categories error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch active categories",
    });
  }
};

// ==========================================
// GET CATEGORY BY ID
// GET /api/categories/id/:id
// ==========================================
export const getCategoryById = async (
  req: Request<Record<string, string>>,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid category ID",
      });
      return;
    }

    const category = await Category.findById(id);

    if (!category) {
      res.status(404).json({
        success: false,
        message: "Category not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      category,
    });
  } catch (error) {
    console.error("Get category by ID error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch category",
    });
  }
};

// ==========================================
// GET CATEGORY BY SLUG
// GET /api/categories/:slug
// ==========================================
export const getCategoryBySlug = async (
  req: Request<Record<string, string>>,
  res: Response
): Promise<void> => {
  try {
    const { slug } = req.params;

    const category = await Category.findOne({
      slug: slug.toLowerCase(),
    });

    if (!category) {
      res.status(404).json({
        success: false,
        message: "Category not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      category,
    });
  } catch (error) {
    console.error("Get category by slug error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch category",
    });
  }
};

// ==========================================
// UPDATE CATEGORY
// PUT /api/categories/:id
// ==========================================
export const updateCategory = async (
  req: Request<Record<string, string>>,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid category ID",
      });
      return;
    }

    const category = await Category.findById(id);

    if (!category) {
      res.status(404).json({
        success: false,
        message: "Category not found",
      });
      return;
    }

    const { name, slug, description, image, isActive } = req.body;

    // Check duplicate name
    if (name && name.trim() !== category.name) {
      const existingName = await Category.findOne({
        name: name.trim(),
        _id: { $ne: id },
      });

      if (existingName) {
        res.status(409).json({
          success: false,
          message: "Category name already exists",
        });
        return;
      }

      category.name = name.trim();
    }

    // Check duplicate slug
    if (slug && slug.trim().toLowerCase() !== category.slug) {
      const existingSlug = await Category.findOne({
        slug: slug.trim().toLowerCase(),
        _id: { $ne: id },
      });

      if (existingSlug) {
        res.status(409).json({
          success: false,
          message: "Category slug already exists",
        });
        return;
      }

      category.slug = slug.trim().toLowerCase();
    }

    if (description !== undefined) {
      category.description = description?.trim();
    }

    if (image !== undefined) {
      category.image = image?.trim();
    }

    if (isActive !== undefined) {
      category.isActive = Boolean(isActive);
    }

    await category.save();

    res.status(200).json({
      success: true,
      message: "Category updated successfully",
      category,
    });
  } catch (error) {
    console.error("Update category error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update category",
    });
  }
};

// ==========================================
// DELETE CATEGORY
// DELETE /api/categories/:id
// ==========================================
export const deleteCategory = async (
  req: Request<Record<string, string>>,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid category ID",
      });
      return;
    }

    const category = await Category.findById(id);

    if (!category) {
      res.status(404).json({
        success: false,
        message: "Category not found",
      });
      return;
    }

    await Category.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Category deleted successfully",
    });
  } catch (error) {
    console.error("Delete category error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to delete category",
    });
  }
};