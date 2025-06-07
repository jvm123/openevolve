// main.js for OpenEvolve Evolution Visualizer

// Declare allNodeData at the very top to avoid ReferenceError
let allNodeData = [];

// --- Store archive list globally for highlight logic ---
let archiveProgramIds = [];

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
let sidebarSticky = false; // Track if sidebar should be sticky (after selection)

function showSidebar() {
    sidebar.style.transform = 'translateX(0)';
}
function hideSidebar() {
    sidebar.style.transform = 'translateX(100%)';
    sidebarSticky = false;
    showSidebarContent(null);
}

// Patch showSidebarContent to only update content on selection, not hover
function showSidebarContent(d, fromHover = false) {
    const sidebarContent = document.getElementById('sidebar-content');
    if (!sidebarContent) return;
    // Only allow hover to update content if sidebar is not sticky
    if (fromHover && sidebarSticky) return;
    if (!d) {
        sidebarContent.innerHTML = '';
        return;
    }
    // Star for MAP-Elite archive
    let starHtml = '';
    if (archiveProgramIds && archiveProgramIds.includes(d.id)) {
        starHtml = '<span style="position:absolute;top:0.2em;left:0.5em;font-size:1.5em;color:#FFD600;z-index:10;">★</span>';
    }
    // X button for closing sidebar (tighter in the corner)
    let closeBtn = '<button id="sidebar-close-btn" style="position:absolute;top:0.2em;right:0.5em;font-size:1.5em;background:none;border:none;color:#888;cursor:pointer;z-index:10;line-height:1;">&times;</button>';
    // Centered open link
    let openLink = '<div style="text-align:center;margin:0.5em 0 1.2em 0;"><a href="/program/' + d.id + '" target="_blank" style="font-size:0.95em;">[open in new window]</a></div>';
    // Tab logic for code/prompts
    let tabHtml = '';
    let tabContentHtml = '';
    let tabNames = [];
    if (d.code && typeof d.code === 'string' && d.code.trim() !== '') tabNames.push('Code');
    if (d.prompts && typeof d.prompts === 'object' && Object.keys(d.prompts).length > 0) tabNames.push('Prompts');
    if (tabNames.length > 0) {
        tabHtml = '<div id="sidebar-tab-bar" style="display:flex;gap:0.7em;margin-bottom:0.7em;">' +
            tabNames.map((name, i) => `<span class="sidebar-tab${i===0?' active':''}" data-tab="${name}">${name}</span>`).join('') + '</div>';
        tabContentHtml = '<div id="sidebar-tab-content">';
        if (tabNames[0] === 'Code') tabContentHtml += `<pre style="max-height:260px;overflow:auto;background:#f7f7f7;padding:0.7em 1em;border-radius:6px;">${d.code}</pre>`;
        if (tabNames[0] === 'Prompts') tabContentHtml += `<pre style="max-height:260px;overflow:auto;background:#f7f7f7;padding:0.7em 1em;border-radius:6px;">${JSON.stringify(d.prompts, null, 2)}</pre>`;
        tabContentHtml += '</div>';
    }
    // Parent island logic
    let parentIslandHtml = '';
    if (d.parent_id && d.parent_id !== 'None') {
        const parent = allNodeData.find(n => n.id == d.parent_id);
        if (parent && parent.island !== undefined) {
            parentIslandHtml = ` <span style="color:#888;font-size:0.92em;">(island ${parent.island})</span>`;
        }
    }
    // Sidebar HTML
    sidebarContent.innerHTML =
        `<div style="position:relative;min-height:2em;">
            ${starHtml}
            ${closeBtn}
            ${openLink}
            <b>Program ID:</b> ${d.id}<br>
            <b>Island:</b> ${d.island}<br>
            <b>Generation:</b> ${d.generation}<br>
            <b>Parent ID:</b> <a href="#" class="parent-link" data-parent="${d.parent_id || ''}">${d.parent_id || 'None'}</a>${parentIslandHtml}<br><br>
            <b>Metrics:</b><br>${formatMetrics(d.metrics)}<br><br>
            ${tabHtml}${tabContentHtml}
        </div>`;
    // Tab switching logic
    if (tabNames.length > 1) {
        const tabBar = document.getElementById('sidebar-tab-bar');
        Array.from(tabBar.children).forEach(tabEl => {
            tabEl.onclick = function() {
                Array.from(tabBar.children).forEach(e => e.classList.remove('active'));
                tabEl.classList.add('active');
                const tabName = tabEl.dataset.tab;
                const tabContent = document.getElementById('sidebar-tab-content');
                if (tabName === 'Code') tabContent.innerHTML = `<pre style="max-height:260px;overflow:auto;background:#f7f7f7;padding:0.7em 1em;border-radius:6px;">${d.code}</pre>`;
                if (tabName === 'Prompts') tabContent.innerHTML = `<pre style="max-height:260px;overflow:auto;background:#f7f7f7;padding:0.7em 1em;border-radius:6px;">${JSON.stringify(d.prompts, null, 2)}</pre>`;
            };
        });
    }
    // X button logic: also clear selection
    const closeBtnEl = document.getElementById('sidebar-close-btn');
    if (closeBtnEl) closeBtnEl.onclick = function() {
        selectedProgramId = null;
        sidebarSticky = false;
        hideSidebar();
    };
    // Parent link logic: works in all tabs
    const parentLink = sidebarContent.querySelector('.parent-link');
    if (parentLink && parentLink.dataset.parent && parentLink.dataset.parent !== 'None' && parentLink.dataset.parent !== '') {
        parentLink.onclick = function(e) {
            e.preventDefault();
            scrollAndSelectNodeById(parentLink.dataset.parent);
        };
    }
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

// --- Utility: scroll and select node by id in any view ---
function scrollAndSelectNodeById(nodeId) {
    // Try list view first
    const container = document.getElementById('node-list-container');
    if (container) {
        const rows = Array.from(container.children);
        const target = rows.find(div => div.getAttribute('data-node-id') === nodeId);
        if (target) {
            target.scrollIntoView({behavior: 'smooth', block: 'center'});
            selectedProgramId = nodeId;
            renderNodeList(allNodeData);
            showSidebarContent(allNodeData.find(n => n.id == nodeId));
            showSidebar();
            selectProgram(selectedProgramId);
            return true;
        }
    }
    // Try graph views (branching/performance)
    const node = allNodeData.find(n => n.id == nodeId);
    if (node) {
        selectedProgramId = nodeId;
        showSidebarContent(node);
        showSidebar();
        selectProgram(selectedProgramId);
        // Optionally, center/zoom to node in D3 (not implemented here)
        return true;
    }
    return false;
}

function showSidebarContent(d) {
    const sidebarContent = document.getElementById('sidebar-content');
    if (!d) {
        sidebarContent.innerHTML =
            '<span style="color:#888;">Select a node to see details.</span>';
        hideSidebar();
        return;
    }
    // Star for MAP-Elite archive
    let starHtml = '';
    if (archiveProgramIds && archiveProgramIds.includes(d.id)) {
        starHtml = '<span title="MAP-Elite archive" alt="MAP-Elite archive" style="position:absolute;top:0.4em;left:0.5em;font-size:1.7em;color:#FFD600;z-index:20;">★</span>';
    }
    // X button for closing sidebar (tighter in the corner)
    let closeBtn = '<button id="sidebar-close-btn" style="position:absolute;top:0.2em;right:0.5em;font-size:1.5em;background:none;border:none;color:#888;cursor:pointer;z-index:10;line-height:1;">&times;</button>';
    // Centered open link
    let openLink = '<div style="text-align:center;margin:0.5em 0 1.2em 0;"><a href="/program/' + d.id + '" target="_blank" style="font-size:0.95em;">[open in new window]</a></div>';
    // Tab logic for code/prompts
    let tabHtml = '';
    let tabContentHtml = '';
    let tabNames = [];
    if (d.code && typeof d.code === 'string' && d.code.trim() !== '') tabNames.push('Code');
    if (d.prompts && typeof d.prompts === 'object' && Object.keys(d.prompts).length > 0) tabNames.push('Prompt');
    if (tabNames.length > 0) {
        tabHtml += '<div id="sidebar-tab-bar" class="sidebar-tab-bar">';
        tabNames.forEach((tab, i) => {
            tabHtml += `<div class="sidebar-tab${i===0?' active':''}" data-tab="${tab}">${tab}</div>`;
        });
        tabHtml += '</div>';
        tabContentHtml += '<div id="sidebar-tab-content">';
        if (tabNames[0] === 'Code') {
            tabContentHtml += `<pre class="sidebar-pre">${d.code.replace(/</g, '&lt;')}</pre>`;
        } else if (tabNames[0] === 'Prompt') {
            Object.entries(d.prompts).forEach(([k, v]) => {
                tabContentHtml += `<b>Prompt: ${k}</b><pre class="sidebar-pre">${v.replace(/</g, '&lt;')}</pre>`;
            });
        }
        tabContentHtml += '</div>';
    }
    // Parent island logic
    let parentIslandHtml = '';
    if (d.parent_id && d.parent_id !== 'None') {
        const parentNode = allNodeData.find(n => n.id == d.parent_id);
        if (parentNode && parentNode.island !== undefined && parentNode.island !== d.island) {
            parentIslandHtml = `<br><b>Parent Island:</b> ${parentNode.island}`;
        }
    }
    // Sidebar HTML
    sidebarContent.innerHTML =
        `<div style="position:relative;min-height:2em;">
            ${starHtml}
            ${closeBtn}
            ${openLink}
            <b>Program ID:</b> ${d.id}<br>
            <b>Island:</b> ${d.island}<br>
            <b>Generation:</b> ${d.generation}<br>
            <b>Parent ID:</b> <a href="#" class="parent-link" data-parent="${d.parent_id || ''}">${d.parent_id || 'None'}</a>${parentIslandHtml}<br><br>
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
                    tabContent.innerHTML = `<pre class="sidebar-pre">${d.code.replace(/</g, '&lt;')}</pre>`;
                } else if (tabEl.dataset.tab === 'Prompt') {
                    let html = '';
                    Object.entries(d.prompts).forEach(([k, v]) => {
                        html += `<b>Prompt: ${k}</b><pre class="sidebar-pre">${v.replace(/</g, '&lt;')}</pre>`;
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
    // Parent link logic: works in all tabs
    const parentLink = sidebarContent.querySelector('.parent-link');
    if (parentLink && parentLink.dataset.parent && parentLink.dataset.parent !== 'None' && parentLink.dataset.parent !== '') {
        parentLink.onclick = function(e) {
            e.preventDefault();
            scrollAndSelectNodeById(parentLink.dataset.parent);
            // Also update node selection in all graphs (including performance tab)
            selectProgram(parentLink.dataset.parent);
            // If performance tab is visible, re-render to update red border
            if (document.getElementById('view-performance').style.display !== 'none') {
                if (typeof allNodeData !== 'undefined' && allNodeData.length) {
                    window.renderPerformanceGraph && window.renderPerformanceGraph(allNodeData);
                }
            }
        };
    }
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
        .attr('stroke', d => selectedProgramId === d.id ? 'red' : (highlightIds.has(d.id) ? '#2196f3' : '#333'))
        .attr('stroke-width', d => selectedProgramId === d.id ? 3 : 1.5)
        .on("click", function(event, d) {
            selectedProgramId = d.id;
            sidebarSticky = true;
            // Remove all node-hovered and node-selected classes
            g.selectAll('circle').classed('node-hovered', false).classed('node-selected', false)
                .attr('stroke', function(nd) {
                    return selectedProgramId === nd.id ? 'red' : (highlightIds.has(nd.id) ? '#2196f3' : '#333');
                })
                .attr('stroke-width', function(nd) {
                    return selectedProgramId === nd.id ? 3 : 1.5;
                });
            d3.select(this).classed('node-selected', true);
            showSidebarContent(d, false);
            showSidebar();
            selectProgram(selectedProgramId);
            event.stopPropagation();
        })
        .on("dblclick", openInNewTab)
        .on("mouseover", function(event, d) {
            if (!sidebarSticky && (!selectedProgramId || selectedProgramId !== d.id)) {
                showSidebarContent(d, true);
                showSidebar();
            }
            d3.select(this)
                .classed('node-hovered', true)
                .attr('stroke', '#FFD600').attr('stroke-width', 4);
        })
        .on("mouseout", function(event, d) {
            d3.select(this)
                .classed('node-hovered', false)
                .attr('stroke', selectedProgramId === d.id ? 'red' : (highlightIds.has(d.id) ? '#2196f3' : '#333'))
                .attr('stroke-width', selectedProgramId === d.id ? 3 : 1.5);
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

    // Click background to unselect node and reset sidebar (and hide sidebar)
    svg.on("click", function(event) {
        if (event.target === svg.node()) {
            selectedProgramId = null;
            sidebarSticky = false;
            hideSidebar();
            // Reset all node highlights and remove highlight classes
            g.selectAll("circle")
                .classed("node-selected", false)
                .classed("node-hovered", false)
                .attr("stroke", function(d) { return (highlightIds.has(d.id) ? '#2196f3' : '#333'); })
                .attr("stroke-width", 1.5);
        }
    });
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

// --- Shared metric bar rendering for summary and node metrics, with min/max labels (CSS only for position) ---
function renderMetricBar(value, min, max, opts={}) {
    let percent = 0;
    if (typeof value === 'number' && isFinite(value) && max > min) {
        percent = (value - min) / (max - min);
        percent = Math.max(0, Math.min(1, percent));
    }
    // Min/max labels: always present, rely on CSS for position
    let minLabel = `<span class="metric-bar-min">${min.toFixed(2)}</span>`;
    let maxLabel = `<span class="metric-bar-max">${max.toFixed(2)}</span>`;
    if (opts.vertical) {
        // For fitness bar, show min/max at top right/bottom right
        minLabel = `<span class="fitness-bar-min" style="right:0;left:auto;">${min.toFixed(2)}</span>`;
        maxLabel = `<span class="fitness-bar-max" style="right:0;left:auto;">${max.toFixed(2)}</span>`;
    }
    // Ensure min/max are always visible by not hiding them with overflow
    return `<span class="metric-bar${opts.vertical ? ' vertical' : ''}" style="overflow:visible;">
        ${minLabel}${maxLabel}
        <span class="metric-bar-fill" style="width:${Math.round(percent*100)}%"></span>
    </span>`;
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
    const metric = getSelectedMetric();
    // Always re-sort if sort is by score and metric changes
    if (sort === 'id') {
        filtered = filtered.slice().sort((a, b) => (a.id + '').localeCompare(b.id + ''));
    } else if (sort === 'generation') {
        filtered = filtered.slice().sort((a, b) => (a.generation || 0) - (b.generation || 0));
    } else if (sort === 'island') {
        filtered = filtered.slice().sort((a, b) => (a.island || 0) - (b.island || 0));
    } else if (sort === 'score') {
        filtered = filtered.slice().sort((a, b) => {
            const aScore = a.metrics && typeof a.metrics[metric] === 'number' ? a.metrics[metric] : -Infinity;
            const bScore = b.metrics && typeof b.metrics[metric] === 'number' ? b.metrics[metric] : -Infinity;
            return bScore - aScore; // Descending
        });
    }
    // Highlight logic for list view
    const highlightFilter = document.getElementById('highlight-select').value;
    const highlightNodes = getHighlightNodes(nodes, highlightFilter, metric);
    const highlightIds = new Set(highlightNodes.map(n => n.id));
    // For fitness bar scaling
    const allScores = nodes.map(n => (n.metrics && typeof n.metrics[metric] === 'number') ? n.metrics[metric] : null).filter(x => x !== null && !isNaN(x));
    const minScore = allScores.length ? Math.min(...allScores) : 0;
    const maxScore = allScores.length ? Math.max(...allScores) : 1;
    // Compute summary
    const topScore = allScores.length ? Math.max(...allScores) : 0;
    const avgScore = allScores.length ? (allScores.reduce((a, b) => a + b, 0) / allScores.length) : 0;
    // Add summary bar (visually improved, with border, using shared metric bar)
    let summaryBar = document.getElementById('list-summary-bar');
    if (!summaryBar) {
        summaryBar = document.createElement('div');
        summaryBar.id = 'list-summary-bar';
        summaryBar.className = 'list-summary-bar';
        container.parentElement.insertBefore(summaryBar, container);
    }
    summaryBar.innerHTML = `
      <div class="summary-block">
        <span class="summary-icon">🏆</span>
        <span class="summary-label">Top score</span>
        <span class="summary-value">${topScore.toFixed(4)}</span>
        ${renderMetricBar(topScore, minScore, maxScore)}
      </div>
      <div class="summary-block">
        <span class="summary-icon">📊</span>
        <span class="summary-label">Average</span>
        <span class="summary-value">${avgScore.toFixed(4)}</span>
        ${renderMetricBar(avgScore, minScore, maxScore)}
      </div>
    `;
    container.innerHTML = '';
    filtered.forEach(node => {
        // Node row: selectable by clicking anywhere except links
        const row = document.createElement('div');
        row.className = 'node-list-item' + (selectedProgramId === node.id ? ' selected' : '') + (highlightIds.has(node.id) ? ' highlighted' : '');
        row.setAttribute('data-node-id', node.id); // for parent scroll
        row.tabIndex = 0;
        // Fitness bar calculation
        let score = node.metrics && typeof node.metrics[metric] === 'number' ? node.metrics[metric] : null;
        let percent = 0;
        if (score !== null && !isNaN(score) && maxScore > minScore) {
            percent = (score - minScore) / (maxScore - minScore);
            percent = Math.max(0, Math.min(1, percent));
        }
        // Fitness bar HTML (vertical, with min/max at top right/bottom right)
        const bar = document.createElement('div');
        bar.className = 'fitness-bar';
        bar.style.position = 'relative';
        bar.style.width = '28px';
        bar.style.height = '64px';
        bar.style.margin = '0 20px 0 0';
        bar.innerHTML = `
            <span class="fitness-bar-max" style="position:absolute;top:-1.2em;right:0;font-size:0.85em;color:#bbb;">${maxScore.toFixed(2)}</span>
            <span class="fitness-bar-min" style="position:absolute;top:100%;right:0;font-size:0.85em;color:#bbb;">${minScore.toFixed(2)}</span>
            <div class="fitness-bar-fill" style="position:absolute;bottom:0;left:0;width:100%;background:#2196f3;border-radius:4px 4px 0 0;height:${Math.round(percent * 100)}%;transition:height 0.2s;"></div>
        `;
        // Main info block (ID, Gen, Island, Parent)
        const infoBlock = document.createElement('div');
        infoBlock.className = 'node-info-block';
        infoBlock.style.flex = '0 0 160px';
        infoBlock.style.display = 'flex';
        infoBlock.style.flexDirection = 'column';
        infoBlock.style.justifyContent = 'center';
        infoBlock.style.gap = '2px';
        infoBlock.style.marginRight = '18px';
        infoBlock.innerHTML = `
            <div><b>ID:</b> ${node.id}</div>
            <div><b>Gen:</b> ${node.generation ?? ''}</div>
            <div><b>Island:</b> ${node.island ?? ''}</div>
            <div><b>Parent:</b> <a href="#" class="parent-link" data-parent="${node.parent_id ?? ''}">${node.parent_id ?? 'None'}</a></div>
        `;
        // Metrics block below, full width
        let metricsHtml = '<div class="metrics-block" style="display:flex;flex-direction:column;gap:2px;">';
        if (node.metrics) {
            Object.entries(node.metrics).forEach(([k, v]) => {
                let val = (typeof v === 'number' && isFinite(v)) ? v.toFixed(4) : v;
                // Per-metric bar (horizontal, blue), use min/max for this metric
                let allVals = nodes.map(n => (n.metrics && typeof n.metrics[k] === 'number') ? n.metrics[k] : null).filter(x => x !== null && isFinite(x));
                let minV = allVals.length ? Math.min(...allVals) : 0;
                let maxV = allVals.length ? Math.max(...allVals) : 1;
                metricsHtml += `<div class="metric-row"><span class="metric-label">${k}:</span> <span class="metric-value">${val}</span>${renderMetricBar(v, minV, maxV)}</div>`;
            });
        }
        metricsHtml += '</div>';
        // Flexbox layout: fitness bar | info block | metrics block
        row.style.display = 'flex';
        row.style.alignItems = 'center';
        row.style.gap = '0';
        row.style.padding = '12px 8px';
        row.style.margin = '0 0 10px 0';
        row.style.borderRadius = '8px';
        row.style.border = selectedProgramId === node.id ? '2.5px solid red' : '1.5px solid #4442';
        row.style.boxShadow = highlightIds.has(node.id) ? '0 0 0 2px #2196f3' : 'none';
        row.style.background = '';
        row.appendChild(bar);
        row.appendChild(infoBlock);
        const metricsBlock = document.createElement('div');
        metricsBlock.innerHTML = metricsHtml;
        metricsBlock.className = 'metrics-block-outer';
        metricsBlock.style.flex = '1 1 0';
        metricsBlock.style.marginLeft = '18px';
        row.appendChild(metricsBlock);
        // Row selection logic: select on click anywhere except links
        row.onclick = (e) => {
            if (e.target.tagName === 'A') return;
            selectedProgramId = node.id;
            window._lastSelectedNodeData = node;
            sidebarSticky = true;
            renderNodeList(allNodeData);
            showSidebarContent(node, false); // always update on click
            showSidebar();
            selectProgram(selectedProgramId);
        };
        // Parent link logic for list (now uses scrollAndSelectNodeById)
        setTimeout(() => {
            const parentLink = row.querySelector('.parent-link');
            if (parentLink && parentLink.dataset.parent && parentLink.dataset.parent !== 'None' && parentLink.dataset.parent !== '') {
                parentLink.onclick = function(e) {
                    e.preventDefault();
                    scrollAndSelectNodeById(parentLink.dataset.parent);
                };
            }
        }, 0);
        container.appendChild(row);
    });
    // Update row backgrounds for theme/metric
    updateListRowBackgroundsForTheme();
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
            archiveProgramIds = Array.isArray(data.archive) ? data.archive : [];
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
    } else if (filter === 'archive') {
        return nodes.filter(n => archiveProgramIds.includes(n.id));
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
    // Update list view backgrounds and highlights, and re-render for sort by score
    renderNodeList(allNodeData);
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
    // Modern toggle for show islands
    let toggleDiv = document.getElementById('perf-island-toggle');
    if (!toggleDiv) {
        toggleDiv = document.createElement('div');
        toggleDiv.id = 'perf-island-toggle';
        toggleDiv.style = 'margin-bottom:1em;display:flex;align-items:center;gap:0.7em;';
        toggleDiv.innerHTML = `
        <label class="toggle-switch" style="margin-right:0.7em;">
            <input type="checkbox" id="show-islands-toggle">
            <span class="toggle-slider"></span>
        </label>
        <span style="font-weight:500;font-size:1.08em;">Show islands</span>
        `;
        perfDiv.insertBefore(toggleDiv, perfDiv.firstChild);
    }
    function renderPerformanceGraph(nodes) {
        window.renderPerformanceGraph = renderPerformanceGraph;
        d3.select('#performance-graph').remove();
        // Calculate width: window width - sidebar width - padding
        const sidebarEl = document.getElementById('sidebar');
        const padding = 32;
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        const toolbarHeight = document.getElementById('toolbar').offsetHeight;
        const sidebarWidth = sidebarEl.offsetWidth || 400;
        // Always fill available window (minus sidebar and padding)
        const width = Math.max(windowWidth - sidebarWidth - padding, 400);
        const height = Math.max(windowHeight - toolbarHeight - 24, 400); // 24 for some margin
        // X: metric, Y: generation (downwards, open-ended)
        const metric = getSelectedMetric();
        const validNodes = nodes.filter(n => n.metrics && typeof n.metrics[metric] === 'number');
        const undefinedNodes = nodes.filter(n => !n.metrics || n.metrics[metric] == null || isNaN(n.metrics[metric]));
        if (!validNodes.length && !undefinedNodes.length) return;
        // --- ISLAND SPLIT LOGIC ---
        const showIslands = document.getElementById('show-islands-toggle')?.checked;
        let islands = [];
        if (showIslands) {
            islands = Array.from(new Set(nodes.map(n => n.island))).sort((a,b)=>a-b);
        } else {
            islands = [null];
        }
        // Always start with generation 0
        const yExtent = d3.extent(nodes, d => d.generation);
        const minGen = 0;
        const maxGen = yExtent[1];
        const xExtent = d3.extent(validNodes, d => d.metrics[metric]);
        const margin = {top: 60, right: 40, bottom: 40, left: 60};
        let undefinedBoxWidth = 70; // reduced width
        const undefinedBoxPad = 54; // increased gap for y-axis
        const genCount = (maxGen - minGen + 1) || 1;
        // Height: one graph per island if split, else one
        const graphHeight = Math.max(400, genCount * 48 + margin.top + margin.bottom);
        // If window is tall, use all available height
        const totalGraphHeight = showIslands ? (graphHeight * islands.length) : graphHeight;
        // If window is taller, stretch graph to fill
        const svgHeight = Math.max(height, totalGraphHeight);
        // Move graph and y-axis further right to avoid overlap
        const graphXOffset = undefinedBoxWidth + undefinedBoxPad;
        const svg = d3.select(perfDiv)
            .append('svg')
            .attr('id', 'performance-graph')
            .attr('width', width)
            .attr('height', svgHeight)
            .style('display', 'block');
        // --- ZOOM/DRAG SUPPORT ---
        const g = svg.append('g').attr('class', 'zoom-group');
        svg.call(
            d3.zoom()
                .scaleExtent([0.2, 10])
                .on('zoom', function(event) {
                    g.attr('transform', event.transform);
                })
        );
        // For each island, render its nodes and edges
        let yScales = {};
        islands.forEach((island, i) => {
            const y = d3.scaleLinear()
                .domain([minGen, maxGen]).nice()
                .range([margin.top + i*graphHeight, margin.top + (i+1)*graphHeight - margin.bottom]);
            yScales[island] = y;
            // Axis (move right)
            g.append('g')
                .attr('transform', `translate(${margin.left+graphXOffset},0)`)
                .call(d3.axisLeft(y).ticks(Math.min(12, genCount)));
            // Y axis label (add only for first island or for each if split)
            g.append('text')
                .attr('transform', `rotate(-90)`)
                .attr('y', margin.left + 8)
                .attr('x', -(margin.top + i*graphHeight + (graphHeight - margin.top - margin.bottom)/2))
                .attr('dy', '-2.2em')
                .attr('text-anchor', 'middle')
                .attr('font-size', '1em')
                .attr('fill', '#888')
                .text('Generation');
            // Add headline for each island (move further down)
            if (showIslands) {
                g.append('text')
                    .attr('x', (width + undefinedBoxWidth) / 2)
                    .attr('y', margin.top + i*graphHeight + 38)
                    .attr('text-anchor', 'middle')
                    .attr('font-size', '2.1em')
                    .attr('font-weight', 700)
                    .attr('fill', '#444')
                    .attr('pointer-events', 'none')
                    .text(`Island ${island}`);
            }
        });
        // X axis (shared, move right)
        const x = d3.scaleLinear()
            .domain([xExtent[0], xExtent[1]]).nice()
            .range([margin.left+graphXOffset, width - margin.right]);
        g.append('g')
            .attr('transform', `translate(0,${margin.top})`)
            .call(d3.axisTop(x))
            .append('text')
            .attr('x', (width + undefinedBoxWidth) / 2)
            .attr('y', -35)
            .attr('fill', '#888')
            .attr('text-anchor', 'middle')
            .attr('font-size', '1.1em')
            .text(metric);
        // Highlight logic (same as branching)
        const highlightFilter = document.getElementById('highlight-select').value;
        const highlightNodes = getHighlightNodes(nodes, highlightFilter, metric);
        const highlightIds = new Set(highlightNodes.map(n => n.id));
        // Draw single NaN box (left of graph, spanning all islands)
        if (undefinedNodes.length) {
            // Make the NaN box narrower and transparent, with more gap to the graph
            let undefinedBoxWidth = 70; // reduced width
            const undefinedBoxPad = 54; // increased gap for y-axis
            const boxTop = margin.top;
            const boxBottom = showIslands ? (margin.top + islands.length*graphHeight - margin.bottom) : (margin.top + graphHeight - margin.bottom);
            // NaN label above the box, centered, smaller font
            g.append('text')
                .attr('x', margin.left + undefinedBoxWidth/2)
                .attr('y', boxTop - 10)
                .attr('text-anchor', 'middle')
                .attr('font-size', '0.92em') // smaller font
                .attr('fill', '#888')
                .text('NaN');
            // Transparent box (no fill, only border)
            g.append('rect')
                .attr('x', margin.left)
                .attr('y', boxTop)
                .attr('width', undefinedBoxWidth)
                .attr('height', boxBottom - boxTop)
                .attr('fill', 'none')
                .attr('stroke', '#bbb')
                .attr('stroke-width', 1.5)
                .attr('rx', 12);
            // Draw all NaN nodes in the box, always centered horizontally
            let xNaN = margin.left + undefinedBoxWidth/2;
            g.append('g')
                .selectAll('circle')
                .data(undefinedNodes)
                .enter()
                .append('circle')
                .attr('cx', xNaN)
                .attr('cy', d => yScales[showIslands ? d.island : null](d.generation))
                .attr('r', d => getNodeRadius(d))
                .attr('fill', d => getNodeColor(d))
                .attr('class', d => [selectedProgramId === d.id ? 'node-selected' : ''].join(' ').trim())
                .attr('stroke', d => selectedProgramId === d.id ? 'red' : (highlightIds.has(d.id) ? '#2196f3' : '#333'))
                .attr('stroke-width', d => selectedProgramId === d.id ? 3 : 1.5)
                .attr('opacity', 0.85)
                .on('mouseover', function(event, d) {
                    if (!sidebarSticky && (!selectedProgramId || selectedProgramId !== d.id)) {
                        showSidebarContent(d, true); // only update if not sticky
                        showSidebar();
                    }
                    d3.select(this)
                        .classed('node-hovered', true)
                        .attr('stroke', '#FFD600').attr('stroke-width', 4);
                })
                .on('mouseout', function(event, d) {
                    d3.select(this)
                        .classed('node-hovered', false)
                        .attr('stroke', selectedProgramId === d.id ? 'red' : (highlightIds.has(d.id) ? '#2196f3' : '#333'))
                        .attr('stroke-width', selectedProgramId === d.id ? 3 : 1.5);
                })
                .on('click', function(event, d) {
                    event.preventDefault();
                    selectedProgramId = d.id;
                    window._lastSelectedNodeData = d;
                    sidebarSticky = true;
                    // Remove all node-hovered and node-selected classes
                    g.selectAll('circle').classed('node-hovered', false).classed('node-selected', false)
                        .attr('stroke', function(nd) {
                            return selectedProgramId === nd.id ? 'red' : (highlightIds.has(nd.id) ? '#2196f3' : '#333');
                        })
                        .attr('stroke-width', function(nd) {
                            return selectedProgramId === nd.id ? 3 : 1.5;
                        });
                    d3.select(this).classed('node-selected', true);
                    showSidebarContent(d, false); // always update on click
                    showSidebar();
                    selectProgram(selectedProgramId);
                    renderPerformanceGraph(nodes);
                });
        }
        // Draw edges (parent-child links, can cross islands)
        const nodeById = Object.fromEntries(nodes.map(n => [n.id, n]));
        // New: handle all edge types (defined→defined, defined→undefined, undefined→defined, undefined→undefined)
        const edges = nodes.filter(n => n.parent_id && nodeById[n.parent_id]).map(n => {
            return {
                source: nodeById[n.parent_id],
                target: n
            };
        });
        g.append('g')
            .selectAll('line')
            .data(edges)
            .enter()
            .append('line')
            .attr('x1', d => {
                const m = d.source.metrics && typeof d.source.metrics[metric] === 'number' ? d.source.metrics[metric] : null;
                if (m === null || isNaN(m)) {
                    // Undefined: in undefined box
                    return margin.left + undefinedBoxWidth/2;
                } else {
                    return x(m);
                }
            })
            .attr('y1', d => {
                const m = d.source.metrics && typeof d.source.metrics[metric] === 'number' ? d.source.metrics[metric] : null;
                const island = showIslands ? d.source.island : null;
                if (m === null || isNaN(m)) {
                    // Undefined: in undefined box, vertical by generation
                    return yScales[island](d.source.generation);
                } else {
                    return yScales[island](d.source.generation);
                }
            })
            .attr('x2', d => {
                const m = d.target.metrics && typeof d.target.metrics[metric] === 'number' ? d.target.metrics[metric] : null;
                if (m === null || isNaN(m)) {
                    // Undefined: in undefined box
                    return margin.left + undefinedBoxWidth/2;
                } else {
                    return x(m);
                }
            })
            .attr('y2', d => {
                const m = d.target.metrics && typeof d.target.metrics[metric] === 'number' ? d.target.metrics[metric] : null;
                const island = showIslands ? d.target.island : null;
                if (m === null || isNaN(m)) {
                    // Undefined: in undefined box, vertical by generation
                    return yScales[island](d.target.generation);
                } else {
                    return yScales[island](d.target.generation);
                }
            })
            .attr('stroke', '#888')
            .attr('stroke-width', 1.5)
            .attr('opacity', 0.5);
        // Draw nodes as circles (only valid metric nodes)
        g.append('g')
            .selectAll('circle')
            .data(validNodes)
            .enter()
            .append('circle')
            .attr('cx', d => x(d.metrics[metric]))
            .attr('cy', d => showIslands ? yScales[d.island](d.generation) : yScales[null](d.generation))
            .attr('r', d => getNodeRadius(d))
            .attr('fill', d => getNodeColor(d))
            .attr('class', d => [
                highlightIds.has(d.id) ? 'node-highlighted' : '',
                selectedProgramId === d.id ? 'node-selected' : ''
            ].join(' ').trim())
            .attr('stroke', d => selectedProgramId === d.id ? 'red' : (highlightIds.has(d.id) ? '#2196f3' : '#333'))
            .attr('stroke-width', d => selectedProgramId === d.id ? 3 : 1.5)
            .attr('opacity', 0.85)
            .on('mouseover', function(event, d) {
                if (!sidebarSticky && (!selectedProgramId || selectedProgramId !== d.id)) {
                    showSidebarContent(d, true); // only update if not sticky
                    showSidebar();
                }
                d3.select(this)
                    .classed('node-hovered', true)
                    .attr('stroke', '#FFD600').attr('stroke-width', 4);
            })
            .on('mouseout', function(event, d) {
                d3.select(this)
                    .classed('node-hovered', false)
                    .attr('stroke', selectedProgramId === d.id ? 'red' : (highlightIds.has(d.id) ? '#2196f3' : '#333'))
                    .attr('stroke-width', selectedProgramId === d.id ? 3 : 1.5);
            })
            .on('click', function(event, d) {
                event.preventDefault();
                selectedProgramId = d.id;
                window._lastSelectedNodeData = d;
                sidebarSticky = true;
                // Remove all node-hovered and node-selected classes
                g.selectAll('circle').classed('node-hovered', false).classed('node-selected', false)
                    .attr('stroke', function(nd) {
                        return selectedProgramId === nd.id ? 'red' : (highlightIds.has(nd.id) ? '#2196f3' : '#333');
                    })
                    .attr('stroke-width', function(nd) {
                        return selectedProgramId === nd.id ? 3 : 1.5;
                    });
                d3.select(this).classed('node-selected', true);
                showSidebarContent(d, false); // always update on click
                showSidebar();
                selectProgram(selectedProgramId);
                renderPerformanceGraph(nodes);
            });
        // Unselect logic: click background to unselect
        svg.on('click', function(event) {
            if (event.target === svg.node()) {
                selectedProgramId = null;
                sidebarSticky = false;
                hideSidebar();
                svg.selectAll('circle')
                    .classed('node-selected', false)
                    .classed('node-hovered', false)
                    .attr('stroke', '#333')
                    .attr('stroke-width', 1.5);
            }
        });
        // Summary bar at top (match list tab style)
        let perfSummary = document.getElementById('performance-summary-bar');
        const allScores = nodes.map(n => (n.metrics && typeof n.metrics[metric] === 'number') ? n.metrics[metric] : null).filter(x => x !== null && !isNaN(x));
        const minScore = allScores.length ? Math.min(...allScores) : 0;
        const maxScore = allScores.length ? Math.max(...allScores) : 1;
        const topScore = allScores.length ? Math.max(...allScores) : 0;
        const avgScore = allScores.length ? (allScores.reduce((a, b) => a + b, 0) / allScores.length) : 0;
        if (!perfSummary) {
            perfSummary = document.createElement('div');
            perfSummary.id = 'performance-summary-bar';
            perfSummary.className = 'list-summary-bar';
            perfDiv.insertBefore(perfSummary, perfDiv.firstChild);
        }
        perfSummary.style.paddingTop = '2.2em';
        perfSummary.innerHTML = `
          <div class="summary-block">
            <span class="summary-icon">🏆</span>
            <span class="summary-label">Top score</span>
            <span class="summary-value">${topScore.toFixed(4)}</span>
            ${renderMetricBar(topScore, minScore, maxScore)}
          </div>
          <div class="summary-block">
            <span class="summary-icon">📊</span>
            <span class="summary-label">Average</span>
            <span class="summary-value">${avgScore.toFixed(4)}</span>
            ${renderMetricBar(avgScore, minScore, maxScore)}
          </div>
        `;
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
    // Toggle event
    document.getElementById('show-islands-toggle').addEventListener('change', function() {
        if (typeof allNodeData !== 'undefined' && allNodeData.length) {
            renderPerformanceGraph(allNodeData);
        }
    });
})();

// --- Add highlight option for MAP-elites archive ---
(function() {
    const highlightSelect = document.getElementById('highlight-select');
    if (highlightSelect && !Array.from(highlightSelect.options).some(o => o.value === 'archive')) {
        const opt = document.createElement('option');
        opt.value = 'archive';
        opt.textContent = 'MAP-elites archive';
        highlightSelect.appendChild(opt);
    }
})();
