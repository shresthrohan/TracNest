import { Schema, model, Types } from "mongoose";

const execSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    requestId: { type: Schema.Types.ObjectId },
    source: { type: String, enum: ["playground", "suite", "rerun"], required: true },
    request: { type: Schema.Types.Mixed, required: true }, // redacted RequestSpec
    ok: { type: Boolean, required: true }, // no error and status < 400
    statusCode: Number,
    responseTime: { type: Number, required: true },
    responseSize: { type: Number, default: 0 },
    responseBody: { type: String, default: "" },
    responseBodyTruncated: { type: Boolean, default: false },
    responseHeaders: { type: Schema.Types.Mixed, default: {} }, // redacted
    finalUrl: String, // redacted
    redirects: { type: [String], default: [] }, // redacted
    error: { type: new Schema({ code: String, message: String }, { _id: false }) },
    executedAt: { type: Date, default: Date.now },
  },
  {
    toJSON: {
      transform: (_d, r: Record<string, unknown>) => {
        r.id = String(r._id);
        delete r._id;
        delete r.__v;
        return r;
      },
    },
  },
);
execSchema.index({ userId: 1, executedAt: -1 });

export const Execution = model("Execution", execSchema);
export const oid = (s: string) => new Types.ObjectId(s);
