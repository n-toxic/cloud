# Techofy Cloud — v2.0

Full-stack cloud hosting panel (Railway/VPS/cPanel ready).

## 🏗️ Structure

```
techofy-fixed/
├── backend/          ← Node.js + Express + MongoDB
│   └── src/
│       ├── db/models/   ← Mongoose models (auto-creates collections)
│       ├── routes/      ← All API routes
│       ├── lib/         ← Auth, mailer, logger
│       └── middlewares/ ← JWT auth middleware
└── frontend/         ← React + Vite + TailwindCSS (self-contained)
    └── src/
        ├── lib/api.ts   ← Full API client (no workspace deps)
        ├── lib/auth.tsx ← Auth context
        └── pages/       ← All pages
```

## 🚀 Quick Start

### Backend
```bash
cd backend
cp ../.env.example .env   # fill in your values
npm install
npm run dev               # development
npm run build && npm start # production
```

### Frontend
```bash
cd frontend
cp .env.example .env      # set VITE_API_URL
npm install
npm run dev               # development
npm run build             # production build
```

## ⚙️ Environment Variables

### Backend (.env)
| Variable | Description |
|----------|-------------|
| `MONGODB_URL` | MongoDB Atlas connection string |
| `JWT_SECRET` | Secret key for JWT tokens |
| `SMTP_HOST` | Email SMTP host (smtp.gmail.com) |
| `SMTP_USER` | Email address |
| `SMTP_PASS` | Gmail app password |
| `RAZORPAY_KEY_ID` | Razorpay key ID |
| `RAZORPAY_SECRET` | Razorpay secret |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID (optional) |

### Frontend (.env)
| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend URL |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth Client ID (optional) |
| `VITE_ADMIN_PANEL_PASSWORD` | Admin panel unlock password (default: Toxic) |

## 🔐 Admin Access

- Admin is restricted to **whytoxicz@gmail.com** only
- Visit `/admin-login` and enter panel password (default: `Toxic`)
- Then login with admin email + password

## 🐛 Bugs Fixed

- ✅ "Invalid Date" in transactions — MongoDB timestamps always set
- ✅ "Deployment failed" — Fixed planId-based deploy API
- ✅ "Failed to create ticket" — MongoDB eliminates missing-column errors
- ✅ Double login bug — Proper OTP redirect on unverified accounts
- ✅ OTP email failures — Graceful error handling, no crash
- ✅ 500 Internal Server Error on /api/transactions — MongoDB query fix
- ✅ Transaction colors — + Green for deposits, - Red for deductions
- ✅ PENDING deposits shown as FAILED (not pending)
- ✅ Dashboard cards are now clickable (navigate to correct tabs)
- ✅ Mobile billing UI — custom amount visible, pay button at bottom
- ✅ Dashboard is scrollable — overflow-y-auto on main content

## 🆕 New Features

- ✅ Google OAuth (Configure GOOGLE_CLIENT_ID)
- ✅ Profile page — change name and password
- ✅ Custom credentials on deploy (username + password)
- ✅ Domain-based hostnames: `techofy-xxx.i.edev.fun`
- ✅ Admin password reset (no OTP needed)
- ✅ Support ticket categories (General, Billing, Technical, etc.)
- ✅ iOS-style loading spinners throughout
- ✅ "© 2026 All rights reserved by Techofy" on all pages

## 🌐 Deployment

### Railway
1. Push to GitHub
2. Create new Railway project → Deploy from GitHub
3. Add environment variables
4. Backend auto-deploys on push

### Vercel (Frontend)
```bash
cd frontend && vercel --prod
```
Set `VITE_API_URL` to your backend Railway URL.

### VPS / cPanel
```bash
# Backend
pm2 start dist/index.js --name techofy-api

# Frontend — build and serve static files
npm run build
# Upload dist/ to public_html or serve with nginx
```

© 2026 All rights reserved by Techofy
