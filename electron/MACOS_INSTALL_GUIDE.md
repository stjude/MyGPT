# MyGPT for macOS — User Installation & Setup Guide

Welcome to **MyGPT**, the private, local-first research and publication assistant developed at **St. Jude Children's Research Hospital**.

---

## 📋 System Requirements

* **Operating System:** macOS 12.0 (Monterey), macOS 13 (Ventura), macOS 14 (Sonoma), or macOS 15 (Sequoia)
* **Architecture:** Apple Silicon (M1/M2/M3/M4) or Intel Core (x86_64)
* **Memory (RAM):** 8 GB minimum (16 GB+ recommended for running larger LLMs)
* **Storage:** ~10 GB free space (for Docker containers, PostgreSQL, and Ollama model weights)

---

## ⚡ Prerequisites (Before Launching MyGPT)

Because MyGPT runs 100% locally on your machine with no external cloud API dependencies, ensure the following two local services are installed and running:

### 1. Install & Start Ollama (Local AI Engine)
1. Download and install Ollama from [https://ollama.com/download/mac](https://ollama.com/download/mac) (or via Homebrew: `brew install --cask ollama`).
2. Open **Ollama** from your Applications folder (the llama icon will appear in your macOS menu bar).
3. Open Terminal and pull the recommended default models:
   ```bash
   # Default embedding model (required for document retrieval)
   ollama pull nomic-embed-text

   # Default fast conversational LLM
   ollama pull llama3.2
   ```

### 2. Install & Start Docker Desktop (Backend & Database)
1. Download and install **Docker Desktop for Mac** from [https://www.docker.com/products/docker-desktop/](https://www.docker.com/products/docker-desktop/).
2. Open Docker Desktop and ensure the engine is running (green status indicator in the bottom left corner).
3. In the MyGPT directory or terminal, start the background backend services:
   ```bash
   docker compose up -d
   ```
   *(This starts the PostgreSQL database, Django backend API on port 8000, and GROBID PDF processing engine).*

---

## 💿 Installing MyGPT Desktop App

1. Download **`MyGPT-1.0.3-arm64.dmg`** (Apple Silicon M1/M2/M3/M4) or **`MyGPT-1.0.3.dmg`** (Intel Macs) from [GitHub Releases](https://github.com/stjude/MyGPT/releases). Version 1.0.3 downloads become available after the release assets are published.
2. Double-click the downloaded `.dmg` file to open the installer disk image.
3. Drag the **MyGPT** app icon into your **Applications** folder.
4. Eject the disk image.

---

## 🛡️ First-Time macOS Gatekeeper Instructions

Because MyGPT is an open-source binary distributed directly without an Apple App Store Developer signature, macOS Gatekeeper may show a security notice on the first open:

> *"MyGPT cannot be opened because Apple cannot check it for malicious software"* or *"unidentified developer"*.

### How to open it on first launch:
1. Open your **Applications** folder in Finder.
2. **Right-click (or Control-click)** on **MyGPT.app** and select **Open**.
3. In the popup dialog, click the **Open** button.
4. *(Alternatively)* Go to **Apple Menu  > System Settings > Privacy & Security**, scroll down to the Security section, and click **"Open Anyway"** next to MyGPT.

*You only need to perform this step once. Future launches from Launchpad, Spotlight, or Dock will open immediately.*

---

## 🔍 Verifying Connection Status in the App

When MyGPT opens, look at the **Footer bar** at the bottom of the screen:

* 🟢 **Backend: Online** (Green pulse) — The configured Django API is reachable.
* 🟢 **Ollama: Online** (Green pulse) — The configured Ollama service is reachable.

Hover over a status indicator (or focus it with the keyboard) to see its configured endpoint. The default local endpoints are `http://127.0.0.1:8000` for the backend and `http://127.0.0.1:11434` for Ollama; yours may differ. Change them in **Settings > Developer / API > Runtime services**.

If either indicator displays 🔴 **Offline**, check the endpoint shown in its tooltip and verify that Docker Desktop or Ollama is running there. The GPT model dropdown lists models available from the configured Ollama service; if it is empty, check the Ollama endpoint and run `ollama list` on that host.

---

## 💡 Quick Tips & Features

* **Ask Questions:** Choose your GPT model in the left panel, pick a library in the middle panel, and type any question to get document-grounded answers with confidence metrics (QRS, ARS, Hallucination Index).
* **Upload Publications:** Click the **Upload** button in the top navigation bar to create new libraries from PDFs or import collections directly from **Zotero**.
* **Direct Chat Mode:** Switch from *"Chat with Documents"* to *"Direct chat with GPTs"* to chat freely with your local Ollama LLMs without document indexing.
* **Developer & API Access:** Go to **Settings > Developer / API** inside the app to view your local JWT tokens, test REST endpoints, or run automated Python scripts via `http://127.0.0.1:8000`.
* **FAQs & Guidance:** Click **FAQs** in the bottom right corner of the footer for detailed usage tutorials and screenshots.
