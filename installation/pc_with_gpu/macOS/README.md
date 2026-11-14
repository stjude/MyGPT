# Installation on Mac with M1 GPU

## Requirements

To Run the MyGPT pipeline, we will need the following minimum specifications for your system:

*   1 Apple GPU
*   8 CPUs
*   32 GB Memory
*   20 GB hard-drive storage

We will also need several tools to run the pipeline:

*   Git
*   Brew
*   Docker
*   Llama-cpp-python

## Requirements installation

We will install these two tools in the following steps:

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
	brew install aria2
	```

3. **Docker installation**

	To run MyGPT with CPUs-only, the entire pipeline will run as a single unit from Docker.
	Check if you have `docker` installed on your system by running following command.

	```
	docker --version
	```

	If you get an error that `docker not found`, go to the official Docker installation page for Mac and install the appropriate Docker on your system: https://docs.docker.com/desktop/install/mac-install/

	You can change Docker setting to match requirements for MyGPT:
	<img src="https://github.com/mb-group/MyGPT_public/blob/main/images/docker_resources.png?raw=true" width="700px">

4. **Llama-cpp-python installation**

	To install llama-cpp-python on MacBook with Apple GPU, run following commands in terminal:

	```
	pip install --upgrade pip
	pip install --upgrade setuptools wheel
	pip uninstall -y llama-cpp-python
	CMAKE_ARGS="-DLLAMA_METAL=on" FORCE_CMAKE=1 pip install llama-cpp-python==0.1.78
	```

## MyGPT installation

1. **Get MyGPT source code**

	If you have zip file with MyGPT source code, you can unzip it and copy it on your desktop or your desired location. You can skip remaining step from below and go to Step 2.

	If you want to get source code from GitHub we will first get MyGPT source code by running following command. It will create `MyGPT` folder on your Desktop. To get the source code from GitHub, we will need `GitHub username` and `GitHub access token` as the GitHub repo is private. When you run the following command, it will ask for this credentials.

	<u>Note:</u> If you don't have GitHub access token, you can genearte classic token using this guideline: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#creating-a-personal-access-token-classic

	```
	git clone https://github.com/mb-group/MyGPT.git
	```

2. **Download the LLM model and modify setting files**

	We will run following script to download the LLM model and modify the setting files:

	```
	bash MyGPT/installation/pc_with_gpu/macOS/set_environment.sh
	```

	The script creates `MyGPT/.env_backend` from its template if needed. Before starting containers, edit that file and follow [Configure backend secrets](../../../backend/README.md#configure-backend-secrets) to generate `SECRET_KEY` locally and create `HUGGINGFACE_API_KEY`.

3. **Build docker images**

	We will run following script to build docker images:

	```
	bash MyGPT/installation/pc_with_gpu/macOS/build_docker.sh
	```

4. **Run docker containers**

	We will run following script to run docker containers:

	```
	bash MyGPT/installation/pc_with_gpu/macOS/run_docker.sh
	```

	This script should take around 5-10 minutes to run.
	While above script is running, it will open several pages in your default browser. 
	You can see status of different components of MyGPT pipeline on these pages.
	* backend: http://localhost:8000/

		<img src="https://github.com/mb-group/MyGPT_public/blob/main/images/backend_server.png?raw=true" width="600px">

	* frontend: http://localhost:3000/

		<img src="https://github.com/mb-group/MyGPT_public/blob/main/images/frontend_launch.png?raw=true" width="600px">

5. **Start LLM API server on Mac**

	First, we will run following script to start nginx server to host your LLM API server on Mac:

	```
	bash MyGPT/installation/pc_with_gpu/macOS/start_nginx.sh
	```

	After that, we will start LLM API by running following command:

	```
	bash MyGPT/installation/pc_with_gpu/macOS/start_llm_api.sh
	```

	You can check status of LLM API server at http://localhost/

	<img src="https://github.com/mb-group/MyGPT_public/blob/main/images/llm_api_server.png?raw=true" width="600px">

## MyGPT pipeline usage

### **Upload publications**

* You can upload publication PDFs from backend page: http://localhost:8000/

* You have to define "Library Name" before uploading publication PDFs. You can use same Library Name if you are uploading to same library. If you want to upload to different library, you have to define new Library Name.

* You can upload 15 PDFs at a time. You can upload multiple times to same library.

	<img src="https://github.com/mb-group/MyGPT_public/blob/main/images/backend_server.png?raw=true" width="600px">

### **Add Zotero library**

* To setup Zotero account, you need to create Zotero account and generate API key. You can generate an API key in your profile settings https://www.zotero.org/settings/keys

* Once you generate the key, add it to `MyGPT/.env_backend` as the `ZOTERO_API_KEY` value.

* After that, if you are running MyGPT pipeline stop it with the script below:

	```
	bash MyGPT/installation/pc_with_gpu/macOS/stop_docker.sh
	```

* After that, you have to follow steps 2 to 4 from installtion to run MyGPT pipeline again. 

Now, you can add Zotero library from same backend page: http://localhost:8000/

* We will need Zotero Group ID and Zotero Collection ID. 
You can get it from URL of the library, for example, here is URL for GPCR library:
https://www.zotero.org/groups/4982570/babu_group/collections/YTPMLXYY

* In above URL, `4982570` is Zotero Group ID and `YTPMLXYY` is Zotero Collection ID.

## Other optional tasks for MyGPT pipeline

### create super user

To create super user, run following command:

```
bash MyGPT/installation/pc_with_gpu/macOS/create_superuser.sh
```
You can check backend database at http://localhost:8000/admin/ with username and password you created in above step.

### stop docker containers

To stop docker containers, run following command:

```
bash MyGPT/installation/pc_with_gpu/macOS/stop_docker.sh
```