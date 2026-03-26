import jwt from "jsonwebtoken";
import mongoose from "mongoose";

// Inline User schema – order-service doesn't have its own user model file
// Uses sparse model registration to avoid OverwriteModelError in case of hot-reload
const UserModel =
  mongoose.models.User ||
  mongoose.model(
    "User",
    new mongoose.Schema({
      username: String,
      email: String,
      password: String,
      isAdmin: { type: Boolean, default: false },
    })
  );

export const authenticate = async (req, res, next) => {
  const token = req.cookies?.jwt;
  if (!token) return res.status(401).json({ error: "Not authorized, no token." });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await UserModel.findById(decoded.userId).select("-password");
    next();
  } catch (error) {
    res.status(401).json({ error: "Not authorized, token failed." });
  }
};

export const authorizeAdmin = (req, res, next) => {
  if (req.user?.isAdmin) return next();
  res.status(403).json({ error: "Not authorized as admin." });
};

