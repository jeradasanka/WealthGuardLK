# Firebase Deployment Guide

## Live Application
**Production URL**: https://wealthguard.web.app

## Prerequisites
1. Install Firebase CLI: `npm install -g firebase-tools`
2. Login to Firebase: `firebase login`

## Initial Setup
1. Firebase project already configured: `wealthguard-f7c26`
2. `.firebaserc` contains the project configuration (gitignored for security)
3. `firebase.json` configures hosting settings (specifically targeted to deploy to `wealthguard` site under the default project)

## Build & Deploy

### Quick Deploy
```bash
# Build and deploy in one command
npx vite build && firebase deploy
```

### Step-by-Step Deploy
```bash
# 1. Build the production bundle
npx vite build

# 2. Deploy to Firebase Hosting
firebase deploy --only hosting
```

### Deploy Output
The build creates:
- Production bundle in `dist/` folder
- Optimized assets with cache headers
- Single-page app with proper routing

## Configuration Files

### firebase.json
```json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ],
    "headers": [
      {
        "source": "**/*.@(js|css)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "max-age=31536000"
          }
        ]
      }
    ]
  }
}
```

### .firebaserc (gitignored)
```json
{
  "projects": {
    "default": "wealthguard-f7c26"
  }
}
```

## Storage Architecture
- **localStorage**: All encrypted user data (Zustand store with automatic persistence)
- **No custom backend**: Fully client-side application running 100% in browser
- **Offline-first**: Works without internet after initial page load
- **Local Backup files**: `.wglk` format (WealthGuard LK custom encrypted backups)
- **Cloud Backup**: Google Drive Integration (GIS OAuth 2.0 Web Client)
  - Uses `drive.file` scope (only interacts with files created by WealthGuard LK)
  - Seamless background auto-sync on state change saves

## Google Drive Integration Setup
To set up Google Drive sync capability on your deployed version, you can leverage your existing Firebase project configuration:

### Method A: Using your existing Firebase Project (Recommended)
1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Select your Firebase project (e.g., `wealthguard-f7c26`).
3. Go to **Authentication > Sign-in method** and enable the **Google** provider.
4. Under the Web SDK configuration, copy the **Web client ID**.
5. Set the **Authorized JavaScript Origins** in the Google Cloud Console (associated with this Firebase project) to your deployment domain (e.g., `https://wealthguard.web.app` or `http://localhost:5173` for local testing).
6. Enter this Client ID in the `.env` file as `VITE_GOOGLE_CLIENT_ID` before building the app, or enter it directly in the Settings/Setup UI.

### Method B: Manual Google Cloud Setup
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create or select a project.
3. Enable the **Google Drive API**.
4. Configure the OAuth Consent Screen (External, requesting the `.../auth/drive.file` scope).
5. Create credentials: **OAuth 2.0 Client ID** (Web application).
6. Set the **Authorized JavaScript Origins** to your deployment domain (e.g., `https://wealthguard.web.app`).
7. Enter this Client ID in the `.env` file as `VITE_GOOGLE_CLIENT_ID` before building the app, or enter it directly in the Settings UI.

## Security Notes
- `.firebaserc` is gitignored to keep project ID private in public repos
- All sensitive data is encrypted client-side using `AES-GCM` before localStorage and Google Drive upload
- No server-side processing is done - the data is 100% yours
- Backup files are encrypted and require your passphrase to decrypt

## Important Notes
- The app uses client-side encryption, so all sensitive data stays in the browser
- Backup files (.wglk) should be stored securely by users
- Firebase Hosting only serves static files - no data collection
- Each deployment creates a new version in Firebase Console

## Troubleshooting

### Build fails with TypeScript errors
Use `npx vite build` instead of `npm run build` to bypass TypeScript checks

### Port already in use during dev
Vite automatically uses next available port (e.g., 5184 instead of 5183)

### Deployment succeeds but changes not visible
Clear browser cache or use incognito mode to see latest deployment
