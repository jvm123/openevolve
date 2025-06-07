// main.js for OpenEvolve Evolution Visualizer

// Declare allNodeData at the very top to avoid ReferenceError
let allNodeData = [];

const darkToggleContainer = document.getElementById('darkmode-toggle').parentElement;
const darkToggleInput = document.getElementById('darkmode-toggle');
const darkToggleLabel = document.getElementById('darkmode-label');

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

    darkToggleContainer.appendChild(darkToggleLabel);
    input.addEventListener('change', function() {
        setTheme(this.checked ? 'dark' : 'light');
    });
}

// Tab switching logic
const tabs = ["branching", "performance", "list"];
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
    updateListRowBackgroundsForTheme();
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
    const sidebarContent = document.getElementById('sidebar-content');
    if (!d) {
        sidebarContent.innerHTML =
            '<span style="color:#888;">Select a node to see details.</span>';
        hideSidebar();
        return;
    }
    // X button for closing sidebar (tight in the corner)
    let closeBtn = '<button id="sidebar-close-btn" style="position:absolute;top:4px;right:4px;font-size:1.3em;background:none;border:none;color:#888;cursor:pointer;z-index:10;">&times;</button>';
    // Open in new window link (no extra left margin)
    let openLink = '<a href="/program/' + d.id + '" target="_blank" style="font-size:0.95em;">[open in new window]</a>';
    // Tab logic for code/prompts
    let tabHtml = '';
    let tabContentHtml = '';
    let tabNames = [];
    if (d.code && typeof d.code === 'string' && d.code.trim() !== '') tabNames.push('Code');
    if (d.prompts && typeof d.prompts === 'object' && Object.keys(d.prompts).length > 0) tabNames.push('Prompt');
    if (tabNames.length > 0) {
        tabHtml += '<div id="sidebar-tab-bar" style="display:flex;gap:1em;margin:1em 0 0.5em 0;">';
        tabNames.forEach((tab, i) => {
            tabHtml += `<div class="sidebar-tab${i===0?' active':''}" data-tab="${tab}" style="cursor:pointer;padding:0.2em 1.2em;border-radius:6px 6px 0 0;background:#eee;font-weight:500;">${tab}</div>`;
        });
        tabHtml += '</div>';
        tabContentHtml += '<div id="sidebar-tab-content">';
        if (tabNames[0] === 'Code') {
            tabContentHtml += `<pre>${d.code.replace(/</g, '&lt;')}</pre>`;
        } else if (tabNames[0] === 'Prompt') {
            Object.entries(d.prompts).forEach(([k, v]) => {
                tabContentHtml += `<b>Prompt: ${k}</b><pre>${v.replace(/</g, '&lt;')}</pre>`;
            });
        }
        tabContentHtml += '</div>';
    }
    // Sidebar HTML
    sidebarContent.innerHTML =
        `<div style="position:relative;">
            ${closeBtn}
            ${openLink}<br><br>
            <b>Program ID:</b> ${d.id}<br>
            <b>Island:</b> ${d.island}<br>
            <b>Generation:</b> ${d.generation}<br>
            <b>Parent ID:</b> ${d.parent_id || 'None'}<br><br>
            <b>Metrics:</b><br>${formatMetrics(d.metrics)}<br><br>
            ${tabHtml}${tabContentHtml}
        </div>`;
    // Tab switching logic
    if (tabNames.length > 1) {
        const tabBar = document.getElementById('sidebar-tab-bar');
        const tabContent = document.getElementById('sidebar-tab-content');
        Array.from(tabBar.children).forEach(tabEl => {
            tabEl.onclick = function() {
                Array.from(tabBar.children).forEach(t => t.classList.remove('active'));
                tabEl.classList.add('active');
                if (tabEl.dataset.tab === 'Code') {
                    tabContent.innerHTML = `<pre>${d.code.replace(/</g, '&lt;')}</pre>`;
                } else if (tabEl.dataset.tab === 'Prompt') {
                    let html = '';
                    Object.entries(d.prompts).forEach(([k, v]) => {
                        html += `<b>Prompt: ${k}</b><pre>${v.replace(/</g, '&lt;')}</pre>`;
                    });
                    tabContent.innerHTML = html;
                }
            };
        });
    }
    // X button logic: also clear selection
    const closeBtnEl = document.getElementById('sidebar-close-btn');
    if (closeBtnEl) closeBtnEl.onclick = function() {
        selectedProgramId = null;
        showSidebarContent(null);
        // Also update graph view selection
        g.selectAll('circle').classed('node-selected', false);
    };
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
    let minScore = Infinity, maxScore = -Infinity;
    let minR = 10, maxR = 32;
    const metric = getSelectedMetric();

    if (Array.isArray(allNodeData) && allNodeData.length > 0) {
        allNodeData.forEach(n => {
            if (n.metrics && typeof n.metrics[metric] === "number") {
                if (n.metrics[metric] < minScore) minScore = n.metrics[metric];
                if (n.metrics[metric] > maxScore) maxScore = n.metrics[metric];
            }
        });
        if (minScore === Infinity) minScore = 0;
        if (maxScore === -Infinity) maxScore = 1;
    } else {
        minScore = 0;
        maxScore = 1;
    }

    let score = d.metrics && typeof d.metrics[metric] === "number" ? d.metrics[metric] : null;
    if (score === null || isNaN(score)) {
        return minR / 2;
    }
    if (maxScore === minScore) return (minR + maxR) / 2;
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

    const metric = getSelectedMetric();
    const highlightFilter = document.getElementById('highlight-select').value;
    const highlightNodes = getHighlightNodes(data.nodes, highlightFilter, metric);
    const highlightIds = new Set(highlightNodes.map(n => n.id));

    const node = g.append("g")
        .attr("stroke", getComputedStyle(document.documentElement).getPropertyValue('--node-stroke').trim() || "#fff")
        .attr("stroke-width", 1.5)
        .selectAll("circle")
        .data(data.nodes)
        .enter().append("circle")
        .attr("r", d => getNodeRadius(d))
        .attr("fill", d => getNodeColor(d))
        .attr("class", d => [
            highlightIds.has(d.id) ? 'node-highlighted' : '',
            selectedProgramId === d.id ? 'node-selected' : ''
        ].join(' ').trim())
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
function getNodeGray(d, minGray = 120, maxGray = 230) {
    // minGray: darkest, maxGray: lightest (0-255)
    // Invert logic: better scores are lighter
    let minScore = Infinity, maxScore = -Infinity;
    const metric = getSelectedMetric();
    if (Array.isArray(allNodeData) && allNodeData.length > 0) {
        allNodeData.forEach(n => {
            if (n.metrics && typeof n.metrics[metric] === "number") {
                if (n.metrics[metric] < minScore) minScore = n.metrics[metric];
                if (n.metrics[metric] > maxScore) maxScore = n.metrics[metric];
            }
        });
        if (minScore === Infinity) minScore = 0;
        if (maxScore === -Infinity) maxScore = 1;
    } else {
        minScore = 0;
        maxScore = 1;
    }
    let score = d.metrics && typeof d.metrics[metric] === "number" ? d.metrics[metric] : null;
    // If no score, use the darkest color (worst)
    if (score === null || isNaN(score)) {
        return `rgb(${minGray},${minGray},${minGray})`;
    }
    if (maxScore === minScore) {
        const g = Math.round((minGray+maxGray)/2);
        return `rgb(${g},${g},${g})`;
    }
    // Invert: higher score = lighter
    const gray = Math.round(maxGray - (maxGray - minGray) * (maxScore - score) / (maxScore - minScore));
    return `rgb(${gray},${gray},${gray})`;
}

