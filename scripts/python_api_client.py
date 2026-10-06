#!/usr/bin/env python3
"""
MyGPT Standalone Python API Client
==================================
Demonstrates how to interact with the MyGPT Desktop backend programmatically
using standard Python and REST requests.

Requirements:
    pip install requests

Usage:
    python python_api_client.py --base-url http://127.0.0.1:8000
"""

import sys
import argparse
import requests
from typing import Dict, Any, List, Optional

class MyGPTClient:
    """Client for interacting with MyGPT REST API."""

    def __init__(self, base_url: str = "http://127.0.0.1:8000"):
        self.base_url = base_url.rstrip("/")
        self.access_token: Optional[str] = None
        self.refresh_token: Optional[str] = None
        self.session = requests.Session()

    def get_headers(self) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.access_token:
            headers["Authorization"] = f"Bearer {self.access_token}"
        return headers

    def authenticate(self, username: str, password: str) -> bool:
        """Authenticate with Django credentials to acquire a JWT token pair."""
        url = f"{self.base_url}/token/"
        try:
            res = self.session.post(url, json={"username": username, "password": password})
            if res.status_code == 200:
                data = res.json()
                self.access_token = data.get("access")
                self.refresh_token = data.get("refresh")
                print(f"[AUTH] Successfully authenticated as '{username}'")
                return True
            else:
                print(f"[AUTH ERROR] Failed with status {res.status_code}: {res.text}")
                return False
        except Exception as e:
            print(f"[AUTH ERROR] Connection error: {e}")
            return False

    def list_datasets(self) -> List[Dict[str, Any]]:
        """Fetch list of all document libraries / datasets."""
        url = f"{self.base_url}/api/get_datasets/"
        res = self.session.post(url, json={"user_email": "", "user_group": ""}, headers=self.get_headers())
        res.raise_for_status()
        return res.json()

    def get_context(self, question: str, dataset: str, model: str = "gpt-oss:20b", embedding_model: str = "nomic-embed-text:latest", max_chunks: int = 5) -> Dict[str, Any]:
        """Perform semantic search / RAG retrieval for relevant text chunks."""
        url = f"{self.base_url}/api/get_context/"
        payload = {
            "text": question,
            "dataset": dataset,
            "model_type": model,
            "use_default_qrs": True,
            "question_best_distance": 0.2,
            "question_worst_distance": 1.7,
            "maximum_chunks_count": max_chunks,
            "no_cutoff": False,
            "new_conversation": True,
            "previous_query": "",
            "no_context": False,
            "selected_embedding_model": embedding_model,
        }
        res = self.session.post(url, json=payload, headers=self.get_headers())
        res.raise_for_status()
        return res.json()

    def generate_llm_response(self, prompt: str, model: str = "gpt-oss:20b", temperature: float = 0.3) -> str:
        """Query the Ollama LLM endpoint directly."""
        url = f"{self.base_url}/api/ollama_generate/"
        payload = {
            "model": model,
            "prompt": prompt,
            "temperature": temperature,
            "stream": False
        }
        res = self.session.post(url, json=payload, headers=self.get_headers())
        res.raise_for_status()
        return res.json().get("response", "")

    def ask_rag(self, question: str, dataset: str, model: str = "gpt-oss:20b") -> str:
        """Full end-to-end RAG pipeline: retrieves context from dataset and queries Ollama LLM."""
        print(f"\n[RAG] Searching context in dataset '{dataset}' for: '{question}'...")
        context_data = self.get_context(question=question, dataset=dataset, model=model)
        
        sources = context_data.get("sources", [])
        full_context = context_data.get("context", "")
        if not sources and not full_context.strip():
            print("[RAG] No document context retrieved. Querying LLM directly...")
            context_text = "No document context available."
        else:
            print(f"[RAG] Retrieved {len(sources)} relevant context source(s).")
            context_text = full_context.strip() if full_context.strip() else "\n\n---\n\n".join([s.get("context", "") for s in sources[:3]])

        prompt = (
            f"### INSTRUCTIONS ###\n"
            f"Use the following context from the user's research publications to answer the question.\n\n"
            f"### CONTEXT ###\n{context_text}\n\n"
            f"### QUESTION ###\n{question}\n\n"
            f"### ANSWER ###\n"
        )

        print("[RAG] Generating response with Ollama LLM...")
        return self.generate_llm_response(prompt=prompt, model=model)

    def upload_document(self, file_path: str, dataset: str, embedding_model: str = "nomic-embed-text:latest") -> Dict[str, Any]:
        """Upload a PDF document to a dataset."""
        url = f"{self.base_url}/api/upload_documents/"
        headers = {}
        if self.access_token:
            headers["Authorization"] = f"Bearer {self.access_token}"
        
        with open(file_path, "rb") as f:
            files = {"file": f}
            data = {
                "dataset": dataset,
                "embedding_model": embedding_model
            }
            res = self.session.post(url, data=data, files=files, headers=headers)
            res.raise_for_status()
            return res.json()


def main():
    parser = argparse.ArgumentParser(description="MyGPT Python API Client")
    parser.add_argument("--base-url", default="http://127.0.0.1:8000", help="MyGPT API Base URL")
    parser.add_argument("--username", default="", help="Django username (optional)")
    parser.add_argument("--password", default="", help="Django password (optional)")
    parser.add_argument("--dataset", default="", help="Dataset name to query")
    parser.add_argument("--question", default="What is MyGPT and how does it prevent hallucinations?", help="Question to ask")
    parser.add_argument("--model", default="gpt-oss:20b", help="Ollama LLM model name")
    args = parser.parse_args()

    client = MyGPTClient(base_url=args.base_url)

    print("==================================================")
    print("           MyGPT Python Client Demo               ")
    print("==================================================")
    print(f"Connecting to: {client.base_url}")

    if args.username and args.password:
        client.authenticate(args.username, args.password)

    # 1. Fetch available datasets
    try:
        datasets = client.list_datasets()
        print(f"\nAvailable Datasets ({len(datasets)}):")
        for d in datasets:
            print(f"  • {d.get('dataset_name')} [Embedding: {d.get('embedding_model')}]")
        
        target_dataset = args.dataset if args.dataset else (datasets[0].get("dataset_name") if datasets else "demo")
        
        # 2. Run RAG Question
        print(f"\nAsking Question on '{target_dataset}':\n>> {args.question}")
        answer = client.ask_rag(question=args.question, dataset=target_dataset, model=args.model)
        print("\nAnswer:\n" + "=" * 50)
        print(answer)
        print("=" * 50)

    except Exception as e:
        print(f"\nNote: Could not complete demo: {e}")
        print("Make sure MyGPT Desktop backend is running at:", args.base_url)

if __name__ == "__main__":
    main()
