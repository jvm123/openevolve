// D3 globals for graph rendering
export let svg = d3.select('#graph-svg');
export let g = svg.append('g');

import { width, height, getHighlightNodes, allNodeData, selectedProgramId, setSelectedProgramId } from './main.js';
import { openInNewTab, showSidebarContent, sidebarSticky, showSidebar, setSidebarSticky } from './sidebar.js';
import { renderNodeList } from './list.js';

// --- Utility: scroll and select node by id in any view ---
export function scrollAndSelectNodeById(nodeId) {
    // Try list view first
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
            return true;
        }
    }
    // Try graph views (branching/performance)
    const node = allNodeData.find(n => n.id == nodeId);
    if (node) {
        setSelectedProgramId(nodeId);
        showSidebarContent(node);
        showSidebar();
        setSidebarSticky(true);
        selectProgram(selectedProgramId);
        // Optionally, center/zoom to node in D3 (not implemented here)
        return true;
    }
    return false;
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
            setSelectedProgramId(d.id);
            setSidebarSticky(true);
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
            // Hide sidebar if no node is selected
            if (!selectedProgramId) {
                hideSidebar();
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

    // Click background to unselect node and reset sidebar (and hide sidebar)
    svg.on("click", function(event) {
        if (event.target === svg.node()) {
            setSelectedProgramId(null);
            setSidebarSticky(false);
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
        setSelectedProgramId(null);
        showSidebarContent(null);
        setSidebarSticky(false);
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

export { renderGraph };