// For dark mode, update backgrounds using a blue-gray scale and same logic
function getNodeGrayDark(d, minGray = 40, maxGray = 120) {
    // minGray: darkest, maxGray: lightest (0-255)
    let minScore = Infinity, maxScore = -Infinity;
    const metric = getSelectedMetric();
    if (Array.isArray(allNodeData) && allNodeData.length > 0) {
        allNodeData.forEach(n => {
            if (n.metrics && typeof n.metrics[metric] === "number") {
                if (n.metrics[metric] < minScore) minScore = n.metrics[metric];
                if (n.metrics[metric] > maxScore) maxScore = n.metrics[metric];
            }
        });
        if (minScore === Infinity) minScore = 0;
        if (maxScore === -Infinity) maxScore = 1;
    } else {
        minScore = 0;
        maxScore = 1;
    }
    let score = d.metrics && typeof d.metrics[metric] === "number" ? d.metrics[metric] : null;
    // If no score, use the darkest color (worst)
    if (score === null || isNaN(score)) {
        return `rgb(${minGray},${minGray+10},${minGray+20})`;
    }
    if (maxScore === minScore) {
        const g = Math.round((minGray+maxGray)/2);
        return `rgb(${g},${g+10},${g+20})`;
    }
    // Invert: higher score = lighter
    const gray = Math.round(maxGray - (maxGray - minGray) * (maxScore - score) / (maxScore - minScore));
    return `rgb(${gray},${gray+10},${gray+20})`;
}

