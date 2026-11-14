# Installation on Windows

## Requirements

To Run the MyGPT pipeline, we will need the following minimum specifications for your system:

*   8 CPUs
*   8 GB Memory (16 GB or more for better response time)
*   10 GB hard-drive storage

We will also need several tools to run the pipeline:

*   Python
*   Chocolatey
*   Git
*   Docker
*   Ollama

## Requirements installation

We will install these two tools in the following steps:

1. **install Python and Pip**

	Check if you have python installed on your system, by running following command from Command Prompt.
	```
	python -v
	```

	If python is not isntalled on your PC, install it by downloading latest release from this page: https://www.python.org/downloads/windows/

	While Python installtion, make sure to select the following option:

	<img src="../../images/python_install_windows.png?raw=true" width="500px">

2. **Chocolatory installation**

	Check if you have choco installed on your system by running following command.
	```
	choco list
	```

	If you get error that `choco not found`, you can install `choco` by folliwng command from the new Command Prompt window:

	```
	@"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -InputFormat None -ExecutionPolicy Bypass -Command "[System.Net.ServicePointManager]::SecurityProtocol = 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))" && SET "PATH=%PATH%;%ALLUSERSPROFILE%\chocolatey\bin"
	```

3.  **Git installation**

	Check if you have git installed on your system by running following command.

	```
	git --help
	```

	if you get message git not found, you can install it using choco.

	```
	choco install git
	```
	
	After you get success message, you can close the Command Prompt window and open new Command Prompt as Administrator to run next command.

4. **Docker installation**

	To run MyGPT with CPUs-only, the entire pipeline will run as a single unit from Docker. Go to the official Docker installation page for Windows and install the appropriate Docker on your system: https://docs.docker.com/desktop/install/windows-install/

	After installation, to verify if Docker is running on your system, run the following code:

	```
	docker --help
	```
	If you get an error that `docker not found`,   Go to the official Docker installation page for Linux and install the appropriate Docker on your system: https://docs.docker.com/desktop/install/linux-install/

5. **Ollama installation**

	Finally, download and install Ollama by following instructions from this offical [Ollama site](https://ollama.ai/)

	You can check if Ollama is running by visiting http://localhost:11434/ in your default browser.

> [!CAUTION]
> After installing Ollama, close any open Terminal/Command Prompt before you pull Llama3 or gpt-oss (if you have more than 8 GB RAM).

Once you start Ollama, you have to pull Llama3 or gpt-oss model by running following command:

```
ollama pull llama3
ollama pull gpt-oss
```

Also, get the nomic embedding model, which is best performing embedding model for MyGPT pipeline, by running following command:

```
ollama pull nomic-embed-text
```


## MyGPT installation

1. **Get MyGPT source code**

	If you have zip file with MyGPT installation instructions, you can unzip it and copy it on your desktop or your desired location. You can skip remaining instructions from below and go to Step 2.

	Or you can get installation instructions by running following command from Terminal. It will create `MyGPT_public` folder on your Desktop or desired folder. To get this from GitHub, we will need `GitHub username` and `GitHub access token` as the GitHub repo is private. When you run the following command, it will ask for this credentials.

	```
	git clone https://github.com/stjude/MyGPT.git
	```

> [!NOTE] 
> If you don't have GitHub access token, you can genearte classic token using this guideline: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#creating-a-personal-access-token-classic

> [!CAUTION] 
> While generating you GitHub Access Token, make sure you check access for `repo` and  `read:packages` similar to image below.

<img src="../../images/GitHub_access_token_scope.png?raw=true" width="600px">

2. login to GitHub Docker registry

	As the GitHub repository is private rightnow, we have to login to GitHub Docker registry to use the prebuilt images. To login to GitHub Docker registry, run following command. It will ask for your GitHub username and password. 

> [!CAUTION]
> Make sure Docker Desktop application is open and running before running the command.
> the password is your access token (same token you used in step 1), not your github password you use to login in github account.

```
docker login ghcr.io
```

3. **Run docker containers**

	Create the ignored runtime files at the repository root, replace backend placeholders, then run the containers:

	```
	cd MyGPT_public
	copy .env_backend.example .env_backend
	copy .env_frontend.example .env_frontend
	```

	Open `.env_backend` in a text editor and follow [Configure backend secrets](../../backend/README.md#configure-backend-secrets), including the Windows command for generating `SECRET_KEY` and the steps for creating `HUGGINGFACE_API_KEY`. Save the file before running the containers:

	```
	cd installation\windows
	run_docker.bat
	```

	This script should take around 5-10 minutes to run.
	Once the script finish running, open following pages in your default browser. 
	You can see status of different components of MyGPT pipeline on these pages.
	* backend: http://localhost:8000/

		<img src="../../images/backend_server.png?raw=true" width="500px">

	* frontend: http://localhost:3000/

		<img src="../../images/frontend_launch.png?raw=true" width="1200px">

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
cd MyGPT_public\installation\windows
run_mcp_server.bat
```

This will start the MCP server and you can access it at http://localhost:5001/sse/

### Configure MCP Client in MyGPT

To setup MCP client in MyGPT, stop the frontend, then update the public settings in `MyGPT_public\.env_frontend`.
To stop the frontend, run following command if you are using pre-built docker images:

```
cd MyGPT_public\installation\windows
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
cd MyGPT_public\installation\windows
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