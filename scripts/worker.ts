import { startWorker } from "@/lib/jobs/worker";

startWorker().catch((err) => {
  console.error("AI job worker failed to start:", err);
  process.exit(1);
});
