import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import clockRoutes from "./routes/clock.routes.js";
import eventsRoutes from "./routes/events.routes.js";
import reportRoutes from "./routes/report.routes.js";
import usersRoutes from "./routes/users.routes.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { prisma } from "./lib/prisma.js";

const app = express();
const PORT = process.env.PORT ?? 3000;

// ── Security Middleware ────────────────────────────────────
// Helmet sets secure HTTP headers (CSP, X-Frame-Options, etc.)
app.use(helmet());

// CORS — restrict to trusted origins in production
app.use(
  cors({
    origin: process.env.CORS_ORIGIN ?? "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
  })
);

// Rate limiting — prevent brute-force / DDoS
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per window
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please try again later." },
  })
);

// ── Body Parsing ───────────────────────────────────────────
// Limit payload size to prevent large-body attacks
app.use(express.json({ limit: "10kb" }));

// ── Request Logger ─────────────────────────────────────────
app.use((req, _res, next) => {
  const ts = new Date().toISOString();
  console.log(`${ts} ${req.method} ${req.url}`);
  next();
});

// ── Routes ─────────────────────────────────────────────────
app.use("/api/clock", clockRoutes);
app.use("/api/events", eventsRoutes);
app.use("/api/report", reportRoutes);
app.use("/api/users", usersRoutes);

// Health check
app.get("/", (_req, res) => {
  res.json({ status: "ok", service: "time-recording-system" });
});

// ── Error Handler (must be registered last) ────────────────
app.use(errorHandler);

// ── Start ──────────────────────────────────────────────────
const server = app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

// ── Graceful Shutdown ──────────────────────────────────────
const shutdown = async () => {
  console.log("Shutting down gracefully...");
  server.close();
  await prisma.$disconnect();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Catch unhandled rejections and uncaught exceptions
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  shutdown();
});
