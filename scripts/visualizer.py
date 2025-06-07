import os
import json
import glob
import logging
from flask import Flask, render_template_string, jsonify

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
        body {
            font-family: Arial, sans-serif;
            background: var(--main-bg);
            color: var(--text-color);
            height: 100vh;
            width: 100vw;
        }
        h1 span { font-size: 0.5em; color: #666; }
        #toolbar {
            display: flex;
            align-items: center;
            gap: 2em;
            background: var(--toolbar-bg);
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
        .node circle { stroke: var(--node-stroke); stroke-width: 2px; }
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
    <div id="toolbar" style="position:fixed;top:0;left:0;width:100vw;z-index:100;background:var(--toolbar-bg);box-shadow:0 2px 8px #eee;display:flex;align-items:center;gap:1.5em;padding:0.3em 1em 0.3em 1em;">
        <div style="display:flex;flex-direction:column;min-width:220px;">
            <span style="font-size:1.1em;font-weight:bold;">OpenEvolve Evolution Visualizer</span>
            <span id="checkpoint-label" style="font-size:0.9em;color:#666;">Checkpoint: None</span>
        </div>
        <div class="tabs" style="margin-left:1.5em;">
            <div class="tab active" id="tab-branching">Branching</div>
            <div class="tab" id="tab-performance">Performance</div>
            <div class="tab" id="tab-prompts">Prompts</div>
        </div>
        <label class="toolbar-label" for="highlight-select"
               style="margin-left:2em;">
            Highlight:
        </label>
        <select id="highlight-select" style="font-size:1em;margin-left:0.5em;">
            <option value="best" selected>Best</option>
            <option value="first">First</option>
            <option value="failed">Failed</option>
        </select>
        <label class="toolbar-label" for="metric-select" style="margin-left:2em;">Metric:</label>
        <select id="metric-select" style="font-size:1em;margin-left:0.5em;">
            <option value="combined_score" selected>combined_score</option>
        </select>
        <div style="margin-left:auto;display:flex;align-items:center;gap:1em;">
            <label style="display:flex;align-items:center;cursor:pointer;gap:0.3em;">
                <input type="checkbox" id="darkmode-toggle" style="accent-color:#0074d9;">
                <span id="darkmode-label" style="font-size:1.1em;">🌙</span>
            </label>
            <div id="sidebar-toggle" title="Show/hide sidebar"
                style="cursor:pointer;font-size:1.5em;padding:0.2em 0.5em;user-select:none;">
                ☰
            </div>
        </div>
    </div>
    <div id="sidebar" style="position:fixed;top:0;right:0;width:400px;max-width:90vw;height:100vh;background:var(--sidebar-bg);box-shadow:var(--sidebar-shadow);z-index:200;transform:translateX(100%);transition:transform 0.2s;overflow-y:auto;padding:2em 1.5em 1em 1.5em;">
        <div id="sidebar-content">
            <span style="color:#888;">
                Select a node to see details.
            </span>
        </div>
    </div>
    <div id="view-branching" class="active" style="padding-top:3.5em;">
        <div id="graph"></div>
    </div>
    <div id="view-performance" style="padding-top:3.5em;"></div>
    <div id="view-prompts" style="padding-top:3.5em;"></div>
    <style id="theme-style">
    :root {
        --toolbar-bg: #fff;
        --sidebar-bg: #fff;
        --text-color: #222;
        --node-default: #fff;
        --node-stroke: #fff;
        --sidebar-shadow: -2px 0 8px #eee;
        --main-bg: #f7f7f7;
    }
    [data-theme="dark"] {
        --toolbar-bg: #181a1b;
        --sidebar-bg: #23272a;
        --text-color: #eee;
        --node-default: #23272a;
        --node-stroke: #444;
        --sidebar-shadow: -2px 0 8px #222;
        --main-bg: #181a1b;
    }
    body {
        background: var(--main-bg);
        color: var(--text-color);
    }
    #toolbar {
        background: var(--toolbar-bg) !important;
    }
    #sidebar {
        background: var(--sidebar-bg) !important;
        box-shadow: var(--sidebar-shadow) !important;
        color: var(--text-color);
    }
    </style>
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

    // Sidebar logic (automatic show/hide)
    const sidebar = document.getElementById('sidebar');
    function showSidebar() {
        sidebar.style.transform = 'translateX(0)';
    }
    function hideSidebar() {
        sidebar.style.transform = 'translateX(100%)';
    }

    // Dark mode logic
    function setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        document.getElementById('darkmode-toggle').checked = (theme === 'dark');
        document.getElementById('darkmode-label').textContent = theme === 'dark' ? '🌙' : '☀️';
    }
    function getSystemTheme() {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    // On load, use localStorage or system default
    (function() {
        let theme = localStorage.getItem('theme');
        if (!theme) theme = getSystemTheme();
        setTheme(theme);
    })();
    document.getElementById('darkmode-toggle').addEventListener('change', function() {
        setTheme(this.checked ? 'dark' : 'light');
    });

    let width = window.innerWidth;
    let toolbarHeight = document.getElementById('toolbar').offsetHeight;
    let height = window.innerHeight - toolbarHeight;

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

    let lastDataStr = null;
    let selectedProgramId = null;

    function formatMetrics(metrics) {
        return Object.entries(metrics).map(([k, v]) => `<b>${k}</b>: ${v}`).join('<br>');
    }

    function showSidebarContent(d) {
        if (!d) {
            document.getElementById('sidebar-content').innerHTML =
                '<span style="color:#888;">Select a node to see details.</span>';
            hideSidebar();
            return;
        }
        document.getElementById('sidebar-content').innerHTML =
            `<b>Program ID:</b> ${d.id}<br>` +
            `<b>Island:</b> ${d.island}<br>` +
            `<b>Generation:</b> ${d.generation}<br>` +
            `<b>Parent ID:</b> ${d.parent_id || 'None'}<br>` +
            `<b>Metrics:</b><br>${formatMetrics(d.metrics)}<br>` +
            `<b>Code:</b><pre>${d.code.replace(/</g, '&lt;')}</pre>`;
        showSidebar();
    }

    function openInNewTab(event, d) {
        const url = `/program/${d.id}`;
        window.open(url, '_blank');
        event.stopPropagation();
    }

    function getNodeColor(d) {
        if (d.island !== undefined) return d3.schemeCategory10[d.island % 10];
        return getComputedStyle(document.documentElement)
            .getPropertyValue('--node-default').trim() || "#fff";
    }

    function getSelectedMetric() {
        const metricSelect = document.getElementById('metric-select');
        return metricSelect ? metricSelect.value : 'overall_score';
    }

    function getNodeRadius(d) {
        let minScore = 0, maxScore = 1;
        let minR = 10, maxR = 32;
        const metric = getSelectedMetric();
        let score = d.metrics && typeof d.metrics[metric] === "number" ? d.metrics[metric] : null;
        if (score === null) return minR;
        score = Math.max(minScore, Math.min(maxScore, score));
        return minR + (maxR - minR) * (score - minScore) / (maxScore - minScore);
    }

    function selectProgram(programId) {
        if (!programId) return;
        const nodes = g.selectAll("circle");
        nodes.each(function(d) {
            if (d.id === programId) {
                d3.select(this)
                    .transition()
                    .duration(200)
                    .attr("stroke", "#000")
                    .attr("stroke-width", 3);
            } else {
                d3.select(this)
                    .transition()
                    .duration(200)
                    .attr("stroke",
                        getComputedStyle(document.documentElement)
                            .getPropertyValue('--node-stroke').trim() || "#fff")
                    .attr("stroke-width", 1.5);
            }
        });
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
            .attr("stroke",
                getComputedStyle(document.documentElement)
                    .getPropertyValue('--node-stroke').trim() || "#fff")
            .attr("stroke-width", 1.5)
            .selectAll("circle")
            .data(data.nodes)
            .enter().append("circle")
            .attr("r", d => getNodeRadius(d))
            .attr("fill", d => getNodeColor(d))
            .on("click", function(event, d) {
                selectedProgramId = d.id;
                showSidebarContent(d);
                showSidebar();
                selectProgram(selectedProgramId);
                event.stopPropagation();
            })
            .on("dblclick", openInNewTab)
            .on("mouseover", function(event, d) {
                if (!selectedProgramId) {
                    showSidebarContent(d);
                    showSidebar();
                    // Highlight hovered node with yellow border
                    d3.select(this)
                        .transition()
                        .duration(100)
                        .attr("stroke", "#FFD600")
                        .attr("stroke-width", 4);
                }
            })
            .on("mouseout", function(event, d) {
                if (!selectedProgramId) {
                    showSidebarContent(null);
                    // Remove yellow border highlight
                    d3.select(this)
                        .transition()
                        .duration(100)
                        .attr("stroke",
                            getComputedStyle(document.documentElement)
                                .getPropertyValue('--node-stroke').trim() || "#fff")
                        .attr("stroke-width", 1.5);
                }
            })
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

        selectProgram(selectedProgramId);
    }

    // D3 drag handlers
    function dragstarted(event, d) {
        if (!event.active) event.subject.fx = event.subject.x;
        if (!event.active) event.subject.fy = event.subject.y;
    }
    function dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
    }
    function dragended(event, d) {
        if (!event.active) {
            d.fx = null;
            d.fy = null;
        }
    }

    // Click background to unselect node and reset sidebar (and hide sidebar)
    svg.on("click", function(event) {
        if (event.target === svg.node()) {
            selectedProgramId = null;
            showSidebarContent(null);
            // Reset all node highlights
            const nodes = g.selectAll("circle");
            nodes.transition().duration(200)
                .attr("stroke",
                    getComputedStyle(document.documentElement)
                        .getPropertyValue('--node-stroke').trim() || "#fff")
                .attr("stroke-width", 1.5);
        }
    });

    function fetchAndRender() {
        fetch('/api/data')
            .then(resp => resp.json())
            .then(data => {
                const dataStr = JSON.stringify(data);
                if (dataStr === lastDataStr) {
                    return;
                }
                lastDataStr = dataStr;

                renderGraph(data);

                // set checkpoint label in toolbar
                document.getElementById('checkpoint-label').textContent =
                    "Checkpoint: " + data.checkpoint_dir;

                // update metric-select options. keep the selected option.
                const metricSelect = document.getElementById('metric-select');
                const currentValue = metricSelect.value;
                metricSelect.innerHTML = '';
                const metrics = new Set();
                data.nodes.forEach(node => {
                    if (node.metrics) {
                        Object.keys(node.metrics).forEach(metric => metrics.add(metric));
                    }
                });
                metrics.forEach(metric => {
                    const option = document.createElement('option');
                    option.value = metric;
                    option.textContent = metric;
                    metricSelect.appendChild(option);
                });
                if (metricSelect.options.length > 0) {
                    metricSelect.selectedIndex = 0;
                }
            });
    }
    fetchAndRender();
    setInterval(fetchAndRender, 2000); // Live update every 2s

    // Responsive resize
    function resize() {
        width = window.innerWidth;
        const toolbarHeight = document.getElementById('toolbar').offsetHeight;
        height = window.innerHeight - toolbarHeight;
        svg.attr("width", width).attr("height", height);
        fetchAndRender();
    }
    window.addEventListener('resize', resize);

    // Re-render graph when metric-select changes
    document.getElementById('metric-select').addEventListener('change', function() {
        fetch('/api/data')
            .then(resp => resp.json())
            .then(data => {
                renderGraph(data);
            });
    });
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
