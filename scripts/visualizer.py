import os
import json
import glob
import logging
import shutil
from flask import Flask, render_template, render_template_string, jsonify


logger = logging.getLogger("openevolve.visualizer")
app = Flask(__name__, template_folder="templates")

def find_latest_checkpoint(base_folder):
    # Check whether the base folder is itself a checkpoint folder
    if os.path.basename(base_folder).startswith("checkpoint_"):
        return base_folder

    checkpoint_folders = glob.glob("**/checkpoint_*", root_dir=base_folder, recursive=True)
    if not checkpoint_folders:
        logger.info(f"No checkpoint folders found in {base_folder}")
        return None
    checkpoint_folders = [os.path.join(base_folder, folder) for folder in checkpoint_folders]
    checkpoint_folders.sort(key=lambda x: os.path.getmtime(x), reverse=True)
    logger.debug(f"Found checkpoint folder: {checkpoint_folders[0]}")
    return checkpoint_folders[0]


def load_evolution_data(checkpoint_folder):
    meta_path = os.path.join(checkpoint_folder, "metadata.json")
    programs_dir = os.path.join(checkpoint_folder, "programs")
    if not os.path.exists(meta_path) or not os.path.exists(programs_dir):
        logger.info(f"Missing metadata.json or programs dir in {checkpoint_folder}")
        return {"archive": [], "nodes": [], "edges": [], "checkpoint_dir": checkpoint_folder}
    with open(meta_path) as f:
        meta = json.load(f)

    nodes = []
    id_to_program = {}
    for island_idx, id_list in enumerate(meta.get("islands", [])):
        for pid in id_list:
            prog_path = os.path.join(programs_dir, f"{pid}.json")
            if os.path.exists(prog_path):
                with open(prog_path) as pf:
                    prog = json.load(pf)
                prog["island"] = island_idx
                nodes.append(prog)
                id_to_program[pid] = prog
            else:
                logger.debug(f"Program file not found: {prog_path}")

    edges = []
    for prog in nodes:
        parent_id = prog.get("parent_id")
        if parent_id and parent_id in id_to_program:
            edges.append({"source": parent_id, "target": prog["id"]})

    logger.info(f"Loaded {len(nodes)} nodes and {len(edges)} edges from {checkpoint_folder}")
    return {
        "archive": meta.get("archive", []),
        "nodes": nodes,
        "edges": edges,
        "checkpoint_dir": checkpoint_folder,
    }


@app.route("/")
def index():
    return render_template("index.html", checkpoint_dir=checkpoint_dir)


checkpoint_dir = None  # Global variable to store the checkpoint directory


@app.route("/api/data")
def data():
    global checkpoint_dir
    base_folder = os.environ.get("EVOLVE_OUTPUT", "examples/")
    checkpoint_dir = find_latest_checkpoint(base_folder)
    if not checkpoint_dir:
        logger.info(f"No checkpoints found in {base_folder}")
        return jsonify({"archive": [], "nodes": [], "edges": [], "checkpoint_dir": ""})

    logger.info(f"Loading data from checkpoint: {checkpoint_dir}")
    data = load_evolution_data(checkpoint_dir)
    logger.debug(f"Data: {data}")
    return jsonify(data)


@app.route("/program/<program_id>")
def program_page(program_id):
    global checkpoint_dir
    if checkpoint_dir is None:
        return "No checkpoint loaded", 500

    data = load_evolution_data(checkpoint_dir)
    program_data = next((p for p in data["nodes"] if p["id"] == program_id), None)
    program_data = {"code": "", "prompts": {}, **program_data}

    return render_template(
        "program_page.html", program_data=program_data, checkpoint_dir=checkpoint_dir
    )


