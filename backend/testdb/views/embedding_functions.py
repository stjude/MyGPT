# imports for embedding functions
from typing import cast, Union
import os
import math
import httpx
import numpy as np
from chromadb.api.types import Documents, EmbeddingFunction, Embeddings
from chromadb.utils.embedding_functions import register_embedding_function

OPENAI_EMBEDDING_MODELS = (
    'text-embedding-3-small',
    'text-embedding-3-large',
    'text-embedding-ada-002',
)


@register_embedding_function
class OpenAIEmbeddingFunction(EmbeddingFunction[Documents]):
    def __init__(self, model_name: str = 'text-embedding-3-small') -> None:
        api_key = os.environ.get('OPENAI_API_KEY', '').strip()
        if not api_key:
            raise ValueError('OPENAI_API_KEY must be configured in .env_backend to use OpenAI embeddings.')
        self._model_name = model_name
        self._session = httpx.Client(
            base_url='https://api.openai.com/v1/',
            headers={'Authorization': f'Bearer {api_key}'},
            timeout=60.0,
        )

    @staticmethod
    def name() -> str:
        return 'mygpt-openai'

    def get_config(self) -> dict[str, str]:
        return {'model_name': self._model_name}

    @staticmethod
    def build_from_config(config: dict[str, str]) -> 'OpenAIEmbeddingFunction':
        return OpenAIEmbeddingFunction(model_name=config['model_name'])

    def __call__(self, input: Documents) -> Embeddings:
        if not input or any(not isinstance(text, str) or not text.strip() for text in input):
            raise ValueError('OpenAI embeddings require non-empty input text.')
        vectors: Embeddings = []
        for offset in range(0, len(input), 100):
            batch = input[offset:offset + 100]
            response = self._session.post(
                'embeddings',
                json={'model': self._model_name, 'input': batch, 'encoding_format': 'float'},
            )
            response.raise_for_status()
            payload = response.json()
            data = payload.get('data') if isinstance(payload, dict) else None
            if not isinstance(data, list) or len(data) != len(batch):
                raise ValueError('OpenAI returned an unexpected number of embeddings.')
            if any(not isinstance(item, dict) or type(item.get('index')) is not int for item in data):
                raise ValueError('OpenAI returned invalid embedding indices.')
            ordered = sorted(data, key=lambda item: item['index'])
            if [item['index'] for item in ordered] != list(range(len(batch))):
                raise ValueError('OpenAI returned invalid embedding indices.')
            for item in ordered:
                embedding = item.get('embedding')
                if (
                    not isinstance(embedding, list) or not embedding
                    or any(type(value) not in (int, float) or not math.isfinite(value) for value in embedding)
                    or (vectors and len(embedding) != len(vectors[0]))
                ):
                    raise ValueError('OpenAI returned an invalid embedding vector.')
                vectors.append(np.array(embedding, dtype=np.float32))
        return vectors


class HuggingFaceEmbeddingFunction(EmbeddingFunction[Documents]):
    """
    This class is used to get embeddings for a list of texts using the HuggingFace API.
    It requires an API key and a model name. The default model name is "sentence-transformers/all-MiniLM-L6-v2".
    """

    def __init__(
        self, api_key: str, model_name: str = "sentence-transformers/all-MiniLM-L6-v2"
    ):
        """
        Initialize the HuggingFaceEmbeddingFunction.

        Args:
            api_key (str): Your API key for the HuggingFace API.
            model_name (str, optional): The name of the model to use for text embeddings. Defaults to "sentence-transformers/all-MiniLM-L6-v2".
        """
        self._api_url = f"https://api-inference.huggingface.co/pipeline/feature-extraction/{model_name}"
        self._session = httpx.Client(timeout=None)
        self._session.headers.update({"Authorization": f"Bearer {api_key}"})

    def __call__(self, input: Documents) -> Embeddings:
        """
        Get the embeddings for a list of texts.

        Args:
            texts (Documents): A list of texts to get embeddings for.

        Returns:
            Embeddings: The embeddings for the texts.

        Example:
            >>> hugging_face = HuggingFaceEmbeddingFunction(api_key="your_api_key")
            >>> texts = ["Hello, world!", "How are you?"]
            >>> embeddings = hugging_face(texts)
        """
        # Call HuggingFace Embedding API for each document
        return cast(
            Embeddings,
            self._session.post(
                self._api_url,
                json={"inputs": input, "options": {"wait_for_model": True}},
            ).json(),
        )
    
