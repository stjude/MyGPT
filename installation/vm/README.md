# Installation on Linux Server/VM

## Requirements
For this installation, we recommand to host User interface (UI), Backend server and Ollama (LLM server) on 3 seperate VMs. The Ollama VM should have a GPU with CUDA installed on the server/VM.

The server/VM should have the following requirements:

| MyGPT Component | RAM | CPU | Disk Space | OS | Additional Hardware/ Software |
| --- | --- | --- | --- | --- | --- |
| Frontend (UI) server | 8GB | 2 cores | 10GB | Ubuntu 20.04 LTS/ Red Hat Linux | Apache2 |
| Backend server | 32GB | 8 cores | 100GB | Ubuntu 20.04 LTS/ Red Hat Linux | Docker, Docker Compose |
| Ollama (LLM server) | 32GB | 12 cores | 100GB | Ubuntu 20.04 LTS/ Red Hat Linux | NVIDIA GPU (Tesla V100, P100, P4, T4, A100), CUDA |

## Installation

### Frontend (UI) server

1. Install Apache2
	```bash
	sudo apt update
	sudo apt install apache2
	```

2. Build the frontend on your local machine
	```bash
	git clone https://github.com/stjude/MyGPT.git
	cd MyGPT/frontend
	npm install
	npm run build
	```

3. Copy the build files to the server
	```bash
	scp -r build/ user@server:/var/www/html/
	```

4. Access the UI on the browser
	```
	http://<server-ip>/index.html
	```

### Backend server

1. Install Docker and Docker Compose

	Check if you have `docker` installed on your system by running following command.

	```bash
	docker --version
	```

	If you get an error that `docker not found`,   Go to the official Docker installation page for Linux and install the appropriate Docker on your system: https://docs.docker.com/desktop/install/linux-install/

2. Clone the backend repository
	If you have zip file with MyGPT installation instructions, you can unzip it and copy it on your desktop or your desired location. You can skip remaining instructions from below and go to Step 2.

	Or you can get installation instructions by running following command from Terminal. It will create `MyGPT` folder on your Desktop or desired folder. To get this from GitHub, we will need `GitHub username` and `GitHub access token` as the GitHub repo is private. When you run the following command, it will ask for this credentials.

	```bash
	git clone https://github.com/stjude/MyGPT.git
	```

3. Create the backend runtime environment file
	Create the ignored root file from its tracked template, then replace every placeholder with a secure value:
	
	```bash
	cd MyGPT
	cp .env_backend.example .env_backend
	vi .env_backend
	```

	Follow [Configure backend secrets](../../backend/README.md#configure-backend-secrets) to generate `SECRET_KEY` locally and create `HUGGINGFACE_API_KEY`, then save `.env_backend`.

	Docker Compose injects these values when the containers start. The file is excluded from Git and Docker build contexts and is not copied into the image.

4. Edit the `settings.py` file in Django app
	Edit the `settings.py` file in the `backend` folder and change the following fields.

	* CORS_ALLOWED_ORIGINS (line 37): `CORS_ALLOWED_ORIGINS = ['https://<frontend-url>']`
	* CSRF_TRUSTED_ORIGINS (line 41): `CSRF_TRUSTED_ORIGINS = ['https://<backend-url>']`

5. Build the backend server
	To build the backend server, go to the backend folder and run the following command.

	```bash
	cd MyGPT
	docker-compose build backend
	```

6. Build Grobid server
	To build the Grobid server, go to the backend folder and run the following command.

	```bash
	cd MyGPT
	docker-compose build grobid
	```

7. Edit nginx configuration
	Edit the `nginx.conf` file in the `nginx` folder and change `dafault.conf` file for following fields.

	* server_name (line 9): `server_name <server-url>;`
	* return 301 (line 23): `return 301 `<server-utl>$request_uri;`
	* server_name (line 44): `server_name <server-url>;`
	* ssl_certificate (line 46): `ssl_certificate <path-to-.pem-file>;`
	* ssl_certificate_key (line 47): `ssl_certificate_key <path-to-.key-file>;`

8. Build nginx server
	To build the nginx server, go to the backend folder and run the following command.

	```bash
	cd MyGPT
	docker-compose build nginx
	```

9. Run the backend server
	To run the backend server, go to the backend folder and run the following command.

	```
	cd MyGPT
	docker-compose up -d db
	docker-compose up -d backend
	docker-compose up -d grobid
	docker-compose up -d nginx
	```

	You can access the backend server on the browser using the following URL.

	```
	http://<server-url>
	```


### Ollama (LLM server)

To install Ollama on the server, follow the instructions in the [Ollama installation guide](https://github.com/ollama/ollama/blob/main/docs/linux.md).

Pull the latest LLM models by running the following commands:

```bash
ollama pull llama3
ollama pull llama3.1
ollam pull gpt-oss
```

Also, get the nomic embedding model, which is best performing embedding model for MyGPT pipeline, by running following command:

```bash
ollama pull nomic-embed-text
```

We also recommand to change envrironment variables in the `ollama` folder and set the following by following guide from Ollama

[How do I configure Ollama server?](https://github.com/ollama/ollama/blob/main/docs/linux.md)

We also securely hosted Ollama server using Nginx. You can follow the instructions in the [Nginx configuration guide for Ollama](https://github.com/ollama/ollama/blob/main/docs/faq.md#how-can-i-use-ollama-with-a-proxy-server)