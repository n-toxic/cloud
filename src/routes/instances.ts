import { Router } from "express";
import { User, Instance, PortRule, Transaction } from "../db/index.js";
import { requireAuth } from "../middlewares/auth.js";
import { z } from "zod";

const router = Router();

const PLANS: Record<string, { ram: number; cpu: number; storage: number; os: string; monthlyCost: number }> = {
  "rdp-4":  { ram: 4,  cpu: 2, storage: 100, os: "Windows Server 2022", monthlyCost: 299 },
  "rdp-8":  { ram: 8,  cpu: 4, storage: 200, os: "Windows Server 2022", monthlyCost: 599 },
  "rdp-16": { ram: 16, cpu: 8, storage: 320, os: "Windows Server 2022", monthlyCost: 1199 },
  "rdp-32": { ram: 32, cpu: 16, storage: 640, os: "Windows Server 2022", monthlyCost: 2399 },
  "vps-4":  { ram: 4,  cpu: 2, storage: 80,  os: "Ubuntu 22.04 LTS",    monthlyCost: 249 },
  "vps-8":  { ram: 8,  cpu: 4, storage: 160, os: "Ubuntu 22.04 LTS",    monthlyCost: 499 },
  "vps-16": { ram: 16, cpu: 6, storage: 320, os: "Ubuntu 22.04 LTS",    monthlyCost: 999 },
  "vps-32": { ram: 32, cpu: 12, storage: 640, os: "Ubuntu 22.04 LTS",   monthlyCost: 2199 },
};

const DeployBody = z.object({
  planId: z.string(),
  customUsername: z.string().min(3).optional(),
  customPassword: z.string().min(6).optional(),
  location: z.string().optional(),
});

function fmt(i: InstanceType<typeof Instance>) {
  return {
    id: i._id.toString(),
    type: i.type,
    os: i.os,
    ram: i.ram,
    cpu: i.cpu,
    storage: i.storage,
    hostname: i.hostname,
    status: i.status,
    monthlyCost: i.monthlyCost,
    createdAt: i.createdAt.toISOString(),
    location: i.location || "US-East",
  };
}

// ─── LIST PLANS ──────────────────────────────────────────────────────────────
router.get("/plans", async (_req, res): Promise<void> => {
  res.json([
    { id: "rdp-4",  name: "RDP Starter",  type: "RDP", os: "Windows Server 2022", ram: 4,  cpu: 2,  storage: 100, monthlyCost: 299,  features: ["Full GUI Remote Desktop","Admin Access","4GB RAM","2 vCPU","100GB SSD","4 Gbps Speed"],              popular: false },
    { id: "rdp-8",  name: "RDP Pro",      type: "RDP", os: "Windows Server 2022", ram: 8,  cpu: 4,  storage: 200, monthlyCost: 599,  features: ["Full GUI Remote Desktop","Admin Access","8GB RAM","4 vCPU","200GB SSD","4 Gbps Speed","Daily Backups"], popular: true  },
    { id: "rdp-16", name: "RDP Business", type: "RDP", os: "Windows Server 2022", ram: 16, cpu: 8,  storage: 320, monthlyCost: 1199, features: ["Full GUI Remote Desktop","Admin Access","16GB RAM","8 vCPU","320GB SSD","Priority Support"],           popular: false },
    { id: "vps-4",  name: "VPS Starter",  type: "VPS", os: "Ubuntu 22.04 LTS",   ram: 4,  cpu: 2,  storage: 80,  monthlyCost: 249,  features: ["Root SSH Access","Ubuntu 22.04","4GB RAM","2 vCPU","80GB SSD","4 Gbps Speed"],                         popular: false },
    { id: "vps-8",  name: "VPS Pro",      type: "VPS", os: "Ubuntu 22.04 LTS",   ram: 8,  cpu: 4,  storage: 160, monthlyCost: 499,  features: ["Root SSH Access","Ubuntu 22.04","8GB RAM","4 vCPU","160GB SSD","Daily Backups"],                        popular: true  },
    { id: "vps-16", name: "VPS Business", type: "VPS", os: "Ubuntu 22.04 LTS",   ram: 16, cpu: 6,  storage: 320, monthlyCost: 999,  features: ["Root SSH Access","Ubuntu 22.04","16GB RAM","6 vCPU","320GB SSD","Priority Support"],                    popular: false },
  ]);
});

// ─── LIST INSTANCES ──────────────────────────────────────────────────────────
router.get("/instances", requireAuth, async (req, res): Promise<void> => {
  const instances = await Instance.find({ userId: req.userId }).sort({ createdAt: -1 });
  res.json(instances.map(fmt));
});

