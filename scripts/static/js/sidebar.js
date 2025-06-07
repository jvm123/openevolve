// Import shared state and helpers from main.js
import { allNodeData, archiveProgramIds, formatMetrics, renderMetricBar, getHighlightNodes } from './main.js';

// Sidebar logic (automatic show/hide)
const sidebar = document.getElementById('sidebar');
export let sidebarSticky = false; // Track if sidebar should be sticky (after selection)

export function showSidebar() {
    sidebar.style.transform = 'translateX(0)';
}
export function hideSidebar() {
    sidebar.style.transform = 'translateX(100%)';
    sidebarSticky = false;
    // Do NOT call showSidebarContent(null) here to avoid recursion!
}

// Patch showSidebarContent to only update content on selection, not hover
export function showSidebarContent(d, fromHover = false) {
    const sidebarContent = document.getElementById('sidebar-content');
    if (!sidebarContent) return;
    // Only allow hover to update content if sidebar is not sticky
    if (fromHover && sidebarSticky) return;
    if (!d) {
        sidebarContent.innerHTML = '';
        // Do NOT call hideSidebar() here to avoid recursion!
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

export function openInNewTab(event, d) {
    const url = `/program/${d.id}`;
    window.open(url, '_blank');
    event.stopPropagation();
}

export function setSidebarSticky(val) {
    sidebarSticky = val;
}