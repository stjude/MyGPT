# Installation on Mac OS

## Requirements

To Run the MyGPT pipeline, we will need the following minimum specifications for your system:

*   8 CPUs
*   8 GB Memory (16 GB or more for better response time)
*   10 GB hard-drive storage

We will also need several tools to run the pipeline:

*   Brew
*   Git
*   Docker
*   Ollama

## Requirements installation

We will install these required tools in the following steps:

1. **Brew installation**

	Check if you have `brew` installed on your system by running following command.

	```
	brew --version
	```

	If you get error that `brew not found`, you can install brew by folliwng command from the new terminal window (similar to Jupyter installation but open new tab for terminal without closing existing window that's running Jupyter). For more details about brew check this [page](https://brew.sh/)

	```
	/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
	```

2.  **Brew packages installation**

	We will install Brew packages by running following commands:

	```
	brew install git
	```

3. **Docker installation**

	To run MyGPT with CPUs-only, the entire pipeline will run as a single unit from Docker.
	Check if you have `docker` installed on your system by running following command.

	```
	docker --version
	```

	If you get an error that `docker not found`, go to the official Docker installation page for Mac and install the appropriate Docker on your system: https://docs.docker.com/desktop/install/mac-install/

	You can change Docker setting to match requirements for MyGPT:
	<img src="../../images/docker_resources.png?raw=true" width="700px">


4. **Ollama installation**

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

You have 2 options to install MyGPT pipeline:

1. Use pre-built docker images (faster and easier to install, but you can't modify source code)
2. Build docker images from source code (slower, but you can modify source code)

### Option 1: Use pre-built docker images

1. **Get MyGPT source code**

	If you have zip file with MyGPT installation instructions, you can unzip it and copy it on your desktop or your desired location. You can skip remaining instructions from below and go to Step 2.

	Or you can get installation instructions by running following command from Terminal. It will create `MyGPT` folder on your Desktop or desired folder.

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

	Create the root runtime environment files and replace every backend placeholder with your own values:

	```
	cd MyGPT
	cp .env_backend.example .env_backend
	cp .env_frontend.example .env_frontend
	```

	Then run the containers:

	```
	cd installation/macOS/prebuilt_images
	bash run_docker.sh
	```

	This script should take around 5-10 minutes to run.
	While above script is running, it will open several pages in your default browser. 
	You can see status of different components of MyGPT pipeline on these pages.
	* backend: http://localhost:8000/

		<img src="../../images/backend_server.png?raw=true" width="500px">

	* frontend: http://localhost:3000/

		<img src="../../images/frontend_launch.png?raw=true" width="1200px">


### Option 2: Build docker images from source code

1. **Get MyGPT source code**

	If you have zip file with MyGPT source code, you can unzip it and copy it on your desktop or your desired location. You can skip remaining instructions from below and go to Step 2.

	If you want to get source code from GitHub we will first get MyGPT source code by running following command. It will create `MyGPT` folder on your Desktop. To get the source code from GitHub, we will need `GitHub username` and `GitHub access token` as the GitHub repo is private. When you run the following command, it will ask for this credentials.

	```
	git clone https://github.com/stjude/MyGPT.git
	```

	<ins>Note:</ins> If you don't have GitHub access token, you can genearte classic token using this guideline: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#creating-a-personal-access-token-classic

2. **Build docker images**

	We will run following script to build docker images:

	```
	cd MyGPT
	bash installation/macOS/build_images/build_docker.sh
	```

	Before starting containers, replace all placeholders in `.env_backend` and review the public settings in `.env_frontend`.

3. **Run docker containers**

	We will run following script to run docker containers:

	```
	bash installation/macOS/build_images/run_docker.sh
	```

	This script should take around 5-10 minutes to run.
	While above script is running, it will open several pages in your default browser. 
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

* <ins>Zotero API key:</ins> You can generate an API key in your profile settings https://www.zotero.org/settings/keys

* <ins>Zotero User ID:</ins> You can get it from Zotero prfile page by visiting https://www.zotero.org/settings/keys. It's 6-7 digit number.

* <ins>Zotero Group ID:</ins> You can get it from URL of the group, for example, here is URL for BABU group and group ID is `4982570`: 
https://www.zotero.org/groups/4982570/babu_group/

* <ins>Zotero Collection ID:</ins> You can get it from URL of the collection, for example, here is URL for BABU group and collection ID is `YTPMLXYY`:
https://www.zotero.org/groups/4982570/babu_group/collections/YTPMLXYY

## Other optional tasks for MyGPT pipeline

### create super user

To create super user, run following command if you are using pre-built docker images:

```
cd MyGPT/installation/macOS/prebuilt_images/
bash create_superuser.sh
```

Or run following command if you are building docker images:

```
bash MyGPT/installation/macOS/build_images/create_superuser.sh
```

Scan the terminal QR code with an authenticator app and enter its current six-digit code. You can then sign in at http://localhost:8000/admin/ with the username, password, and authenticator code.

Note: `create_superuser.sh` now runs `create_superuser_with_otp`, which creates the superuser and walks through this TOTP enrollment in one step.

### Run MCP server
To run MCP server, run following command if you are using pre-built docker images:

```
cd MyGPT/installation/macOS/prebuilt_images/
bash run_mcp_server.sh
```
Or run following command if you are building docker images:

```
bash MyGPT/installation/macOS/build_images/run_mcp_server.sh
```
This will start the MCP server and you can access it at http://localhost:5001/sse/

### Configure MCP Client in MyGPT

To setup MCP client in MyGPT, stop the frontend, then update the public settings in `MyGPT/.env_frontend`.
To stop the frontend, run following command if you are using pre-built docker images:

```cd MyGPT/installation/macOS/prebuilt_images/
bash stop_docker.sh
```
Or run following command if you are building docker images:

```
bash MyGPT/installation/macOS/build_images/stop_docker.sh
```

Set the following values in `.env_frontend`:

```
VITE_MCP_SERVER_URL=http://localhost:5001/sse
VITE_MCP_SHOW_MCP_MENU=true
```

You can change MCP server URL to your custom MCP server URL if you are using a different server.

Then, you can start the frontend again by running following command if you are using pre-built docker images:

```cd MyGPT/installation/macOS/prebuilt_images/
bash run_docker.sh
```	
Or run following command if you are building docker images:

```
bash MyGPT/installation/macOS/build_images/run_docker.sh
```

Once the frontend is running, you can access it at http://localhost:3000/ and you should see MCP menu in the settings page.
Select the MCP tools you want to use from the customization page.

Once you select the tools, go to the main page and select LLM with tool support and you should see the MCP tools in the chat interface.

<img src="../../images/MyGPT_MCP_UI.png?raw=true" width="1000px">

### stop docker containers

To stop docker containers, run following command if you are using pre-built docker images:
```
cd MyGPT/installation/macOS/prebuilt_images/
bash stop_docker.sh
```

Or run following command if you are building docker images:


```
bash MyGPT/installation/macOS/build_images/stop_docker.sh
```