def static_export(output_path, base_folder):
    import re
    # Find latest checkpoint and load data
    checkpoint_dir = find_latest_checkpoint(base_folder)
    if not checkpoint_dir:
        raise RuntimeError(f"No checkpoint found in {base_folder}")
    data = load_evolution_data(checkpoint_dir)
    logger.info(f"Exporting visualization for checkpoint: {checkpoint_dir}")

    # Read and concatenate all JS and CSS files
    static_dir = os.path.join(os.path.dirname(__file__), "static")
    templates_dir = os.path.join(os.path.dirname(__file__), "templates")
    # Ensure main.js is last in the static export for correct dependency order
    js_files = [
        'js/graph.js',
        'js/performance.js',
        'js/sidebar.js',
        'js/list.js',
        'js/mainUI.js',
        'js/main.js',
    ]
    css_files = ['css/main.css']

    def strip_import_export(js):
        lines = js.splitlines()
        filtered = []
        exports = []
        for line in lines:
            stripped = line.strip()
            if stripped.startswith('import '):
                continue
            if stripped.startswith('export {'):
                # Collect exported names from export block
                names = re.findall(r'\b([a-zA-Z0-9_]+)\b', line)
                exports.extend([n for n in names if n != 'export'])
                continue
            if stripped.startswith('export '):
                # Remove 'export ' from function/const/class declarations
                m = re.match(r'export (function|const|let|var|class) ([a-zA-Z0-9_]+)', stripped)
                if m:
                    exports.append(m.group(2))
                filtered.append(line.replace('export ', '', 1))
                continue
            filtered.append(line)
        return '\n'.join(filtered), exports

    # Python-only static export: concatenate all JS into a single <script type="module"> block
    js_code = ''
    for jsf in js_files:
        with open(os.path.join(static_dir, jsf), 'r', encoding='utf-8') as f:
            file_content = f.read()
            # Strip all import/export lines for static export
            file_content, _ = strip_import_export(file_content)
            js_code += f'// ---- {jsf} ----\n{file_content}\n'
    # Inline as a single <script type="module">
    js_code = f'<script type="module">\n{js_code}\n</script>\n'

    css_code = ''
    for cssf in css_files:
        with open(os.path.join(static_dir, cssf), 'r', encoding='utf-8') as f:
            css_code += f"\n/* ---- {cssf} ---- */\n" + f.read()

    # Fetch the HTML template
    template_path = os.path.join(templates_dir, 'index.html')
    with open(template_path, 'r', encoding='utf-8') as f:
        html = f.read()

    # Replace CSS and JS links with inlined content
    html = re.sub(r'<link rel="stylesheet"[^>]+>', f'<style>{css_code}</style>', html)

    # Remove all <script type="module" src=...></script> except d3
    html = re.sub(r'<script type="module" src="\{\{ url_for\([^)]+\) \}\}"></script>\s*', '', html)

    # Insert inlined JS and data before </body>
    data_json = json.dumps(data)
    inlined = (
        f'<script>window.STATIC_DATA = {data_json};</script>'
        f'\n{js_code}'
    )
    # Insert the inlined data script before the first <script type="module" tag
    script_tag_idx = html.find('<script type="module"')
    if (script_tag_idx != -1):
        html = html[:script_tag_idx] + inlined + '\n' + html[script_tag_idx:]
    else:
        # fallback: insert before </body>
        html = html.replace('</body>', inlined + '\n</body>')

    # Write out
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(html)
    print(f"Static export written to {output_path}")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="OpenEvolve Evolution Visualizer")
    parser.add_argument(
        "--path",
        type=str,
        default="examples/",
        help="Path to openevolve_output or checkpoints folder",
    )
    parser.add_argument("--host", type=str, default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8080)
    parser.add_argument(
        "--log-level",
        type=str,
        default="INFO",
        help="Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)",
    )
    parser.add_argument(
        "--static-output",
        type=str,
        default=None,
        help="Produce a static HTML export in this directory and exit."
    )
    args = parser.parse_args()

    logger.info(f"Current working directory: {os.getcwd()}")

    if args.static_output:
        output_dir = args.static_output
        os.makedirs(output_dir, exist_ok=True)
        # Copy static/ folder recursively
        static_src = os.path.join(os.path.dirname(__file__), "static")
        static_dst = os.path.join(output_dir, "static")
        if os.path.exists(static_dst):
            shutil.rmtree(static_dst)
        shutil.copytree(static_src, static_dst)
        # Build custom index.html
        checkpoint_dir = find_latest_checkpoint(args.path)
        if not checkpoint_dir:
            raise RuntimeError(f"No checkpoint found in {args.path}")
        data = load_evolution_data(checkpoint_dir)
        logger.info(f"Exporting visualization for checkpoint: {checkpoint_dir}")
        templates_dir = os.path.join(os.path.dirname(__file__), "templates")
        template_path = os.path.join(templates_dir, 'index.html')
        with open(template_path, 'r', encoding='utf-8') as f:
            html = f.read()
        # Replace Jinja url_for with static relative paths for static export
        # (do not hard-code JS files; use regex for all url_for('static', ...))
        import re as _re
        html = _re.sub(r"\{\{\s*url_for\('static', filename='([^']+)'\)\s*\}\}", r'static/\1', html)
        # Use json.dumps with ensure_ascii=False and escape < to prevent XSS/parse issues
        data_json = json.dumps(data, ensure_ascii=False).replace('<', '\u003c')
        inlined = f'<script>window.STATIC_DATA = {data_json};</script>'
        # Insert the inlined data script before the first <script type="module" tag
        script_tag_idx = html.find('<script type="module"')
        if script_tag_idx != -1:
            html = html[:script_tag_idx] + inlined + '\n' + html[script_tag_idx:]
        else:
            # fallback: insert before </body>
            html = html.replace('</body>', inlined + '\n</body>')
        # Write out index.html
        with open(os.path.join(output_dir, 'index.html'), 'w', encoding='utf-8') as f:
            f.write(html)
        print(f"Static export written to {output_dir}/index.html and static/")
        exit(0)

    log_level = getattr(logging, args.log_level.upper(), logging.INFO)
    logging.basicConfig(level=log_level, format="[%(asctime)s] %(levelname)s %(name)s: %(message)s")

    os.environ["EVOLVE_OUTPUT"] = args.path
    logger.info(
        f"Starting server at http://{args.host}:{args.port} with log level {args.log_level.upper()}"
    )
    app.run(host=args.host, port=args.port, debug=True)
