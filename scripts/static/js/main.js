// main.js for OpenEvolve Evolution Visualizer
// ...existing code from <script> in index.html...

// Modern toggle switch logic
const darkToggleContainer = document.getElementById('darkmode-toggle').parentElement;
const darkToggleInput = document.getElementById('darkmode-toggle');
const darkToggleLabel = document.getElementById('darkmode-label');

// Replace checkbox with custom toggle switch
if (!document.getElementById('custom-dark-toggle')) {
    const wrapper = document.createElement('label');
    wrapper.className = 'toggle-switch';
    wrapper.id = 'custom-dark-toggle';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = 'darkmode-toggle';
    input.checked = darkToggleInput.checked;
    const slider = document.createElement('span');
    slider.className = 'toggle-slider';
    wrapper.appendChild(input);
    wrapper.appendChild(slider);
    darkToggleContainer.replaceChild(wrapper, darkToggleInput);
    // Move the label after the switch
    darkToggleContainer.appendChild(darkToggleLabel);
    // Re-attach event
    input.addEventListener('change', function() {
        setTheme(this.checked ? 'dark' : 'light');
    });
}

// Tab switching logic (add List tab)
const tabs = ["branching", "list", "performance", "prompts"];
tabs.forEach(tab => {
    document.getElementById(`tab-${tab}`).addEventListener('click', function() {
        tabs.forEach(t => {
            document.getElementById(`tab-${t}`).classList.remove('active');
            const view = document.getElementById(`view-${t}`);
            if (view) view.style.display = 'none';
        });
        this.classList.add('active');
        const view = document.getElementById(`view-${tab}`);
        if (view) view.style.display = 'block';
        // Synchronize node selection when switching tabs
        if (tab === 'list' || tab === 'branching') {
            if (selectedProgramId) {
                selectProgram(selectedProgramId);
                showSidebarContent(window._lastSelectedNodeData || null);
            }
        }
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
        '<a href="/program/' + d.id + '" target="_blank" style="font-size:0.95em;margin-left:0.5em;">[open in new window]</a><br><br>' +
        '<b>Program ID:</b> ' + d.id + '<br>' +
        '<b>Island:</b> ' + d.island + '<br>' +
        '<b>Generation:</b> ' + d.generation + '<br>' +
        '<b>Parent ID:</b> ' + (d.parent_id || 'None') + '<br><br>' +
        '<b>Metrics:</b><br>' + formatMetrics(d.metrics) + '<br><br>' +
        '<b>Code:</b> <pre>' + d.code.replace(/</g, '&lt;') + '</pre>';
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
    const nodes = g.selectAll("circle");
    nodes.each(function(d) {
        const nodeElem = d3.select(this);
        if (d.id === programId) {
            nodeElem.classed("node-selected", true);
        } else {
            nodeElem.classed("node-selected", false);
        }
        nodeElem.classed("node-hovered", false);
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
        .attr("stroke", getComputedStyle(document.documentElement).getPropertyValue('--node-stroke').trim() || "#fff")
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
            }
            d3.select(this)
                .classed("node-hovered", true)
                .transition()
                .duration(100)
                .attr("stroke-width", 4);
        })
        .on("mouseout", function(event, d) {
            if (!selectedProgramId) {
                showSidebarContent(null);
            }
            d3.select(this)
                .classed("node-hovered", false)
                .transition()
                .duration(100)
                .attr("stroke", getComputedStyle(document.documentElement).getPropertyValue('--node-stroke').trim() || "#fff")
                .attr("stroke-width", 1.5);
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
        // Reset all node highlights and remove highlight classes
        const nodes = g.selectAll("circle");
        nodes.each(function() {
            d3.select(this)
                .classed("node-selected", false)
                .classed("node-hovered", false)
                .transition().duration(200)
                .attr("stroke", getComputedStyle(document.documentElement).getPropertyValue('--node-stroke').trim() || "#fff")
                .attr("stroke-width", 1.5);
        });
    }
});

// Node list rendering and logic
let allNodeData = [];
function renderNodeList(nodes) {
    allNodeData = nodes;
    const container = document.getElementById('node-list-container');
    if (!container) return;
    const search = document.getElementById('list-search').value.trim().toLowerCase();
    const sort = document.getElementById('list-sort').value;
    let filtered = nodes;
    if (search) {
        filtered = nodes.filter(n => (n.id + '').toLowerCase().includes(search));
    }
    if (sort === 'id') {
        filtered = filtered.slice().sort((a, b) => (a.id + '').localeCompare(b.id + ''));
    } else if (sort === 'generation') {
        filtered = filtered.slice().sort((a, b) => (a.generation || 0) - (b.generation || 0));
    } else if (sort === 'island') {
        filtered = filtered.slice().sort((a, b) => (a.island || 0) - (b.island || 0));
    }
    container.innerHTML = '';
    filtered.forEach(node => {
        const div = document.createElement('div');
        div.className = 'node-list-item' + (selectedProgramId === node.id ? ' selected' : '');
        div.innerHTML =
            `<b>ID:</b> ${node.id}<br>` +
            `<b>Gen:</b> ${node.generation ?? ''} &nbsp; <b>Island:</b> ${node.island ?? ''}<br>` +
            `<b>Parent:</b> ${node.parent_id ?? 'None'}<br>` +
            `<b>Metrics:</b> ${Object.entries(node.metrics || {}).map(([k, v]) => `${k}: ${v}`).join(', ')}`;
        div.onclick = () => {
            selectedProgramId = node.id;
            window._lastSelectedNodeData = node;
            renderNodeList(allNodeData);
            showSidebarContent(node);
            selectProgram(selectedProgramId);
        };
        container.appendChild(div);
    });
}

// List search/sort events
if (document.getElementById('list-search')) {
    document.getElementById('list-search').addEventListener('input', () => renderNodeList(allNodeData));
}
if (document.getElementById('list-sort')) {
    document.getElementById('list-sort').addEventListener('change', () => renderNodeList(allNodeData));
}

// Patch fetchAndRender to update node list
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
            renderNodeList(data.nodes);
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
