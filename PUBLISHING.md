# Publishing guide

## 0. One-time prep

1. Replace placeholders in `package.json`:
   - `publisher` → your Marketplace/Open VSX publisher id
   - `repository`, `bugs`, `homepage` → your GitHub URLs
2. Add an `icon.png` (128×128 recommended) at the repo root (referenced by the
   `icon` field). Remove the `icon` field if you don't have one yet.
3. `npm install`

## 1. Push to GitHub

```bash
git init                       # already done if you cloned this folder
git add -A
git commit -m "Initial commit: Cursor Sound Alerts"
git branch -M main
git remote add origin https://github.com/<your-username>/cursor-sound-alerts.git
git push -u origin main
```

## 2. Build the VSIX

```bash
npm run package                # -> cursor-sound-alerts-<version>.vsix
```

## 3a. Publish to the VS Code Marketplace (for VS Code users)

1. Create a publisher at https://marketplace.visualstudio.com/manage
2. Create an Azure DevOps Personal Access Token (scope: Marketplace > Manage).
3. Publish:

```bash
npx @vscode/vsce login <your-publisher-id>
npm run publish:vsce           # vsce publish
# or bump + publish: npx vsce publish patch
```

## 3b. Publish to Open VSX (for Cursor / VSCodium users)

Cursor installs from Open VSX, so publish there too:

1. Create an account + token at https://open-vsx.org (Settings → Access Tokens).
2. Publish:

```bash
npx ovsx create-namespace <your-publisher-id> -p <token>   # first time only
npx ovsx publish cursor-sound-alerts-<version>.vsix -p <token>
```

## 4. Releases

Tag and create a GitHub release; attach the `.vsix`. The optional workflow in
`.github/workflows/release.yml` builds the VSIX on tag push.

> Note: actual publishing requires your own accounts and tokens — those steps
> must be run by you; they are not automated here.
