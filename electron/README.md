# MyGPT Desktop Application (Electron)

This directory contains the cross-platform **Electron Desktop Application** for MyGPT, wrapping the React frontend and orchestrating the Dockerized Django backend and Ollama LLM service.

> [!IMPORTANT]
> **The web app remains the recommended way to use MyGPT. Desktop distribution is a work in progress.** Please read the limitations below before downloading, especially if you use a company-managed Mac.

## Current Limitations and Signing Status

**Current macOS downloads are not yet Developer ID signed and notarized.** macOS Gatekeeper may show an "unidentified developer" or "Apple cannot check it for malicious software" warning and prevent MyGPT from opening. Downloading the installer does not guarantee that your Mac will allow it to run.

We are working with St. Jude's Apple support team to obtain the required certificate and prepare signed and notarized macOS releases. **No availability date is confirmed.** The existing downloads do not become trusted automatically when a certificate is obtained; users will need a new signed and notarized release.

On company-managed Macs, IT policies may prevent first-launch overrides or installation altogether. Do not disable security protections or attempt to bypass your organization's policies. Ask IT about approval or managed deployment; even a future signed and notarized release may require organizational approval.

**Use MyGPT in your browser instead:** follow the [macOS](../installation/macOS/README.md), [Windows](../installation/windows/README.md), or [Linux](../installation/linux/README.md) setup guide for local use, or the [server/VM](../installation/vm/README.md) or [Azure](../installation/azure/README.md) guide for a hosted deployment. If your organization already hosts MyGPT, use its web URL. The web app avoids the desktop app's Gatekeeper check, but local setup still requires the services and permissions described in those guides.

## Download Desktop Apps

