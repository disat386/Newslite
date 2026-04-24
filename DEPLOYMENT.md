# Deployment Guide: NewsLite on Hostinger via GitHub 🚀

Follow these steps to take your NewsLite application live on Hostinger.

## 1. Export from AI Studio
1. In the AI Studio editor, go to **Settings** (Gear icon) -> **Export to GitHub**.
2. Connect your GitHub account and create a new repository (e.g., `newslite-app`).
3. Once exported, the entire codebase is now on GitHub.

## 2. Get Your Own Gemini API Key
AI Studio provides a built-in key for development, but for your live site, you need your own:
1. Go to [Google AI Studio](https://aistudio.google.com/).
2. Create a new API Key.
3. **Important**: You will need to add this key to your Hostinger environment or your `.env` file.

## 3. Automation: GitHub to Hostinger via FTP (Recommended)

To make GitHub update your site automatically every time you push code, I have added a workflow file at `.github/workflows/deploy.yml`.

### Setting up GitHub Secrets:
1. Open your repository on GitHub.
2. Go to **Settings** > **Secrets and variables** > **Actions**.
3. Click **New repository secret** and add exactly these names:
    - `FTP_SERVER`: Your Hostinger FTP hostname (find this in hPanel -> FTP Accounts).
    - `FTP_USERNAME`: Your FTP username.
    - `FTP_PASSWORD`: Your FTP password.
    - `VITE_GEMINI_API_KEY`: Your Gemini API Key from Google AI Studio.

### How it works:
1. When you push to `main`, GitHub starts an "Action".
2. It builds the project (`npm run build`).
3. It takes the output folder (`dist/`) and uploads it to Hostinger's `public_html`.

## 4. Environment Variables Configuration
Because this is a Vite app, variables must start with `VITE_` to be visible in the browser. 
I have updated `src/lib/gemini.ts` to support this.

## 5. Firebase Rules
Make sure you deploy your Firestore rules!
1. Go to your Firebase Console.
2. Copy the contents of `firestore.rules` from your code.
3. Paste it into the **Rules** tab of your Firestore Database.

## Success!
Your site should now be live at your Hostinger domain.
