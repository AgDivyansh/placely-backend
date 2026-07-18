# Placely Backend

Node.js + Express + TypeScript + MongoDB backend for the Placely campus placement portal.

## What's inside

- **Auth** — signup, login (email / college ID / phone), JWT, password hashing, forgot/reset
- **Jobs** — CRUD, eligibility-aware listing
- **Applications** — apply (with server-side eligibility gate), withdraw, admin applicant management, stage moves, bulk actions
- **Companies, Alumni** — directory + detail
- **Bookmarks, Documents, Notifications, Profile** — student features
- **Announcements, Activity log, Analytics, Student Directory** — admin features
- **Multi-tenancy** — every record scoped by `collegeId`
- **Security** — helmet, CORS, rate limiting, validation (Zod), central error handling

---

## Prerequisites

- **Node.js 18+** — check with `node -v`
- **A MongoDB database** — either:
  - MongoDB Atlas (free cloud — recommended), or
  - MongoDB installed locally

---

## Step-by-step setup

### 1. Install dependencies
```bash
npm install
```

### 2. Get a MongoDB connection string

**Option A — MongoDB Atlas (recommended, free):**
1. Go to https://www.mongodb.com/atlas and create a free account
2. Create a free cluster (M0 tier)
3. Click **Connect** → **Drivers** → copy the connection string
4. It looks like: `mongodb+srv://user:<password>@cluster0.xxxxx.mongodb.net/`
5. Replace `<password>` with your database user's password
6. Add the database name before the `?`: `...mongodb.net/placely?retryWrites=true&w=majority`

Also: in Atlas → **Network Access** → add IP address `0.0.0.0/0` (allow from anywhere) for development.

**Option B — Local MongoDB:**
Use `mongodb://localhost:27017/placely`

### 3. Create your `.env` file
```bash
cp .env.example .env
```
Then open `.env` and fill in:
- `MONGODB_URI` — the string from step 2
- `JWT_SECRET` — generate one with:
  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
  ```
- `CORS_ORIGINS` — your frontend URL (default `http://localhost:5173` is fine for local dev)

### 4. Seed demo data
```bash
npm run seed
```
This creates a demo college, ~40 students, 8 companies, 8 jobs, applications, alumni, and announcements.

**Demo logins after seeding:**
- Student → `divyansh@gmail.com` / `placely2026`
- Admin → `divyansh@admin.com` / `placely2026`

### 5. Run the server
```bash
npm run dev
```
You should see:
```
✅ MongoDB connected
🚀 Placely API running on port 5000 [development]
```

### 6. Test it works
Open http://localhost:5000/health — you should see `{"success":true,"status":"ok",...}`

---

## Connecting your frontend

In your **frontend** `.env`:
```
VITE_USE_MOCK=false
VITE_API_BASE_URL=http://localhost:5000/api
```
Restart the frontend. It now talks to this backend instead of mock data.

> Note: the frontend's Redux slices other than auth may still call mock data
> directly. Those need to be wired to the API service layer — ask for that
> step separately.

---

## Deploying to production (Render — free tier)

1. Push this backend to a GitHub repo
2. Go to https://render.com → **New** → **Web Service**
3. Connect your repo
4. Settings:
   - **Build command:** `npm install && npm run build`
   - **Start command:** `npm start`
5. Add environment variables (from your `.env`):
   - `MONGODB_URI`, `JWT_SECRET`, `CORS_ORIGINS` (set to your Vercel frontend URL), `NODE_ENV=production`
6. Deploy → you get a URL like `https://placely-api.onrender.com`
7. Update your frontend's `VITE_API_BASE_URL` to `https://placely-api.onrender.com/api` and redeploy the frontend

---

## Project structure

```
src/
├── config/       env loading + DB connection
├── models/       Mongoose schemas (College, User, Company, Job, Application, ...)
├── modules/      feature modules (each: routes → controller → service → validation)
│   ├── auth/
│   ├── jobs/
│   ├── applications/
│   ├── catalog/     (companies, alumni)
│   ├── student/     (bookmarks, documents, notifications, profile)
│   └── admin/       (announcements, activity, analytics, students)
├── middleware/   auth guard, validation, error handler
├── utils/        AppError, http helpers, jwt, eligibility engine, activity logger
├── types/        shared TypeScript types
├── scripts/      seed.ts
├── app.ts        Express app assembly
└── server.ts     entry point
```

## API endpoints (all under `/api`)

| Method | Path | Role | Purpose |
|---|---|---|---|
| POST | `/auth/signup` | public | Register a student |
| POST | `/auth/login` | public | Login (email/collegeId/phone) |
| GET | `/auth/me` | any | Current user |
| POST | `/auth/forgot-password` | public | Request reset code |
| POST | `/auth/reset-password` | public | Reset with OTP |
| GET | `/jobs` | any | List jobs (eligibility-aware) |
| GET | `/jobs/:id` | any | Job detail |
| POST | `/jobs` | admin | Create job |
| PATCH | `/jobs/:id` | admin | Update job |
| DELETE | `/jobs/:id` | admin | Delete job |
| GET | `/applications` | student | My applications |
| POST | `/applications` | student | Apply (eligibility-gated) |
| DELETE | `/applications/:id` | student | Withdraw |
| GET | `/applicants/job/:jobId` | admin | Applicants for a job |
| PATCH | `/applicants/:id/stage` | admin | Move applicant stage |
| DELETE | `/applicants/:id` | admin | Revoke application |
| PATCH | `/applicants/bulk-advance` | admin | Bulk advance |
| POST | `/applicants/bulk-revoke` | admin | Bulk revoke |
| GET | `/companies` `/companies/:id` | any | Companies |
| GET | `/alumni` `/alumni/:id` | any | Alumni |
| GET/PUT/DELETE | `/bookmarks` | student | Saved jobs |
| GET/POST/DELETE | `/documents` | student | Document vault |
| GET/PATCH | `/notifications` | any | Notifications |
| GET/PATCH | `/profile` | any | Profile |
| GET/POST/PATCH/DELETE | `/announcements` | read: any, write: admin | Announcements |
| GET | `/activity` | admin | Audit log |
| GET | `/analytics/overview` | admin | Dashboard KPIs |
| GET | `/students` `/students/:id` | admin | Student directory |
```
