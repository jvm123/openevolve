import { allNodeData, archiveProgramIds, formatMetrics, renderMetricBar, getHighlightNodes, selectedProgramId, setSelectedProgramId } from './main.js';
import { scrollAndSelectNodeById } from './graph.js';

const sidebar = document.getElementById('sidebar');
export let sidebarSticky = false;

export function showSidebar() {
    sidebar.style.transform = 'translateX(0)';
}
export function hideSidebar() {
    sidebar.style.transform = 'translateX(100%)';
    sidebarSticky = false;
}

export function showSidebarContent(d, fromHover = false) {
    const sidebarContent = document.getElementById('sidebar-content');
    if (!sidebarContent) return;
    if (fromHover && sidebarSticky) return;
    if (!d) {
        sidebarContent.innerHTML = '';
        return;
    }
    let starHtml = '';
    if (archiveProgramIds && archiveProgramIds.includes(d.id)) {
        starHtml = '<span style="position:absolute;top:0.2em;left:0.5em;font-size:1.5em;color:#FFD600;z-index:10;">★</span>';
    }
    let closeBtn = '<button id="sidebar-close-btn" style="position:absolute;top:0.2em;right:0.5em;font-size:1.5em;background:none;border:none;color:#888;cursor:pointer;z-index:10;line-height:1;">&times;</button>';
    let openLink = '<div style="text-align:center;margin:0.5em 0 1.2em 0;"><a href="/program/' + d.id + '" target="_blank" style="font-size:0.95em;">[open in new window]</a></div>';
    let tabHtml = '';
    let tabContentHtml = '';
    let tabNames = [];
    if (d.code && typeof d.code === 'string' && d.code.trim() !== '') tabNames.push('Code');
    if (d.prompts && typeof d.prompts === 'object' && Object.keys(d.prompts).length > 0) tabNames.push('Prompts');
    if (tabNames.length > 0) {
        tabHtml = '<div id="sidebar-tab-bar" style="display:flex;gap:0.7em;margin-bottom:0.7em;">' +
            tabNames.map((name, i) => `<span class="sidebar-tab${i===0?' active':''}" data-tab="${name}">${name}</span>`).join('') + '</div>';
        tabContentHtml = '<div id="sidebar-tab-content">';
        if (tabNames[0] === 'Code') tabContentHtml += `<pre class="sidebar-code-pre">${d.code}</pre>`;
        if (tabNames[0] === 'Prompts') {
            for (const [k, v] of Object.entries(d.prompts)) {
                tabContentHtml += `<div style="margin-bottom:0.7em;"><b>${k}:</b><pre class="sidebar-pre">${v}</pre></div>`;
            }
        }
        tabContentHtml += '</div>';
    }
    let parentIslandHtml = '';
    if (d.parent_id && d.parent_id !== 'None') {
        const parent = allNodeData.find(n => n.id == d.parent_id);
        if (parent && parent.island !== undefined) {
            parentIslandHtml = ` <span style="color:#888;font-size:0.92em;">(island ${parent.island})</span>`;
        }
    }
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
    if (tabNames.length > 1) {
        const tabBar = document.getElementById('sidebar-tab-bar');
        Array.from(tabBar.children).forEach(tabEl => {
            tabEl.onclick = function() {
                Array.from(tabBar.children).forEach(e => e.classList.remove('active'));
                tabEl.classList.add('active');
                const tabName = tabEl.dataset.tab;
                const tabContent = document.getElementById('sidebar-tab-content');
                if (tabName === 'Code') tabContent.innerHTML = `<pre class="sidebar-code-pre">${d.code}</pre>`;
                if (tabName === 'Prompts') {
                    let html = '';
                    for (const [k, v] of Object.entries(d.prompts)) {
                        html += `<div style="margin-bottom:0.7em;"><b>${k}:</b><pre class="sidebar-pre">${v}</pre></div>`;
                    }
                    tabContent.innerHTML = html;
                }
            };
        });
    }
    const closeBtnEl = document.getElementById('sidebar-close-btn');
    if (closeBtnEl) closeBtnEl.onclick = function() {
        setSelectedProgramId(null);
        sidebarSticky = false;
        hideSidebar();
    };
    // Parent link logic
    const parentLink = sidebarContent.querySelector('.parent-link');
    if (parentLink && parentLink.dataset.parent && parentLink.dataset.parent !== 'None' && parentLink.dataset.parent !== '') {
        parentLink.onclick = function(e) {
            e.preventDefault();
            const parentNode = allNodeData.find(n => n.id == parentLink.dataset.parent);
            if (parentNode) {
                window._lastSelectedNodeData = parentNode;
            }
            const perfTabBtn = document.getElementById('tab-performance');
            const perfTabView = document.getElementById('view-performance');
            if ((perfTabBtn && perfTabBtn.classList.contains('active')) || (perfTabView && perfTabView.classList.contains('active'))) {
                import('./performance.js').then(mod => {
                    mod.selectPerformanceNodeById(parentLink.dataset.parent);
                    showSidebar();
                });
            } else {
                scrollAndSelectNodeById(parentLink.dataset.parent);
            }
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