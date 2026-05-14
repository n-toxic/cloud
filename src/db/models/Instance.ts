import mongoose, { Schema, Document, Model } from "mongoose";

export interface IInstance extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  type: "RDP" | "VPS";
  os: string;
  ram: number;
  cpu: number;
  storage: number;
  hostname?: string;
  rawIp?: string;
  username?: string;
  passwordHash?: string;
  customPassword?: string;
  status: "PENDING" | "DEPLOYING" | "RUNNING" | "STOPPED" | "ERROR";
  monthlyCost: number;
  location: string;
  createdAt: Date;
  updatedAt: Date;
}

const instanceSchema = new Schema<IInstance>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["RDP", "VPS"], required: true },
    os: { type: String, required: true },
    ram: { type: Number, required: true },
    cpu: { type: Number, required: true },
    storage: { type: Number, required: true },
    hostname: { type: String },
    rawIp: { type: String },
    username: { type: String },
    passwordHash: { type: String },
    customPassword: { type: String },
    status: { type: String, enum: ["PENDING", "DEPLOYING", "RUNNING", "STOPPED", "ERROR"], default: "PENDING" },
    monthlyCost: { type: Number, required: true },
    location: { type: String, default: "US-East" },
  },
  { timestamps: true }
);

instanceSchema.index({ userId: 1, createdAt: -1 });

export const Instance: Model<IInstance> = mongoose.model<IInstance>("Instance", instanceSchema);
