import { Router } from "express";
import { User, Otp } from "../db/index.js";
import { hashPassword, verifyPassword, signToken, generateOtp } from "../lib/auth.js";
import { sendOtpEmail, sendPasswordResetEmail } from "../lib/mailer.js";
import { requireAuth } from "../middlewares/auth.js";
import { z } from "zod";
import { OAuth2Client } from "google-auth-library";
import { logger } from "../lib/logger.js";

const router = Router();

const ADMIN_EMAIL = "whytoxicz@gmail.com";

// Rate limiting (in-memory, use Redis in production)
const attempts = new Map<string, { count: number; resetAt: number }>();
function rateLimit(key: string, max = 5, windowMs = 15 * 60 * 1000): boolean {
  const now = Date.now();
  const rec = attempts.get(key);
  if (!rec || rec.resetAt < now) { attempts.set(key, { count: 1, resetAt: now + windowMs }); return true; }
  if (rec.count >= max) return false;
  rec.count++;
  return true;
}

async function trySendOtp(email: string, code: string, name: string): Promise<boolean> {
  try { await sendOtpEmail(email, code, name); return true; } catch (e) { logger.warn({ err: e, email }, "OTP email failed"); return false; }
}
async function trySendReset(email: string, code: string, name: string): Promise<boolean> {
  try { await sendPasswordResetEmail(email, code, name); return true; } catch (e) { logger.warn({ err: e, email }, "Reset email failed"); return false; }
}

function formatUser(u: InstanceType<typeof User>) {
  return {
    id: u._id.toString(),
    email: u.email,
    name: u.name,
    role: u.role,
    walletBalance: u.walletBalance,
    createdAt: u.createdAt.toISOString(),
  };
}

// ─── REGISTER ────────────────────────────────────────────────────────────────
const RegisterBody = z.object({
  email: z.string().email(),
  password: z.string().min(6, "Password must be at least 6 characters"),
  name: z.string().min(2, "Name must be at least 2 characters"),
});

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid input" });
    return;
  }
  const { email, password, name } = parsed.data;
  const emailLower = email.toLowerCase().trim();

  const existing = await User.findOne({ email: emailLower });
  if (existing) { res.status(400).json({ error: "Email already registered" }); return; }

  const passwordHash = hashPassword(password);
  const user = await User.create({ email: emailLower, passwordHash, name: name.trim(), role: "USER", isVerified: false });

  const code = generateOtp();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await Otp.deleteMany({ email: emailLower });
  await Otp.create({ email: emailLower, code, expiresAt });

  const sent = await trySendOtp(emailLower, code, name);
  if (!sent) {
    await User.deleteOne({ _id: user._id });
    await Otp.deleteMany({ email: emailLower });
    res.status(500).json({ error: "Failed to send verification email. Please check your email and try again." });
    return;
  }

  res.json({ message: "OTP sent to your email. Please verify to activate your account." });
});

// ─── VERIFY OTP ──────────────────────────────────────────────────────────────
const VerifyOtpBody = z.object({ email: z.string().email(), code: z.string().length(6) });

router.post("/auth/verify-otp", async (req, res): Promise<void> => {
  const parsed = VerifyOtpBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const { email, code } = parsed.data;
  const emailLower = email.toLowerCase().trim();

  if (!rateLimit(`verify:${emailLower}`, 5)) { res.status(429).json({ error: "Too many attempts. Try again in 15 minutes." }); return; }

  const otp = await Otp.findOne({ email: emailLower, code, expiresAt: { $gt: new Date() } });
  if (!otp) { res.status(400).json({ error: "Invalid or expired OTP. Please request a new one." }); return; }

  await Otp.deleteMany({ email: emailLower });
  const user = await User.findOneAndUpdate({ email: emailLower }, { isVerified: true }, { new: true });
  if (!user) { res.status(400).json({ error: "User not found" }); return; }

  // Auto-set admin role if admin email
  if (user.email === ADMIN_EMAIL && user.role !== "ADMIN") {
    user.role = "ADMIN";
    await user.save();
  }

  const token = signToken({ userId: user._id.toString(), role: user.role });
  res.json({ user: formatUser(user), token });
});

// ─── LOGIN ───────────────────────────────────────────────────────────────────
const LoginBody = z.object({ email: z.string().email(), password: z.string().min(1) });

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const { email, password } = parsed.data;
  const emailLower = email.toLowerCase().trim();

  if (!rateLimit(`login:${emailLower}`, 10)) { res.status(429).json({ error: "Too many login attempts. Try again in 15 minutes." }); return; }

  const user = await User.findOne({ email: emailLower });
  if (!user || !verifyPassword(password, user.passwordHash)) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  // If not verified, resend OTP and redirect to verification
  if (!user.isVerified) {
    const code = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await Otp.deleteMany({ email: emailLower });
    await Otp.create({ email: emailLower, code, expiresAt });
    await trySendOtp(emailLower, code, user.name ?? "");
    res.status(403).json({
      error: "Account not verified. A new OTP has been sent to your email.",
      requiresVerification: true,
      email: emailLower,
    });
    return;
  }

  // Auto-set admin role for admin email
  if (user.email === ADMIN_EMAIL && user.role !== "ADMIN") {
    user.role = "ADMIN";
    await user.save();
  }

  const token = signToken({ userId: user._id.toString(), role: user.role });
  res.json({ user: formatUser(user), token });
});

