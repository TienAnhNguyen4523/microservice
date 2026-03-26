import express from "express";
import * as user from "../controllers/userController.js";
import { authenticate, authorizeAdmin } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Public routes
router.post("/register", user.createUser);
router.post("/login", user.loginUser);
router.post("/logout", user.logoutCurrentUser);

// Protected routes
router.get("/profile", authenticate, user.getCurrentUserProfile);
router.put("/profile", authenticate, user.updateCurrentUserProfile);

// Admin routes
router.get("/", authenticate, authorizeAdmin, user.getAllUsers);
router.get("/:id", authenticate, authorizeAdmin, user.getUserById);
router.put("/:id", authenticate, authorizeAdmin, user.updateUserById);
router.delete("/:id", authenticate, authorizeAdmin, user.deleteUserById);

export default router;