// Update node list row backgrounds for current theme/metric/highlight
function updateListRowBackgroundsForTheme() {
    const container = document.getElementById('node-list-container');
    if (!container) return;
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const metric = getSelectedMetric();
    const highlightFilter = document.getElementById('highlight-select').value;
    const highlightNodes = getHighlightNodes(allNodeData, highlightFilter, metric);
    const highlightIds = new Set(highlightNodes.map(n => n.id));
    Array.from(container.children).forEach(div => {
        // Find node by ID in the first child div
        const idDiv = div.querySelector('div');
        if (!idDiv) return;
        const nodeId = idDiv.textContent.replace('ID:', '').trim();
        const node = allNodeData.find(n => n.id == nodeId);
        if (node) {
            // Use inline style with !important to override CSS background
            div.style.setProperty('background', isDark ? getNodeGrayDark(node, 40, 120) : getNodeGray(node, 120, 230), 'important');
            div.classList.toggle('highlighted', highlightIds.has(nodeId));
        }
    });
}

// Patch renderNodeList to use row-by-row table style and gray background, and update bg on metric change
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
    } else if (sort === 'score') {
        const metric = getSelectedMetric();
        filtered = filtered.slice().sort((a, b) => {
            const aScore = a.metrics && typeof a.metrics[metric] === 'number' ? a.metrics[metric] : -Infinity;
            const bScore = b.metrics && typeof b.metrics[metric] === 'number' ? b.metrics[metric] : -Infinity;
            return bScore - aScore; // Descending
        });
    }
    // Highlight logic for list view
    const metric = getSelectedMetric();
    const highlightFilter = document.getElementById('highlight-select').value;
    const highlightNodes = getHighlightNodes(nodes, highlightFilter, metric);
    const highlightIds = new Set(highlightNodes.map(n => n.id));
    container.innerHTML = '';
    filtered.forEach(node => {
        const row = document.createElement('div');
        row.className = 'node-list-item' + (selectedProgramId === node.id ? ' selected' : '') + (highlightIds.has(node.id) ? ' highlighted' : '');
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        // Use inline style with !important to override CSS background
        row.style.setProperty('background', isDark ? getNodeGrayDark(node, 40, 120) : getNodeGray(node, 120, 230), 'important');
        // Table-style columns (ID, Gen, Island, Parent, Metrics)
        row.innerHTML = `
            <div><b>ID:</b> ${node.id}</div>
            <div><b>Gen:</b> ${node.generation ?? ''}</div>
            <div><b>Island:</b> ${node.island ?? ''}</div>
            <div><b>Parent:</b> ${node.parent_id ?? 'None'}</div>
            <div><b>Metrics:</b> ${Object.entries(node.metrics || {}).map(([k, v]) => `${k}: ${v}`).join(', ')}</div>
        `;
        row.onclick = () => {
            selectedProgramId = node.id;
            window._lastSelectedNodeData = node;
            renderNodeList(allNodeData);
            showSidebarContent(node);
            selectProgram(selectedProgramId);
        };
        container.appendChild(row);
    });
}

