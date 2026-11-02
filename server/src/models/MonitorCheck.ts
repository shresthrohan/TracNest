import { Schema, model } from "mongoose";
import { idJson } from "./json.js";

const s = new Schema(
  {
    monitorId: { type: Schema.Types.ObjectId, required: true },
    userId: { type: Schema.Types.ObjectId, required: true },
    ok: { type: Boolean, required: true },
    statusCode: Number,
    responseTime: { type: Number, required: true },
    error: { type: new Schema({ code: String, message: String }, { _id: false }) },
    anomaly: { type: Boolean, default: false },
    checkedAt: { type: Date, default: Date.now },
  },
  idJson,
);
s.index({ monitorId: 1, checkedAt: -1 });
s.index({ userId: 1, checkedAt: -1 });
s.index({ checkedAt: 1 }, { expireAfterSeconds: 30 * 24 * 3600 });
export const MonitorCheck = model("MonitorCheck", s);
