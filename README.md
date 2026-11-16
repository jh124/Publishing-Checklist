# Publishing Checklist

A small, responsive editing and publishing workspace. Two pages keep projects and reusable prompts/notes together, with a fixed pill navigation at the bottom.

## Features

- All three supplied workflows: **Edit** (11 steps), **Edit/publish** (16 steps), and **Publish** (6 steps).
- Projects automatically copy their workflow template. Edit an individual project or its template independently.
- All, unfinished, and finished filters; a green completion ring on every project.
- Unfinished projects sort by completion percentage, highest first. Ties sort by creation time, newest first. Finished projects appear after all unfinished projects, newest completion first.
- Checklist items stay in their original order when checked off.
- Create, edit, delete, and copy reusable prompts/notes. The print margin note is included automatically.
- Browser-local persistence, backup export/restore, and offline use after the first successful visit.
- Keyboard-accessible controls, modal dialogs, responsive layouts, and reduced-motion support.

## Run locally

Use Node.js 20 or newer. No installation or build step is required.

```sh
npm run dev
```

Open `http://localhost:3000`. The development server serves the app files from the repository root.

```sh
npm run check
npm test
```

## Publish with GitHub Pages

Like Daily, the app files live at the top level of the repository. No build step or dependencies are required for GitHub Pages.

1. Open **Settings → Pages**.
2. Set **Source** to **Deploy from a branch**.
3. Choose **main** and **/ (root)**, then save.
4. Open the Pages URL after deployment finishes.

Pushing updates to `main` automatically republishes the app. All asset paths are relative, so it works at a project address such as `/Publishing-Checklist/`.

If Pages is already configured this way, no settings change is needed. The **Check app** workflow verifies every push and pull request. The optional manual **Deploy GitHub Pages** workflow builds a static copy for repositories configured to use **GitHub Actions** instead.

## Install on your home screen

On iPhone, open the Pages URL in Safari, tap **Share → Add to Home Screen**, and open it from the new icon. It runs in its own window, like Daily. On Android or desktop Chrome, use the browser's **Install app** or **Add to Home Screen** option.

The app shell is cached after the first online visit, so it can reopen offline without waiting for the network. Projects, templates, and notes remain saved on that device.

## Other static hosts

Run `npm run build` to copy the public app files into an ignored `dist` directory. The `.openai/hosting.json` file retains the existing ChatGPT Site connection and points at that build output. Root files remain the source of truth.

## Your data

Projects, completion status, templates, and notes are stored in this browser’s `localStorage` under `publishing-checklist:v1`. No project data is committed to this repository or sent to a server. Devices and browser profiles have separate workspaces.

Use the three-dot menu beside the app title to **Export backup** or **Restore from backup**. Restore validates the file and asks before replacing the workspace. Export a backup before clearing browser data or moving to a new device. Browser storage can be cleared by the browser or operating system; the backup is your portable copy.

The interface uses Google Fonts when available, with local system and serif fallbacks. The versioned app shell loads from the installed cache; service worker updates replace it when connected. Saved data belongs to the website address: export/import a backup to move work from another address.

## Files

- `index.html` — accessible application shell and GitHub Pages entry point
- `styles.css` — responsive interface
- `app.js` — UI, forms, notes, persistence, backup/restore
- `core.js` — exact templates, ordering, completion rules, state validation
- `sw.js` — offline asset caching
- `manifest.webmanifest` and PNG icons — standalone home-screen installation
- `tests/core.test.js` — workflow and data behavior tests
- `scripts/serve.mjs` — dependency-free development server
- `scripts/build.mjs` — optional static output for other hosts