The following installers are available in [GitHub Release v1.0.3](https://github.com/stjude/MyGPT/releases/tag/v1.0.3):

| Platform | Architecture | Download |
| --- | --- | --- |
| macOS | Apple Silicon (arm64) | [MyGPT-1.0.3-arm64.dmg](https://github.com/stjude/MyGPT/releases/download/v1.0.3/MyGPT-1.0.3-arm64.dmg) |
| macOS | Intel (x64) | [MyGPT-1.0.3.dmg](https://github.com/stjude/MyGPT/releases/download/v1.0.3/MyGPT-1.0.3.dmg) |
| Windows | x64 installer | [MyGPT.Setup.1.0.3.exe](https://github.com/stjude/MyGPT/releases/download/v1.0.3/MyGPT.Setup.1.0.3.exe) |
| Windows | x64 portable | [MyGPT.1.0.3.exe](https://github.com/stjude/MyGPT/releases/download/v1.0.3/MyGPT.1.0.3.exe) |
| Linux | x64 AppImage | [MyGPT-1.0.3.AppImage](https://github.com/stjude/MyGPT/releases/download/v1.0.3/MyGPT-1.0.3.AppImage) |
| Debian / Ubuntu | amd64 package | [MyGPT-desktop_1.0.3_amd64.deb](https://github.com/stjude/MyGPT/releases/download/v1.0.3/MyGPT-desktop_1.0.3_amd64.deb) |

Installed desktop apps do not require Node.js or a source checkout. For local services, install and start Docker Desktop and Ollama. For a remote backend, configure **Settings > Developer / API > Runtime services** instead; see the [remote desktop guide](./REMOTE_CLOUD_DESKTOP_GUIDE.md). macOS users should follow the [installation and Gatekeeper guide](./MACOS_INSTALL_GUIDE.md).

The sections below cover development and packaging from source.

---

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js** (v18+ recommended) & **npm**
- **Docker Desktop** (running in the background for Django backend and PostgreSQL)
- **Ollama** (running on `http://localhost:11434` with `llama3.2` and `nomic-embed-text` installed)

### 2. First-Time Setup
From the repository root, ensure your runtime environment files exist:
```bash
cp ../.env_backend.example ../.env_backend
cp ../.env_frontend.example ../.env_frontend
```

Install frontend dependencies:
```bash
cd ../frontend
npm install
```

Install desktop app dependencies:
```bash
cd ../electron
npm install
```

---

## 💻 Running the Desktop App in Development

From the repository root, run:
```bash
cd electron
npm run dev
```

**What this does automatically:**
1. Checks if the backend containers are up; if not, launches Docker backend (`db`, `backend`, `grobid`).
2. Starts the Vite React development server on `http://localhost:3000`.
3. Opens the native **MyGPT Electron Window** with live reloading and native app menus.

The development app uses separate settings from an installed MyGPT app, so both can run at once. Changes to the installed app require rebuilding and reinstalling the desktop package.

---

## 📦 Packaging Desktop Installers

To build standalone installer packages for distribution:

```bash
cd electron

# Build for current operating system
npm run dist

# Or build specifically for a target platform:
npm run dist:mac     # macOS DMG & Zip (Apple Silicon & Intel)
npm run dist:win     # Windows NSIS Installer (.exe) & Portable
npm run dist:linux   # Linux AppImage & Debian package (.deb)
```

The output installers will be placed in `electron/release/`:
* `MyGPT-1.0.3-arm64.dmg` (for Apple Silicon M1/M2/M3/M4)
* `MyGPT-1.0.3.dmg` (for Intel Macs)

### Publishing Desktop Downloads

Keep installers out of Git; `electron/release/` is ignored. Distribute them as assets on [GitHub Releases](https://github.com/stjude/MyGPT/releases).

1. Commit the 1.0.3 source changes and push them before creating the release tag. Keep the existing `v1.0.2` release unchanged.
2. Rebuild the macOS installers with `npm run dist:mac` from `electron/`. Do not rename old 1.0.2 installers: the packaged app must contain version 1.0.3.
3. On GitHub, choose **Releases > Draft a new release**, create tag `v1.0.3` on the release commit, and title the release `MyGPT Desktop 1.0.3`.
4. Drag the new DMGs into the release's **Attach binaries** area. Wait for uploads to finish, then publish. To attach files after publishing, open the release, choose **Edit**, upload the files, and save.

Alternatively, after creating the release, upload from the repository root with GitHub CLI:

```bash
gh release upload v1.0.3 \
   electron/release/MyGPT-1.0.3-arm64.dmg \
   electron/release/MyGPT-1.0.3.dmg \
   --repo stjude/MyGPT
```

Attach ZIPs or Windows/Linux installers only after building and testing them. Do not upload temporary files or unpacked app directories. Verify runtime endpoints and exclude development credentials before publishing.

Published installers are listed in [Download Desktop Apps](#download-desktop-apps). Use the exact published asset URLs when updating download links; GitHub may replace spaces in uploaded filenames with dots.

### 📖 Distribution & User Guides:
* **macOS Local User Guide:** [MACOS_INSTALL_GUIDE.md](./MACOS_INSTALL_GUIDE.md) — local installation, Ollama/Docker setup, and first-launch Gatekeeper instructions where permitted by your organization's policies. These instructions may not be available on managed Macs; see [Current Limitations and Signing Status](#current-limitations-and-signing-status).
* **Remote VM & Cloud Desktop Guide:** [REMOTE_CLOUD_DESKTOP_GUIDE.md](./REMOTE_CLOUD_DESKTOP_GUIDE.md) — instructions for building and distributing desktop apps that connect to a remote VM, GPU server, or Cloud instance (Azure/AWS/GCP) with SSL and enterprise SSO.

---

## 🐳 Docker Backend Management

You can manage backend Docker containers directly via npm scripts from the `electron/` folder:

```bash
npm run docker:up      # Starts db, backend, and grobid containers in background
npm run docker:logs    # Streams backend Django logs in real-time
npm run docker:build   # Rebuilds the backend Docker image after dependency changes
npm run docker:down    # Stops all MyGPT Docker containers
```

---

## 🔌 API & Python Script Integration

When MyGPT Desktop or Docker backend is running, all REST APIs are served on `http://127.0.0.1:8000`:

1. **Interactive Swagger Documentation:**
   👉 Visit [http://127.0.0.1:8000/api/docs/](http://127.0.0.1:8000/api/docs/) in your browser.

2. **OpenAPI 3.0 JSON Schema:**
   👉 Visit [http://127.0.0.1:8000/api/schema/](http://127.0.0.1:8000/api/schema/).

3. **Running the Python Client Demo:**
   ```bash
   python3 ../scripts/python_api_client.py --base-url http://127.0.0.1:8000
   ```

4. **In-App Developer Settings:**
   Inside the desktop app, go to **Settings > Developer / API** to view your active JWT access token, copy-paste ready-to-run Python snippets, or download Ollama models.

## Runtime service settings

**Settings > Developer / API > Runtime services** lets desktop users:

- Change the backend and Ollama API base URLs without rebuilding the frontend.
- Check the configured services in the footer: hover over or focus the **Backend** and **Ollama** status indicators to see each endpoint, even when offline.
- Start the local `db`, `backend`, and `grobid` Docker Compose services.
- Choose whether local backend containers start automatically with the app.

Changing the Ollama URL while using a local Docker backend recreates the managed
backend containers so the new `OLLAMA_SERVER` value takes effect. Docker controls
are disabled for remote, HTTPS, or path-based backend URLs.

Installed desktop builds use the published multi-architecture backend image and
store Docker data and generated local credentials under Electron's per-user app
data directory. Source checkouts continue to use the repository Compose file.
