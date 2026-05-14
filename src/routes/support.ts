import { Router } from "express";
import { SupportTicket, TicketMessage, User } from "../db/index.js";
import { requireAuth } from "../middlewares/auth.js";
import { z } from "zod";

const router = Router();

const TICKET_CATEGORIES = ["General", "Billing", "Technical", "Server Issue", "Account", "Other"];

const CreateTicketBody = z.object({
  subject: z.string().min(5, "Subject must be at least 5 characters").max(200),
  message: z.string().min(10, "Message must be at least 10 characters").max(5000),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  category: z.string().optional(),
});

const ReplyBody = z.object({ message: z.string().min(1).max(5000) });

function fmtTicket(t: InstanceType<typeof SupportTicket>, email = "") {
  return {
    id: t._id.toString(),
    subject: t.subject,
    category: t.category,
    status: t.status,
    priority: t.priority,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    userId: t.userId.toString(),
    userEmail: email,
  };
}

// ─── LIST TICKETS ────────────────────────────────────────────────────────────
router.get("/support/tickets", requireAuth, async (req, res): Promise<void> => {
  const [tickets, user] = await Promise.all([
    SupportTicket.find({ userId: req.userId }).sort({ createdAt: -1 }),
    User.findById(req.userId),
  ]);
  res.json(tickets.map((t) => fmtTicket(t, user?.email ?? "")));
});

// ─── CREATE TICKET ───────────────────────────────────────────────────────────
router.post("/support/tickets", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateTicketBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid input" });
    return;
  }
  const { subject, message, priority, category } = parsed.data;
  const ticket = await SupportTicket.create({
    userId: req.userId,
    subject,
    category: category && TICKET_CATEGORIES.includes(category) ? category : "General",
    priority: priority ?? "MEDIUM",
    status: "OPEN",
  });
  await TicketMessage.create({
    ticketId: ticket._id,
    userId: req.userId,
    content: message,
    isAdmin: false,
  });
  const user = await User.findById(req.userId);
  res.json(fmtTicket(ticket, user?.email ?? ""));
});

// ─── GET TICKET DETAIL ───────────────────────────────────────────────────────
router.get("/support/tickets/:id", requireAuth, async (req, res): Promise<void> => {
  const ticket = await SupportTicket.findOne({ _id: req.params.id, userId: req.userId });
  if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return; }
  const [messages, user] = await Promise.all([
    TicketMessage.find({ ticketId: ticket._id }).sort({ createdAt: 1 }),
    User.findById(req.userId),
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
  res.json({ ...fmtTicket(ticket, user?.email ?? ""), messages: messagesWithAuthor });
});

// ─── REPLY ───────────────────────────────────────────────────────────────────
router.post("/support/tickets/:id/reply", requireAuth, async (req, res): Promise<void> => {
  const ticket = await SupportTicket.findOne({ _id: req.params.id, userId: req.userId });
  if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return; }
  const parsed = ReplyBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Message required" }); return; }
  await TicketMessage.create({ ticketId: ticket._id, userId: req.userId, content: parsed.data.message, isAdmin: false });
  ticket.updatedAt = new Date();
  await ticket.save();
  res.json({ message: "Reply added" });
});

// ─── GET CATEGORIES ──────────────────────────────────────────────────────────
router.get("/support/categories", (_req, res): void => {
  res.json(TICKET_CATEGORIES);
});

export default router;