// ─── GOOGLE AUTH ──────────────────────────────────────────────────────────────
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

router.post("/auth/google", async (req, res): Promise<void> => {
  const { credential } = req.body;
  if (!credential) { res.status(400).json({ error: "Google credential required" }); return; }
  if (!process.env.GOOGLE_CLIENT_ID) { res.status(501).json({ error: "Google auth not configured" }); return; }

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.email) { res.status(400).json({ error: "Invalid Google token" }); return; }

    const emailLower = payload.email.toLowerCase();
    let user = await User.findOne({ email: emailLower });

    if (!user) {
      user = await User.create({
        email: emailLower,
        passwordHash: hashPassword(Math.random().toString(36)),
        name: payload.name || emailLower.split("@")[0],
        role: emailLower === ADMIN_EMAIL ? "ADMIN" : "USER",
        isVerified: true,
        googleId: payload.sub,
      });
    } else {
      if (!user.isVerified) { user.isVerified = true; }
      if (!user.googleId) { user.googleId = payload.sub; }
      if (emailLower === ADMIN_EMAIL && user.role !== "ADMIN") { user.role = "ADMIN"; }
      await user.save();
    }

    const token = signToken({ userId: user._id.toString(), role: user.role });
    res.json({ user: formatUser(user), token });
  } catch (err) {
    logger.error({ err }, "Google auth failed");
    res.status(401).json({ error: "Google authentication failed" });
  }
});

// ─── RESEND OTP ──────────────────────────────────────────────────────────────
router.post("/auth/request-otp", async (req, res): Promise<void> => {
  const { email } = req.body;
  if (!email) { res.status(400).json({ error: "Email required" }); return; }
  const emailLower = email.toLowerCase().trim();
  if (!rateLimit(`otp:${emailLower}`, 3, 10 * 60 * 1000)) { res.status(429).json({ error: "Too many OTP requests. Wait 10 minutes." }); return; }
  const user = await User.findOne({ email: emailLower });
  if (user) {
    const code = generateOtp();
    await Otp.deleteMany({ email: emailLower });
    await Otp.create({ email: emailLower, code, expiresAt: new Date(Date.now() + 10 * 60 * 1000) });
    await trySendOtp(emailLower, code, user.name ?? "");
  }
  res.json({ message: "If this email exists, an OTP has been sent." });
});

// ─── FORGOT PASSWORD ─────────────────────────────────────────────────────────
router.post("/auth/forgot-password", async (req, res): Promise<void> => {
  const { email } = req.body;
  if (!email) { res.status(400).json({ error: "Email required" }); return; }
  const emailLower = email.toLowerCase().trim();
  if (!rateLimit(`forgot:${emailLower}`, 3, 15 * 60 * 1000)) { res.status(429).json({ error: "Too many requests. Wait 15 minutes." }); return; }
  const user = await User.findOne({ email: emailLower });
  if (user) {
    const code = generateOtp();
    await Otp.deleteMany({ email: emailLower });
    await Otp.create({ email: emailLower, code, expiresAt: new Date(Date.now() + 15 * 60 * 1000) });
    await trySendReset(emailLower, code, user.name ?? "");
  }
  res.json({ message: "Password reset OTP has been sent." });
});

// ─── RESET PASSWORD ──────────────────────────────────────────────────────────
const ResetPasswordBody = z.object({
  email: z.string().email(),
  code: z.string().length(6),
  newPassword: z.string().min(6),
});

router.post("/auth/reset-password", async (req, res): Promise<void> => {
  const parsed = ResetPasswordBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input. Password must be at least 6 characters." }); return; }
  const { email, code, newPassword } = parsed.data;
  const emailLower = email.toLowerCase().trim();
  if (!rateLimit(`reset:${emailLower}`, 5)) { res.status(429).json({ error: "Too many attempts." }); return; }

  const otp = await Otp.findOne({ email: emailLower, code, expiresAt: { $gt: new Date() } });
  if (!otp) { res.status(400).json({ error: "Invalid or expired OTP" }); return; }
  await Otp.deleteMany({ email: emailLower });
  const user = await User.findOneAndUpdate(
    { email: emailLower },
    { passwordHash: hashPassword(newPassword), isVerified: true },
    { new: true }
  );
  if (!user) { res.status(400).json({ error: "User not found" }); return; }
  res.json({ message: "Password reset successfully. You can now log in." });
});

// ─── GET ME ──────────────────────────────────────────────────────────────────
router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const user = await User.findById(req.userId);
  if (!user) { res.status(401).json({ error: "User not found" }); return; }
  res.json(formatUser(user));
});

router.post("/auth/logout", (_req, res): void => { res.json({ message: "Logged out" }); });

export default router;
