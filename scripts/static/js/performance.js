import { allNodeData, archiveProgramIds, formatMetrics, renderMetricBar, getHighlightNodes, getSelectedMetric, selectedProgramId, setSelectedProgramId } from './main.js';
import { getNodeRadius, getNodeColor, selectProgram, scrollAndSelectNodeById } from './graph.js';
import { hideSidebar, sidebarSticky, showSidebarContent, showSidebar, setSidebarSticky } from './sidebar.js';
import { selectListNodeById } from './list.js';

(function() {
    window.addEventListener('DOMContentLoaded', function() {
        const perfDiv = document.getElementById('view-performance');
        if (!perfDiv) return;
        let toggleDiv = document.getElementById('perf-island-toggle');
        if (!toggleDiv) {
            toggleDiv = document.createElement('div');
            toggleDiv.id = 'perf-island-toggle';
            toggleDiv.style = 'display:flex;align-items:center;gap:0.7em;';
            toggleDiv.innerHTML = `
            <label class="toggle-switch" style="margin-right:0.7em;">
                <input type="checkbox" id="show-islands-toggle">
                <span class="toggle-slider"></span>
            </label>
            <span style="font-weight:500;font-size:1.08em;">Show islands</span>
            `;
            perfDiv.insertBefore(toggleDiv, perfDiv.firstChild);
        }
        function animatePerformanceGraphAttributes() {
            const svg = d3.select('#performance-graph');
            if (svg.empty()) return;
            const g = svg.select('g.zoom-group');
            if (g.empty()) return;
            const metric = getSelectedMetric();
            const highlightFilter = document.getElementById('highlight-select').value;
            const showIslands = document.getElementById('show-islands-toggle')?.checked;
            const nodes = allNodeData;
            const validNodes = nodes.filter(n => n.metrics && typeof n.metrics[metric] === 'number');
            const undefinedNodes = nodes.filter(n => !n.metrics || n.metrics[metric] == null || isNaN(n.metrics[metric]));
            let islands = [];
            if (showIslands) {
                islands = Array.from(new Set(nodes.map(n => n.island))).sort((a,b)=>a-b);
            } else {
                islands = [null];
            }
            const yExtent = d3.extent(nodes, d => d.generation);
            const minGen = 0;
            const maxGen = yExtent[1];
            const margin = {top: 60, right: 40, bottom: 40, left: 60};
            let undefinedBoxWidth = 70;
            const undefinedBoxPad = 54;
            const graphXOffset = undefinedBoxWidth + undefinedBoxPad;
            const width = +svg.attr('width');
            const height = +svg.attr('height');
            const graphHeight = Math.max(400, (maxGen - minGen + 1) * 48 + margin.top + margin.bottom);
            let yScales = {};
            islands.forEach((island, i) => {
                yScales[island] = d3.scaleLinear()
                    .domain([minGen, maxGen]).nice()
                    .range([margin.top + i*graphHeight, margin.top + (i+1)*graphHeight - margin.bottom]);
            });
            const xExtent = d3.extent(validNodes, d => d.metrics[metric]);
            const x = d3.scaleLinear()
                .domain([xExtent[0], xExtent[1]]).nice()
                .range([margin.left+graphXOffset, width - margin.right]);
            const highlightNodes = getHighlightNodes(nodes, highlightFilter, metric);
            const highlightIds = new Set(highlightNodes.map(n => n.id));
            // Animate valid nodes
            g.selectAll('circle')
                .filter(function(d) { return validNodes.includes(d); })
                .transition().duration(400)
                .attr('cx', d => x(d.metrics[metric]))
                .attr('cy', d => showIslands ? yScales[d.island](d.generation) : yScales[null](d.generation))
                .attr('r', d => getNodeRadius(d))
                .attr('fill', d => getNodeColor(d))
                .attr('stroke', d => selectedProgramId === d.id ? 'red' : (highlightIds.has(d.id) ? '#2196f3' : '#333'))
                .attr('stroke-width', d => selectedProgramId === d.id ? 3 : 1.5)
                .attr('opacity', 0.85)
                .on('end', null)
                .selection()
                .each(function(d) {
                    d3.select(this)
                        .classed('node-highlighted', highlightIds.has(d.id))
                        .classed('node-selected', selectedProgramId === d.id);
                });
            // Animate undefined nodes (NaN box)
            g.selectAll('circle')
                .filter(function(d) { return undefinedNodes.includes(d); })
                .transition().duration(400)
                .attr('cx', margin.left + undefinedBoxWidth/2)
                .attr('cy', d => yScales[showIslands ? d.island : null](d.generation))
                .attr('r', d => getNodeRadius(d))
                .attr('fill', d => getNodeColor(d))
                .attr('stroke', d => selectedProgramId === d.id ? 'red' : '#333')
                .attr('stroke-width', d => selectedProgramId === d.id ? 3 : 1.5)
                .attr('opacity', 0.85)
                .on('end', null)
                .selection()
                .each(function(d) {
                    d3.select(this)
                        .classed('node-selected', selectedProgramId === d.id);
                });
            // Animate edges
            const nodeById = Object.fromEntries(nodes.map(n => [n.id, n]));
            const edges = nodes.filter(n => n.parent_id && nodeById[n.parent_id]).map(n => {
                return {
                    source: nodeById[n.parent_id],
                    target: n
                };
            });
            g.selectAll('line.performance-edge')
                .data(edges, d => d.target.id)
                .transition().duration(400)
                .attr('x1', d => {
                    const m = d.source.metrics && typeof d.source.metrics[metric] === 'number' ? d.source.metrics[metric] : null;
                    if (m === null || isNaN(m)) {
                        return margin.left + undefinedBoxWidth/2;
                    } else {
                        return x(m);
                    }
                })
                .attr('y1', d => {
                    const m = d.source.metrics && typeof d.source.metrics[metric] === 'number' ? d.source.metrics[metric] : null;
                    const island = showIslands ? d.source.island : null;
                    return yScales[island](d.source.generation);
                })
                .attr('x2', d => {
                    const m = d.target.metrics && typeof d.target.metrics[metric] === 'number' ? d.target.metrics[metric] : null;
                    if (m === null || isNaN(m)) {
                        return margin.left + undefinedBoxWidth/2;
                    } else {
                        return x(m);
                    }
                })
                .attr('y2', d => {
                    const m = d.target.metrics && typeof d.target.metrics[metric] === 'number' ? d.target.metrics[metric] : null;
                    const island = showIslands ? d.target.island : null;
                    return yScales[island](d.target.generation);
                })
                .attr('stroke', '#888')
                .attr('stroke-width', 1.5)
                .attr('opacity', 0.5);
        }
        const metricSelect = document.getElementById('metric-select');
        metricSelect.addEventListener('change', function() {
            animatePerformanceGraphAttributes();
        });
        const highlightSelect = document.getElementById('highlight-select');
        highlightSelect.addEventListener('change', function() {
            animatePerformanceGraphAttributes();
        });
        document.getElementById('tab-performance').addEventListener('click', function() {
            if (typeof allNodeData !== 'undefined' && allNodeData.length) {
                updatePerformanceGraph(allNodeData);
            }
        });
        // Show islands yes/no toggle event
        document.getElementById('show-islands-toggle').addEventListener('change', function() {
            updatePerformanceGraph(allNodeData);
        });
        // Responsive resize
        window.addEventListener('resize', function() {
            if (typeof allNodeData !== 'undefined' && allNodeData.length && perfDiv.style.display !== 'none') {
                updatePerformanceGraph(allNodeData);
            }
        });
        window.updatePerformanceGraph = updatePerformanceGraph;

        // Initial render
        if (typeof allNodeData !== 'undefined' && allNodeData.length) {
            updatePerformanceGraph(allNodeData);
        }
    });
})();

