import express from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import routes from "./routes/index.js";
import { logger } from "./lib/logger.js";

const app = express();

// Security and Middleware
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cors({
  origin: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
}));

app.use(pinoHttp({
  logger,
  serializers: {
    req: (req) => ({ id: req.id, method: req.method, url: req.url?.split("?")[0] }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
}));

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));
app.set("trust proxy", 1);

// API Routes
app.use("/api", routes);

// Base Route - Replacing JSON with UI
app.get("/", (_req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Techofy Cloud</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
            body { background-color: #020617; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; font-family: sans-serif; overflow: hidden; position: relative; }
            .bg-glow { position: absolute; width: 300px; height: 300px; background: rgba(59, 130, 246, 0.15); filter: blur(100px); border-radius: 50%; z-index: 0; }
            .card { background: rgba(15, 23, 42, 0.8); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 32px; padding: 48px 24px; text-align: center; max-width: 400px; width: 92%; z-index: 10; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7); }
        </style>
    </head>
    <body>
        <div class="bg-glow" style="top: -10%; left: -10%;"></div>
        <div class="bg-glow" style="bottom: -10%; right: -10%;"></div>

        <div class="card">
            <div class="mb-6 flex justify-center">
                <div class="w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                    <svg class="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                    </svg>
                </div>
            </div>

            <h1 class="text-3xl font-black text-white tracking-tight mb-1">Techofy</h1>
            <p class="text-blue-400 text-sm font-semibold tracking-widest uppercase mb-6">Cloud Infrastructure</p>

            <p class="text-slate-400 text-sm leading-relaxed mb-10 px-4">
                Advanced digital solutions and tech insights. Follow our journey on Telegram for exclusive updates.
            </p>

            <a href="https://Techofy.xyz" target="_blank" class="flex items-center justify-center w-full py-4 bg-white text-black font-bold rounded-2xl hover:bg-blue-50 transition-all active:scale-95 shadow-xl">
                Join Techofy
            </a>
            
            <p class="mt-6 text-[10px] text-slate-600 uppercase tracking-[0.2em]">Status: Online • v2.0.0</p>
        </div>
    </body>
    </html>
  `);
});

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err }, "Unhandled error");
  res.status(500).json({ error: "Internal server error" });
});

export default app;