// List search/sort events
if (document.getElementById('list-search')) {
    document.getElementById('list-search').addEventListener('input', () => renderNodeList(allNodeData));
}
if (document.getElementById('list-sort')) {
    document.getElementById('list-sort').addEventListener('change', () => renderNodeList(allNodeData));
}

// On page load, set default sort to generation
if (document.getElementById('list-sort')) {
    document.getElementById('list-sort').value = 'generation';
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
            const highlightSelect = document.getElementById('highlight-select');
            const currentMetric = metricSelect.value;
            const currentHighlight = highlightSelect.value;
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

// Highlight logic for graph and list views
function getHighlightNodes(nodes, filter, metric) {
    if (!filter) return [];
    if (filter === 'top') {
        let best = -Infinity;
        nodes.forEach(n => {
            if (n.metrics && typeof n.metrics[metric] === 'number') {
                if (n.metrics[metric] > best) best = n.metrics[metric];
            }
        });
        return nodes.filter(n => n.metrics && n.metrics[metric] === best);
    } else if (filter === 'first') {
        return nodes.filter(n => n.generation === 0);
    } else if (filter === 'failed') {
        return nodes.filter(n => n.metrics && n.metrics.error != null);
    } else if (filter === 'unset') {
        return nodes.filter(n => !n.metrics || n.metrics[metric] == null);
    }
    return [];
}

// Switch metric-select and highlight-select order in the toolbar (robust, no error)
(function() {
    const toolbar = document.getElementById('toolbar');
    const metricSelect = document.getElementById('metric-select');
    const highlightSelect = document.getElementById('highlight-select');
    if (toolbar && metricSelect && highlightSelect) {
        // Only move if both are direct children of toolbar and not already in order
        if (
            metricSelect.parentElement === toolbar &&
            highlightSelect.parentElement === toolbar &&
            toolbar.children.length > 0 &&
            highlightSelect.previousElementSibling !== metricSelect
        ) {
            toolbar.insertBefore(metricSelect, highlightSelect);
        }
    }
})();

// Add event listener to re-highlight nodes on highlight-select change (no full rerender)
const highlightSelect = document.getElementById('highlight-select');
highlightSelect.addEventListener('change', function() {
    // Only update highlight classes, do not rerender graph
    const metric = getSelectedMetric();
    const filter = highlightSelect.value;
    // Use allNodeData for current nodes
    const highlightNodes = getHighlightNodes(allNodeData, filter, metric);
    const highlightIds = new Set(highlightNodes.map(n => n.id));
    // Update graph view
    g.selectAll('circle').each(function(d) {
        d3.select(this).classed('node-highlighted', highlightIds.has(d.id));
    });
    // Update list view
    const container = document.getElementById('node-list-container');
    if (container) {
        Array.from(container.children).forEach(div => {
            const nodeId = div.innerHTML.match(/<b>ID:<\/b>\s*([^<]+)/);
            if (nodeId && nodeId[1]) {
                div.classList.toggle('highlighted', highlightIds.has(nodeId[1]));
            }
        });
    }
});

// Add event listener to re-highlight nodes and update radii on metric-select change (no full rerender)
const metricSelect = document.getElementById('metric-select');
metricSelect.addEventListener('change', function() {
    const metric = getSelectedMetric();
    const filter = highlightSelect.value;
    // Update highlight classes and radii
    const highlightNodes = getHighlightNodes(allNodeData, filter, metric);
    const highlightIds = new Set(highlightNodes.map(n => n.id));
    g.selectAll('circle').each(function(d) {
        d3.select(this)
            .classed('node-highlighted', highlightIds.has(d.id))
            .attr('r', getNodeRadius(d));
    });
    // Update list view backgrounds and highlights
    const container = document.getElementById('node-list-container');
    if (container) {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        Array.from(container.children).forEach((div, i) => {
            // Find node by ID in the first child div
            const idDiv = div.querySelector('div');
            if (!idDiv) return;
            const nodeId = idDiv.textContent.replace('ID:', '').trim();
            const node = allNodeData.find(n => n.id == nodeId);
            if (node) {
                div.style.setProperty('background', isDark ? getNodeGrayDark(node, 40, 120) : getNodeGray(node, 120, 230), 'important');
                div.classList.toggle('highlighted', highlightIds.has(nodeId));
            }
        });
    }
});

// Always show sidebar in list view, and adjust node-list width
const viewList = document.getElementById('view-list');
const sidebarEl = document.getElementById('sidebar');
function updateListSidebarLayout() {
    if (viewList.style.display !== 'none') {
        sidebarEl.style.transform = 'translateX(0)';
        viewList.style.marginRight = sidebarEl.offsetWidth + 'px';
    } else {
        viewList.style.marginRight = '0';
    }
}
// Call on tab switch and window resize
['resize', 'DOMContentLoaded'].forEach(evt => window.addEventListener(evt, updateListSidebarLayout));
document.getElementById('tab-list').addEventListener('click', updateListSidebarLayout);
document.getElementById('tab-branching').addEventListener('click', function() {
    // Hide sidebar if it was hidden in branching
    if (sidebarEl.style.transform === 'translateX(100%)') {
        sidebarEl.style.transform = 'translateX(100%)';
    }
    viewList.style.marginRight = '0';
});

// Always show sidebar in list view
(function() {
    const origShowSidebar = showSidebar;
    showSidebar = function() {
        if (viewList.style.display !== 'none') {
            sidebarEl.style.transform = 'translateX(0)';
            viewList.style.marginRight = sidebarEl.offsetWidth + 'px';
        } else {
            origShowSidebar();
        }
    };
})();

// Update all node list row backgrounds for the current theme and metric
function updateListRowBackgroundsForTheme() {
    const container = document.getElementById('node-list-container');
    if (!container) return;
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const metric = getSelectedMetric();
    const highlightFilter = document.getElementById('highlight-select').value;
    const highlightNodes = getHighlightNodes(allNodeData, highlightFilter, metric);
    const highlightIds = new Set(highlightNodes.map(n => n.id));
    Array.from(container.children).forEach(div => {
        // Find node by ID in the first child div
        const idDiv = div.querySelector('div');
        if (!idDiv) return;
        const nodeId = idDiv.textContent.replace('ID:', '').trim();
        const node = allNodeData.find(n => n.id == nodeId);
        if (node) {
            div.style.background = isDark ? getNodeGrayDark(node, 40, 120) : getNodeGray(node, 120, 230);
            div.classList.toggle('highlighted', highlightIds.has(nodeId));
        }
    });
}

// --- Performance Tab D3 Graph ---
(function() {
    const perfDiv = document.getElementById('view-performance');
    if (!perfDiv) return;
    d3.select('#performance-graph').remove();
    perfDiv.style.overflowY = 'auto';
    perfDiv.style.position = 'relative';
    function renderPerformanceGraph(nodes) {
        d3.select('#performance-graph').remove();
        // Calculate width: window width - sidebar width - padding
        const sidebarEl = document.getElementById('sidebar');
        const padding = 32;
        const windowWidth = window.innerWidth;
        const sidebarWidth = sidebarEl.offsetWidth || 400;
        const width = Math.max(windowWidth - sidebarWidth - padding, 400);
        // X: metric, Y: generation (downwards, open-ended)
        const metric = getSelectedMetric();
        const validNodes = nodes.filter(n => n.metrics && typeof n.metrics[metric] === 'number');
        if (!validNodes.length) return;
        // Always start with generation 0
        const yExtent = d3.extent(validNodes, d => d.generation);
        const minGen = 0;
        const maxGen = yExtent[1];
        const xExtent = d3.extent(validNodes, d => d.metrics[metric]);
        const margin = {top: 60, right: 40, bottom: 40, left: 60};
        const genCount = (maxGen - minGen + 1) || 1;
        const height = Math.max(400, genCount * 48 + margin.top + margin.bottom);
        const svg = d3.select(perfDiv)
            .append('svg')
            .attr('id', 'performance-graph')
            .attr('width', width)
            .attr('height', height)
            .style('display', 'block');
        const x = d3.scaleLinear()
            .domain([xExtent[0], xExtent[1]]).nice()
            .range([margin.left, width - margin.right]);
        const y = d3.scaleLinear()
            .domain([minGen, maxGen]).nice()
            .range([margin.top, height - margin.bottom]);
        // Axes
        svg.append('g')
            .attr('transform', `translate(0,${margin.top})`)
            .call(d3.axisTop(x))
            .append('text')
            .attr('x', width/2)
            .attr('y', -35)
            .attr('fill', '#888')
            .attr('text-anchor', 'middle')
            .attr('font-size', '1.1em')
            .text(metric);
        svg.append('g')
            .attr('transform', `translate(${margin.left},0)`)
            .call(d3.axisLeft(y).ticks(Math.min(12, genCount)))
            .append('text')
            .attr('transform', 'rotate(-90)')
            .attr('x', -height/2)
            .attr('y', -45)
            .attr('fill', '#888')
            .attr('text-anchor', 'middle')
            .attr('font-size', '1.1em')
            .text('Generation');
        // Highlight logic (same as branching)
        const highlightFilter = document.getElementById('highlight-select').value;
        const highlightNodes = getHighlightNodes(nodes, highlightFilter, metric);
        const highlightIds = new Set(highlightNodes.map(n => n.id));
        // Draw nodes as circles
        svg.append('g')
            .selectAll('circle')
            .data(validNodes)
            .enter()
            .append('circle')
            .attr('cx', d => x(d.metrics[metric]))
            .attr('cy', d => y(d.generation))
            .attr('r', d => getNodeRadius(d))
            .attr('fill', d => getNodeColor(d))
            .attr('class', d => [
                highlightIds.has(d.id) ? 'node-highlighted' : '',
                selectedProgramId === d.id ? 'node-selected' : ''
            ].join(' ').trim())
            .attr('stroke', d => selectedProgramId === d.id ? 'red' : '#333')
            .attr('stroke-width', d => selectedProgramId === d.id ? 3 : 1.5)
            .attr('opacity', 0.85)
            .on('mouseover', function(event, d) {
                if (selectedProgramId === d.id) return; // Do not apply hover if selected
                showSidebarContent(d);
                showSidebar();
                d3.select(this)
                    .classed('node-hovered', true)
                    .attr('stroke', '#FFD600').attr('stroke-width', 4);
            })
            .on('mouseout', function(event, d) {
                if (selectedProgramId === d.id) return; // Do not revert if selected
                showSidebarContent(null);
                d3.select(this)
                    .classed('node-hovered', false)
                    .attr('stroke', '#333').attr('stroke-width', 1.5);
            })
            .on('click', function(event, d) {
                selectedProgramId = d.id;
                window._lastSelectedNodeData = d;
                showSidebarContent(d);
                showSidebar();
                selectProgram(selectedProgramId);
                renderPerformanceGraph(nodes);
            });
        // Unselect logic: click background to unselect
        svg.on('click', function(event) {
            if (event.target === svg.node()) {
                selectedProgramId = null;
                showSidebarContent(null);
                svg.selectAll('circle')
                    .classed('node-selected', false)
                    .classed('node-hovered', false)
                    .attr('stroke', '#333')
                    .attr('stroke-width', 1.5);
            }
        });
    }
    // Hook into fetchAndRender to update performance graph
    const origFetchAndRender = fetchAndRender;
    fetchAndRender = function() {
        origFetchAndRender.apply(this, arguments);
        if (typeof allNodeData !== 'undefined' && allNodeData.length) {
            renderPerformanceGraph(allNodeData);
        }
    };
    // Also update on metric or highlight change
    const metricSelect = document.getElementById('metric-select');
    metricSelect.addEventListener('change', function() {
        if (typeof allNodeData !== 'undefined' && allNodeData.length) {
            renderPerformanceGraph(allNodeData);
        }
    });
    const highlightSelect = document.getElementById('highlight-select');
    highlightSelect.addEventListener('change', function() {
        if (typeof allNodeData !== 'undefined' && allNodeData.length) {
            renderPerformanceGraph(allNodeData);
        }
    });
    document.getElementById('tab-performance').addEventListener('click', function() {
        if (typeof allNodeData !== 'undefined' && allNodeData.length) {
            renderPerformanceGraph(allNodeData);
        }
    });
})();
