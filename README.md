# Kenku Phrasebook

A mobile + web application for D&D players who play Kenku characters. Kenku can only speak in mimicry of phrases they've already heard — this app lets you log those phrases with rich metadata, search through them semantically, and play them back.

## Features

- **Log phrases** with emotion, accent, speaker info, and context
- **Record audio** of phrases you've heard (stored locally on device)
- **Auto-transcription** via on-device speech recognition (iOS/Android) or Web Speech API (browser)
- **Smart search** — TF-IDF vector search + FTS5 full-text search, combined and ranked
- **Tags** with custom colours for organising your phrasebook
- **Auto-suggestions** — emotion and tags suggested from transcribed text
- **Export** your data as JSON or ZIP (with audio recordings)
- **Import** from a previously exported file (merges, never overwrites)
- **Delete all data** from Settings
- **No account required** — everything stays on your device
- **Dark D&D fantasy theme**

## Getting Started

### Prerequisites

- Node.js 20+
- For native: Xcode (iOS) or Android Studio (Android)

### Install dependencies

```bash
npm install
```

### Run in development

**Web** (no native modules needed):
```bash
npm run web
```

**Native with Expo Go** (limited — no STT transcription):
```bash
npx expo start
```

**Native with Development Build** (full features including transcription):
```bash
# iOS
npx expo run:ios

# Android
npx expo run:android
```

### Build for production

```bash
npm install -g eas-cli
eas build --platform all
```

## Architecture

```
src/
├── db/             SQLite database: client, migrations, repositories
├── search/         TF-IDF engine + tokeniser + search orchestration
├── audio/          expo-av recording + file management
├── stt/            Platform-split speech-to-text (native/web)
├── export/         JSON and ZIP export/import
├── suggest/        Keyword-based emotion + tag suggestions
├── hooks/          React hooks for all data operations
├── context/        DatabaseContext (provides DB handle to the tree)
├── components/     UI components
└── constants/      Theme, emotions, accents

app/                Expo Router file-based screens
├── _layout.tsx     Root: DB init, splash, navigation shell
├── (tabs)/
│   ├── index.tsx   Phrasebook list + search
│   ├── capture.tsx Record + quick-add
│   └── settings.tsx Export, import, tags, danger zone
└── phrase/
    ├── [id].tsx    Detail / edit
    └── new.tsx     Manual add (modal)
```

### Database schema

| Table | Purpose |
|-------|---------|
| `phrases` | Core phrase log (text, emotion, accent, …) |
| `tags` | Named, coloured labels |
| `phrase_tags` | Many-to-many join |
| `tfidf_terms` | TF values per phrase (for vector search) |
| `phrases_fts` | FTS5 virtual table (for exact/prefix search) |
| `schema_migrations` | Migration version tracking |

### Adding a schema migration

Append to the `MIGRATIONS` array in `src/db/migrations.ts`:

```typescript
{
  version: 2,
  description: 'Add campaign_name column',
  up: async (db) => {
    await db.execAsync('ALTER TABLE phrases ADD COLUMN campaign_name TEXT;');
  },
}
```

### STT (Speech-to-Text)

| Platform | Backend | Requires |
|----------|---------|----------|
| iOS/Android | `@react-native-voice/voice` | Development build |
| Web | Web Speech API | Chrome/Edge/Safari |

Metro resolves `src/stt/stt.native.ts` on native and `src/stt/stt.web.ts` on web automatically.

### Search modes

| Mode | Description |
|------|-------------|
| Smart ✦ | TF-IDF cosine similarity — ranked by semantic relevance |
| Exact | FTS5 full-text search — prefix matching |

## Running tests

```bash
npm test
```

## Settings & data

- **Tag manager** — create, rename, delete tags
- **Export JSON** — phrases and tags, no audio
- **Export ZIP** — phrases, tags, and all audio files
- **Import** — merge from JSON or ZIP; existing phrases are skipped
- **Delete all data** — irreversible, requires confirmation

The donation link in Settings is configured by changing `DONATION_URL` in `app/(tabs)/settings.tsx`.

## License

MIT — see [LICENSE](LICENSE).