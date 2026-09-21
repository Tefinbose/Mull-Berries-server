import { Response } from "express";
import mongoose from "mongoose";

import Address from "../models/Address";
import { AuthRequest } from "../middleware/authMiddleware";

export const getMyAddresses = async (
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

    const addresses = await Address.find({
      user: req.userId,
    }).sort({
      isDefault: -1,
      createdAt: -1,
    });

    res.status(200).json({
      success: true,
      addresses,
    });
  } catch (error) {
    console.error("GET ADDRESSES ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to get addresses",
    });
  }
};

export const getAddressById = async (
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

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid address ID",
      });
      return;
    }

    const address = await Address.findOne({
      _id: id,
      user: req.userId,
    });

    if (!address) {
      res.status(404).json({
        success: false,
        message: "Address not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      address,
    });
  } catch (error) {
    console.error("GET ADDRESS ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to get address",
    });
  }
};

export const createAddress = async (
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
      name,
      phone,
      addressLine1,
      addressLine2,
      landmark,
      city,
      state,
      pincode,
      country = "India",
      type = "home",
      isDefault = false,
    } = req.body;

    if (
      !name ||
      !phone ||
      !addressLine1 ||
      !city ||
      !state ||
      !pincode
    ) {
      res.status(400).json({
        success: false,
        message: "Please provide all required address fields",
      });
      return;
    }

    if (!/^\d{6}$/.test(String(pincode).trim())) {
      res.status(400).json({
        success: false,
        message: "Pincode must contain exactly 6 digits",
      });
      return;
    }

    const existingCount = await Address.countDocuments({
      user: req.userId,
    });

    const shouldBeDefault =
      existingCount === 0 || Boolean(isDefault);

    if (shouldBeDefault) {
      await Address.updateMany(
        {
          user: req.userId,
        },
        {
          $set: {
            isDefault: false,
          },
        }
      );
    }

    const address = await Address.create({
      user: req.userId,
      name: String(name).trim(),
      phone: String(phone).trim(),
      addressLine1: String(addressLine1).trim(),
      addressLine2: addressLine2
        ? String(addressLine2).trim()
        : undefined,
      landmark: landmark
        ? String(landmark).trim()
        : undefined,
      city: String(city).trim(),
      state: String(state).trim(),
      pincode: String(pincode).trim(),
      country: String(country).trim() || "India",
      type,
      isDefault: shouldBeDefault,
    });

    res.status(201).json({
      success: true,
      message: "Address created successfully",
      address,
    });
  } catch (error) {
    console.error("CREATE ADDRESS ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create address",
    });
  }
};

export const updateAddress = async (
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

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid address ID",
      });
      return;
    }

    const address = await Address.findOne({
      _id: id,
      user: req.userId,
    });

    if (!address) {
      res.status(404).json({
        success: false,
        message: "Address not found",
      });
      return;
    }

    const {
      name,
      phone,
      addressLine1,
      addressLine2,
      landmark,
      city,
      state,
      pincode,
      country,
      type,
      isDefault,
    } = req.body;

    if (
      pincode !== undefined &&
      !/^\d{6}$/.test(String(pincode).trim())
    ) {
      res.status(400).json({
        success: false,
        message: "Pincode must contain exactly 6 digits",
      });
      return;
    }

    if (isDefault === true) {
      await Address.updateMany(
        {
          user: req.userId,
          _id: { $ne: id },
        },
        {
          $set: {
            isDefault: false,
          },
        }
      );
    }

    if (name !== undefined) address.name = String(name).trim();
    if (phone !== undefined) address.phone = String(phone).trim();
    if (addressLine1 !== undefined) {
      address.addressLine1 = String(addressLine1).trim();
    }

    if (addressLine2 !== undefined) {
      address.addressLine2 = String(addressLine2).trim();
    }

    if (landmark !== undefined) {
      address.landmark = String(landmark).trim();
    }

    if (city !== undefined) address.city = String(city).trim();
    if (state !== undefined) address.state = String(state).trim();

    if (pincode !== undefined) {
      address.pincode = String(pincode).trim();
    }

    if (country !== undefined) {
      address.country = String(country).trim();
    }

    if (type !== undefined) address.type = type;

    if (isDefault !== undefined) {
      address.isDefault = Boolean(isDefault);
    }

    await address.save();

    res.status(200).json({
      success: true,
      message: "Address updated successfully",
      address,
    });
  } catch (error) {
    console.error("UPDATE ADDRESS ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update address",
    });
  }
};

export const deleteAddress = async (
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

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid address ID",
      });
      return;
    }

    const address = await Address.findOne({
      _id: id,
      user: req.userId,
    });

    if (!address) {
      res.status(404).json({
        success: false,
        message: "Address not found",
      });
      return;
    }

    const wasDefault = address.isDefault;

    await Address.deleteOne({
      _id: id,
      user: req.userId,
    });

    if (wasDefault) {
      const replacement = await Address.findOne({
        user: req.userId,
      }).sort({
        createdAt: -1,
      });

      if (replacement) {
        replacement.isDefault = true;
        await replacement.save();
      }
    }

    res.status(200).json({
      success: true,
      message: "Address deleted successfully",
    });
  } catch (error) {
    console.error("DELETE ADDRESS ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to delete address",
    });
  }
};

export const setDefaultAddress = async (
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

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid address ID",
      });
      return;
    }

    const address = await Address.findOne({
      _id: id,
      user: req.userId,
    });

    if (!address) {
      res.status(404).json({
        success: false,
        message: "Address not found",
      });
      return;
    }

    await Address.updateMany(
      {
        user: req.userId,
      },
      {
        $set: {
          isDefault: false,
        },
      }
    );

    address.isDefault = true;

    await address.save();

    res.status(200).json({
      success: true,
      message: "Default address updated",
      address,
    });
  } catch (error) {
    console.error("SET DEFAULT ADDRESS ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to set default address",
    });
  }
};