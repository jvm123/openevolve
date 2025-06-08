import { width, height, getHighlightNodes, allNodeData, selectedProgramId, setSelectedProgramId } from './main.js';
import { openInNewTab, showSidebarContent, sidebarSticky, showSidebar, setSidebarSticky, hideSidebar } from './sidebar.js';
import { renderNodeList, selectListNodeById } from './list.js';

export function scrollAndSelectNodeById(nodeId) {
    const container = document.getElementById('node-list-container');
    if (container) {
        const rows = Array.from(container.children);
        const target = rows.find(div => div.getAttribute('data-node-id') === nodeId);
        if (target) {
            target.scrollIntoView({behavior: 'smooth', block: 'center'});
            setSelectedProgramId(nodeId);
            renderNodeList(allNodeData);
            showSidebarContent(allNodeData.find(n => n.id == nodeId));
            showSidebar();
            setSidebarSticky(true);
            selectProgram(selectedProgramId);
            updateGraphNodeSelection();
            return true;
        }
    }
    const node = allNodeData.find(n => n.id == nodeId);
    if (node) {
        setSelectedProgramId(nodeId);
        showSidebarContent(node);
        showSidebar();
        setSidebarSticky(true);
        selectProgram(selectedProgramId);
        updateGraphNodeSelection();
        return true;
    }
    return false;
}

export function updateGraphNodeSelection() {
    if (!g) return;
    g.selectAll('circle')
        .attr('stroke', d => selectedProgramId === d.id ? 'red' : '#333')
        .attr('stroke-width', d => selectedProgramId === d.id ? 3 : 1.5)
        .classed('node-selected', d => selectedProgramId === d.id);
}

export function getNodeColor(d) {
    if (d.island !== undefined) return d3.schemeCategory10[d.island % 10];
    return getComputedStyle(document.documentElement)
        .getPropertyValue('--node-default').trim() || "#fff";
}

function getSelectedMetric() {
    const metricSelect = document.getElementById('metric-select');
    return metricSelect ? metricSelect.value : 'overall_score';
}

export function getNodeRadius(d) {
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

export function selectProgram(programId) {
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

let svg = null;
let g = null;

function ensureGraphSvg() {
    // Always get latest width/height from main.js
    let svgEl = d3.select('#graph').select('svg');
    if (svgEl.empty()) {
        svgEl = d3.select('#graph').append('svg')
            .attr('width', width)
            .attr('height', height)
            .attr('id', 'graph-svg');
    } else {
        svgEl.attr('width', width).attr('height', height);
    }
    let gEl = svgEl.select('g');
    if (gEl.empty()) {
        gEl = svgEl.append('g');
    }
    return { svg: svgEl, g: gEl };
}

function applyDragHandlersToAllNodes() {
    if (!g) return;
    g.selectAll('circle').each(function() {
        d3.select(this).on('.drag', null);
        d3.select(this).call(d3.drag()
            .on('start', dragstarted)
            .on('drag', dragged)
            .on('end', dragended));
    });
}

function renderGraph(data) {
    const { svg: svgEl, g: gEl } = ensureGraphSvg();
    svg = svgEl;
    g = gEl;
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
            setSelectedProgramId(d.id);
            setSidebarSticky(true);
            selectListNodeById(d.id); // sync list selection
            g.selectAll('circle')
                .classed('node-hovered', false)
                .classed('node-selected', false)
                .classed('node-highlighted', nd => highlightIds.has(nd.id))
                .classed('node-selected', nd => selectedProgramId === nd.id);
            d3.select(this).classed('node-selected', true);
            showSidebarContent(d, false);
            showSidebar();
            selectProgram(selectedProgramId);
            event.stopPropagation();
            applyDragHandlersToAllNodes();
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
            applyDragHandlersToAllNodes();
        })
        .on("mouseout", function(event, d) {
            d3.select(this)
                .classed('node-hovered', false)
                .attr('stroke', selectedProgramId === d.id ? 'red' : (highlightIds.has(d.id) ? '#2196f3' : '#333'))
                .attr('stroke-width', selectedProgramId === d.id ? 3 : 1.5);
            if (!selectedProgramId) {
                hideSidebar();
            }
            applyDragHandlersToAllNodes();
        });

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
    applyDragHandlersToAllNodes();

    svg.on("click", function(event) {
        if (event.target === svg.node()) {
            setSelectedProgramId(null);
            setSidebarSticky(false);
            hideSidebar();
            g.selectAll("circle")
                .classed("node-selected", false)
                .classed("node-hovered", false)
                .attr("stroke", function(d) { return (highlightIds.has(d.id) ? '#2196f3' : '#333'); })
                .attr("stroke-width", 1.5);
            applyDragHandlersToAllNodes();
        }
    });
}

export function animateGraphNodeAttributes() {
    if (!g) return;
    const metric = getSelectedMetric();
    const filter = document.getElementById('highlight-select').value;
    const highlightNodes = getHighlightNodes(allNodeData, filter, metric);
    const highlightIds = new Set(highlightNodes.map(n => n.id));
    g.selectAll('circle')
        .transition().duration(400)
        .attr('r', d => getNodeRadius(d))
        .attr('fill', d => getNodeColor(d))
        .attr('stroke', d => selectedProgramId === d.id ? 'red' : (highlightIds.has(d.id) ? '#2196f3' : '#333'))
        .attr('stroke-width', d => selectedProgramId === d.id ? 3 : 1.5)
        .attr('opacity', 1)
        .on('end', null)
        .selection()
        .each(function(d) {
            d3.select(this)
                .classed('node-highlighted', highlightIds.has(d.id))
                .classed('node-selected', selectedProgramId === d.id);
        });
    setTimeout(applyDragHandlersToAllNodes, 420);
}

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

export { renderGraph, g };