// Select a node by ID and update graph and sidebar
export function selectPerformanceNodeById(id, opts = {}) {
    setSelectedProgramId(id);
    setSidebarSticky(true);
    if (typeof allNodeData !== 'undefined' && allNodeData.length) {
        updatePerformanceGraph(allNodeData, opts);
        const node = allNodeData.find(n => n.id == id);
        if (node) showSidebarContent(node, false);
    }
}

export function centerAndHighlightNodeInPerformanceGraph(nodeId) {
    if (!g || !svg) return;
    // Ensure zoomBehavior is available and is a function
    if (!zoomBehavior || typeof zoomBehavior !== 'function') {
        zoomBehavior = d3.zoom()
            .scaleExtent([0.2, 10])
            .on('zoom', function(event) {
                g.attr('transform', event.transform);
                lastTransform = event.transform;
            });
        svg.call(zoomBehavior);
    }
    // Try both valid and NaN nodes
    let nodeSel = g.selectAll('circle.performance-node').filter(d => d.id == nodeId);
    if (nodeSel.empty()) {
        nodeSel = g.selectAll('circle.performance-nan').filter(d => d.id == nodeId);
    }
    if (!nodeSel.empty()) {
        const node = nodeSel.node();
        const bbox = node.getBBox();
        const graphW = svg.attr('width');
        const graphH = svg.attr('height');
        const scale = Math.min(graphW / (bbox.width * 6), graphH / (bbox.height * 6), 1.5);
        const tx = graphW/2 - scale * (bbox.x + bbox.width/2);
        const ty = graphH/2 - scale * (bbox.y + bbox.height/2);
        const t = d3.zoomIdentity.translate(tx, ty).scale(scale);
        // Use the correct D3 v7 API for programmatic zoom
        svg.transition().duration(400).call(zoomBehavior.transform, t);
        // Yellow shadow highlight
        nodeSel.each(function() {
            const el = d3.select(this);
            el.classed('node-locator-highlight', true)
                .style('filter', 'drop-shadow(0 0 16px 8px #FFD600)');
            el.transition().duration(350).style('filter', 'drop-shadow(0 0 24px 16px #FFD600)')
                .transition().duration(650).style('filter', null)
                .on('end', function() { el.classed('node-locator-highlight', false); });
        });
    }
}

