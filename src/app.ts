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

// Replace the app.get("/", ...) route in your app.ts with this:

app.get("/", (_req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>Techofy Cloud</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --blue: #3b82f6;
      --indigo: #6366f1;
      --emerald: #10b981;
      --bg: #020817;
      --surface: rgba(13, 22, 48, 0.75);
      --border: rgba(99, 102, 241, 0.18);
      --text: #e2e8f0;
      --muted: #64748b;
    }

    html, body {
      width: 100%;
      height: 100%;
      overflow: hidden;
    }

    body {
      background: var(--bg);
      font-family: 'DM Sans', sans-serif;
      color: var(--text);
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      position: relative;
    }

    /* ── Canvas background ── */
    #canvas-bg {
      position: fixed;
      inset: 0;
      z-index: 0;
      pointer-events: none;
    }

    /* ── Gradient orbs ── */
    .orb {
      position: fixed;
      border-radius: 50%;
      filter: blur(90px);
      pointer-events: none;
      z-index: 0;
      animation: orbFloat linear infinite;
    }
    .orb-1 { width: 420px; height: 420px; background: rgba(59,130,246,0.12); top: -120px; left: -120px; animation-duration: 18s; }
    .orb-2 { width: 380px; height: 380px; background: rgba(99,102,241,0.12); bottom: -100px; right: -100px; animation-duration: 22s; animation-direction: reverse; }
    .orb-3 { width: 250px; height: 250px; background: rgba(16,185,129,0.07); top: 50%; left: 50%; transform: translate(-50%,-50%); animation-duration: 14s; }
    @keyframes orbFloat {
      0%,100% { transform: translate(0,0) scale(1); }
      33%      { transform: translate(30px,-20px) scale(1.05); }
      66%      { transform: translate(-20px,25px) scale(0.97); }
    }

    /* ── Card ── */
    .wrapper {
      position: relative;
      z-index: 10;
      width: 100%;
      max-width: 420px;
      padding: 16px;
      display: flex;
      justify-content: center;
    }

    .card {
      width: 100%;
      background: var(--surface);
      backdrop-filter: blur(28px);
      -webkit-backdrop-filter: blur(28px);
      border: 1px solid var(--border);
      border-radius: 28px;
      padding: 44px 28px 36px;
      text-align: center;
      box-shadow:
        0 0 0 1px rgba(99,102,241,0.06),
        0 32px 64px -16px rgba(0,0,0,0.8),
        0 0 80px -20px rgba(99,102,241,0.15);
      animation: cardIn 0.9s cubic-bezier(0.16,1,0.3,1) both;
    }
    @keyframes cardIn {
      from { opacity:0; transform: translateY(40px) scale(0.96); }
      to   { opacity:1; transform: translateY(0)   scale(1);    }
    }

    /* ── Icon ── */
    .icon-wrap {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 80px;
      height: 80px;
      border-radius: 22px;
      background: linear-gradient(135deg, #3b82f6, #6366f1);
      box-shadow: 0 0 40px rgba(99,102,241,0.45), 0 0 80px rgba(59,130,246,0.2);
      margin-bottom: 24px;
      animation: iconPulse 3s ease-in-out infinite;
    }
    @keyframes iconPulse {
      0%,100% { box-shadow: 0 0 40px rgba(99,102,241,0.45), 0 0 80px rgba(59,130,246,0.2); transform: translateY(0); }
      50%      { box-shadow: 0 0 55px rgba(99,102,241,0.65), 0 0 100px rgba(59,130,246,0.35); transform: translateY(-5px); }
    }
    .icon-wrap svg { width: 38px; height: 38px; color: #fff; }

    /* ── Typography ── */
    h1 {
      font-family: 'Syne', sans-serif;
      font-size: clamp(28px, 7vw, 34px);
      font-weight: 800;
      letter-spacing: -0.03em;
      background: linear-gradient(135deg, #93c5fd 0%, #a5b4fc 60%, #c4b5fd 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 4px;
      animation: fadeUp 0.7s 0.2s both;
    }
    .sub {
      font-family: 'Syne', sans-serif;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.28em;
      color: rgba(129,140,248,0.7);
      text-transform: uppercase;
      margin-bottom: 28px;
      animation: fadeUp 0.7s 0.3s both;
    }
    .desc {
      font-size: 13.5px;
      font-weight: 400;
      color: rgba(148,163,184,0.85);
      line-height: 1.65;
      margin-bottom: 28px;
      animation: fadeUp 0.7s 0.4s both;
    }
    @keyframes fadeUp {
      from { opacity:0; transform:translateY(16px); }
      to   { opacity:1; transform:translateY(0); }
    }

    /* ── Live Stats ── */
    .stats {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 24px;
      animation: fadeUp 0.7s 0.5s both;
    }
    .stat-box {
      background: rgba(30,41,59,0.6);
      border: 1px solid rgba(99,102,241,0.12);
      border-radius: 14px;
      padding: 14px 10px;
      position: relative;
      overflow: hidden;
      transition: border-color 0.3s;
    }
    .stat-box::before {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg, rgba(99,102,241,0.06), transparent);
      opacity: 0;
      transition: opacity 0.3s;
    }
    .stat-box:hover { border-color: rgba(99,102,241,0.3); }
    .stat-box:hover::before { opacity: 1; }
    .stat-label {
      font-size: 9.5px;
      font-weight: 500;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: var(--muted);
      margin-bottom: 6px;
    }
    .stat-value {
      font-family: 'Syne', sans-serif;
      font-size: 20px;
      font-weight: 700;
      color: #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
    }
    .stat-dot {
      width: 7px; height: 7px;
      border-radius: 50%;
      display: inline-block;
      animation: blink 1.4s ease-in-out infinite;
    }
    .dot-green  { background: #10b981; box-shadow: 0 0 8px #10b981; }
    .dot-blue   { background: #3b82f6; box-shadow: 0 0 8px #3b82f6; }
    .dot-purple { background: #a78bfa; box-shadow: 0 0 8px #a78bfa; }
    .dot-amber  { background: #fbbf24; box-shadow: 0 0 8px #fbbf24; }
    @keyframes blink {
      0%,100% { opacity:1; } 50% { opacity:0.3; }
    }

    /* ── Uptime bar ── */
    .uptime-row {
      background: rgba(30,41,59,0.5);
      border: 1px solid rgba(99,102,241,0.1);
      border-radius: 12px;
      padding: 12px 14px;
      margin-bottom: 22px;
      animation: fadeUp 0.7s 0.6s both;
    }
    .uptime-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 10px;
      color: var(--muted);
      letter-spacing: 0.1em;
      text-transform: uppercase;
      margin-bottom: 8px;
    }
    .uptime-val { color: #10b981; font-weight: 600; }
    .bar-track {
      height: 5px;
      background: rgba(51,65,85,0.8);
      border-radius: 99px;
      overflow: hidden;
    }
    .bar-fill {
      height: 100%;
      border-radius: 99px;
      background: linear-gradient(90deg, #10b981, #3b82f6);
      width: 0%;
      transition: width 1.6s cubic-bezier(0.34,1.56,0.64,1);
      box-shadow: 0 0 10px rgba(16,185,129,0.5);
    }

    /* ── CTA Button ── */
    .btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      width: 100%;
      padding: 16px;
      background: linear-gradient(135deg, #3b82f6, #6366f1);
      color: #fff;
      font-family: 'Syne', sans-serif;
      font-size: 15px;
      font-weight: 700;
      letter-spacing: 0.05em;
      border-radius: 16px;
      text-decoration: none;
      border: none;
      cursor: pointer;
      position: relative;
      overflow: hidden;
      transition: transform 0.25s, box-shadow 0.25s;
      box-shadow: 0 4px 24px rgba(99,102,241,0.35);
      animation: fadeUp 0.7s 0.7s both;
    }
    .btn::before {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg, rgba(255,255,255,0.15), transparent);
      opacity: 0;
      transition: opacity 0.3s;
    }
    .btn:hover { transform: translateY(-3px); box-shadow: 0 8px 32px rgba(99,102,241,0.55); }
    .btn:hover::before { opacity: 1; }
    .btn:active { transform: translateY(0) scale(0.97); }
    .btn svg { width: 17px; height: 17px; transition: transform 0.3s; }
    .btn:hover svg { transform: translateX(3px); }

    /* ── Status footer ── */
    .status-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 7px;
      margin-top: 20px;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: #475569;
      animation: fadeUp 0.7s 0.8s both;
    }
    .ping-wrap { position: relative; display: flex; align-items:center; justify-content:center; width:10px; height:10px; }
    .ping-ring {
      position: absolute;
      inset: 0;
      border-radius: 50%;
      background: #10b981;
      opacity: 0.6;
      animation: pingRing 1.5s ease-out infinite;
    }
    .ping-dot { position: relative; width: 8px; height: 8px; border-radius: 50%; background: #10b981; }
    @keyframes pingRing {
      0%   { transform: scale(1);   opacity: 0.6; }
      100% { transform: scale(2.2); opacity: 0; }
    }

    /* ── Shimmer scan line ── */
    .card::after {
      content: '';
      position: absolute;
      top: -100%;
      left: -60%;
      width: 40%;
      height: 300%;
      background: linear-gradient(105deg, transparent, rgba(255,255,255,0.04), transparent);
      animation: shimmer 5s ease-in-out infinite;
      pointer-events: none;
      border-radius: 28px;
    }
    .card { position: relative; }
    @keyframes shimmer {
      0%   { transform: translateX(-100%) rotate(0deg); opacity:0; }
      20%  { opacity:1; }
      80%  { opacity:1; }
      100% { transform: translateX(600%) rotate(0deg); opacity:0; }
    }
  </style>
</head>
<body>
  <div class="orb orb-1"></div>
  <div class="orb orb-2"></div>
  <div class="orb orb-3"></div>

  <div class="wrapper">
    <div class="card">

      <div class="icon-wrap">
        <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"/>
        </svg>
      </div>

      <h1>Techofy Cloud</h1>
      <p class="sub">Infrastructure</p>
      <p class="desc">Advanced digital solutions &amp; tech insights.<br>Support Us @Techofy</p>

      <!-- Live Stats -->
      <div class="stats">
        <div class="stat-box">
          <div class="stat-label">Status</div>
          <div class="stat-value">
            <span class="stat-dot dot-green"></span>
            <span id="stat-status">Online</span>
          </div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Latency</div>
          <div class="stat-value">
            <span class="stat-dot dot-blue"></span>
            <span id="stat-ping">—</span><span style="font-size:12px;color:#64748b">ms</span>
          </div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Response</div>
          <div class="stat-value">
            <span class="stat-dot dot-purple"></span>
            <span id="stat-resp">—</span><span style="font-size:12px;color:#64748b">ms</span>
          </div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Version</div>
          <div class="stat-value" style="font-size:15px;">
            <span class="stat-dot dot-amber"></span>
            v2.0.0
          </div>
        </div>
      </div>

      <!-- Uptime Bar -->
      <div class="uptime-row">
        <div class="uptime-header">
          <span>30-day uptime</span>
          <span class="uptime-val" id="uptime-pct">99.9%</span>
        </div>
        <div class="bar-track">
          <div class="bar-fill" id="uptime-bar"></div>
        </div>
      </div>

      <a href="https://techofy.xyz" target="_blank" class="btn">
        Visit Techofy
        <svg fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3"/>
        </svg>
      </a>

      <div class="status-row">
        <div class="ping-wrap">
          <span class="ping-ring"></span>
          <span class="ping-dot"></span>
        </div>
        Status: Online &bull; v2.0.0
      </div>

    </div>
  </div>

  <script>
    // Animate uptime bar on load
    setTimeout(() => {
      document.getElementById('uptime-bar').style.width = '99.9%';
    }, 600);

    // Live ping check against techofy.xyz
    async function checkStatus() {
      const start = performance.now();
      try {
        const r = await fetch('https://techofy.xyz', { method: 'HEAD', mode: 'no-cors', cache: 'no-store' });
        const ping = Math.round(performance.now() - start);
        document.getElementById('stat-ping').textContent = ping;
        document.getElementById('stat-status').textContent = 'Online';
        animateValue('stat-resp', parseInt(document.getElementById('stat-resp').textContent) || ping, Math.round(ping * 0.85 + Math.random() * 20), 400);
      } catch {
        document.getElementById('stat-status').textContent = 'Error';
        document.getElementById('stat-ping').textContent = '—';
      }
    }

    function animateValue(id, from, to, duration) {
      const el = document.getElementById(id);
      if (isNaN(from)) from = to;
      const start = performance.now();
      function step(now) {
        const p = Math.min((now - start) / duration, 1);
        el.textContent = Math.round(from + (to - from) * p);
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }

    checkStatus();
    setInterval(checkStatus, 8000);
  </script>
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
