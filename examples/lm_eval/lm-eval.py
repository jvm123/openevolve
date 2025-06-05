"""
OpenEvolve <-> lm-evaluation-harness adapter

Implements generation only, no loglikelihood. Tasks such as GSM8K / BoolQ / MMLU-Math /
AQUA-RAT and most code suites should work fine because they grade on the generated
answer string.
"""

from __future__ import annotations
import logging
import subprocess, tempfile, json, os, argparse, math, pathlib
from pathlib import Path
from typing import List, Dict, Tuple, Any, Iterable

import lm_eval
from lm_eval.tasks import TaskManager
from lm_eval.evaluator import evaluate
from lm_eval.api.model import LM
from lm_eval.api.registry import register_model
from datetime import datetime

logger = logging.getLogger(__name__)

# cd to the parent parent directory of this file
os.chdir(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

PIPELINE_CMD = ["python3", "openevolve-run.py"]


@register_model("openevolve")
class OpenEvolve(LM):
    PROMPT_REL_PATH = "prompts/system_message.txt"
    EVALUATOR_PROMPT_REL_PATH = "prompts/evaluator_system_message.txt"
    BEST_REL_PATH = "openevolve_output/best/best_program.txt"

    def __init__(
        self,
        base_path: str = "examples/lm_eval/",
        init_file: str = "initial_content_stub.txt",
        evaluator_file: str = "evaluator_stub.py",
        config_file: str = "config.yml",
        iterations: int = 5,
        extra_param: List[str] = [],
        log_level: str = "INFO",
        **kwargs,
    ):
        super().__init__()
        self.init_file = init_file
        self.evaluator_file = evaluator_file
        self.iterations = iterations
        self.extra_param = extra_param
        self.config_file = config_file
        self.log_level = log_level

        # Build file paths from base_path and relative constants
        self.prompt_path = os.path.join(base_path, self.PROMPT_REL_PATH)
        self.evaluator_prompt_path = os.path.join(base_path, self.EVALUATOR_PROMPT_REL_PATH)
        self.best_path = os.path.join(base_path, self.BEST_REL_PATH)
        self.base_system_message = "" #"You are an expert task solver, with a lot of commonsense, math, language and coding knowledge.  You are in a test scenario and must solve tasks. Important: If the task does not clearly indicate that this is a coding exercise, assume it is a natural language task, and give a natural language response! Otherwise the benchmark would fail, for there is no automatic code execution! To succeed in the exercise, the answer must be in the same output format as in the examples in the task, and output nothing else. A dumb string match will measure your success."

    def generate(self, prompts: List[str], max_gen_toks: int = None, stop=None, **kwargs):
        outs = []
        total = len(prompts)
        for idx, prompt in enumerate(prompts, 1):
            logging.info(f"Processing prompt {idx}/{total}...")

            # Task prompt becomes the system message. User prompt is the evolutionary logic.
            # We create temporary prompt files with the system message
            with Path(self.init_file).open("w") as f:
                f.write(prompt)

            with Path(self.prompt_path).open("w") as f:
                f.write(self.base_system_message.format(prompt=prompt))

            with Path(self.evaluator_prompt_path).open("w") as f:
                f.write(self.base_system_message.format(prompt=prompt))

            cmd = (
                PIPELINE_CMD
                + ["--log-level", self.log_level]
                + ["--config", self.config_file]
                + ["--iterations", str(self.iterations)]
                + self.extra_param
                + [self.init_file, self.evaluator_file]
            )
            logging.debug(f"Running command: {' '.join(cmd)}")
            try:
                res = subprocess.run(cmd, capture_output=True, text=True, check=True)
                text = res.stdout.strip()
                logging.debug(f"Process output: {text}")
            except subprocess.CalledProcessError as e:
                logging.debug(f"Command failed with return code {e.returncode}")
                logging.debug(f"stderr: {e.stderr}")
                text = ""

            logging.debug(f"# Prompt: {prompt}")
            with Path(self.best_path).open("r") as f:
                best = f.read().strip()
                logging.debug(f"# Answer: {best}")

            # honour stop tokens
            if stop:
                for s in stop:
                    idx = best.find(s)
                    if idx != -1:
                        best = best[:idx]
                        break
            outs.append(best)
        return outs

    # For tasks that ask for log likelihood, indicate that it is unsupported
    def loglikelihood(self, requests: Iterable[Tuple[str, str]], **kw):
        # return [(-math.inf, False) for _ in requests]
        raise NotImplementedError

    def loglikelihood_rolling(self, requests: Iterable[str], **kw):
        # return [(-math.inf, False) for _ in requests]
        raise NotImplementedError

    def generate_until(self, requests: Iterable[Any], **kw) -> List[str]:
        ctxs, stops = [], []

        for req in requests:
            if isinstance(req, tuple):
                ctx, until = req
            else:
                ctx = req.args[0]  # first positional arg
                until = []
                # If a second positional arg exists and is list-like,
                # treat it as the stop sequence
                if len(req.args) > 1 and isinstance(req.args[1], (list, tuple)):
                    until = list(req.args[1])

            ctxs.append(ctx)
            stops.append(until)

        # Run the generator once per context
        gens = self.generate(ctxs, stop=None)

        # Post-trim at the first stop sequence
        cleaned = []
        for g, until in zip(gens, stops):
            for s in until:
                idx = g.find(s)
                if idx != -1:
                    g = g[:idx]
                    break
            cleaned.append(g)
        return cleaned


if __name__ == "__main__":
    # cli arguments for primary model, secondary model, iterations, config and tasks
    p = argparse.ArgumentParser(
        description="OpenEvolve <-> lm-evaluation-harness adapter.",
    )
    p.add_argument("--config", default="examples/lm_eval/config.yml", help="config file")
    p.add_argument(
        "--init_file",
        default="examples/lm_eval/initial_content_stub.txt",
        help="Initial content file",
    )
    p.add_argument(
        "--evaluator_file", default="examples/lm_eval/evaluator_stub.py", help="Evaluator program file"
    )
    p.add_argument("--iterations", default=5, type=int, help="number of iterations")
    p.add_argument(
        "--limit",
        default=None,
        type=int,
        help="Limit the number of examples per task that are executed",
    )
    # p.add_argument("--tasks", default="boolq,gsm8k,mmlu", help="comma-list of tasks to evaluate")
    p.add_argument("--tasks", default="gsm8k", help="list of tasks to evaluate")
    p.add_argument("--output_path", default="results", help="output path for results")
    p.add_argument(
        "--log-level",
        "-l",
        help="Logging level",
        choices=["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"],
        default="INFO",
    )
    args = p.parse_args()

    # Set up logging
    logging.basicConfig(
        level=getattr(logging, args.log_level.upper()),
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )

    # Print info on tasks, limit and iterations
    logging.info(f"Evaluating tasks: {args.tasks}")
    if args.limit:
        logging.info(f"Limiting each task to {args.limit} examples")
    else:
        logging.info("No limit on number of examples per task")
    logging.info(f"Iterations per example: {args.iterations}")

    lm_obj = OpenEvolve(
        init_file=args.init_file,
        evaluator_file=args.evaluator_file,
        iterations=args.iterations,
        config_file=args.config,
        log_level=args.log_level,
    )

    task_dict = lm_eval.tasks.get_task_dict(args.tasks.split(","))

    results = evaluate(
        lm=lm_obj,
        task_dict=task_dict,
        limit=args.limit,
    )

    # Write out the results
    pathlib.Path(
        args.output_path,
    ).mkdir(exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    results_path = pathlib.Path(
        os.path.join(
            args.output_path,
            f"{timestamp}_iter{args.iterations}.json",
        )
    )

    with results_path.open("w") as f:
        json.dump(results, f, indent=2)

    # Print result summary
    short = {}
    for task, metrics in results["results"].items():
        # Pick the first value that is a real number
        for key, val in metrics.items():
            if isinstance(val, (int, float)):
                short[task] = (key, val)  # store *both* name & value
                break

    logging.info(f"Full results written to {results_path}\n")
    logging.info("Headline metrics:")
    for task, (name, value) in short.items():
        logging.info(f"  {task:<15} {name:<12} {value:.3%}")

    logging.info("\nNote: Never cite the overall average when some components were skipped!")
