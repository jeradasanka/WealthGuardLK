# Contributing to WealthGuard LK

Thank you for your interest in contributing to WealthGuard LK! This document provides instructions and guidelines to help you get started with contributing.

---

## 🏗️ Technical Stack

- **Frontend**: React 18 + TypeScript (Strict Mode)
- **Build Tool**: Vite
- **Styling**: Tailwind CSS + shadcn/ui
- **State Management**: Zustand
- **Encryption**: Web Crypto API (AES-GCM + PBKDF2)
- **AI Integration**: Google Gemini AI (PDF parsing, chatbot)
- **Cloud Backup**: Google Drive API v3 (GIS OAuth 2.0 Client-side)
- **Hosting**: Firebase Hosting

---

## 🛣️ Git Workflow (Critical)

To maintain a clean and reliable codebase, **never commit directly to the `master` branch**. Please follow this workflow:

1. **Pull the Latest Changes**:
   Ensure your local `master` branch is up to date:
   ```bash
   git checkout master
   git pull origin master
   ```

2. **Create a Feature/Fix Branch**:
   Create a new branch with a descriptive name using the prefix matching the type of changes:
   - `feature/your-feature-name` - New features or enhancements
   - `fix/bug-description` - Bug fixes
   - `test/test-description` - Testing improvements
   - `chore/task-description` - Maintenance, package/config updates
   - `docs/documentation-update` - Documentation updates

   Example:
   ```bash
   git checkout -b feature/google-drive-sync-integration
   ```

3. **Make Your Changes & Commit**:
   Keep commits focused and write descriptive commit messages:
   ```bash
   git add .
   git commit -m "feat: add Google Drive backup sync capability"
   ```

4. **Verify and Build Locally**:
   Run tests and perform a production build to check for TypeScript errors or compilation issues:
   ```bash
   npm run build
   ```

5. **Push & Create a Pull Request**:
   Push your branch to GitHub and open a Pull Request (PR) to merge into `master`:
   ```bash
   git push origin feature/your-feature-name
   ```
   Open GitHub and create a Pull Request against the `master` branch.

---

## 🛠️ Environment Configuration

WealthGuard LK uses client-side Google API integrations. To configure Google Drive Sync or Gemini AI for local development:

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Open `.env` and fill in:
   - `VITE_GOOGLE_CLIENT_ID`: Your Google OAuth 2.0 Web Client ID.
     - You can create one in the [Google Cloud Console](https://console.cloud.google.com/).
     - Ensure the **Authorized JavaScript Origins** contains `http://localhost:5173` (or your Vite dev server port).

---

## 📝 Code Quality & Security Standards

- **TypeScript**: Strict typing is enforced. Avoid using the `any` type.
- **IRD Cage Mapping**: All financial structures and pages must map directly to Inland Revenue Department (IRD) form `Asmt_IIT_003_E` and Schedules 1-10. Always reference IRD cage numbers in comments and variables (e.g., `// Cage 903: APIT`).
- **Privacy & Encryption**:
  - All taxpayer data must be encrypted client-side using `AES-GCM` before being persisted.
  - **Never log decrypted user data** or raw passphrase hashes in production or console logs.
- **Auto-Save Pattern**: Ensure `saveToStorage()` is called on Zustand store updates from user forms to trigger localStorage updates and Google Drive auto-sync.
