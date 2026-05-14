import mongoose, { Schema, Document, Model } from "mongoose";

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  email: string;
  passwordHash: string;
  name?: string;
  role: "USER" | "ADMIN";
  walletBalance: number;
  isVerified: boolean;
  googleId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    name: { type: String, trim: true },
    role: { type: String, enum: ["USER", "ADMIN"], default: "USER" },
    walletBalance: { type: Number, default: 0, min: 0 },
    isVerified: { type: Boolean, default: false },
    googleId: { type: String, sparse: true },
  },
  { timestamps: true }
);

userSchema.index({ email: 1 });

export const User: Model<IUser> = mongoose.model<IUser>("User", userSchema);
