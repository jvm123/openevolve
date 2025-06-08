import { allNodeData, archiveProgramIds, formatMetrics, renderMetricBar, getHighlightNodes, fetchAndRender, getSelectedMetric, selectedProgramId, setSelectedProgramId } from './main.js';
import { getNodeRadius, getNodeColor, selectProgram, scrollAndSelectNodeById } from './graph.js';
import { hideSidebar, sidebarSticky, showSidebarContent, showSidebar, setSidebarSticky } from './sidebar.js';
import { selectListNodeById } from './list.js';

(function() {
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
    function renderPerformanceGraph(nodes, options = {}) {
        window.renderPerformanceGraph = renderPerformanceGraph;
        // --- Preserve zoom/pan transform ---
        let prevTransform = null;
        const oldSvg = d3.select('#performance-graph');
        if (!oldSvg.empty()) {
            const g = oldSvg.select('g.zoom-group');
            if (!g.empty()) {
                const transform = g.attr('transform');
                if (transform) prevTransform = transform;
            }
        }
        oldSvg.remove();
        const sidebarEl = document.getElementById('sidebar');
        const padding = 32;
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        const toolbarHeight = document.getElementById('toolbar').offsetHeight;
        const sidebarWidth = sidebarEl.offsetWidth || 400;
        const width = Math.max(windowWidth - sidebarWidth - padding, 400);
        const height = Math.max(windowHeight - toolbarHeight - 24, 400);
        const metric = getSelectedMetric();
        const validNodes = nodes.filter(n => n.metrics && typeof n.metrics[metric] === 'number');
        const undefinedNodes = nodes.filter(n => !n.metrics || n.metrics[metric] == null || isNaN(n.metrics[metric]));
        if (!validNodes.length && !undefinedNodes.length) return;
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
        const xExtent = d3.extent(validNodes, d => d.metrics[metric]);
        const margin = {top: 60, right: 40, bottom: 40, left: 60};
        let undefinedBoxWidth = 70;
        const undefinedBoxPad = 54;
        const genCount = (maxGen - minGen + 1) || 1;
        const graphHeight = Math.max(400, genCount * 48 + margin.top + margin.bottom);
        const totalGraphHeight = showIslands ? (graphHeight * islands.length) : graphHeight;
        const svgHeight = Math.max(height, totalGraphHeight);
        const graphXOffset = undefinedBoxWidth + undefinedBoxPad;
        const svg = d3.select(perfDiv)
            .append('svg')
            .attr('id', 'performance-graph')
            .attr('width', width)
            .attr('height', svgHeight)
            .style('display', 'block');

        const g = svg.append('g').attr('class', 'zoom-group');
        const zoomBehavior = d3.zoom()
            .scaleExtent([0.2, 10])
            .on('zoom', function(event) {
                g.attr('transform', event.transform);
            });
        svg.call(zoomBehavior);
        if (prevTransform) {
            g.attr('transform', prevTransform);
            const t = d3.zoomTransform(g.node());
            svg.call(zoomBehavior.transform, t);
        } else if (options.fitToNodes) {
            // Intelligent zoom-to-fit on initial load
            setTimeout(() => {
                try {
                    const allCircles = g.selectAll('circle').nodes();
                    if (allCircles.length > 0) {
                        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                        allCircles.forEach(c => {
                            const bbox = c.getBBox();
                            minX = Math.min(minX, bbox.x);
                            minY = Math.min(minY, bbox.y);
                            maxX = Math.max(maxX, bbox.x + bbox.width);
                            maxY = Math.max(maxY, bbox.y + bbox.height);
                        });
                        const pad = 40;
                        minX -= pad; minY -= pad; maxX += pad; maxY += pad;
                        const graphW = svg.attr('width');
                        const graphH = svg.attr('height');
                        const scale = Math.min(graphW / (maxX - minX), graphH / (maxY - minY), 1);
                        const tx = (graphW - scale * (minX + maxX)) / 2;
                        const ty = (graphH - scale * (minY + maxY)) / 2;
                        const t = d3.zoomIdentity.translate(tx, ty).scale(scale);
                        svg.transition().duration(400).call(zoomBehavior.transform, t);
                    }
                } catch {}
            }, 0);
        } else if (options.centerNodeId) {
            // Center and zoom to a specific node
            setTimeout(() => {
                try {
                    const node = g.selectAll('circle').filter(d => d.id == options.centerNodeId).node();
                    if (node) {
                        const bbox = node.getBBox();
                        const graphW = svg.attr('width');
                        const graphH = svg.attr('height');
                        const scale = Math.min(graphW / (bbox.width * 6), graphH / (bbox.height * 6), 1.5); // zoom in a bit
                        const tx = graphW/2 - scale * (bbox.x + bbox.width/2);
                        const ty = graphH/2 - scale * (bbox.y + bbox.height/2);
                        const t = d3.zoomIdentity.translate(tx, ty).scale(scale);
                        svg.transition().duration(400).call(zoomBehavior.transform, t);
                    }
                } catch {}
            }, 0);
        }

        let yScales = {};
        islands.forEach((island, i) => {
            const y = d3.scaleLinear()
                .domain([minGen, maxGen]).nice()
                .range([margin.top + i*graphHeight, margin.top + (i+1)*graphHeight - margin.bottom]);
            yScales[island] = y;
            // Axis
            g.append('g')
                .attr('transform', `translate(${margin.left+graphXOffset},0)`)
                .call(d3.axisLeft(y).ticks(Math.min(12, genCount)));
            // Y axis label
            g.append('text')
                .attr('transform', `rotate(-90)`)
                .attr('y', margin.left + 8)
                .attr('x', -(margin.top + i*graphHeight + (graphHeight - margin.top - margin.bottom)/2))
                .attr('dy', '-2.2em')
                .attr('text-anchor', 'middle')
                .attr('font-size', '1em')
                .attr('fill', '#888')
                .text('Generation');
            // Show a headline for each island
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
        // x axis
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
        const highlightFilter = document.getElementById('highlight-select').value;
        const highlightNodes = getHighlightNodes(nodes, highlightFilter, metric);
        const highlightIds = new Set(highlightNodes.map(n => n.id));
        // Draw single NaN box left of graphs, spanning all islands
        if (undefinedNodes.length) {
            let undefinedBoxWidth = 70; // reduced width
            const undefinedBoxPad = 54; // increased gap for y-axis
            const boxTop = margin.top;
            const boxBottom = showIslands ? (margin.top + islands.length*graphHeight - margin.bottom) : (margin.top + graphHeight - margin.bottom);
            g.append('text')
                .attr('x', margin.left + undefinedBoxWidth/2)
                .attr('y', boxTop - 10)
                .attr('text-anchor', 'middle')
                .attr('font-size', '0.92em') // smaller font
                .attr('fill', '#888')
                .text('NaN');
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
                        showSidebarContent(d, true); // Only update if not sticky
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
                    selectListNodeById(d.id); // sync list selection
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
                    renderPerformanceGraph(nodes);
                });
        }

        // Draw edges (parent-child links, can cross islands)
        const nodeById = Object.fromEntries(nodes.map(n => [n.id, n]));

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
                    // NaN nodes go into the NaN box, generation on the y axis
                    return margin.left + undefinedBoxWidth/2;
                } else {
                    return x(m);
                }
            })
            .attr('y1', d => {
                const m = d.source.metrics && typeof d.source.metrics[metric] === 'number' ? d.source.metrics[metric] : null;
                const island = showIslands ? d.source.island : null;
                if (m === null || isNaN(m)) {
                    // Each island with its own graph; generation on the y axis
                    return yScales[island](d.source.generation);
                } else {
                    return yScales[island](d.source.generation);
                }
            })
            .attr('x2', d => {
                const m = d.target.metrics && typeof d.target.metrics[metric] === 'number' ? d.target.metrics[metric] : null;
                if (m === null || isNaN(m)) {
                    // NaN nodes go into the NaN box, generation on the y axis
                    return margin.left + undefinedBoxWidth/2;
                } else {
                    return x(m);
                }
            })
            .attr('y2', d => {
                const m = d.target.metrics && typeof d.target.metrics[metric] === 'number' ? d.target.metrics[metric] : null;
                const island = showIslands ? d.target.island : null;
                if (m === null || isNaN(m)) {
                    // Each island with its own graph; generation on the y axis
                    return yScales[island](d.target.generation);
                } else {
                    return yScales[island](d.target.generation);
                }
            })
            .attr('stroke', '#888')
            .attr('stroke-width', 1.5)
            .attr('opacity', 0.5);

        // Draw nodes
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
                    showSidebarContent(d, true); // Only update sidebar content if not sticky
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
                // Hide sidebar if no node is selected
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
                renderPerformanceGraph(nodes);
            });
        // Click background to unselect node and hide sidebar
        svg.on('click', function(event) {
            if (event.target === svg.node()) {
                setSelectedProgramId(null);
                setSidebarSticky(false);
                hideSidebar();
                svg.selectAll('circle')
                    .classed('node-selected', false)
                    .classed('node-hovered', false)
                    .attr('stroke', '#333')
                    .attr('stroke-width', 1.5);
                selectListNodeById(null);
                selectProgram(null);
            }
        });
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
    // Show islands yes/no toggle event
    document.getElementById('show-islands-toggle').addEventListener('change', function() {
        if (typeof allNodeData !== 'undefined' && allNodeData.length) {
            renderPerformanceGraph(allNodeData);
        }
    });
    // Responsive resize
    window.addEventListener('resize', function() {
        if (typeof allNodeData !== 'undefined' && allNodeData.length && perfDiv.style.display !== 'none') {
            renderPerformanceGraph(allNodeData);
        }
    });
})();

// Select a node by ID and update graph and sidebar
export function selectPerformanceNodeById(id, opts = {}) {
    setSelectedProgramId(id);
    setSidebarSticky(true);
    if (typeof allNodeData !== 'undefined' && allNodeData.length) {
        renderPerformanceGraph(allNodeData, opts);
        const node = allNodeData.find(n => n.id == id);
        if (node) showSidebarContent(node, false);
    }
}
