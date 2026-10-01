# Building & Distributing MyGPT Desktop for VM or Cloud Deployments

This guide explains how to build and distribute customized **MyGPT Desktop Applications** that connect to a remote **Virtual Machine (VM)**, **GPU Server**, or **Cloud Instance** (e.g., Azure, AWS, GCP, or On-Premises HPC).

---

## 🏗️ Architecture Overview

When MyGPT is hosted on a remote server or cloud infrastructure:

```
┌────────────────────────────────────────────────────────┐
│                   End-User Devices                     │
│  ┌───────────────────────┐  ┌───────────────────────┐  │
│  │ MyGPT macOS (.dmg)    │  │ MyGPT Windows (.exe)  │  │
│  └───────────┬───────────┘  └───────────┬───────────┘  │
└──────────────┼──────────────────────────┼──────────────┘
               │  HTTPS / WSS / REST API  │
               ▼                          ▼
┌────────────────────────────────────────────────────────┐
│          Remote VM / Cloud / GPU Server                │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Django Backend (Port 443 / 8000)                 │  │
│  │ PostgreSQL + pgvector Database                   │  │
│  │ GROBID Document Engine                           │  │
│  │ Ollama LLM / Embedding Engine (CUDA / GPU)       │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

**Benefits for End Users:**
* **Zero local hardware requirements:** Users do not need powerful GPUs, Docker Desktop, or local Ollama installed on their laptops.
* **Centralized document libraries:** Teams can share datasets, publications, and embedding indexes across the organization.
* **Enterprise authentication:** Seamless integration with **Microsoft Entra ID (Azure AD)** SSO or Django 2FA.

---

## 🛠️ Step 1: Prepare the Remote Server

Before building the desktop client, ensure your remote server is configured:

1. **Deploy MyGPT on the Server:**
   Follow [installation/server_or_VM/README.md](../installation/server_or_VM/README.md) or [installation/azure/README.md](../installation/azure/README.md) to start the backend, database, and Ollama with GPU acceleration.

2. **Configure SSL/TLS (HTTPS):**
   Expose the backend via HTTPS with a valid domain name (e.g., `https://mygpt.your-institution.org`) using NGINX, Caddy, or a Cloud Load Balancer with Let's Encrypt or institutional SSL certificates.

3. **Configure CORS & Allowed Hosts:**
   In your server's `.env_backend`:
   ```env
   DJANGO_ALLOWED_HOSTS="mygpt.your-institution.org,127.0.0.1,localhost"
   CORS_ALLOWED_ORIGINS="https://mygpt.your-institution.org"
   CORS_ALLOW_ALL_ORIGINS=True  # Or set specific client origins
   ```

4. **(Optional) Configure Enterprise SSO (Azure AD):**
   If using institutional SSO, populate your Azure AD tenant and client IDs in `.env_backend` and `.env_frontend`.

---

## 💻 Step 2: Configure the Desktop Client for Remote Connection

1. In the repository root, open or create `.env_frontend`:
   ```env
   # Point to your production server URL (must include https:// and trailing slash)
   VITE_BACKEND_API="https://mygpt.your-institution.org/"

   # (Optional) Azure AD SSO Configuration
   VITE_AZURE_CLIENT_ID="your-azure-client-id"
   VITE_AZURE_TENANT_ID="your-azure-tenant-id"
   ```

2. Build the production React frontend bundle:
   ```bash
   cd frontend
   npm install
   npm run build
   ```
   *(This embeds your server URL into the compiled static frontend).*

---

## 📦 Step 3: Customize & Package the Desktop App

1. **Customize Branding & App Metadata:**
   Edit `electron/electron-builder.yml` to reflect your organization:
   ```yaml
   appId: org.yourinstitution.mygpt
   productName: MyGPT
   copyright: Copyright © 2026 Your Institution Name
   ```

2. **Package the Installers:**
   From the `electron/` folder, run the build command for your target platforms:
   ```bash
   cd electron
   npm install

   # Package for macOS (DMG for Apple Silicon & Intel)
   npm run dist:mac

   # Package for Windows (NSIS .exe installer & Portable)
   npm run dist:win

   # Package for Linux (.AppImage & .deb)
   npm run dist:linux
   ```

3. **Output Artifacts:**
   Installers are generated in `electron/release/`:
   * **macOS:** `MyGPT-x.x.x-arm64.dmg` and `MyGPT-x.x.x-x64.dmg`
   * **Windows:** `MyGPT Setup x.x.x.exe`
   * **Linux:** `MyGPT-x.x.x.AppImage`

---

## 🛡️ Step 4: Enterprise Distribution & Code Signing

To distribute desktop installers smoothly across an organization without security warnings:

### macOS Distribution & Apple Notarization
* **Unsigned Builds:** Share the `.dmg` alongside the first-time Gatekeeper instructions (Right-Click > Open > Open).
* **Enterprise Signed Builds:** If your organization has an **Apple Developer Program** account ($99/yr):
  1. Set your environment variables:
     ```bash
     export CSC_LINK="/path/to/developer_ID_certificate.p12"
     export CSC_KEY_PASSWORD="your_password"
     export APPLE_ID="developer@yourinstitution.org"
     export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
     export APPLE_TEAM_ID="YOUR_TEAM_ID"
     ```
  2. Run `npm run dist:mac`. `electron-builder` will automatically sign the binary and submit it to Apple for notarization.

### Windows Distribution & SmartScreen
* **Enterprise Signed Builds:** Sign the `.exe` with your organization's **Code Signing Certificate (Sectigo, DigiCert, or internal CA)**:
  ```bash
  export WIN_CSC_LINK="/path/to/authenticode_cert.pfx"
  export WIN_CSC_KEY_PASSWORD="cert_password"
  npm run dist:win
  ```

---

## 📋 Checklist for End-User Deployment

When sharing the app with your team or research group, provide them with:

1. **The Installer:** Provide `MyGPT-arm64.dmg` / `MyGPT-x64.dmg` (or Windows `.exe`).
2. **Network / VPN Access:** Ensure users are on the institutional network or connected to the corporate VPN if the server is not publicly accessible.
3. **Login Credentials:** Provide users with their Django username & password (+ Authenticator OTP setup) or instruct them to use their corporate SSO login button.
