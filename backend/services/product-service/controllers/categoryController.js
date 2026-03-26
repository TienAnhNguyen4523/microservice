import Category from "../models/categoryModel.js";

// Create Category (Optional for Admin)
export const createCategory = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required" });

    const existingCategory = await Category.findOne({ name });
    if (existingCategory) return res.status(400).json({ error: "Already exists" });

    const category = await new Category({ name }).save();
    res.json(category);
  } catch (error) {
    res.status(400).json(error);
  }
};

// Get All Categories
export const listCategory = async (req, res) => {
  try {
    const all = await Category.find({});
    res.json(all);
  } catch (error) {
    res.status(400).json(error.message);
  }
};

// Currently, frontend expects GET /api/category/categories to return a list
export const getCategories = async (req, res) => {
  try {
    const categories = await Category.find({});
    res.json(categories);
  } catch (error) {
    res.status(400).json(error.message);
  }
};
