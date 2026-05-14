import { Router } from "express";
import crypto from "crypto";
import Razorpay from "razorpay";
import { User, Transaction, Instance, SupportTicket } from "../db/index.js";
import { requireAuth } from "../middlewares/auth.js";
import { z } from "zod";
import { hashPassword, verifyPassword } from "../lib/auth.js";

const router = Router();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "rzp_test_SmTIYm8Ve8ckv8",
  key_secret: process.env.RAZORPAY_SECRET || "52SqeA8LVmbDxSPZum75UTp1",
});

function formatTx(tx: InstanceType<typeof Transaction>) {
  return {
    id: tx._id.toString(),
    type: tx.type,
    amount: tx.amount,
    description: tx.description ?? "",
    status: tx.status,
    razorpayOrderId: tx.razorpayOrderId,
    date: tx.createdAt ? tx.createdAt.toISOString() : new Date().toISOString(),
  };
}

// ─── WALLET ──────────────────────────────────────────────────────────────────
router.get("/users/wallet", requireAuth, async (req, res): Promise<void> => {
  const user = await User.findById(req.userId);
  res.json({ balance: user?.walletBalance ?? 0, currency: "INR" });
});

// ─── DEPOSIT ─────────────────────────────────────────────────────────────────
const CreateDepositBody = z.object({ amount: z.number().min(10, "Minimum deposit ₹10") });

router.post("/users/deposit", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateDepositBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0]?.message }); return; }
  const { amount } = parsed.data;
  try {
    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100),
      currency: "INR",
      receipt: `rcpt_${Date.now()}`,
    });
    // Mark old PENDING deposits as FAILED before creating new one
    await Transaction.updateMany(
      { userId: req.userId, type: "DEPOSIT", status: "PENDING" },
      { status: "FAILED" }
    );
    await Transaction.create({
      userId: req.userId,
      amount,
      type: "DEPOSIT",
      description: "Wallet top-up via Razorpay",
      razorpayOrderId: order.id,
      status: "PENDING",
    });
    res.json({
      orderId: order.id,
      amount: amount * 100,
      currency: "INR",
      keyId: process.env.RAZORPAY_KEY_ID || "rzp_test_SmTIYm8Ve8ckv8",
    });
  } catch (err) {
    res.status(500).json({ error: "Payment gateway error. Please try again." });
  }
});

// ─── VERIFY DEPOSIT ──────────────────────────────────────────────────────────
const VerifyDepositBody = z.object({
  orderId: z.string(),
  paymentId: z.string(),
  signature: z.string(),
});

router.post("/users/deposit/verify", requireAuth, async (req, res): Promise<void> => {
  const parsed = VerifyDepositBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid payload" }); return; }
  const { orderId, paymentId, signature } = parsed.data;

  const secret = process.env.RAZORPAY_SECRET || "52SqeA8LVmbDxSPZum75UTp1";
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(`${orderId}|${paymentId}`);
  const expected = hmac.digest("hex");
  if (expected !== signature) { res.status(400).json({ error: "Payment verification failed" }); return; }

  const tx = await Transaction.findOne({ razorpayOrderId: orderId, userId: req.userId });
  if (!tx) { res.status(400).json({ error: "Transaction not found" }); return; }

  tx.status = "SUCCESS";
  tx.razorpayPaymentId = paymentId;
  await tx.save();

  await User.findByIdAndUpdate(req.userId, { $inc: { walletBalance: tx.amount } });
  res.json({ message: "Payment verified and wallet credited" });
});

// ─── PROFILE UPDATE ──────────────────────────────────────────────────────────
const UpdateProfileBody = z.object({
  name: z.string().min(2).optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(6).optional(),
});

router.put("/users/profile", requireAuth, async (req, res): Promise<void> => {
  const parsed = UpdateProfileBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0]?.message }); return; }
  const { name, currentPassword, newPassword } = parsed.data;

  const user = await User.findById(req.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  if (name) user.name = name;

  if (currentPassword && newPassword) {
    if (!verifyPassword(currentPassword, user.passwordHash)) {
      res.status(400).json({ error: "Current password is incorrect" });
      return;
    }
    user.passwordHash = hashPassword(newPassword);
  }

  await user.save();
  res.json({
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    role: user.role,
    walletBalance: user.walletBalance,
    createdAt: user.createdAt.toISOString(),
  });
});

// ─── TRANSACTIONS ────────────────────────────────────────────────────────────
router.get("/transactions", requireAuth, async (req, res): Promise<void> => {
  const txs = await Transaction.find({ userId: req.userId }).sort({ createdAt: -1 }).limit(100);
  res.json(txs.map(formatTx));
});

// ─── DASHBOARD SUMMARY ───────────────────────────────────────────────────────
router.get("/dashboard/summary", requireAuth, async (req, res): Promise<void> => {
  const [user, instances, tickets] = await Promise.all([
    User.findById(req.userId),
    Instance.find({ userId: req.userId }),
    SupportTicket.find({ userId: req.userId }),
  ]);

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const txs = await Transaction.find({ userId: req.userId, type: "DEDUCTION", status: "SUCCESS", createdAt: { $gte: monthStart } });
  const monthlySpend = txs.reduce((sum, t) => sum + t.amount, 0);

  res.json({
    runningInstances: instances.filter((i) => i.status === "RUNNING").length,
    stoppedInstances: instances.filter((i) => i.status === "STOPPED").length,
    pendingInstances: instances.filter((i) => ["PENDING", "DEPLOYING"].includes(i.status)).length,
    totalInstances: instances.length,
    walletBalance: user?.walletBalance ?? 0,
    monthlySpend,
    openTickets: tickets.filter((t) => ["OPEN", "IN_PROGRESS"].includes(t.status)).length,
  });
});

export default router;
