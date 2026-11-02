import { createApp } from "./app.js";
import { connectDb } from "./config/db.js";
import { env } from "./config/env.js";
import { startScheduler } from "./jobs/scheduler.js";

await connectDb();
startScheduler();
createApp().listen(env.PORT, () => console.log(`TraceNest API listening on :${env.PORT}`));
