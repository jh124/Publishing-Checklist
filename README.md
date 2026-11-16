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

Open `http://localhost:3000`. Alternatively, serve the `dist` directory with any static web server.

```sh
npm run check
npm test
```

## Host

The deployable app is the `dist` directory. Asset paths are relative so the app also works beneath a repository subpath such as `/Publishing-Checklist/`.

For GitHub Pages, open **Settings → Pages**, set **Source** to **GitHub Actions**, and run the included **Deploy GitHub Pages** workflow. Run that workflow again whenever you want to publish an update to GitHub Pages. The separate **Check app** workflow verifies every push to `main` and every pull request.

The `.openai/hosting.json` file connects the same source to its ChatGPT Site deployment.

## Your data

Projects, completion status, templates, and notes are stored in this browser’s `localStorage` under `publishing-checklist:v1`. No project data is committed to this repository or sent to a server. Devices and browser profiles have separate workspaces.

Use the three-dot menu beside the app title to **Export backup** or **Restore from backup**. Restore validates the file and asks before replacing the workspace. Export a backup before clearing browser data or moving to a new device. Browser storage can be cleared by the browser or operating system; the backup is your portable copy.

The interface uses Google Fonts when available, with local system and serif fallbacks. App assets are cached for offline use; requests prefer the network so updates are picked up when connected.

## Files

- `dist/index.html` — accessible application shell
- `dist/styles.css` — responsive interface
- `dist/app.js` — UI, forms, notes, persistence, backup/restore
- `dist/core.js` — exact templates, ordering, completion rules, state validation
- `dist/sw.js` — offline asset caching
- `tests/core.test.js` — workflow and data behavior tests
- `scripts/serve.mjs` — dependency-free development server

