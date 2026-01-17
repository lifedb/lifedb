# LifeDB

A React Native app for context-aware file editing with Gemini AI integration.

## Features

- 📁 **File Management** - Create, edit, and organize markdown files
- 🤖 **Gemini AI** - Context-aware AI assistance for editing
- 📝 **Markdown Preview** - Toggle between edit and preview modes
- 💬 **Chat History** - View conversation logs with Gemini per file
- 🔄 **CRDT Sync** - Conflict-free editing (foundation implemented)
- ☁️ **Backup** - Local backup with restore capability
- 🔗 **GitHub** - OAuth integration for repo sync (in progress)

## Getting Started

```bash
npm install
npx expo start
```

## Configuration

### Gemini API Key
Set your API key in the app's Settings screen.

### GitHub OAuth (TODO)
To enable GitHub sync:
1. Create a GitHub OAuth App at https://github.com/settings/developers
2. Set callback URL to: `https://auth.expo.io/@danielsuo/lifedb`
3. Update `src/services/githubService.ts` with your credentials:
   - `GITHUB_CLIENT_ID`
   - `GITHUB_CLIENT_SECRET`

> **TODO**: Move credentials to environment variables or implement GitHub Device Flow (no secret needed on device).

## Deployment

```bash
./scripts/deploy.sh        # Local build + TestFlight
./scripts/deploy.sh --cloud # EAS cloud build + TestFlight
```

## License

Private