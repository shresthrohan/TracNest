process.env.JWT_SECRET ??= "test-secret-test-secret-test-secret-1234";
process.env.NODE_ENV = "test";
process.env.ALLOW_PRIVATE_TARGETS = "true"; // route tests hit a local http server
import { beforeAll, afterAll, afterEach } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

let mongo: MongoMemoryServer;
beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});
afterEach(async () => {
  for (const c of Object.values(mongoose.connection.collections)) await c.deleteMany({});
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});
