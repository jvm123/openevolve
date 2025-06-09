# Content writing example

This example showcases a config.yaml file and prompts optimized for the LLM evolution and evaluation of content other than code.

To apply this to different content generation use cases, modify
- prompts/system_message.txt
- prompts/evaluator_system_message.txt
- prompts/evaluation.txt

The first two files describe the use case of the content creation, and the evaluation.txt describes the LLM feedback metrics. These decide what you are optimizing your content for.

In initial_content.txt provide either a version of your content you want to iterate upon, or a placeholder, optionally with a description of the sort of content you imagine.

## Execution

Run with
```bash
python3 openevolve-run.py --iterations 100 --config examples/content_writing/config.yml examples/content_writing/initial_content.txt examples/content_writing/evaluator.py
```
