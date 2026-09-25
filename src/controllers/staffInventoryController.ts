import { Response } from "express";
import Product from "../models/Product";
import { AuthRequest } from "../middleware/authMiddleware";

/*
|--------------------------------------------------------------------------
| GET STAFF INVENTORY
|--------------------------------------------------------------------------
| GET /api/staff/inventory
|
| Permission:
| inventory.view
| inventory.update
|
| Query:
| ?search=saree
| ?stockStatus=low
| ?stockStatus=out
| ?stockStatus=in
| ?page=1
| ?limit=20
|--------------------------------------------------------------------------
*/

export const getStaffInventory = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.userId || !req.role) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const permissions = req.permissions || [];

    const canViewInventory =
      req.role === "superadmin" ||
      permissions.includes("inventory.view") ||
      permissions.includes("inventory.update");

    if (!canViewInventory) {
      res.status(403).json({
        success: false,
        message: "You do not have permission to view inventory",
      });
      return;
    }

    const {
      search,
      stockStatus,
      page = "1",
      limit = "20",
    } = req.query;

    const pageNumber = Math.max(Number(page) || 1, 1);

    const limitNumber = Math.min(
      Math.max(Number(limit) || 20, 1),
      100
    );

    const skip = (pageNumber - 1) * limitNumber;

    /*
    |--------------------------------------------------------------------------
    | BUILD FILTER
    |--------------------------------------------------------------------------
    */

    const filter: Record<string, any> = {};

    /*
    |--------------------------------------------------------------------------
    | SEARCH
    |--------------------------------------------------------------------------
    */

    if (search && typeof search === "string") {
      filter.$or = [
        {
          name: {
            $regex: search,
            $options: "i",
          },
        },
        {
          sku: {
            $regex: search,
            $options: "i",
          },
        },
      ];
    }

    /*
    |--------------------------------------------------------------------------
    | STOCK FILTER
    |--------------------------------------------------------------------------
    */

    if (stockStatus === "out") {
      filter.stock = {
        $lte: 0,
      };
    }

    if (stockStatus === "low") {
      filter.stock = {
        $gt: 0,
        $lte: 10,
      };
    }

    if (stockStatus === "in") {
      filter.stock = {
        $gt: 10,
      };
    }

    /*
    |--------------------------------------------------------------------------
    | FETCH INVENTORY
    |--------------------------------------------------------------------------
    */

    const [products, total] = await Promise.all([
      Product.find(filter)
        .select(
          "_id name slug sku price comparePrice stock images isActive variants createdAt updatedAt"
        )
        .sort({
          stock: 1,
          createdAt: -1,
        })
        .skip(skip)
        .limit(limitNumber)
        .lean(),

      Product.countDocuments(filter),
    ]);

    /*
    |--------------------------------------------------------------------------
    | INVENTORY SUMMARY
    |--------------------------------------------------------------------------
    */

    const [
      totalProducts,
      inStock,
      lowStock,
      outOfStock,
    ] = await Promise.all([
      Product.countDocuments(),

      Product.countDocuments({
        stock: {
          $gt: 10,
        },
      }),

      Product.countDocuments({
        stock: {
          $gt: 0,
          $lte: 10,
        },
      }),

      Product.countDocuments({
        stock: {
          $lte: 0,
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limitNumber);

    res.status(200).json({
      success: true,

      inventory: products,

      summary: {
        totalProducts,
        inStock,
        lowStock,
        outOfStock,
      },

      pagination: {
        total,
        page: pageNumber,
        limit: limitNumber,
        totalPages,
        hasNextPage: pageNumber < totalPages,
        hasPreviousPage: pageNumber > 1,
      },
    });
  } catch (error) {
    console.error("GET STAFF INVENTORY ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to load inventory",
    });
  }
};


/*
|--------------------------------------------------------------------------
| GET SINGLE INVENTORY PRODUCT
|--------------------------------------------------------------------------
| GET /api/staff/inventory/:id
|
| Permission:
| inventory.view
| inventory.update
|--------------------------------------------------------------------------
*/

export const getStaffInventoryProduct = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.userId || !req.role) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const permissions = req.permissions || [];

    const canViewInventory =
      req.role === "superadmin" ||
      permissions.includes("inventory.view") ||
      permissions.includes("inventory.update");

    if (!canViewInventory) {
      res.status(403).json({
        success: false,
        message: "You do not have permission to view inventory",
      });
      return;
    }

    const { id } = req.params;

    const product = await Product.findById(id)
      .select(
        "_id name slug sku price comparePrice stock images isActive variants createdAt updatedAt"
      )
      .lean();

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
    console.error("GET STAFF INVENTORY PRODUCT ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to load inventory product",
    });
  }
};


