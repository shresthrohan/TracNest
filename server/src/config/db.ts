import mongoose from "mongoose";
import { env } from "./env.js";

export const connectDb = (uri = env.MONGO_URI) => mongoose.connect(uri);
