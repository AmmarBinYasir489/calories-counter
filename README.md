# Nourish

AI-assisted nutrition tracking with a reusable Personal Foods library.

## Production architecture

- Next.js App Router on Vercel
- Supabase Auth with email/password and Google OAuth
- Supabase PostgreSQL with row-level security
- Gemini Vision-ready meal analysis prompt

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Add your Supabase project URL and publishable key.
3. Apply `database/supabase_personal_foods.sql` to the intended Supabase project.
4. Configure these Supabase Auth redirect URLs:
   - `http://localhost:3000/auth/callback`
   - `https://YOUR_DOMAIN/auth/callback`
5. Run `npm install`, then `npm run dev`.

## Vercel

Set the three variables from `.env.example` for Production, Preview, and Development. Point `NEXT_PUBLIC_SITE_URL` to the environment's canonical URL. Attach the custom domain in Vercel after the first successful deployment.
