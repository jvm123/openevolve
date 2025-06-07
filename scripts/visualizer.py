import os
import json
import glob
import logging
from flask import Flask, render_template_string, jsonify
from pathlib import Path

app = Flask(__name__)

# HTML template with D3.js for network visualization
HTML_TEMPLATE = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>OpenEvolve Evolution Visualizer</title>
    <script src="https://d3js.org/d3.v7.min.js"></script>
    <style>
        html, body { height: 100%; margin: 0; padding: 0 1em; }
        body { font-family: Arial, sans-serif; background: #f7f7f7; height: 100vh; width: 100vw; }
        h1 span { font-size: 0.5em; color: #666; }
        #toolbar {
            display: flex;
            align-items: center;
            gap: 2em;
            background: #fff;
            border-bottom: 1px solid #ddd;
            padding: 0.5em 0 0.5em 0.5em;
            margin-bottom: 0.5em;
        }
        .tabs {
            display: flex;
            gap: 1em;
        }
        .tab {
            padding: 0.3em 1.2em;
            border-radius: 6px 6px 0 0;
            background: #eee;
            cursor: pointer;
            font-weight: 500;
            border: 1px solid #ddd;
            border-bottom: none;
        }
        .tab.active {
            background: #fff;
            border-bottom: 1px solid #fff;
        }
        .toolbar-label {
            font-size: 1em;
            margin-left: 2em;
        }
        #highlight-select {
            font-size: 1em;
            margin-left: 0.5em;
        }
        #graph { width: 100vw; height: 100vh; }
        .node circle { stroke: #fff; stroke-width: 2px; }
        .node text { pointer-events: none; font-size: 12px; }
        .link { stroke: #999; stroke-opacity: 0.6; }
        .tooltip {
            position: absolute;
            text-align: left;
            width: 400px;
            max-width: 90vw;
            max-height: 60vh;
            overflow: auto;
            padding: 10px;
            font: 12px sans-serif;
            background: #fff;
            border: 1px solid #aaa;
            border-radius: 8px;
            pointer-events: none;
            box-shadow: 2px 2px 8px #aaa;
            z-index: 10;
        }
        pre {
            background: #f0f0f0;
            padding: 6px;
            border-radius: 4px;
            max-height: 200px;
            overflow: auto;
            white-space: pre;
        }
        #view-branching, #view-performance, #view-prompts {
            display: none;
        }
        #view-branching.active, #view-performance.active, #view-prompts.active {
            display: block;
        }
    </style>
