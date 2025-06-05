# lm-eval.py

`lm-eval.py` provides basic benchmark capability for LLM feedback-based evolutionary task solving. The benchmark framework is [EleutherAI's lm-evaluation-harness](https://github.com/EleutherAI/lm-evaluation-harness).

*Limitation:* Only generation-only tasks such as gsm8k are supported. This is because tasks that require loglikelihood probabilities are not well applicable to agents.

## Usage

```bash
$ python3 examples/lm_eval/lm-eval.py -h
usage: lm-eval.py [-h] [--config CONFIG] [--init_file INIT_FILE] [--evaluator_file EVALUATOR_FILE] [--iterations ITERATIONS] [--limit LIMIT] [--tasks TASKS]
                  [--output_path OUTPUT_PATH]

OpenEvolve <-> lm-evaluation-harness adapter.

options:
  -h, --help            show this help message and exit
  --config CONFIG       config file
  --init_file INIT_FILE
                        initial content file
  --evaluator_file EVALUATOR_FILE
                        evaluator file
  --iterations ITERATIONS
                        number of iterations
  --limit LIMIT         limit the number of examples per task that are executed
  --tasks TASKS         list of tasks to evaluate
  --output_path OUTPUT_PATH
                        output path for results
```

## Example Results

GSM8K is a benchmark dataset for arithmetic reasoning, with 8500 grade school level math problems. See SotA benchmark results at https://paperswithcode.com/sota/arithmetic-reasoning-on-gsm8k.

The table below summarizes example results with OpenEvolve. The expectation would be that with more iterations, even when primary and secondary model are both weaker than those in the SotA benchmark, eventually a similar accuracy will be hit. First results below:

for the `gsm8k` benchmark, using a limit of 10 examples and different numbers of iterations.
- gsm8k
  - gemma3:12b-it-qat / llama-4-scout-17b-16e-instruct / gemma3:12b-it-qat, limit 20, iterations 1: 50%
  - gemma3:12b-it-qat / (llama-4-scout-17b-16e-instruct) / gemma3:12b-it-qat, limit 20, iterations 10: 70%
  - gemma3:12b-it-qat / llama-4-scout-17b-16e-instruct / gemma3:12b-it-qat, limit 20, iterations 20:

--old values below:--
  - `llama3.1-8b`/`llama-4-scout-17b-16e-instruct`/`llama3.1-8b`, limit 10, iterations 1: 30%
  - `llama3.1-8b`/`llama-4-scout-17b-16e-instruct`/`llama3.1-8b`, limit 10, iterations 2: 40%
  - `llama3.1-8b`/`llama-4-scout-17b-16e-instruct`/`llama3.1-8b`, limit 10, iterations 3: 70%
  - qwen-3-32b / deepseek-r1-distill-llama-70b / qwen-3-32b, limit 1, iterations 10: 100%
  - qwen-3-32b / deepseek-r1-distill-llama-70b / qwen-3-32b, limit 20, iterations 10: 95% ; =100 0000 tokens.
  - qwen-3-32b / deepseek-r1-distill-llama-70b / qwen-3-32b, limit 14, iterations 1: 57%
  20/8500 problems, 10 instead of 100 iterations. 425*10 more tokens needed to do full gsm8k with 100 iterations => 425 000 000

| Benchmark | Limit | Iterations | `llama-3.3-70b`/`llama-4-scout-17b-16e-instruct` | `llama3.1-8b`/`llama-4-scout-17b-16e-instruct` |
|-----------|-------|------------|-----------------------------------------|-----------------------------------------------|
| gsm8k     | 10    | 1          | ??                                      | 30.0%                                         |
| gsm8k     | 10    | 2          | ??                                      | 40.0%                                         |
| gsm8k     | 10    | 3          | ??                                      | 70.0%                                         |
| gsm8k     | 10    | 10         | ??                                      | ??                                            |
| gsm8k     | 10    | 15         | ??                                      | ??                                            |
| gsm8k     | 5     | 100        | ??                                      | ??                                            |

*Note: These early examples were meant to indicate that more evolution iterations might improve task performance, but the prompting may not be ideal yet.*

## Warning

- Be aware that this is an early implementation. No extensive benchmarks have been executed so far. With a limit to 10 tasks and 10 iterations, the benchmark is meaningless as is.
- Use the --limit parameter only for tests, not for metric generation.
- Do not cite the metrics that result from the script execution blindly without reviewing the solution first.

## References

```bibtex
@misc{eval-harness,
    author       = {Gao, Leo and Tow, Jonathan and Abbasi, Baber and Biderman, Stella and Black, Sid and DiPofi, Anthony and Foster, Charles and Golding, Laurence and Hsu, Jeffrey and Le Noac'h, Alain and Li, Haonan and McDonell, Kyle and Muennighoff, Niklas and Ociepa, Chris and Phang, Jason and Reynolds, Laria and Schoelkopf, Hailey and Skowron, Aviya and Sutawika, Lintang and Tang, Eric and Thite, Anish and Wang, Ben and Wang, Kevin and Zou, Andy},
    title        = {The Language Model Evaluation Harness},
    month        = 07,
    year         = 2024,
    publisher    = {Zenodo},
    version      = {v0.4.3},
    doi          = {10.5281/zenodo.12608602},
    url          = {https://zenodo.org/records/12608602}
}
```