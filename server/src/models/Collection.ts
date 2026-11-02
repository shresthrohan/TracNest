import { Schema, model } from "mongoose";
import { idJson } from "./json.js";

const s = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    name: { type: String, required: true },
    description: { type: String, default: "" },
  },
  { ...idJson, timestamps: true },
);
export const Collection = model("Collection", s);
