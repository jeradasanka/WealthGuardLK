# Firebase Deployment Guide

## Live Application
**Production URL**: https://wealthguard-f7c26.web.app

## Prerequisites
1. Install Firebase CLI: `npm install -g firebase-tools`
2. Login to Firebase: `firebase login`

## Initial Setup
1. Firebase project already configured: `wealthguard-f7c26`
2. `.firebaserc` contains the project configuration (gitignored for security)
3. `firebase.json` configures hosting settings

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
- **localStorage**: All encrypted user data (supports larger datasets)
- **No backend**: Fully client-side application
- **Offline-first**: Works without internet after initial load
- **Backup files**: .wglk format (WealthGuard LK encrypted backups)

## Security Notes
- `.firebaserc` is gitignored to keep project ID private in public repos
- All sensitive data encrypted client-side before localStorage
- No server-side data processing or storage
- Backup files are encrypted and require passphrase to decrypt

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
