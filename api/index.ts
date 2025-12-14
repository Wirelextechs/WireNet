import type { VercelRequest, VercelResponse } from "@vercel/node";
import express from "express";
import { registerRoutes } from "../server/routes";

process.env.NODE_ENV = "production";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = [
    "https://wire-net.vercel.app",
    "https://wire-net-git-main-wirenet.vercel.app",
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
  ].filter(Boolean) as string[];
  
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }
  next();
});

let initialized = false;
let initPromise: Promise<void> | null = null;

async function ensureInitialized() {
  if (initialized) return;
  if (!initPromise) {
    initPromise = (async () => {
      await registerRoutes(app);
      initialized = true;
    })();
  }
  await initPromise;
}

export default async (req: VercelRequest, res: VercelResponse) => {
  await ensureInitialized();
  return app(req, res);
};
