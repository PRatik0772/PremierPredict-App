# Glassnik Mobile

A capability-based video platform for immersive eye-level experiences. Users share mobile video from their perspective; creators with `mobile.creator` capability can upload. Built as an Expo React Native app backed by the Glassnik NestJS API.

## Run & Operate

- `pnpm --filter @workspace/mobile run dev` — start the Expo dev server
- `pnpm --filter @workspace/api-server run dev` — run the local Express API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Environment Variables

- `EXPO_PUBLIC_API_URL` — Base URL of the Glassnik NestJS backend (e.g. `https://api.glassnik.com`). If not set, the app defaults to `https://api.glassnik.com`. Set this in Replit Secrets to point at your deployed backend.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- **Mobile**: Expo SDK 54, Expo Router (file-based routing), React Native 0.81
- **State**: React Query + React Context + AsyncStorage
- **API**: Express 5 (local scaffold) + Glassnik NestJS backend (external)
- **DB**: PostgreSQL + Drizzle ORM (local scaffold), Prisma + GCP (Glassnik backend)
- **Auth**: JWT + Refresh Token (via Glassnik `/auth/*` endpoints)
- Validation: Zod, API codegen: Orval (from OpenAPI spec)

## Where things live

- `artifacts/mobile/` — Expo mobile app
  - `app/auth/` — Login & Register screens
  - `app/(tabs)/` — Feed, Upload, Profile tabs
  - `app/video/[id].tsx` — Video detail/player screen
  - `context/AuthContext.tsx` — JWT auth state + AsyncStorage persistence
  - `lib/api.ts` — API client (base URL from `EXPO_PUBLIC_API_URL`)
  - `components/VideoCard.tsx` — Feed video card
  - `components/CapabilityBadge.tsx` — Capability badge
  - `constants/colors.ts` — Dark tech palette (black/electric blue)
- `artifacts/api-server/` — Express API server scaffold
- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for local API)

## Architecture decisions

- **Custom API client in `lib/api.ts`**: The Glassnik backend is a separate NestJS repo (not this monorepo's Express server), so `@workspace/api-client-react` generated hooks are not used for the mobile app. The mobile app uses a hand-written thin client with JWT auto-refresh.
- **AsyncStorage for auth**: Tokens and user data are stored in AsyncStorage, not SecureStore, for Expo Go compatibility in MVP.
- **FileReader for upload base64**: Video uploads use `fetch(uri) → blob → FileReader → base64` pipeline, compatible across Expo platforms without native dependencies.
- **Dark-first palette**: The color scheme uses a near-black background with electric blue primary — dark mode is the only theme since the product is media-focused.
- **Capability gating on client**: The Upload tab checks `mobile.creator` capability via `GET /me/capabilities` and shows a "Request Access" screen for non-creators.

## Product

Glassnik is an eye-level video platform. Mobile creators upload first-person perspective clips that appear in a public feed. Viewers discover and watch content from around the world. The capability system controls who can upload, go live, or access premium content.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- `EXPO_PUBLIC_API_URL` must point to a running Glassnik NestJS backend for API calls to work. Without it, the feed shows a "Cannot connect" error state with a retry button.
- The GCP service account JSON (`glassnik-7d5600b7230e_1784874746326.json`) must be placed in the backend directory alongside `.env` for video uploads to GCP to work.
- `expo-image-picker` permissions must be granted before picking videos for upload.
- expo-file-system is installed at v19.0.23 for Expo SDK 54 compatibility.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- Glassnik backend repo: https://github.com/ductri19122001/glassnik
- Database schema: `attached_assets/dbPSQL.txt` (in the attached_assets folder)
