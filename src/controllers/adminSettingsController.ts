import { Request, Response } from "express";
import Settings from "../models/Settings";

export const getAdminSettings = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    let settings = await Settings.findOne();

    if (!settings) {
      settings = await Settings.create({});
    }

    res.status(200).json({
      success: true,
      settings,
    });
  } catch (error) {
    console.error("GET ADMIN SETTINGS ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to load settings",
    });
  }
};

export const updateAdminSettings = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const body = req.body;

    const updateData = {
      storeName:
        typeof body.storeName === "string"
          ? body.storeName.trim()
          : undefined,

      storeEmail:
        typeof body.storeEmail === "string"
          ? body.storeEmail.trim().toLowerCase()
          : undefined,

      storePhone:
        typeof body.storePhone === "string"
          ? body.storePhone.trim()
          : undefined,

      currency:
        typeof body.currency === "string"
          ? body.currency.trim().toUpperCase()
          : undefined,

      notifications: body.notifications
        ? {
            orders: Boolean(body.notifications.orders),
            payments: Boolean(body.notifications.payments),
            inventory: Boolean(body.notifications.inventory),
            shipping: Boolean(body.notifications.shipping),
            returns: Boolean(body.notifications.returns),
            abandoned: Boolean(body.notifications.abandoned),
          }
        : undefined,

      shipping: body.shipping
        ? {
            freeShipping: Boolean(body.shipping.freeShipping),
            threshold: Number(body.shipping.threshold) || 0,
            defaultPackageWeight:
              Number(body.shipping.defaultPackageWeight) || 0,
          }
        : undefined,

      payments: body.payments
        ? {
            razorpay: Boolean(body.payments.razorpay),
            cod: Boolean(body.payments.cod),
            codLimit: Number(body.payments.codLimit) || 0,
          }
        : undefined,

      rolePermissions: body.rolePermissions
        ? {
            "Super Admin":
              Array.isArray(body.rolePermissions["Super Admin"])
                ? body.rolePermissions["Super Admin"]
                : [],

            Manager:
              Array.isArray(body.rolePermissions.Manager)
                ? body.rolePermissions.Manager
                : [],

            Staff:
              Array.isArray(body.rolePermissions.Staff)
                ? body.rolePermissions.Staff
                : [],
          }
        : undefined,
    };

    Object.keys(updateData).forEach((key) => {
      const value = updateData[key as keyof typeof updateData];

      if (value === undefined) {
        delete updateData[key as keyof typeof updateData];
      }
    });

    const settings = await Settings.findOneAndUpdate(
      {},
      {
        $set: updateData,
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    );

    res.status(200).json({
      success: true,
      message: "Settings updated successfully",
      settings,
    });
  } catch (error) {
    console.error("UPDATE ADMIN SETTINGS ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update settings",
    });
  }
};