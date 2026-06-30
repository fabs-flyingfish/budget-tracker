# 🏡 Home Budget Tracker

A personal budget tracker that auto-emails you and your partner on the 28th of every month.

---

## Deploy in 4 steps

### Step 1 — Set up Supabase (free)

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Create a new project (pick any name, e.g. "home-budget")
3. Once created, go to **SQL Editor** and run the contents of `supabase-setup.sql`
4. Go to **Project Settings > API** and copy:
   - Project URL → `VITE_SUPABASE_URL`
   - `anon` public key → `VITE_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_KEY`

### Step 2 — Set up Resend (free)

1. Go to [resend.com](https://resend.com) and create a free account
2. Go to **API Keys** and create a new key
3. Copy it → `RESEND_API_KEY`
4. Add and verify a sending domain (or use the Resend test domain to start)
5. Update the `from` address in `netlify/functions/send-budget-email.js` to match your domain

### Step 3 — Deploy to Netlify (free)

1. Push this project to a GitHub repo
2. Go to [netlify.com](https://netlify.com) and connect your GitHub repo
3. Build settings:
   - Build command: `npm run build`
   - Publish directory: `dist`
4. Go to **Site settings > Environment variables** and add all variables from `.env.example`
5. Deploy!

### Step 4 — Test the email

In Netlify, go to **Functions > send-budget-email** and trigger it manually to test the email sends correctly before waiting for the 28th.

---

## Environment variables

| Variable | Where to get it |
|---|---|
| `VITE_SUPABASE_URL` | Supabase > Project Settings > API |
| `VITE_SUPABASE_ANON_KEY` | Supabase > Project Settings > API |
| `SUPABASE_SERVICE_KEY` | Supabase > Project Settings > API |
| `RESEND_API_KEY` | resend.com > API Keys |
| `EMAIL_1` | Your email address |
| `EMAIL_2` | Ree's email address |

---

## What's included

- `src/BudgetApp.jsx` — the full React app
- `src/App.jsx` — data layer connecting to Supabase
- `src/supabase.js` — Supabase client
- `netlify/functions/send-budget-email.js` — scheduled email function
- `netlify.toml` — Netlify config with scheduled function
- `supabase-setup.sql` — database setup

---

## Future: adding more users

When you're ready to open this up to other households:

1. Enable Supabase Auth (email/password or Google login)
2. Replace `USER_ID = 'fabs'` in `App.jsx` with the logged-in user's ID
3. Update the RLS policy in Supabase to be user-specific
4. Add a login/signup screen
5. Add Stripe for subscriptions