</head>
<body>
    <h1>OpenEvolve Evolution Visualizer<br /><span>Checkpoint: None</span></h1>
    <div id="toolbar">
        <div class="tabs">
            <div class="tab active" id="tab-branching">Branching</div>
            <div class="tab" id="tab-performance">Performance</div>
            <div class="tab" id="tab-prompts">Prompts</div>
        </div>
        <label class="toolbar-label" for="highlight-select">Highlight:</label>
        <select id="highlight-select">
            <option value="best" selected>Best</option>
            <option value="first">First</option>
            <option value="failed">Failed</option>
        </select>
    </div>
    <div id="view-branching" class="active">
        <div id="graph"></div>
    </div>
    <div id="view-performance"></div>
    <div id="view-prompts"></div>
    <script>
    // Tab switching logic
    const tabs = ["branching", "performance", "prompts"];
    tabs.forEach(tab => {
        document.getElementById(`tab-${tab}`).addEventListener('click', function() {
            tabs.forEach(t => {
                document.getElementById(`tab-${t}`).classList.remove('active');
                document.getElementById(`view-${t}`).classList.remove('active');
            });
            this.classList.add('active');
            document.getElementById(`view-${tab}`).classList.add('active');
        });
    });

    let width = window.innerWidth;
    let height = window.innerHeight - document.querySelector('h1').offsetHeight;

    const svg = d3.select("#graph").append("svg")
        .attr("width", width)
        .attr("height", height)
        .call(d3.zoom()
            .scaleExtent([0.1, 10])
            .on("zoom", (event) => {
                g.attr("transform", event.transform);
            }))
        .on("dblclick.zoom", null);

    const g = svg.append("g");

    const tooltip = d3.select("body").append("div")
        .attr("class", "tooltip")
        .style("opacity", 0);

    let lastDataStr = null;
    let sticky = false;

    function formatMetrics(metrics) {
        return Object.entries(metrics).map(([k, v]) => `<b>${k}</b>: ${v}`).join('<br>');
    }

    function showTooltip(event, d) {
        resetTooltip(false);
        tooltip.transition().duration(200).style("opacity", .95);
        tooltip.html(
            `<b>Program ID:</b> ${d.id}<br>` +
            `<b>Island:</b> ${d.island}<br>` +
            `<b>Generation:</b> ${d.generation}<br>` +
            `<b>Parent ID:</b> ${d.parent_id || 'None'}<br>` +
            `<b>Metrics:</b><br>${formatMetrics(d.metrics)}<br>` +
            `<b>Code:</b><pre>${d.code.replace(/</g, '&lt;')}</pre>`
        )
        .style("left", (event.pageX + 20) + "px")
        .style("top", (event.pageY - 20) + "px");

        d3.select(event.target)
            .transition()
            .duration(200)
            .attr("stroke", "#000")
            .attr("stroke-width", 3);
    }
    function showTooltipSticky(event, d) {
        showTooltip(event, d);
        sticky = true;
    }

    function hideTooltip(event, d) {
        if (sticky) return;
        tooltip.transition().duration(300).style("opacity", 0);

        d3.selectAll("circle")
            .transition()
            .duration(200)
            .attr("stroke", "#fff")
            .attr("stroke-width", 1.5);
    }
    function resetTooltip(event, d) {
        // Only reset if the click target is the SVG itself (not a node)
        if (!event || event.target === this) {
            sticky = false;
            hideTooltip(event, d);
        }
    }

    function openInNewTab(event, d) {
        const url = `/program/${d.id}`;
        window.open(url, '_blank');
        event.stopPropagation(); // Prevent tooltip from closing
    }

    function getNodeColor(d) {
        return d.island !== undefined ? d3.schemeCategory10[d.island % 10] : "#888";
    }

    function getNodeSuccess(d) {
        return d.metrics && typeof d.metrics.overall_score === "number" && !d.metrics.error;
    }

    function getNodeRadius(d) {
        let minScore = 0, maxScore = 1;
        let minR = 10, maxR = 32;
        let score = d.metrics && typeof d.metrics.overall_score === "number" ? d.metrics.overall_score : null;
        if (score === null) return minR;
        score = Math.max(minScore, Math.min(maxScore, score));
        return minR + (maxR - minR) * (score - minScore) / (maxScore - minScore);
    }

    function renderGraph(data) {
        g.selectAll("*").remove();
        const simulation = d3.forceSimulation(data.nodes)
            .force("link", d3.forceLink(data.edges).id(d => d.id).distance(80))
            .force("charge", d3.forceManyBody().strength(-200))
            .force("center", d3.forceCenter(width / 2, height / 2));

        const link = g.append("g")
            .attr("stroke", "#999")
            .attr("stroke-opacity", 0.6)
            .selectAll("line")
            .data(data.edges)
            .enter().append("line")
            .attr("stroke-width", 2);

        const node = g.append("g")
            .attr("stroke", "#fff")
            .attr("stroke-width", 1.5)
            .selectAll("circle")
            .data(data.nodes)
            .enter().append("circle")
            .attr("r", d => getNodeRadius(d))
            .attr("fill", d => getNodeColor(d))
            .on("mouseover", showTooltip)
            .on("click", showTooltipSticky)
            .on("dblclick", openInNewTab)
            .on("mouseout", hideTooltip)
            .call(d3.drag()
                .on("start", dragstarted)
                .on("drag", dragged)
                .on("end", dragended));

        node.append("title").text(d => d.id);

        simulation.on("tick", () => {
            link
                .attr("x1", d => d.source.x)
                .attr("y1", d => d.source.y)
                .attr("x2", d => d.target.x)
                .attr("y2", d => d.target.y);
            node
                .attr("cx", d => d.x)
                .attr("cy", d => d.y);
        });

        function dragstarted(event, d) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
        }
        function dragged(event, d) {
            d.fx = event.x;
            d.fy = event.y;
        }
        function dragended(event, d) {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
        }
    }

    // Add background click handler to reset tooltip
    svg.on("click", resetTooltip);

    function fetchAndRender() {
        fetch('/api/data')
            .then(resp => resp.json())
            .then(data => {
                const dataStr = JSON.stringify(data);
                if (dataStr !== lastDataStr) {
                    renderGraph(data);
                    lastDataStr = dataStr;
                }

                // set headline to include data.checkpoint_dir
                let title = "OpenEvolve Evolution Visualizer <br /><span>Checkpoint: " + data.checkpoint_dir + "</span>";
                document.querySelector('h1').innerHTML = title;
            });
    }
    fetchAndRender();
    setInterval(fetchAndRender, 2000); // Live update every 2s

    // Responsive resize
    function resize() {
        width = window.innerWidth;
        height = window.innerHeight - document.querySelector('h1').offsetHeight;
        svg.attr("width", width).attr("height", height);
        fetchAndRender();
    }
    window.addEventListener('resize', resize);
    </script>
