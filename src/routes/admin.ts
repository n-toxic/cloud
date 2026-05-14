import { Router } from "express";
import { User, Instance, Transaction, SupportTicket, TicketMessage, ServerPool } from "../db/index.js";
import { requireAuth, requireAdmin } from "../middlewares/auth.js";
import { z } from "zod";
import { hashPassword } from "../lib/auth.js";
import mongoose from "mongoose";

const router = Router();

// ─── STATS ───────────────────────────────────────────────────────────────────
router.get("/admin/stats", requireAuth, requireAdmin, async (_req, res): Promise<void> => {
  const [totalUsers, totalInstances, activeInstances, pendingInstances, openTickets, serverPoolAvailable] = await Promise.all([
    User.countDocuments(),
    Instance.countDocuments(),
    Instance.countDocuments({ status: "RUNNING" }),
    Instance.countDocuments({ status: "PENDING" }),
    SupportTicket.countDocuments({ status: "OPEN" }),
    ServerPool.countDocuments({ status: "AVAILABLE" }),
  ]);

  const allTx = await Transaction.find();
  const totalRevenue = allTx.filter((t) => t.type === "DEPOSIT" && t.status === "SUCCESS").reduce((s, t) => s + t.amount, 0);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const monthlyRevenue = allTx.filter((t) => t.type === "DEPOSIT" && t.status === "SUCCESS" && t.createdAt >= monthStart).reduce((s, t) => s + t.amount, 0);

  res.json({ totalUsers, totalInstances, activeInstances, pendingInstances, openTickets, serverPoolAvailable, totalRevenue, monthlyRevenue });
});

// ─── USERS ───────────────────────────────────────────────────────────────────
router.get("/admin/users", requireAuth, requireAdmin, async (_req, res): Promise<void> => {
  const users = await User.find().sort({ createdAt: -1 });
  const result = await Promise.all(
    users.map(async (u) => {
      const [instanceCount, txs] = await Promise.all([
        Instance.countDocuments({ userId: u._id }),
        Transaction.find({ userId: u._id, type: "DEDUCTION", status: "SUCCESS" }),
      ]);
      const totalSpent = txs.reduce((s, t) => s + t.amount, 0);
      return { id: u._id.toString(), email: u.email, name: u.name, role: u.role, walletBalance: u.walletBalance, instanceCount, totalSpent, isVerified: u.isVerified, createdAt: u.createdAt.toISOString() };
    })
  );
  res.json(result);
});

// ─── ADJUST WALLET ───────────────────────────────────────────────────────────
const AdjustWalletBody = z.object({ amount: z.number(), reason: z.string().min(1) });

router.put("/admin/users/:userId/wallet", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const parsed = AdjustWalletBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0]?.message }); return; }
  const user = await User.findById(req.params.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  const newBalance = Math.max(0, user.walletBalance + parsed.data.amount);
  user.walletBalance = newBalance;
  await user.save();
  await Transaction.create({
    userId: user._id,
    amount: Math.abs(parsed.data.amount),
    type: parsed.data.amount > 0 ? "DEPOSIT" : "DEDUCTION",
    description: `Manual Admin Credit: ${parsed.data.reason}`,
    status: "SUCCESS",
  });
  res.json({ message: `Wallet adjusted by ₹${parsed.data.amount}`, newBalance });
});

// ─── RESET USER PASSWORD (admin override, no OTP needed) ─────────────────────
router.put("/admin/users/:userId/password", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) { res.status(400).json({ error: "New password must be at least 6 characters" }); return; }
  const user = await User.findByIdAndUpdate(req.params.userId, { passwordHash: hashPassword(newPassword) }, { new: true });
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  res.json({ message: "Password updated successfully" });
});

// ─── ALL INSTANCES ───────────────────────────────────────────────────────────
router.get("/admin/instances", requireAuth, requireAdmin, async (_req, res): Promise<void> => {
  const instances = await Instance.find().sort({ createdAt: -1 });
  const result = await Promise.all(
    instances.map(async (i) => {
      const user = await User.findById(i.userId);
      return {
        id: i._id.toString(),
        userId: i.userId.toString(),
        userEmail: user?.email ?? "",
        type: i.type, os: i.os, ram: i.ram, cpu: i.cpu, storage: i.storage,
        hostname: i.hostname, rawIp: i.rawIp,
        status: i.status, monthlyCost: i.monthlyCost,
        createdAt: i.createdAt.toISOString(),
      };
    })
  );
  res.json(result);
});

// ─── ASSIGN INSTANCE (admin activates with IP/creds) ────────────────────────
const AssignInstanceBody = z.object({
  ip: z.string().min(7),
  username: z.string().min(1),
  password: z.string().min(1),
  hostname: z.string().optional(),
});

router.put("/admin/instances/:id/assign", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const parsed = AssignInstanceBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0]?.message }); return; }
  const { ip, username, password, hostname } = parsed.data;
  const generatedHostname = hostname ?? `techofy-${req.params.id.slice(-6)}.i.edev.fun`;
  const instance = await Instance.findByIdAndUpdate(req.params.id, {
    rawIp: ip, username, passwordHash: password,
    customPassword: password, hostname: generatedHostname, status: "RUNNING",
  }, { new: true });
  if (!instance) { res.status(404).json({ error: "Instance not found" }); return; }
  res.json({ message: "Instance credentials assigned and activated", hostname: generatedHostname });
});

