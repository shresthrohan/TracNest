import { Schema, model } from "mongoose";
import { idJson } from "./json.js";

const s = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    requestId: { type: Schema.Types.ObjectId, required: true },
    name: { type: String, required: true },
    assertions: { type: [Schema.Types.Mixed], default: [] },
    lastRun: { type: Schema.Types.Mixed },
  },
  { ...idJson, timestamps: true },
);
export const TestSuite = model("TestSuite", s);
