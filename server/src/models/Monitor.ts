import { Schema, model } from "mongoose";
import { idJson } from "./json.js";

const s = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    name: { type: String, required: true },
    spec: { type: Schema.Types.Mixed, required: true }, // unredacted RequestSpec (carries real credentials)
    intervalSec: { type: Number, required: true },
    expectedStatus: { type: Number, default: 200 },
    active: { type: Boolean, default: true },
    nextRunAt: { type: Date, default: Date.now },
    lastCheckedAt: Date,
    lastStatusCode: Number,
    lastResponseTime: Number,
    currentStatus: { type: String, enum: ["pending", "up", "down"], default: "pending" },
  },
  { ...idJson, timestamps: true },
);
s.index({ active: 1, nextRunAt: 1 });
s.index({ userId: 1 });
export const Monitor = model("Monitor", s);
