// HTTP server entrypoint for the SupportAI API.
import { createApp } from "./app";
import { env } from "./config/env";

const server = createApp().listen(env.PORT, () => {
  console.log(JSON.stringify({ level: "info", message: "SupportAI API listening", port: env.PORT }));
});

let isShuttingDown = false;
function shutdown(signal: "SIGINT" | "SIGTERM") {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(JSON.stringify({ level: "info", message: "SupportAI API shutting down", signal }));
  server.close((error) => {
    if (error) process.exitCode = 1;
    process.exit();
  });
  setTimeout(() => process.exit(1), 5000).unref();
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