/*
|--------------------------------------------------------------------------
| UPDATE PRODUCT STOCK
|--------------------------------------------------------------------------
| PATCH /api/staff/inventory/:id/stock
|
| Permission:
| inventory.update
|
| Body:
| {
|   "stock": 25
| }
|--------------------------------------------------------------------------
*/

export const updateStaffInventoryStock = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.userId || !req.role) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const permissions = req.permissions || [];

    const canUpdateInventory =
      req.role === "superadmin" ||
      permissions.includes("inventory.update");

    if (!canUpdateInventory) {
      res.status(403).json({
        success: false,
        message: "You do not have permission to update inventory",
      });
      return;
    }

    const { id } = req.params;

    const { stock } = req.body;

    /*
    |--------------------------------------------------------------------------
    | VALIDATE STOCK
    |--------------------------------------------------------------------------
    */

    if (stock === undefined || stock === null) {
      res.status(400).json({
        success: false,
        message: "Stock value is required",
      });
      return;
    }

    const numericStock = Number(stock);

    if (!Number.isInteger(numericStock)) {
      res.status(400).json({
        success: false,
        message: "Stock must be a whole number",
      });
      return;
    }

    if (numericStock < 0) {
      res.status(400).json({
        success: false,
        message: "Stock cannot be negative",
      });
      return;
    }

    /*
    |--------------------------------------------------------------------------
    | FIND PRODUCT
    |--------------------------------------------------------------------------
    */

    const product = await Product.findById(id);

    if (!product) {
      res.status(404).json({
        success: false,
        message: "Product not found",
      });
      return;
    }

    const previousStock = Number(product.stock || 0);

    /*
    |--------------------------------------------------------------------------
    | UPDATE STOCK
    |--------------------------------------------------------------------------
    */

    product.stock = numericStock;

    if (product.variants && product.variants.length > 0) {
      if (product.variants.length === 1) {
        product.variants[0].stock = numericStock;
      } else {
        const currentSum = product.variants.reduce(
          (sum: number, v: any) => sum + (Number(v.stock) || 0),
          0
        );

        if (currentSum === 0 && numericStock > 0) {
          const perVariant = Math.floor(numericStock / product.variants.length);
          const rem = numericStock % product.variants.length;
          product.variants.forEach((v: any, idx: number) => {
            v.stock = perVariant + (idx === 0 ? rem : 0);
          });
        } else if (numericStock === 0) {
          product.variants.forEach((v: any) => {
            v.stock = 0;
          });
        } else if (currentSum > 0) {
          const factor = numericStock / currentSum;
          let allocated = 0;
          product.variants.forEach((v: any, idx: number) => {
            if (idx === product.variants.length - 1) {
              v.stock = Math.max(0, numericStock - allocated);
            } else {
              const s = Math.round((Number(v.stock) || 0) * factor);
              v.stock = s;
              allocated += s;
            }
          });
        }
      }
    } else {
      product.variants = [
        {
          name: "Standard",
          sku: `${product.slug || product._id}-default`,
          price: product.price,
          stock: numericStock,
          attributes: new Map([["size", "Free Size"], ["color", "Standard"]]),
        } as any,
      ];
    }

    await product.save();

    /*
    |--------------------------------------------------------------------------
    | RETURN UPDATED PRODUCT
    |--------------------------------------------------------------------------
    */

    const updatedProduct = await Product.findById(product._id)
      .select(
        "_id name slug sku price comparePrice stock images isActive variants createdAt updatedAt"
      )
      .lean();

    res.status(200).json({
      success: true,

      message: "Stock updated successfully",

      stock: {
        previous: previousStock,
        current: numericStock,
        difference: numericStock - previousStock,
      },

      product: updatedProduct,
    });
  } catch (error) {
    console.error("UPDATE STAFF INVENTORY STOCK ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update stock",
    });
  }
};