// ─── ADMIN TICKETS ───────────────────────────────────────────────────────────
router.get("/admin/tickets", requireAuth, requireAdmin, async (_req, res): Promise<void> => {
  const tickets = await SupportTicket.find().sort({ createdAt: -1 });
  const result = await Promise.all(
    tickets.map(async (t) => {
      const user = await User.findById(t.userId);
      return { id: t._id.toString(), subject: t.subject, category: t.category, status: t.status, priority: t.priority, createdAt: t.createdAt.toISOString(), updatedAt: t.updatedAt.toISOString(), userId: t.userId.toString(), userEmail: user?.email ?? "" };
    })
  );
  res.json(result);
});

// Admin get ticket detail (for admin reply page)
router.get("/admin/tickets/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const ticket = await SupportTicket.findById(req.params.id);
  if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return; }
  const [messages, user] = await Promise.all([
    TicketMessage.find({ ticketId: ticket._id }).sort({ createdAt: 1 }),
    User.findById(ticket.userId),
  ]);
  const messagesWithAuthor = await Promise.all(
    messages.map(async (m) => {
      let authorName = "Support Team";
      if (!m.isAdmin) {
        const author = await User.findById(m.userId);
        authorName = author?.name ?? author?.email ?? "User";
      }
      return {
        id: m._id.toString(),
        content: m.content,
        isAdmin: m.isAdmin,
        createdAt: m.createdAt.toISOString(),
        authorName,
      };
    })
  );
  res.json({
    id: ticket._id.toString(),
    subject: ticket.subject,
    category: ticket.category,
    status: ticket.status,
    priority: ticket.priority,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
    userId: ticket.userId.toString(),
    userEmail: user?.email ?? "",
    messages: messagesWithAuthor,
  });
});

// ─── SERVER POOL EDIT / DELETE / PING ────────────────────────────────────────
router.put("/admin/server-pool/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const { ip, rootUsername, location } = req.body;
  const entry = await ServerPool.findByIdAndUpdate(
    req.params.id,
    { ...(ip && { ip }), ...(rootUsername && { rootUsername }), ...(location && { location }) },
    { new: true }
  );
  if (!entry) { res.status(404).json({ error: "Server not found" }); return; }
  res.json({ message: "Server updated", id: entry._id.toString(), ip: entry.ip });
});

router.delete("/admin/server-pool/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const entry = await ServerPool.findByIdAndDelete(req.params.id);
  if (!entry) { res.status(404).json({ error: "Server not found" }); return; }
  res.json({ message: "Server removed from pool" });
});

router.get("/admin/server-pool/:id/ping", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const entry = await ServerPool.findById(req.params.id);
  if (!entry) { res.status(404).json({ error: "Server not found" }); return; }
  // Use a basic TCP connect to port 22 (VPS) or 3389 (RDP) to check reachability
  const net = await import("net");
  const port = entry.type === "RDP" ? 3389 : 22;
  const reachable = await new Promise<boolean>((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(5000);
    socket.on("connect", () => { socket.destroy(); resolve(true); });
    socket.on("timeout", () => { socket.destroy(); resolve(false); });
    socket.on("error", () => { socket.destroy(); resolve(false); });
    socket.connect(port, entry.ip);
  });
  // Update status in DB
  await ServerPool.findByIdAndUpdate(req.params.id, { status: reachable ? (entry.status === "ASSIGNED" ? "ASSIGNED" : "AVAILABLE") : "OFFLINE" });
  res.json({ reachable, ip: entry.ip, port });
});
router.post("/admin/tickets/:id/reply", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const ticket = await SupportTicket.findById(req.params.id);
  if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return; }
  const { message } = req.body;
  if (!message) { res.status(400).json({ error: "Message required" }); return; }
  await TicketMessage.create({ ticketId: ticket._id, userId: new mongoose.Types.ObjectId(req.userId), content: message, isAdmin: true });
  ticket.status = "IN_PROGRESS";
  ticket.updatedAt = new Date();
  await ticket.save();
  res.json({ message: "Reply sent" });
});

// Close ticket
router.put("/admin/tickets/:id/status", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const { status } = req.body;
  const ticket = await SupportTicket.findByIdAndUpdate(req.params.id, { status }, { new: true });
  if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return; }
  res.json({ message: "Status updated" });
});

// ─── SERVER POOL ─────────────────────────────────────────────────────────────
router.get("/admin/server-pool", requireAuth, requireAdmin, async (_req, res): Promise<void> => {
  const pool = await ServerPool.find().sort({ createdAt: -1 });
  res.json(pool.map((s) => ({
    id: s._id.toString(),
    ip: s.ip, rootUsername: s.rootUsername, type: s.type,
    status: s.status, location: s.location, isActive: s.isActive,
    assignedInstanceId: s.assignedInstanceId?.toString(),
    addedAt: s.createdAt.toISOString(),
  })));
});

const AddServerBody = z.object({
  ip: z.string().min(7),
  rootUsername: z.string().min(1),
  rootPassword: z.string().min(1),
  type: z.enum(["RDP", "VPS"]),
  location: z.string().optional(),
});

router.post("/admin/server-pool", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const parsed = AddServerBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0]?.message }); return; }
  const { ip, rootUsername, rootPassword, type, location } = parsed.data;
  const entry = await ServerPool.create({
    ip, rootUsername,
    rootPasswordHash: hashPassword(rootPassword),
    type, location: location ?? "US-East",
    status: "AVAILABLE", isActive: true,
  });
  res.json({ id: entry._id.toString(), ip: entry.ip, rootUsername: entry.rootUsername, type: entry.type, status: entry.status, location: entry.location, addedAt: entry.createdAt.toISOString() });
});

export default router;