// ─── DEPLOY INSTANCE ─────────────────────────────────────────────────────────
router.post("/instances", requireAuth, async (req, res): Promise<void> => {
  const parsed = DeployBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid deployment parameters" });
    return;
  }
  const { planId, customUsername, customPassword, location } = parsed.data;

  const plan = PLANS[planId];
  if (!plan) { res.status(400).json({ error: "Invalid plan ID" }); return; }

  const planType = planId.startsWith("rdp") ? "RDP" : "VPS";

  const user = await User.findById(req.userId);
  if (!user) { res.status(401).json({ error: "User not found" }); return; }
  if (user.walletBalance < plan.monthlyCost) {
    res.status(402).json({ error: "Insufficient wallet balance. Please deposit funds." });
    return;
  }

  user.walletBalance -= plan.monthlyCost;
  await user.save();

  await Transaction.create({
    userId: req.userId,
    amount: plan.monthlyCost,
    type: "DEDUCTION",
    description: `${planType} ${plan.ram}GB ${plan.os} server deployment`,
    status: "SUCCESS",
  });

  const username = customUsername ?? (planType === "RDP" ? "TechofyUser" : "techofy");
  const instance = await Instance.create({
    userId: req.userId,
    type: planType,
    os: plan.os,
    ram: plan.ram,
    cpu: plan.cpu,
    storage: plan.storage,
    status: "PENDING",
    monthlyCost: plan.monthlyCost,
    location: location ?? "US-East",
    username,
    customPassword: customPassword,
  });

  // Default port rules
  await PortRule.insertMany([
    { instanceId: instance._id, port: planType === "RDP" ? 3389 : 22, protocol: "TCP", direction: "INBOUND", description: planType === "RDP" ? "Remote Desktop" : "SSH" },
    { instanceId: instance._id, port: 80, protocol: "TCP", direction: "INBOUND", description: "HTTP" },
    { instanceId: instance._id, port: 443, protocol: "TCP", direction: "INBOUND", description: "HTTPS" },
  ]);

  res.json(fmt(instance));
});

// ─── GET INSTANCE ────────────────────────────────────────────────────────────
router.get("/instances/:id", requireAuth, async (req, res): Promise<void> => {
  const instance = await Instance.findOne({ _id: req.params.id, userId: req.userId });
  if (!instance) { res.status(404).json({ error: "Instance not found" }); return; }
  const ports = await PortRule.find({ instanceId: instance._id });
  res.json({
    ...fmt(instance),
    ports: ports.map((p) => ({ id: p._id.toString(), port: p.port, protocol: p.protocol, description: p.description ?? "", direction: p.direction })),
  });
});

// ─── START/STOP/REBOOT ───────────────────────────────────────────────────────
router.post("/instances/:id/start", requireAuth, async (req, res): Promise<void> => {
  const i = await Instance.findOneAndUpdate({ _id: req.params.id, userId: req.userId }, { status: "RUNNING" }, { new: true });
  if (!i) { res.status(404).json({ error: "Instance not found" }); return; }
  res.json({ message: "Instance started" });
});

router.post("/instances/:id/stop", requireAuth, async (req, res): Promise<void> => {
  const i = await Instance.findOneAndUpdate({ _id: req.params.id, userId: req.userId }, { status: "STOPPED" }, { new: true });
  if (!i) { res.status(404).json({ error: "Instance not found" }); return; }
  res.json({ message: "Instance stopped" });
});

router.post("/instances/:id/reboot", requireAuth, async (req, res): Promise<void> => {
  const i = await Instance.findOneAndUpdate({ _id: req.params.id, userId: req.userId }, { status: "DEPLOYING" }, { new: true });
  if (!i) { res.status(404).json({ error: "Instance not found" }); return; }
  setTimeout(async () => {
    await Instance.findByIdAndUpdate(req.params.id, { status: "RUNNING" });
  }, 15000);
  res.json({ message: "Instance is rebooting" });
});

// ─── CREDENTIALS ─────────────────────────────────────────────────────────────
router.get("/instances/:id/credentials", requireAuth, async (req, res): Promise<void> => {
  const i = await Instance.findOne({ _id: req.params.id, userId: req.userId });
  if (!i) { res.status(404).json({ error: "Instance not found" }); return; }
  // Use domain hostname instead of raw IP
  const hostname = i.hostname ?? `pending-${i._id}.i.edev.fun`;
  res.json({
    hostname,
    username: i.username ?? "techofy",
    password: i.customPassword ?? i.passwordHash ?? "Pending — admin will assign credentials shortly",
    port: i.type === "RDP" ? 3389 : 22,
    connectionString: i.type === "RDP"
      ? `mstsc /v:${hostname}`
      : `ssh ${i.username ?? "techofy"}@${hostname}`,
  });
});

// ─── PORTS ───────────────────────────────────────────────────────────────────
router.get("/instances/:id/ports", requireAuth, async (req, res): Promise<void> => {
  const i = await Instance.findOne({ _id: req.params.id, userId: req.userId });
  if (!i) { res.status(404).json({ error: "Instance not found" }); return; }
  const ports = await PortRule.find({ instanceId: i._id });
  res.json(ports.map((p) => ({ id: p._id.toString(), port: p.port, protocol: p.protocol, description: p.description ?? "", direction: p.direction })));
});

const AddPortBody = z.object({
  port: z.number().min(1).max(65535),
  protocol: z.enum(["TCP", "UDP"]).optional(),
  direction: z.enum(["INBOUND", "OUTBOUND"]).optional(),
  description: z.string().optional(),
});

router.post("/instances/:id/ports", requireAuth, async (req, res): Promise<void> => {
  const i = await Instance.findOne({ _id: req.params.id, userId: req.userId });
  if (!i) { res.status(404).json({ error: "Instance not found" }); return; }
  const parsed = AddPortBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0]?.message }); return; }
  const rule = await PortRule.create({ instanceId: i._id, ...parsed.data, protocol: parsed.data.protocol ?? "TCP", direction: parsed.data.direction ?? "INBOUND" });
  res.json({ id: rule._id.toString(), port: rule.port, protocol: rule.protocol, description: rule.description ?? "", direction: rule.direction });
});

router.delete("/instances/:id/ports/:portId", requireAuth, async (req, res): Promise<void> => {
  const i = await Instance.findOne({ _id: req.params.id, userId: req.userId });
  if (!i) { res.status(404).json({ error: "Instance not found" }); return; }
  await PortRule.deleteOne({ _id: req.params.portId, instanceId: i._id });
  res.json({ message: "Port rule removed" });
});

export default router;
