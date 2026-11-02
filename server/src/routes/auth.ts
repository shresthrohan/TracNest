import { Router, type Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { User } from "../models/User.js";
import { env } from "../config/env.js";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../utils/HttpError.js";
import { authLimiter } from "../middleware/limits.js";

const router = Router();
// compared against when the email is unknown, so login takes about as long either way
const DUMMY_HASH = "$2b$12$puR9gW/qLAD8TP9IRCmIg.VmYAcLxSpin5eM0Sv8zLyJyZYs2ZShW";
const WEEK = 7 * 24 * 3600 * 1000;
const cookieOpts = { httpOnly: true, sameSite: "lax" as const, secure: env.NODE_ENV === "production", path: "/" };

const limiter = authLimiter();

const setToken = (res: Response, id: string) =>
  res.cookie("tn_token", jwt.sign({ sub: id }, env.JWT_SECRET, { expiresIn: "7d" }), { ...cookieOpts, maxAge: WEEK });
const pub = (u: { id: string; name: string; email: string }) => ({ id: u.id, name: u.name, email: u.email });

const email = z.string().email().max(254);
const registerSchema = z.object({ name: z.string().trim().min(1).max(100), email, password: z.string().min(8).max(200) });
const loginSchema = z.object({ email, password: z.string().min(1).max(200) });
const patchSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8).max(200).optional(),
});

router.post("/register", limiter, async (req, res) => {
  const b = registerSchema.parse(req.body);
  if (await User.exists({ email: b.email.toLowerCase() })) throw new HttpError(409, "Email already registered", "EMAIL_TAKEN");
  const user = await User.create({ name: b.name, email: b.email, passwordHash: await bcrypt.hash(b.password, 12) }).catch((e) => {
    throw e?.code === 11000 ? new HttpError(409, "Email already registered", "EMAIL_TAKEN") : e; // lost the race to a concurrent register
  });
  setToken(res, user.id);
  res.status(201).json(pub(user));
});

router.post("/login", limiter, async (req, res) => {
  const b = loginSchema.parse(req.body);
  const user = await User.findOne({ email: b.email.toLowerCase() });
  const ok = await bcrypt.compare(b.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok)
    throw new HttpError(401, "Invalid email or password", "INVALID_CREDENTIALS");
  setToken(res, user.id);
  res.json(pub(user));
});

router.post("/logout", (_req, res) => {
  res.clearCookie("tn_token", cookieOpts);
  res.json({ ok: true });
});

router.get("/me", requireAuth, async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) throw new HttpError(401, "Not authenticated", "UNAUTHENTICATED");
  res.json(pub(user));
});

router.patch("/me", requireAuth, async (req, res) => {
  const b = patchSchema.parse(req.body);
  const user = await User.findById(req.userId);
  if (!user) throw new HttpError(401, "Not authenticated", "UNAUTHENTICATED");
  if (b.name) user.name = b.name;
  if (b.newPassword) {
    if (!b.currentPassword || !(await bcrypt.compare(b.currentPassword, user.passwordHash)))
      throw new HttpError(401, "Current password is incorrect", "INVALID_CREDENTIALS");
    user.passwordHash = await bcrypt.hash(b.newPassword, 12);
  }
  await user.save();
  res.json(pub(user));
});

export default router;
