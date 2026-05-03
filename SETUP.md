# Biocare Service Management System — Setup Guide

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Supabase (FREE)

1. Go to https://supabase.com and create a free account
2. Create a new project (choose any name, remember the DB password)
3. Wait for project to initialize (~2 minutes)
4. Go to **SQL Editor** → **New Query**
5. Copy the entire contents of `supabase/schema.sql` and paste it
6. Click **Run** — this creates all tables, policies, and seed data

### 3. Get Your Supabase Keys

1. In Supabase dashboard → **Settings** → **API**
2. Copy:
   - **Project URL** (starts with `https://...supabase.co`)
   - **anon public** key (under API Keys)

### 4. Create Environment File
```bash
cp .env.example .env
```
Edit `.env` and fill in:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 5. Create Your First Admin User

1. In Supabase dashboard → **Authentication** → **Users** → **Add User**
2. Enter email and password
3. After creation, go to **Table Editor** → **profiles**
4. Find the new user and change `role` to `admin`

### 6. Start the App
```bash
npm run dev
```
Open http://localhost:5173 in your browser

---

## Color Code System
- 🟢 **Green** = Cash Sale — customer pays for service
- 🟠 **Orange** = Placement — Biocare covers all service costs
- 🔵 **Blue** = Hire Purchase — free during payments, chargeable after completion

## Importing Equipment from Excel

1. Login as admin
2. Go to **Equipment** → **Import Excel**
3. Upload the Biocare template (.xlsx)
4. The system reads each sheet (sheet name = equipment model)
5. Preview the data and click **Import**

**Template format:**
- Each sheet = equipment model (e.g., "DYMIND DH36")
- Row 1: Title (skipped)
- Row 2: Headers
- Row 3+: Data
- Columns: `FACILITY | EMAIL | PHONE NO. | CONTACT PERSON | S/N | STATUS | MODE OF AQUISITION`

---

## Deployment (Free)

### Deploy Frontend to Vercel
1. Push code to GitHub
2. Go to https://vercel.com → Import Project
3. Add environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
4. Deploy!

### Supabase handles the backend automatically (free tier)

---

## Android App

The Android app will be built with **Expo (React Native)** sharing:
- Same Supabase backend
- Same TypeScript types
- Same business logic

Install Expo CLI:
```bash
npm install -g @expo/cli
npx create-expo-app biocare-mobile --template
```

Connect to the same Supabase project using the same environment variables.

---

## Free Tier Limits

| Service | Free Limit |
|---------|-----------|
| Supabase Database | 500MB PostgreSQL |
| Supabase Auth | Unlimited users |
| Supabase Storage | 1GB for images |
| Vercel Frontend | Unlimited deployments |

This is more than enough for hundreds of equipment records and thousands of service logs.
