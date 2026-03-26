import User from "../models/userModel.js";
import bcrypt from "bcryptjs";
import createToken from "../utils/createToken.js";

// POST /users/register
export const createUser = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password)
      return res.status(400).json({ error: "Please fill all the inputs." });

    const userExists = await User.findOne({ email });
    if (userExists) return res.status(400).json({ error: "User already exists" });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const newUser = new User({ username, email, password: hashedPassword });
    await newUser.save();

    createToken(res, newUser._id);
    res.status(201).json({ _id: newUser._id, username: newUser.username, email: newUser.email, isAdmin: newUser.isAdmin });
  } catch (error) {
    res.status(400).json({ error: "Invalid user data" });
  }
};

// POST /users/login
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    const existingUser = await User.findOne({ email });
    if (!existingUser) return res.status(401).json({ error: "Invalid email or password" });

    const isPasswordValid = await bcrypt.compare(password, existingUser.password);
    if (!isPasswordValid) return res.status(401).json({ error: "Invalid email or password" });

    createToken(res, existingUser._id);
    res.status(200).json({ _id: existingUser._id, username: existingUser.username, email: existingUser.email, isAdmin: existingUser.isAdmin });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// POST /users/logout
export const logoutCurrentUser = async (req, res) => {
  res.cookie("jwt", "", { httpOnly: true, expires: new Date(0) });
  res.status(200).json({ message: "Logged out successfully" });
};

// GET /users (admin)
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({});
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET /users/profile
export const getCurrentUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: "User not found." });
    res.json({ _id: user._id, username: user.username, email: user.email });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// PUT /users/profile
export const updateCurrentUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: "User not found" });

    user.username = req.body.username || user.username;
    user.email = req.body.email || user.email;
    if (req.body.password) {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(req.body.password, salt);
    }
    const updatedUser = await user.save();
    res.json({ _id: updatedUser._id, username: updatedUser.username, email: updatedUser.email, isAdmin: updatedUser.isAdmin });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// DELETE /users/:id (admin)
export const deleteUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found." });
    if (user.isAdmin) return res.status(400).json({ error: "Cannot delete admin user" });
    await User.deleteOne({ _id: user._id });
    res.json({ message: "User removed" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET /users/:id (admin)
export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// PUT /users/:id (admin)
export const updateUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    user.username = req.body.username || user.username;
    user.email = req.body.email || user.email;
    user.isAdmin = Boolean(req.body.isAdmin);
    const updatedUser = await user.save();
    res.json({ _id: updatedUser._id, username: updatedUser.username, email: updatedUser.email, isAdmin: updatedUser.isAdmin });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
