"""
Model ensemble for LLMs
"""

import asyncio
import logging
import random
from typing import Dict, List, Optional, Tuple

from openevolve.config import LLMConfig
from openevolve.llm.base import LLMInterface
from openevolve.llm.openai import OpenAILLM

logger = logging.getLogger(__name__)


class LLMEnsemble:
    """Ensemble of LLMs for generating diverse code modifications"""

    def __init__(self, config: LLMConfig):
        self.config = config

        # Initialize models from the configuration
        self.models = [OpenAILLM(config, model=model["name"]) for model in config.models]

        # Extract and normalize model weights
        self._weights = [model["weight"] for model in config.models]
        total = sum(self._weights)
        self._weights = [w / total for w in self._weights]

        logger.info(
            f"Initialized LLM ensemble with models: "
            + ", ".join(
                f"{model['name']} (weight: {weight:.2f})"
                for model, weight in zip(config.models, self._weights)
            )
        )

    async def generate(self, prompt: str, **kwargs) -> str:
        """Generate text using a randomly selected model based on weights"""
        model = self._sample_model()
        return await model.generate(prompt, **kwargs)

    async def generate_with_context(
        self, system_message: str, messages: List[Dict[str, str]], **kwargs
    ) -> str:
        """Generate text using a system message and conversational context"""
        model = self._sample_model()
        return await model.generate_with_context(system_message, messages, **kwargs)

    def _sample_model(self) -> LLMInterface:
        """Sample a model from the ensemble based on weights"""
        index = random.choices(range(len(self.models)), weights=self._weights, k=1)[0]
        return self.models[index]

    async def generate_multiple(self, prompt: str, n: int, **kwargs) -> List[str]:
        """Generate multiple texts in parallel"""
        tasks = [self.generate(prompt, **kwargs) for _ in range(n)]
        return await asyncio.gather(*tasks)

    async def parallel_generate(self, prompts: List[str], **kwargs) -> List[str]:
        """Generate responses for multiple prompts in parallel"""
        tasks = [self.generate(prompt, **kwargs) for prompt in prompts]
        return await asyncio.gather(*tasks)