let svg = null;
let g = null;
let zoomBehavior = null;
let lastTransform = null;

function updatePerformanceGraph(nodes, options = {}) {
    // Get or create SVG
    if (!svg) {
        svg = d3.select('#performance-graph');
        if (svg.empty()) {
            svg = d3.select('#view-performance')
                .append('svg')
                .attr('id', 'performance-graph')
                .style('display', 'block');
        }
    }
    // Get or create group
    g = svg.select('g.zoom-group');
    if (g.empty()) {
        g = svg.append('g').attr('class', 'zoom-group');
    }
    // Setup zoom behavior only once
    if (!zoomBehavior) {
        zoomBehavior = d3.zoom()
            .scaleExtent([0.2, 10])
            .on('zoom', function(event) {
                g.attr('transform', event.transform);
                lastTransform = event.transform;
            });
        svg.call(zoomBehavior);
    }
    // Reapply last transform after update
    if (lastTransform) {
        svg.call(zoomBehavior.transform, lastTransform);
    }
    // Add SVG background click handler for unselect
    svg.on('click', function(event) {
        if (event.target === svg.node()) {
            setSelectedProgramId(null);
            setSidebarSticky(false);
            hideSidebar();
            // Remove selection from all nodes
            g.selectAll('circle.performance-node, circle.performance-nan')
                .classed('node-selected', false)
                .attr('stroke', function(d) {
                    // Use highlight color if highlighted, else default
                    const highlightFilter = document.getElementById('highlight-select').value;
                    const highlightNodes = getHighlightNodes(nodes, highlightFilter, getSelectedMetric());
                    const highlightIds = new Set(highlightNodes.map(n => n.id));
                    return highlightIds.has(d.id) ? '#2196f3' : '#333';
                })
                .attr('stroke-width', 1.5);
            selectListNodeById(null);
        }
    });
    // Sizing
    const sidebarEl = document.getElementById('sidebar');
    const padding = 32;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const toolbarHeight = document.getElementById('toolbar').offsetHeight;
    const sidebarWidth = sidebarEl.offsetWidth || 400;
    const width = Math.max(windowWidth - sidebarWidth - padding, 400);
    const metric = getSelectedMetric();
    const validNodes = nodes.filter(n => n.metrics && typeof n.metrics[metric] === 'number');
    const undefinedNodes = nodes.filter(n => !n.metrics || n.metrics[metric] == null || isNaN(n.metrics[metric]));
    const showIslands = document.getElementById('show-islands-toggle')?.checked;
    let islands = [];
    if (showIslands) {
        islands = Array.from(new Set(nodes.map(n => n.island))).sort((a,b)=>a-b);
    } else {
        islands = [null];
    }
    const yExtent = d3.extent(nodes, d => d.generation);
    const minGen = 0;
    const maxGen = yExtent[1];
    const margin = {top: 60, right: 40, bottom: 40, left: 60};
    let undefinedBoxWidth = 70;
    const undefinedBoxPad = 54;
    const genCount = (maxGen - minGen + 1) || 1;
    const graphHeight = Math.max(400, genCount * 48 + margin.top + margin.bottom);
    const totalGraphHeight = showIslands ? (graphHeight * islands.length) : graphHeight;
    const svgHeight = Math.max(windowHeight - toolbarHeight - 24, totalGraphHeight);
    const graphXOffset = undefinedBoxWidth + undefinedBoxPad;
    svg.attr('width', width).attr('height', svgHeight);
    // Remove old axes/labels
    g.selectAll('.axis, .axis-label, .island-label, .nan-label, .nan-box').remove();
    // Y scales per island
    let yScales = {};
    islands.forEach((island, i) => {
        yScales[island] = d3.scaleLinear()
            .domain([minGen, maxGen]).nice()
            .range([margin.top + i*graphHeight, margin.top + (i+1)*graphHeight - margin.bottom]);
        // Y axis
        g.append('g')
            .attr('class', 'axis')
            .attr('transform', `translate(${margin.left+graphXOffset},0)`)
            .call(d3.axisLeft(yScales[island]).ticks(Math.min(12, genCount)));
        // Y axis label
        g.append('text')
            .attr('class', 'axis-label')
            .attr('transform', `rotate(-90)`) // vertical
            .attr('y', margin.left + 8)
            .attr('x', -(margin.top + i*graphHeight + (graphHeight - margin.top - margin.bottom)/2))
            .attr('dy', '-2.2em')
            .attr('text-anchor', 'middle')
            .attr('font-size', '1em')
            .attr('fill', '#888')
            .text('Generation');
        // Island label
        if (showIslands) {
            g.append('text')
                .attr('class', 'island-label')
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
    // X axis
    const xExtent = d3.extent(validNodes, d => d.metrics[metric]);
    const x = d3.scaleLinear()
        .domain([xExtent[0], xExtent[1]]).nice()
        .range([margin.left+graphXOffset, width - margin.right]);
    g.append('g')
        .attr('class', 'axis')
        .attr('transform', `translate(0,${margin.top})`)
        .call(d3.axisTop(x))
        .append('text')
        .attr('class', 'axis-label')
        .attr('x', (width + undefinedBoxWidth) / 2)
        .attr('y', -35)
        .attr('fill', '#888')
        .attr('text-anchor', 'middle')
        .attr('font-size', '1.1em')
        .text(metric);
    // NaN box
    if (undefinedNodes.length) {
        const boxTop = margin.top;
        const boxBottom = showIslands ? (margin.top + islands.length*graphHeight - margin.bottom) : (margin.top + graphHeight - margin.bottom);
        g.append('text')
            .attr('class', 'nan-label')
            .attr('x', margin.left + undefinedBoxWidth/2)
            .attr('y', boxTop - 10)
            .attr('text-anchor', 'middle')
            .attr('font-size', '0.92em')
            .attr('fill', '#888')
            .text('NaN');
        g.append('rect')
            .attr('class', 'nan-box')
            .attr('x', margin.left)
            .attr('y', boxTop)
            .attr('width', undefinedBoxWidth)
            .attr('height', boxBottom - boxTop)
            .attr('fill', 'none')
            .attr('stroke', '#bbb')
            .attr('stroke-width', 1.5)
            .attr('rx', 12);
    }
    // Data join for edges
    const nodeById = Object.fromEntries(nodes.map(n => [n.id, n]));
    const edges = nodes.filter(n => n.parent_id && nodeById[n.parent_id]).map(n => ({ source: nodeById[n.parent_id], target: n }));
    const edgeSel = g.selectAll('line.performance-edge')
        .data(edges, d => d.target.id);
    edgeSel.enter()
        .append('line')
        .attr('class', 'performance-edge')
        .attr('stroke', '#888')
        .attr('stroke-width', 1.5)
        .attr('opacity', 0.5)
        .attr('x1', d => x(d.source.metrics && typeof d.source.metrics[metric] === 'number' ? d.source.metrics[metric] : null) || (margin.left + undefinedBoxWidth/2))
        .attr('y1', d => yScales[showIslands ? d.source.island : null](d.source.generation))
        .attr('x2', d => x(d.target.metrics && typeof d.target.metrics[metric] === 'number' ? d.target.metrics[metric] : null) || (margin.left + undefinedBoxWidth/2))
        .attr('y2', d => yScales[showIslands ? d.target.island : null](d.target.generation))
        .merge(edgeSel)
        .transition().duration(500)
        .attr('x1', d => x(d.source.metrics && typeof d.source.metrics[metric] === 'number' ? d.source.metrics[metric] : null) || (margin.left + undefinedBoxWidth/2))
        .attr('y1', d => yScales[showIslands ? d.source.island : null](d.source.generation))
        .attr('x2', d => x(d.target.metrics && typeof d.target.metrics[metric] === 'number' ? d.target.metrics[metric] : null) || (margin.left + undefinedBoxWidth/2))
        .attr('y2', d => yScales[showIslands ? d.target.island : null](d.target.generation));
    edgeSel.exit().transition().duration(300).attr('opacity', 0).remove();
    // Data join for nodes
    const highlightFilter = document.getElementById('highlight-select').value;
    const highlightNodes = getHighlightNodes(nodes, highlightFilter, metric);
    const highlightIds = new Set(highlightNodes.map(n => n.id));
    const nodeSel = g.selectAll('circle.performance-node')
        .data(validNodes, d => d.id);
    nodeSel.enter()
        .append('circle')
        .attr('class', 'performance-node')
        .attr('cx', d => x(d.metrics[metric]))
        .attr('cy', d => showIslands ? yScales[d.island](d.generation) : yScales[null](d.generation))
        .attr('r', d => getNodeRadius(d))
        .attr('fill', d => getNodeColor(d))
        .attr('stroke', d => selectedProgramId === d.id ? 'red' : (highlightIds.has(d.id) ? '#2196f3' : '#333'))
        .attr('stroke-width', d => selectedProgramId === d.id ? 3 : 1.5)
        .attr('opacity', 0.85)
        .on('mouseover', function(event, d) {
            if (!sidebarSticky && (!selectedProgramId || selectedProgramId !== d.id)) {
                showSidebarContent(d, true);
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
            if (!selectedProgramId) {
                hideSidebar();
            }
        })
        .on('click', function(event, d) {
            event.preventDefault();
            setSelectedProgramId(d.id);
            window._lastSelectedNodeData = d;
            setSidebarSticky(true);
            selectListNodeById(d.id);
            g.selectAll('circle.performance-node').classed('node-hovered', false).classed('node-selected', false)
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
        })
        .merge(nodeSel)
        .transition().duration(500)
        .attr('cx', d => x(d.metrics[metric]))
        .attr('cy', d => showIslands ? yScales[d.island](d.generation) : yScales[null](d.generation))
        .attr('r', d => getNodeRadius(d))
        .attr('fill', d => getNodeColor(d))
        .attr('stroke', d => selectedProgramId === d.id ? 'red' : (highlightIds.has(d.id) ? '#2196f3' : '#333'))
        .attr('stroke-width', d => selectedProgramId === d.id ? 3 : 1.5)
        .attr('opacity', 0.85)
        .on('end', null)
        .selection()
        .each(function(d) {
            d3.select(this)
                .classed('node-highlighted', highlightIds.has(d.id))
                .classed('node-selected', selectedProgramId === d.id);
        });
    nodeSel.exit().transition().duration(300).attr('opacity', 0).remove();
    // Data join for NaN nodes
    const nanSel = g.selectAll('circle.performance-nan')
        .data(undefinedNodes, d => d.id);
    nanSel.enter()
        .append('circle')
        .attr('class', 'performance-nan')
        .attr('cx', margin.left + undefinedBoxWidth/2)
        .attr('cy', d => yScales[showIslands ? d.island : null](d.generation))
        .attr('r', d => getNodeRadius(d))
        .attr('fill', d => getNodeColor(d))
        .attr('stroke', d => selectedProgramId === d.id ? 'red' : '#333')
        .attr('stroke-width', d => selectedProgramId === d.id ? 3 : 1.5)
        .attr('opacity', 0.85)
        .on('mouseover', function(event, d) {
            if (!sidebarSticky && (!selectedProgramId || selectedProgramId !== d.id)) {
                showSidebarContent(d, true);
                showSidebar();
            }
            d3.select(this)
                .classed('node-hovered', true)
                .attr('stroke', '#FFD600').attr('stroke-width', 4);
        })
        .on('mouseout', function(event, d) {
            d3.select(this)
                .classed('node-hovered', false)
                .attr('stroke', selectedProgramId === d.id ? 'red' : '#333')
                .attr('stroke-width', selectedProgramId === d.id ? 3 : 1.5);
            if (!selectedProgramId) {
                hideSidebar();
            }
        })
        .on('click', function(event, d) {
            event.preventDefault();
            setSelectedProgramId(d.id);
            window._lastSelectedNodeData = d;
            setSidebarSticky(true);
            selectListNodeById(d.id);
            g.selectAll('circle.performance-nan').classed('node-hovered', false).classed('node-selected', false)
                .attr('stroke', function(nd) {
                    return selectedProgramId === nd.id ? 'red' : '#333';
                })
                .attr('stroke-width', function(nd) {
                    return selectedProgramId === nd.id ? 3 : 1.5;
                });
            d3.select(this).classed('node-selected', true);
            showSidebarContent(d, false);
            showSidebar();
            selectProgram(selectedProgramId);
        })
        .merge(nanSel)
        .transition().duration(500)
        .attr('cx', margin.left + undefinedBoxWidth/2)
        .attr('cy', d => yScales[showIslands ? d.island : null](d.generation))
        .attr('r', d => getNodeRadius(d))
        .attr('fill', d => getNodeColor(d))
        .attr('stroke', d => selectedProgramId === d.id ? 'red' : '#333')
        .attr('stroke-width', d => selectedProgramId === d.id ? 3 : 1.5)
        .attr('opacity', 0.85)
        .on('end', null)
        .selection()
        .each(function(d) {
            d3.select(this)
                .classed('node-selected', selectedProgramId === d.id);
        });
    nanSel.exit().transition().duration(300).attr('opacity', 0).remove();
}
