import mongoose, { Schema, Document, Model } from "mongoose";

// ─── Port Rule ───────────────────────────────────────────────────────────────
export interface IPortRule extends Document {
  _id: mongoose.Types.ObjectId;
  instanceId: mongoose.Types.ObjectId;
  port: number;
  protocol: "TCP" | "UDP";
  direction: "INBOUND" | "OUTBOUND";
  description?: string;
}
const portRuleSchema = new Schema<IPortRule>({
  instanceId: { type: Schema.Types.ObjectId, ref: "Instance", required: true },
  port: { type: Number, required: true },
  protocol: { type: String, enum: ["TCP", "UDP"], default: "TCP" },
  direction: { type: String, enum: ["INBOUND", "OUTBOUND"], default: "INBOUND" },
  description: { type: String },
});
portRuleSchema.index({ instanceId: 1 });
export const PortRule: Model<IPortRule> = mongoose.model<IPortRule>("PortRule", portRuleSchema);

// ─── Support Ticket ──────────────────────────────────────────────────────────
export interface ISupportTicket extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  subject: string;
  category: string;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  createdAt: Date;
  updatedAt: Date;
}
const supportTicketSchema = new Schema<ISupportTicket>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    subject: { type: String, required: true },
    category: { type: String, default: "General" },
    status: { type: String, enum: ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"], default: "OPEN" },
    priority: { type: String, enum: ["LOW", "MEDIUM", "HIGH", "URGENT"], default: "MEDIUM" },
  },
  { timestamps: true }
);
supportTicketSchema.index({ userId: 1, createdAt: -1 });
export const SupportTicket: Model<ISupportTicket> = mongoose.model<ISupportTicket>("SupportTicket", supportTicketSchema);

// ─── Ticket Message ──────────────────────────────────────────────────────────
export interface ITicketMessage extends Document {
  _id: mongoose.Types.ObjectId;
  ticketId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  content: string;
  isAdmin: boolean;
  createdAt: Date;
}
const ticketMessageSchema = new Schema<ITicketMessage>(
  {
    ticketId: { type: Schema.Types.ObjectId, ref: "SupportTicket", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, required: true },
    isAdmin: { type: Boolean, default: false },
  },
  { timestamps: true }
);
ticketMessageSchema.index({ ticketId: 1, createdAt: 1 });
export const TicketMessage: Model<ITicketMessage> = mongoose.model<ITicketMessage>("TicketMessage", ticketMessageSchema);

// ─── OTP ─────────────────────────────────────────────────────────────────────
export interface IOtp extends Document {
  _id: mongoose.Types.ObjectId;
  email: string;
  code: string;
  expiresAt: Date;
}
const otpSchema = new Schema<IOtp>({
  email: { type: String, required: true, lowercase: true },
  code: { type: String, required: true },
  expiresAt: { type: Date, required: true },
});
otpSchema.index({ email: 1 });
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const Otp: Model<IOtp> = mongoose.model<IOtp>("Otp", otpSchema);

// ─── Server Pool ─────────────────────────────────────────────────────────────
export interface IServerPool extends Document {
  _id: mongoose.Types.ObjectId;
  ip: string;
  rootUsername: string;
  rootPasswordHash: string;
  type: "RDP" | "VPS";
  status: "AVAILABLE" | "ASSIGNED" | "OFFLINE";
  location: string;
  assignedInstanceId?: mongoose.Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
}
const serverPoolSchema = new Schema<IServerPool>(
  {
    ip: { type: String, required: true, unique: true },
    rootUsername: { type: String, required: true },
    rootPasswordHash: { type: String, required: true },
    type: { type: String, enum: ["RDP", "VPS"], required: true },
    status: { type: String, enum: ["AVAILABLE", "ASSIGNED", "OFFLINE"], default: "AVAILABLE" },
    location: { type: String, default: "US-East" },
    assignedInstanceId: { type: Schema.Types.ObjectId, ref: "Instance" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);
export const ServerPool: Model<IServerPool> = mongoose.model<IServerPool>("ServerPool", serverPoolSchema);
