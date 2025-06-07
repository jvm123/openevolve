// Import shared state and helpers from main.js
import { allNodeData, archiveProgramIds, formatMetrics, renderMetricBar, getHighlightNodes, getSelectedMetric, setAllNodeData, selectedProgramId, setSelectedProgramId } from './main.js';
import { showSidebar, setSidebarSticky, showSidebarContent } from './sidebar.js';
import { selectProgram } from './graph.js';

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
export function updateListRowBackgroundsForTheme() {
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

export function renderNodeList(nodes) {
    setAllNodeData(nodes);
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
        bar.innerHTML = `
            <span class="fitness-bar-max">${maxScore.toFixed(2)}</span>
            <span class="fitness-bar-min">${minScore.toFixed(2)}</span>
            <div class="fitness-bar-fill" style="height:${Math.round(percent * 100)}%;"></div>
        `;
        // Main info block (ID, Gen, Island, Parent)
        const infoBlock = document.createElement('div');
        infoBlock.className = 'node-info-block';
        infoBlock.innerHTML = `
            <div><b>ID:</b> ${node.id}</div>
            <div><b>Gen:</b> ${node.generation ?? ''}</div>
            <div><b>Island:</b> ${node.island ?? ''}</div>
            <div><b>Parent:</b> <a href="#" class="parent-link" data-parent="${node.parent_id ?? ''}">${node.parent_id ?? 'None'}</a></div>
        `;
        // Metrics block below, full width
        let metricsHtml = '<div class="metrics-block">';
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
        row.style.alignItems = 'stretch';
        row.style.gap = '32px';
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
        row.appendChild(metricsBlock);
        // Row selection logic: select on click anywhere except links
        row.onclick = (e) => {
            if (e.target.tagName === 'A') return;
            setSelectedProgramId(node.id);
            window._lastSelectedNodeData = node;
            setSidebarSticky(true);
            renderNodeList(allNodeData);
            showSidebarContent(node, false); // always update on click
            showSidebarListView();
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

// Highlight select event
const highlightSelect = document.getElementById('highlight-select');
highlightSelect.addEventListener('change', function() {
    renderNodeList(allNodeData);
});

// On page load, set default sort to generation
if (document.getElementById('list-sort')) {
    document.getElementById('list-sort').value = 'generation';
}

// Always show sidebar in list view, and adjust node-list width
const viewList = document.getElementById('view-list');
const sidebarEl = document.getElementById('sidebar');
export function updateListSidebarLayout() {
    if (viewList.style.display !== 'none') {
        sidebarEl.style.transform = 'translateX(0)';
        viewList.style.marginRight = sidebarEl.offsetWidth + 'px';
    } else {
        viewList.style.marginRight = '0';
    }
}

// Remove monkey-patching of imported showSidebar (ES module imports are read-only)
// Instead, define a local function and use it in this file only
function showSidebarListView() {
    if (viewList.style.display !== 'none') {
        sidebarEl.style.transform = 'translateX(0)';
        viewList.style.marginRight = sidebarEl.offsetWidth + 'px';
    } else {
        showSidebar();
    }
}