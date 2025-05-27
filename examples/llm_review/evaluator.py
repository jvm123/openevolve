import os
from smolagents.local_python_executor import LocalPythonExecutor
from openvolve.llm import ensemble

class LLMReviewers(LLMEnsemble):
    def __init__(
        config_path: Optional[str] = None,
        config: Optional[Config] = None,
    ):
        # Load configuration
        if config_path:
            config = load_config(config_path)

        # Call the parent constructor to load the models
        super().__init__(config)

    def _generate_json(self, model: LLMInterface, prompt: str, **kwargs) -> Dict[str, float]:
        """Generate JSON"""
        retries = kwargs.get("retries", self.config.retries)

        for attempt in range(retries + 1):
            try:
                response = await model.generate(prompt, **kwargs)
                response_json = json.loads(response)
                return response_json
            except json.JSONDecodeError as e:
                if attempt < retries:
                    logger.warning(
                        f"Invalid json response on attempt {attempt + 1}/{retries + 1}: {str(e)}. Retrying..."
                    )
                else:
                    logger.error(f"All {retries + 1} attempts failed with a JSON decoding error: {e}")
                    raise

    def generate_weighted_metrics(prompt: str, **kwargs) -> Dict[str, float]:
        """Generate metrics using the ensemble of LLMs"""
        # Retrieve model responses
        metrics = []
        for model in self.models:
            try:
                response_json = model.generate_json(model, prompt, **kwargs)
                if not isinstance(response, dict):
                    raise TypeError(f"Expected response to be a dict, but got {type(response).__name__}")
                metrics.append(response_json)
            except Exception as e:
                logger.error(f"Error generating response with model {model.name}: {str(e)}, cancelling evaluation")
        logging.info(f"Generated metrics: {metrics}")

        # With the weights from self.models["weight"], calculate a weighted average
        weighted_metrics = {}
        for metric in metrics:
            for key, value in metric.items():
                if key not in weighted_metrics:
                    weighted_metrics[key] = 0.0
                weighted_metrics[key] += value * self._weights[metrics.index(metric)]

        return weighted_metrics

def load_file(file_path):
    try:
        with open(file_path, 'r') as file:
            return file.read()
    except Exception as e:
        return {"error": str(e)}

def evaluate_stage1(file_path):
    try:
        content = load_file(file_path)
        prompt = """Evaluate the following content:

--

{content}."""

        config_path = os.path.join(os.path.dirname(__file__), "config_llm_reviewers.yaml")
        llm_reviewers = LLMReviewers(config_path)  # TODO: persist the class instance
        eval = llm_reviewers.generate_weighted_metrics(prompt)

        return eval
    except Exception as e:
        return {"error": str(e)}

def evaluate(file_path):
    return evaluate_stage1(file_path)

# main
if __name__ == "__main__":
    import sys

    if len(sys.argv) != 2:
        print("Usage: python evaluator.py <program_path>")
        sys.exit(1)

    program_path = sys.argv[1]
    result = evaluate(program_path)
    print(result)
