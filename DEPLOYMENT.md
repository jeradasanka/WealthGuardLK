# Firebase Deployment Guide

## Prerequisites
1. Install Firebase CLI: `npm install -g firebase-tools`
2. Login to Firebase: `firebase login`

## Setup
1. Update `.firebaserc` with your Firebase project ID
2. Replace `"default": "your-project-id"` with your actual project ID

## Deploy
```bash
# Build the production bundle
npm run build

# Deploy to Firebase Hosting
firebase deploy --only hosting
```

## Important Notes
- `.firebaserc` is gitignored to keep your project ID private
- Keep a local backup of `.firebaserc` with your actual project ID
- The app uses client-side encryption, so all sensitive data stays in the browser
