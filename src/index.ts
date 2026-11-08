import index from "./index.html";
import { handleApi } from "./server/api";

const port = Number(process.env.PORT ?? 3000);

const server = Bun.serve({
  port,
  development: process.env.NODE_ENV !== "production",
  routes: {
    "/api/*": (request) => handleApi(request),
    "/*": index,
  },
  error(error) {
    console.error("[signal] unhandled server error", error);
    return Response.json({ error: "Interner Serverfehler" }, { status: 500 });
  },
});

console.log(`\n  Signal · Causal Monitoring Console`);
console.log(`  → ${server.url}`);
console.log(`  Mode: ${process.env.NINJA_MODE ?? "demo"} · API: ${server.url}api/health\n`);
