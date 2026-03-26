import express from "express";
import { createCategory, listCategory, getCategories } from "../controllers/categoryController.js";

const router = express.Router();

router.post("/", createCategory);
router.get("/", listCategory);
router.get("/categories", getCategories);

export default router;