class OllamaEmbeddingFunction(EmbeddingFunction[Documents]):
    """
    This class is used to generate embeddings for a list of texts using the Ollama Embedding API (https://github.com/ollama/ollama/blob/main/docs/api.md#generate-embeddings).
    """

    def __init__(self, url: str, model_name: str) -> None:
        """
        Initialize the Ollama Embedding Function.

        Args:
            url (str): The URL of the Ollama Server.
            model_name (str): The name of the model to use for text embeddings. E.g. "nomic-embed-text" (see https://ollama.com/library for available models).
        """
        self._api_url = f"{url}"
        self._model_name = model_name
        self._session = httpx.Client(timeout=None)

    def __call__(self, input: Union[Documents, str]) -> Embeddings:
        """
        Get the embeddings for a list of texts.

        Args:
            input (Documents): A list of texts to get embeddings for.

        Returns:
            Embeddings: The embeddings for the texts.

        Example:
            >>> ollama_ef = OllamaEmbeddingFunction(url="http://localhost:11434/api/embeddings", model_name="nomic-embed-text")
            >>> texts = ["Hello, world!", "How are you?"]
            >>> embeddings = ollama_ef(texts)
        """
        # Call Ollama Server API for each document
        texts = input if isinstance(input, list) else [input]
        embeddings = [
            self._session.post(
                self._api_url, json={"model": self._model_name, "prompt": text}
            ).json()
            for text in texts
        ]
        return cast(
            Embeddings,
            [
                embedding["embedding"]
                for embedding in embeddings
                if "embedding" in embedding
            ],
        )
    
class RayEmbeddingFunction(EmbeddingFunction[Documents]):
    """
    This class is used to generate embeddings for a list of texts using the Ollama Embedding API (https://github.com/ollama/ollama/blob/main/docs/api.md#generate-embeddings).
    """

    def __init__(self, url: str, model_name: str) -> None:
        """
        Initialize the Ray Embedding Function.

        Args:
            url (str): The URL of the Ray Server.
            model_name (str): The name of the model to use for text embeddings. E.g. "nomic-embed-text" (see https://ollama.com/library for available models).
        """
        self._api_url = f"{url}"
        self._model_name = model_name
        self._session = httpx.Client(timeout=None)

    def __call__(self, input: Union[Documents, str]) -> Embeddings:
        """
        Get the embeddings for a list of texts.

        Args:
            input (Documents): A list of texts to get embeddings for.

        Returns:
            Embeddings: The embeddings for the texts.

        Example:
            >>> ray_ef = RayEmbeddingFunction(url="http://ray_server_url/v2/models/ray_gateway_router/infer", model_name="nomic-embed-text-v1.5")
            >>> texts = ["Hello, world!", "How are you?"]
            >>> embeddings = ray_ef(texts)
        """
        # Call Ray Server API for each document
        texts = input if isinstance(input, list) else [input]
        results = [
            self._session.post(
                self._api_url, json={
                    "inputs":
                        [
                            {"model_name": self._model_name, "inputs": {"text": text}}
                        ]
                }
            ).json()
            for text in texts
        ]
        return cast(
            Embeddings,
            [
                result["outputs"][0]["embeddings"][0]
                for result in results
                if (result and "outputs" in result and
                isinstance(result["outputs"], list) and
                len(result["outputs"]) > 0 and
                "embeddings" in result["outputs"][0])
            ],
        )