# Clarix

Expo Router app for turning pasted work into structured briefs and tasks with Supabase auth/storage.

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env` from `.env.example` and fill in your Supabase project values.

3. Apply Supabase migrations, including the new `brief_payload` migration.

4. Deploy the Edge Function and set function secrets:

```bash
supabase functions deploy summarize-email
supabase secrets set GEMINI_API_KEY=your-key
supabase secrets set GEMINI_MODEL=gemini-flash-latest
```

## Commands

```bash
npm run dev
npm run lint
npm run typecheck
```

## Architecture notes

- Gemini is called from the authenticated Supabase Edge Function at `supabase/functions/summarize-email`.
- Assistant briefs are stored in `chats.brief_payload` as structured JSON.
- Existing assistant chat rows still render through a fallback parser until all environments run the migration.
