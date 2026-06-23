# Publishing guide

Publisher id and GitHub URLs are already set to `dshashikk`.

## 0. One-time prep

1. `npm install`
2. (Optional) Add an `icon.png` (128×128) at the repo root and an `"icon"`
   field in `package.json` for a nicer Marketplace/Open VSX listing.

## 1. Push to GitHub

```bash
git init                       # already done if you cloned this folder
git add -A
git commit -m "Initial commit: Sound Alerts"
git branch -M main
git remote add origin https://github.com/<your-username>/sound-alerts.git
git push -u origin main
```

## 2. Build the VSIX

```bash
npm run package                # -> sound-alerts-<version>.vsix
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
npx ovsx publish sound-alerts-<version>.vsix -p <token>
```

## 4. Automated releases (recommended)

`.github/workflows/release.yml` runs on any `v*` tag push and will:

1. Build the `.vsix`.
2. Attach it to the GitHub release for that tag.
3. Publish to Open VSX — **only if** an `OVSX_TOKEN` repo secret is set.

Set the secret once:

```bash
gh secret set OVSX_TOKEN   # paste your open-vsx.org access token
```

First-time Open VSX namespace (once per publisher id):

```bash
npx ovsx create-namespace dshashikk -p <token>
```

Then cut a release:

```bash
npm version patch            # bumps package.json + creates a git tag
git push --follow-tags
```

> Note: publishing to Open VSX / the VS Code Marketplace requires your own
> accounts and tokens — those must be supplied by you (via the `OVSX_TOKEN`
> secret or local login).