</body>
</html>
"""
HTML_TEMPLATE_PROGRAM_PAGE = """
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>Program {{ program_data.id }}</title>
        <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            pre { background: #f0f0f0; padding: 10px; border-radius: 5px; }
        </style>
    </head>
    <body>
        <h1>Program ID: {{ program_data.id }}</h1>
        <ul>
            <li><strong>Checkpoint:</strong> {{checkpoint_dir}}</li>
            <li><strong>Island:</strong> {{ program_data.island }}</li>
            <li><strong>Generation:</strong> {{ program_data.generation }}</li>
            <li><strong>Parent ID:</strong> {{ program_data.parent_id or 'None' }}</li>
            <li><strong>Metrics:</strong>
        <ul>
            {% for key, value in program_data.metrics.items() %}
                <li><strong>{{ key }}:</strong> {{ value }}</li>
            {% endfor %}
        </ul>
            </li>
            </ul>
        <h2>Code:</h2>
        <pre>{{ program_data.code }}</pre>
    </body>
    </html>
"""

logger = logging.getLogger("openevolve.visualizer")


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
        return {"nodes": [], "edges": [], "checkpoint_dir": checkpoint_folder}
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
    return {"nodes": nodes, "edges": edges, "checkpoint_dir": checkpoint_folder}


@app.route("/")
def index():
    return render_template_string(HTML_TEMPLATE)


checkpoint_dir = None  # Global variable to store the checkpoint directory


@app.route("/api/data")
def data():
    global checkpoint_dir
    base_folder = os.environ.get("EVOLVE_OUTPUT", "examples/")
    checkpoint_dir = find_latest_checkpoint(base_folder)
    if not checkpoint_dir:
        logger.info(f"No checkpoints found in {base_folder}")
        return jsonify({"nodes": [], "edges": [], "checkpoint_dir": ""})


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

    return render_template_string(
        HTML_TEMPLATE_PROGRAM_PAGE, program_data=program_data, checkpoint_dir=checkpoint_dir
    )


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
    args = parser.parse_args()

    log_level = getattr(logging, args.log_level.upper(), logging.INFO)
    logging.basicConfig(level=log_level, format="[%(asctime)s] %(levelname)s %(name)s: %(message)s")

    os.environ["EVOLVE_OUTPUT"] = args.path
    logger.info(
        f"Starting server at http://{args.host}:{args.port} with log level {args.log_level.upper()}"
    )
    app.run(host=args.host, port=args.port, debug=True)
