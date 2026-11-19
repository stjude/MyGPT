# Installation on Windows

## Requirements

To Run the MyGPT pipeline, we will need the following minimum specifications for your system:

*   8 CPUs
*   8 GB Memory (16 GB or more for better response time)
*   10 GB hard-drive storage

You will also need:

* Git, to download the repository
* Docker Desktop with Linux containers enabled
* Ollama on Windows, unless you will use OpenAI mode or an Ollama server on another machine

## Install the requirements

Install the requirements using the official installers. Chocolatey and Python are not required for this Docker-based installation.

1. **Git**

	Install Git for Windows from [git-scm.com/download/win](https://git-scm.com/download/win). Verify it from Command Prompt:

	```
	git --version
	```

2. **Docker Desktop**

	Install [Docker Desktop for Windows](https://docs.docker.com/desktop/install-windows/) and keep it running. Verify Docker and Compose:

	```
	docker --version
	docker compose version
	```

3. **Ollama (local LLM mode)**

	The default configuration uses Ollama. Install [Ollama for Windows](https://ollama.com/download/windows) and start it. Verify it by opening http://localhost:11434/ in a browser.

	Pull the default chat and embedding models:

	```
	ollama pull llama3
	ollama pull nomic-embed-text
	```

	Skip this step if you will configure OpenAI mode or use a remote Ollama server.


## MyGPT installation

1. **Get MyGPT source code**

	Clone the repository from Command Prompt:

	```
	git clone https://github.com/stjude/MyGPT.git
	```

	For a downloaded source archive, extract it and open Command Prompt in the extracted `MyGPT` folder instead.

2. **Log in to GitHub Container Registry**

	The Windows Compose file uses prebuilt images from GitHub Container Registry. Log in with a GitHub account and a personal access token. For a private repository, the token needs `repo` and `read:packages` access:

```
docker login ghcr.io
```

3. **Configure and run the containers**

	Create the ignored runtime files at the repository root:

	```
	cd MyGPT
	copy .env_backend.example .env_backend
	copy .env_frontend.example .env_frontend
	```

	Open `.env_backend` and follow [Configure backend secrets](../../backend/README.md#configure-backend-secrets) to set `SECRET_KEY`, `HUGGINGFACE_API_KEY`, and a strong `POSTGRES_PASSWORD`. Save the file before continuing.

	For local Ollama, keep `VITE_OLLAMA_API=http://localhost:11434/` in `.env_frontend`; the backend reaches the Windows host through its default `OLLAMA_SERVER` value. For a remote Ollama server, set both `VITE_OLLAMA_API` (the URL reachable from the browser) and `OLLAMA_SERVER` (the URL reachable from the backend container). Do not use `localhost` for a remote server.

	```
	cd MyGPT
	installation\windows\run_docker.bat
	```

	The script starts the database, backend, and frontend. When it finishes, open the frontend at http://localhost:3000/. The backend status page is available at http://localhost:8000/.

## MyGPT pipeline usage

### **Upload publications**

* You can upload documents or publications as PDF file by going to the settings, and selecting first tab: "Publication libraries" and selecting "Upload documents" menu as screeshot below.

* start by giving your library a "Library Name" and start uploading documents.

* You can upload upto 40 PDFs at a time. You can upload multiple times to same library. It will take some time to process the documents and once it's done, you can see your new library in the list with success message.

	<img src="../../images/MyGPT_upload_menu.png?raw=true" width="800px">

### **Add Zotero library**

* You can add Zotero library by going to the settings, and selecting first tab: "Publication libraries" and selecting "Add Zotero library" menu as screeshot below.

* You must provide Zotero AI key, Zotero Group ID/User ID, and Zotero Collection ID to add Zotero library.

* If you need help getting any of these, you can click on the help button next to the input field or check section after screenshot.

	<img src="../../images/MyGPT_zotero_menu.png?raw=true" width="800px">

* <u>Zotero API key:</u> You can generate an API key in your profile settings https://www.zotero.org/settings/keys

* <u>Zotero User ID:</u> You can get it from Zotero prfile page by visiting https://www.zotero.org/settings/keys. It's 6-7 digit number.

* <u>Zotero Group ID:</u> You can get it from URL of the group, for example, here is URL for BABU group and group ID is `4982570`: 
https://www.zotero.org/groups/4982570/babu_group/

* <u>Zotero Collection ID:</u> You can get it from URL of the collection, for example, here is URL for BABU group and collection ID is `YTPMLXYY`:
https://www.zotero.org/groups/4982570/babu_group/collections/YTPMLXYY

## Other optional tasks for MyGPT pipeline

<!-- ### create super user

To create super user, run following command:

```
bash MyGPT/installation/pc_no_gpu/macOS/create_superuser.sh
```

Scan the terminal QR code with an authenticator app and enter its current six-digit code. You can then sign in at http://localhost:8000/admin/ with the username, password, and authenticator code.

Note: `create_superuser.sh` now runs `create_superuser_with_otp`, which creates the superuser and walks through this TOTP enrollment in one step.
 -->

### Run MCP server
To run MCP server, run following command if you are using pre-built docker images:

```
cd MyGPT\installation\windows
run_mcp_server.bat
```

This will start the MCP server and you can access it at http://localhost:5001/sse/

### Configure MCP Client in MyGPT

To setup MCP client in MyGPT, stop the frontend, then update the public settings in `MyGPT\.env_frontend`.
To stop the frontend, run following command if you are using pre-built docker images:

```
cd MyGPT\installation\windows
stop_docker.bat
```

Set the following values in `.env_frontend`:

```
VITE_MCP_SERVER_URL=http://localhost:5001/sse
VITE_MCP_SHOW_MCP_MENU=true
```

You can change MCP server URL to your custom MCP server URL if you are using a different server.

Then, you can start the frontend again by running following command if you are using pre-built docker images:

```
cd MyGPT\installation\windows
start_docker.bat
```

Once the frontend is running, you can access it at http://localhost:3000/ and you should see MCP menu in the settings page.
Select the MCP tools you want to use from the customization page.

Once you select the tools, go to the main page and select LLM with tool support and you should see the MCP tools in the chat interface.

<img src="../../images/MyGPT_MCP_UI.png?raw=true" width="1000px">

### stop docker containers

To stop docker containers, run following command:

```
stop_docker.bat
```