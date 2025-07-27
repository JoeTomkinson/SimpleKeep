# Simple Keep

**Simple Keep** is a lightweight, client‑side note taking app inspired by Google Keep. It runs entirely in your browser, requires no back‑end services and can be deployed for pennies on Azure Static Web Apps or any other static hosting platform.

---

## Features

- **Notes and checklists:** Create plain text notes or switch to checklist mode to add tasks with inline check boxes.
- **Pinned & coloured notes:** Organise visually with note colours and drag notes to the top by pinning.
- **Edit, delete, and search:** Quickly update content or filter with instant search.
- **Offline support:** Works entirely in the browser with localStorage persistence.
- **Import/export:** Backup and restore notes using a JSON file. Use your own Google Drive, OneDrive, Dropbox, etc. to manage storage.
- **Zero-cost hosting:** Deploy as a static site — no server required.

---

## Getting Started

### Run locally

1. Download or clone this repository.
2. Open `index.html` in your browser.

That’s it — everything runs client-side.

---

## Deployment

### Deploy to Azure Static Web Apps

You can host Simple Keep as a static site:

1. Create a new [Azure Static Web App](https://portal.azure.com/).
2. Point it at this repository or upload the contents of the `note_app` folder.
3. Set the build output location to `/note_app`.
4. (Optional) Enable authentication with Azure AD or GitHub to secure access.

### Other Hosting Options

- GitHub Pages
- Netlify
- Vercel
- Any S3-compatible bucket

---

## User Storage

Simple Keep provides two buttons in the header:

- **Export Notes**: Saves your notes as a `.json` file.
- **Import Notes**: Restores from a previously exported file.

This allows users to manage their own data using cloud drives (e.g., upload the exported file to Google Drive or OneDrive) without the need for server-side databases.

---

## Customisation Ideas

- Replace `localStorage` with IndexedDB for more robust offline support.
- Integrate with OAuth + Microsoft Graph or Google Drive for user-authenticated storage.
- Enable PWA functionality with a service worker and manifest.
- Add drag & drop reordering.

---

## License

MIT — free for personal or commercial use.
