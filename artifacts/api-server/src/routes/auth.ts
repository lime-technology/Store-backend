// Auth routes: POST /signup and POST /login
// Users stored in memory. Passwords stored as plain text (simple/demo mode).
// JWT token is returned on successful login.

import { Router, type IRouter } from "express";
import jwt from "jsonwebtoken";
import { findUserByEmail, createUser } from "../lib/users.js";
import { JWT_SECRET } from "../middlewares/auth.js";

const router: IRouter = Router();

// POST /api/signup — Register a new user
router.post("/signup", (req, res) => {
  console.log("[POST /signup] New signup request");
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required." });
    return;
  }

  const existing = findUserByEmail(email);
  if (existing) {
    res.status(400).json({ error: "User with this email already exists." });
    return;
  }

  createUser(email, password);
  console.log(`[POST /signup] User created: ${email}`);
  res.status(201).json({ message: "User created successfully.", email });
});

// POST /api/login — Login and receive a JWT token
router.post("/login", (req, res) => {
  console.log("[POST /login] Login attempt");
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required." });
    return;
  }

  const user = findUserByEmail(email);
  if (!user || user.password !== password) {
    res.status(401).json({ error: "Invalid email or password." });
    return;
  }

  const token = jwt.sign({ email: user.email }, JWT_SECRET, {
    expiresIn: "24h",
  });

  console.log(`[POST /login] Login successful for: ${email}`);
  res.json({ token, email });
});

export default router;
