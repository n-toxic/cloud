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

// Base Route - Replacing JSON with Animated UI
app.get("/", (_req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <title>Techofy Cloud</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
        <style>
            body { 
                background-color: #020617; 
                font-family: 'Inter', sans-serif;
                margin: 0;
                min-height: 100vh;
                width: 100vw;
                max-width: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
                overflow-x: hidden; /* Fixes the left-shift issue */
                overflow-y: hidden;
            }
            
            /* Background Glows */
            .glow-1 { position: absolute; width: 350px; height: 350px; background: rgba(59, 130, 246, 0.15); filter: blur(80px); border-radius: 50%; top: -10%; left: -10%; z-index: 0; animation: pulse 8s infinite alternate; pointer-events: none; }
            .glow-2 { position: absolute; width: 350px; height: 350px; background: rgba(99, 102, 241, 0.15); filter: blur(80px); border-radius: 50%; bottom: -10%; right: -10%; z-index: 0; animation: pulse 10s infinite alternate-reverse; pointer-events: none; }

            /* Animations */
            @keyframes pulse { 0% { opacity: 0.5; transform: scale(1); } 100% { opacity: 1; transform: scale(1.2); } }
            @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
            @keyframes fadeUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }

            .animate-float { animation: float 6s ease-in-out infinite; }
            .animate-fade-up { animation: fadeUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
            
            .card-wrapper {
                width: 100%;
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 10;
                padding: 0 20px;
                box-sizing: border-box;
            }

            .card { 
                background: rgba(15, 23, 42, 0.6); 
                backdrop-filter: blur(16px); 
                -webkit-backdrop-filter: blur(16px);
                border: 1px solid rgba(255, 255, 255, 0.08); 
                border-radius: 32px; 
                padding: 48px 24px; 
                text-align: center; 
                width: 100%; 
                max-width: 400px; 
                margin: 0 auto;
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7); 
            }

            .btn-hover { transition: all 0.3s ease; }
            .btn-hover:hover { transform: translateY(-3px); box-shadow: 0 10px 25px -5px rgba(255, 255, 255, 0.2); }
        </style>
    </head>
    <body class="relative text-white">
        
        <div class="glow-1"></div>
        <div class="glow-2"></div>

        <div class="card-wrapper">
            <div class="card animate-fade-up animate-float">
                <div class="mb-6 flex justify-center">
                    <div class="w-20 h-20 rounded-[1.5rem] bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-[0_0_30px_rgba(59,130,246,0.4)]">
                        <svg class="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"></path>
                        </svg>
                    </div>
                </div>

                <h1 class="text-[32px] font-extrabold tracking-tight mb-1 text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-indigo-400">
                    Techofy Cloud
                </h1>
                <p class="text-indigo-400/80 text-xs font-bold tracking-[0.25em] uppercase mb-8">Infrastructure</p>

                <p class="text-slate-400/90 text-sm leading-relaxed mb-10 px-2 font-medium">
                    Advanced digital solutions and tech insights. Support Us @Techofy
                </p>

                <a href="https://techofy.xyz" target="_blank" class="btn-hover flex items-center justify-center w-full py-4 bg-white text-slate-900 font-bold rounded-2xl active:scale-95">
                    Click Here
                </a>
                
                <div class="mt-8 flex items-center justify-center gap-2 text-[10px] text-slate-500 uppercase tracking-[0.15em] font-semibold">
                    <span class="relative flex h-2.5 w-2.5">
                    <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                    </span>
                    Status: Online • v2.0.0
                </div>
            </div>
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
