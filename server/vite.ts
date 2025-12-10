import express, { Express } from "express";
import { createServer as createViteServer, ViteDevServer } from "vite";

let vite: ViteDevServer;

export async function setupVite(app: Express, server: any) {
  vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });

  app.use(vite.middlewares);

  app.use("*", async (req, res) => {
    try {
      const url = req.originalUrl;
      const html = await vite.transformIndexHtml(
        url,
        `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>WireNet</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`
      );
      res.status(200).set({ "Content-Type": "text/html" }).end(html);
    } catch (e: any) {
      vite?.ssrFixStacktrace(e);
      console.log(e.stack);
      res.status(500).end(e.stack);
    }
  });
}

export function serveStatic(app: Express) {
  app.use(express.static("dist/public"));

  app.use("*", (req, res) => {
    res.sendFile("dist/public/index.html", { root: process.cwd() });
  });
}

export function log(message: string) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}
