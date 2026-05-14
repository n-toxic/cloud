import mongoose from "mongoose";
import { logger } from "../lib/logger.js";

export async function connectDB(): Promise<void> {
  const uri = process.env.MONGODB_URL || process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URL environment variable is not set");
  await mongoose.connect(uri);
  logger.info("✅ MongoDB connected");
}

export * from "./models/User.js";
export * from "./models/Transaction.js";
export * from "./models/Instance.js";
export * from "./models/PortRule.js";
export * from "./models/SupportTicket.js";
export * from "./models/TicketMessage.js";
export * from "./models/Otp.js";
export * from "./models/ServerPool.js";
