/**
 * Auth middleware for user-service.
 * Validates JWT from cookie and attaches user to request.
 */

import jwt from "jsonwebtoken";
import User from "../models/userModel.js";

export const authenticate = async (req, res, next) => {
  const token = req.cookies?.jwt;
  if (!token) return res.status(401).json({ error: "Not authorized, no token." });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.userId).select("-password");
    next();
  } catch (error) {
    res.status(401).json({ error: "Not authorized, token failed." });
  }
};

export const authorizeAdmin = (req, res, next) => {
  if (req.user?.isAdmin) return next();
  res.status(403).json({ error: "Not authorized as an admin." });
};
