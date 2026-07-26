# Nourish

AI-assisted nutrition tracking with a reusable Personal Foods library.

## Production architecture

- Next.js App Router on Vercel
- Supabase Auth with email/password and Google OAuth
- Supabase PostgreSQL with row-level security
- Gemini meal-photo analysis with structured, validated nutrition output
- Private Supabase Storage with per-user image access

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Add your Supabase project URL, publishable key, and server-only Gemini key.
3. Apply both SQL files to the intended Supabase project:
   - `database/supabase_personal_foods.sql`
   - `database/supabase_meal_images.sql`
4. Confirm the private `meal-images` bucket exists in Supabase Storage.
5. Configure these Supabase Auth redirect URLs:
   - `http://localhost:3000/auth/callback`
   - `https://YOUR_DOMAIN/auth/callback`
6. Run `npm install`, then `npm run dev`.

## Vercel

Set the four variables from `.env.example` for Production, Preview, and Development. `GEMINI_API_KEY` must remain server-only. Point `NEXT_PUBLIC_SITE_URL` to the environment's canonical URL. Attach the custom domain in Vercel after the first successful deployment.
