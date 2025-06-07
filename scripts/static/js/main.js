// main.js for OpenEvolve Evolution Visualizer

import { sidebarSticky, showSidebarContent } from './sidebar.js';
import { updateListSidebarLayout, renderNodeList } from './list.js';
import { renderGraph, g, getNodeRadius } from './graph.js';

export let allNodeData = [];

let archiveProgramIds = [];

const sidebarEl = document.getElementById('sidebar');

let lastDataStr = null;
let selectedProgramId = null;

function formatMetrics(metrics) {
    return Object.entries(metrics).map(([k, v]) => `<b>${k}</b>: ${v}`).join('<br>');
}

function renderMetricBar(value, min, max, opts={}) {
    let percent = 0;
    if (typeof value === 'number' && isFinite(value) && max > min) {
        percent = (value - min) / (max - min);
        percent = Math.max(0, Math.min(1, percent));
    }
    let minLabel = `<span class="metric-bar-min">${min.toFixed(2)}</span>`;
    let maxLabel = `<span class="metric-bar-max">${max.toFixed(2)}</span>`;
    if (opts.vertical) {
        minLabel = `<span class="fitness-bar-min" style="right:0;left:auto;">${min.toFixed(2)}</span>`;
        maxLabel = `<span class="fitness-bar-max" style="right:0;left:auto;">${max.toFixed(2)}</span>`;
    }
    return `<span class="metric-bar${opts.vertical ? ' vertical' : ''}" style="overflow:visible;">
        ${minLabel}${maxLabel}
        <span class="metric-bar-fill" style="width:${Math.round(percent*100)}%"></span>
    </span>`;
}


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
            // Update metric-select options. Keep the selected option.
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

export let width = window.innerWidth;
export let height = window.innerHeight;

function resize() {
    width = window.innerWidth;
    const toolbarHeight = document.getElementById('toolbar').offsetHeight;
    height = window.innerHeight - toolbarHeight;
    // Re-render the graph with new width/height and latest data
    // allNodeData may be [] on first load, so only re-render if nodes exist
    if (allNodeData && allNodeData.length > 0) {
        // Find edges from lastDataStr if possible, else from allNodeData
        let edges = [];
        if (typeof lastDataStr === 'string') {
            try {
                const parsed = JSON.parse(lastDataStr);
                edges = parsed.edges || [];
            } catch {}
        }
        renderGraph({ nodes: allNodeData, edges });
    }
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

function getSelectedMetric() {
    const metricSelect = document.getElementById('metric-select');
    return metricSelect && metricSelect.value ? metricSelect.value : 'combined_score';
}

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


// Call on tab switch and window resize
['resize', 'DOMContentLoaded'].forEach(evt => window.addEventListener(evt, updateListSidebarLayout));
document.getElementById('tab-list').addEventListener('click', updateListSidebarLayout);
document.getElementById('tab-branching').addEventListener('click', function() {
    // Hide sidebar if it was hidden in branching
    const viewList = document.getElementById('view-list');
    if (sidebarEl.style.transform === 'translateX(100%)') {
        sidebarEl.style.transform = 'translateX(100%)';
    }
    viewList.style.marginRight = '0';
});



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

// Export all shared state and helpers for use in other modules
export function setAllNodeData(nodes) {
    allNodeData = nodes;
}

export function setSelectedProgramId(id) {
    selectedProgramId = id;
}

export { archiveProgramIds, lastDataStr, selectedProgramId, formatMetrics, renderMetricBar, fetchAndRender, getHighlightNodes, getSelectedMetric };
