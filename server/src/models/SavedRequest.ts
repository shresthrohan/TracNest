import { Schema, model } from "mongoose";
import { idJson } from "./json.js";

const s = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    collectionId: { type: Schema.Types.ObjectId, required: true },
    name: { type: String, required: true },
    order: { type: Number, default: 0 },
    spec: { type: Schema.Types.Mixed, required: true }, // unredacted RequestSpec (carries real credentials)
  },
  { ...idJson, timestamps: true },
);
s.index({ userId: 1, collectionId: 1, order: 1 });
export const SavedRequest = model("SavedRequest", s);
