# Mobile

Expo 50 + React Native 0.73 app for Forumo. Pre-alpha scaffold — navigation structure and project wiring exist but no functional screens have been implemented. Do not use this as a reference for production patterns.

## Tech stack

| | Version |
|---|---|
| Expo | 50.0.17 |
| React Native | 0.73.6 |
| React | 18.3.1 |
| React Navigation | 7.x (bottom-tabs + native-stack) |
| Async Storage | 3.x |
| expo-image-picker | 14.x |
| expo-notifications | 0.27.x |
| @forumo/shared | workspace |
| Jest / Detox | 29.x / 20.x |
| EAS Build | via `eas.json` |

## Run on simulator

```bash
# Install dependencies (from repo root first)
pnpm install

# Start Expo dev server
cd apps/mobile
pnpm start

# Open on iOS simulator
pnpm ios

# Open on Android emulator
pnpm android
```

Requires Expo CLI and either Xcode (iOS) or Android Studio (Android) to be installed. The API URL is configured in `app.config.ts` and reads from environment at build time.

## Build with EAS

```bash
# Development build (installs on device, supports hot reload)
pnpm build:dev

# Preview build
pnpm build:preview

# Production build
pnpm build:production
```

EAS profiles are in `eas.json`.

## Key environment variables

Set via `app.config.ts` `extra` field and EAS environment:
```
EXPO_PUBLIC_API_BASE_URL     # Backend API URL per channel (dev/preview/production)
```

## What exists

```
src/
├── App.tsx               # Root component — NavigationContainer + providers
├── api/                  # API integration (ForumoApiClient from @forumo/shared)
├── hooks/                # Custom hooks (scaffolded, mostly empty)
├── navigation/           # Bottom tab + stack navigator definitions
├── providers/            # Context providers (auth, etc.)
└── screens/              # Screen components — all placeholder/empty
```

## What does not exist

- No authentication flow (login, registration, session management)
- No listing browse or search screen
- No order management screen
- No messaging screen
- No profile screen
- No payment flow
- No push notification handling (library present, no implementation)
- No Async Storage session persistence (library present, not wired)
- No offline support

## Testing

```bash
# Unit tests
pnpm test

# Detox E2E (iOS simulator, headless)
pnpm test:detox
```

Detox config is in `package.json` under `"detox"` key. Detox E2E tests in `e2e/` are also scaffolded but empty.

## Known issues

- `app.config.ts` references environment variables that may not exist in all build environments — review before setting up EAS channels.
- Metro bundler is configured in `metro.config.js` to resolve `@forumo/shared` from the workspace. If you see module resolution errors, ensure the workspace symlinks are intact (`pnpm install` from root).
- Expo 50 has known incompatibilities with some React Navigation 7 features — test on a real device before declaring anything working.
- No error boundaries or crash reporting wired up.
