// Popup script pour NotebookLM Sources Extractor v1.2

let currentNotebookData = {
    sources: {},
    artifacts: {}
};

let selectedArtifactId = null;

// Éléments du DOM
const artifactsList = document.getElementById('artifacts-list');
const sourcesList = document.getElementById('sources-list');
const artifactDetails = document.getElementById('artifact-details');
const detailsSection = document.getElementById('details-section');
const refreshBtn = document.getElementById('refresh-btn');
const scanBtn = document.getElementById('scan-btn');
const copyBtn = document.getElementById('copy-btn');
const instructionsBox = document.getElementById('instructions');
const statusText = document.getElementById('status-text');

// Événements
refreshBtn.addEventListener('click', () => refreshData(true));
scanBtn.addEventListener('click', triggerManualScan);
copyBtn.addEventListener('click', copyToClipboard);

// Charger les données au démarrage
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    // Auto-refresh périodique si le popup reste ouvert
    setInterval(() => loadData(), 5000);
});

// Update Status
function updateStatus(msg) {
    if (statusText) statusText.textContent = msg;
}

// Obtenir l'onglet actif
async function getActiveTab() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs[0];
}

// Déclencher un scan manuel dans la page
async function triggerManualScan() {
    updateStatus('🔍 Scan en cours...');
    scanBtn.disabled = true;

    try {
        const activeTab = await getActiveTab();

        // 1. Envoyer message au content script pour qu'il scanne
        await chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            func: () => {
                window.postMessage('MANUAL_SCAN_REQUEST', '*');
                // Force aussi un petit scroll pour charger du contenu lazy
                window.scrollBy(0, 200);
                setTimeout(() => window.scrollBy(0, -200), 200);
            }
        });

        // 2. Attendre un peu que le script fasse son travail
        setTimeout(() => {
            loadData();
            scanBtn.disabled = false;
        }, 1500);

    } catch (e) {
        console.error('Erreur scan:', e);
        updateStatus('❌ Erreur scan: ' + e.message);
        scanBtn.disabled = false;
    }
}

// Charger les données
async function loadData() {
    try {
        const activeTab = await getActiveTab();

        if (!activeTab?.url?.includes('notebooklm.google')) {
            showNotOnNotebookLM();
            return;
        }

        // Lire le localStorage de la page (c'est là que content.js écrit)
        const result = await chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            func: () => {
                const data = localStorage.getItem('notebooklm_sources_extension_data');
                const logs = localStorage.getItem('notebooklm_sources_debug_log');
                return {
                    data: data ? JSON.parse(data) : null,
                    logs: logs ? JSON.parse(logs) : []
                };
            }
        });

        if (result && result[0]?.result) {
            const { data, logs } = result[0].result;

            // Afficher les logs de debug dans la console du popup pour nous aider
            if (logs && logs.length > 0) {
                // On pourrait les afficher dans le popup si besoin, mais la console suffit pour le dev
                // console.log('Page Logs:', logs); 
            }

            if (data) {
                currentNotebookData = data;
                renderData();
                const sCount = Object.keys(data.sources || {}).length;
                const aCount = Object.keys(data.artifacts || {}).length;

                if (sCount > 0 || aCount > 0) {
                    updateStatus(`✅ ${sCount} sources, ${aCount} artefacts`);
                    instructionsBox.style.display = 'none';
                } else {
                    updateStatus('📭 Données vides trouvées');
                    showEmptyState();
                }
            } else {
                updateStatus('⚠️ Aucune donnée en mémoire');
                showEmptyState();
            }
        }
    } catch (e) {
        console.error('Load error:', e);
        // Ne pas spammer l'erreur si c'est juste un refresh périodique
        if (statusText.textContent !== '❌ Erreur technique') {
            updateStatus('❌ Erreur technique');
        }
    }
}

function showNotOnNotebookLM() {
    if (instructionsBox) instructionsBox.style.display = 'block';
    if (artifactsList) artifactsList.innerHTML = '<div class="empty-state">Ouvrez NotebookLM</div>';
    if (sourcesList) sourcesList.innerHTML = '';
}

function showEmptyState() {
    // Ne pas écraser s'il y a déjà quelque chose et qu'on fait juste un refresh
    if (!artifactsList || !sourcesList) return;

    if (artifactsList.children.length === 0 || artifactsList.querySelector('.loading')) {
        artifactsList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📭</div>
                <p>Aucun artefact détecté</p>
                <p class="help-text">Cliquez sur "Scanner la page" ou naviguez un peu.</p>
            </div>
        `;
    }
    if (sourcesList.children.length === 0 || sourcesList.querySelector('.loading')) {
        sourcesList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📄</div>
                <p>Aucune source détectée</p>
            </div>
        `;
    }
}

function renderData() {
    if (!sourcesList || !artifactsList) return;

    // SOURCES
    const sources = Object.values(currentNotebookData.sources || {});
    // On trie par nom pour que ce soit plus propre
    sources.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    if (sources.length > 0) {
        // Optimisation: ne pas re-render si le contenu est identique (compliqué à check simplement, on écrase pour l'instant)
        sourcesList.innerHTML = sources.slice(0, 30).map(s => `
            <div class="source-item">
                <div class="source-item-name">📄 ${escapeHtml(s.name)}</div>
            </div>
        `).join('') + (sources.length > 30 ? `<div class="source-item more">+ ${sources.length - 30} autres</div>` : '');
    }

    // ARTIFACTS
    const artifacts = Object.values(currentNotebookData.artifacts || {});
    if (artifacts.length > 0) {
        artifactsList.innerHTML = artifacts.map(a => {
            const count = a.sourceIds?.length || a.sourceCountDisplay || 0;
            // Ne pas afficher 0 sources si possible, sauf si on est sûr
            const countDisplay = count > 0 ? `${count} source(s)` : 'Source inconnue';

            // Garder la sélection active
            const isActive = selectedArtifactId === a.id ? 'active' : '';

            return `
                <div class="artifact-item ${isActive}" data-id="${escapeAttr(a.id)}">
                    <div class="artifact-item-title">${getIcon(a.title)} ${escapeHtml(a.title)}</div>
                    <div class="artifact-item-count">${countDisplay}</div>
                </div>
            `;
        }).join('');

        document.querySelectorAll('.artifact-item').forEach(el => {
            el.addEventListener('click', () => selectArtifact(el.dataset.id));
        });
    }
}

function getIcon(title) {
    if (!title) return '📄';
    const t = title.toLowerCase();
    if (t.includes('vidéo') || t.includes('video')) return '🎬';
    if (t.includes('audio') || t.includes('podcast')) return '🎙️';
    if (t.includes('résumé') || t.includes('summary')) return '📝';
    return '📄';
}

function selectArtifact(id) {
    selectedArtifactId = id;
    document.querySelectorAll('.artifact-item').forEach(el => el.classList.remove('active'));
    document.querySelector(`[data-id="${CSS.escape(id)}"]`)?.classList.add('active');

    const art = currentNotebookData.artifacts[id];
    if (!art) {
        detailsSection.style.display = 'none';
        return;
    }

    // Si on a les sourcesIds exacts (via Network), c'est top
    if (art.sourceIds && art.sourceIds.length > 0) {
        let html = `<div class="details-header"><strong>${art.sourceIds.length}</strong> sources identifiées :</div>`;

        // Convertir les IDs en objets source et trier
        const linkedSources = art.sourceIds.map(sid => {
            return currentNotebookData.sources[sid] || { id: sid, missing: true };
        }).sort((a, b) => {
            if (a.missing && !b.missing) return 1;
            if (!a.missing && b.missing) return -1;
            return (a.name || '').localeCompare(b.name || '');
        });

        html += linkedSources.map(src => {
            if (!src.missing) {
                return `<div class="detail-item"><div class="detail-item-name">📄 ${escapeHtml(src.name)}</div></div>`;
            } else {
                return `<div class="detail-item unresolved"><div class="detail-item-name">ID: ${src.id.substring(0, 10)}... (Non chargée)</div></div>`;
            }
        }).join('');

        artifactDetails.innerHTML = html;
        copyBtn.style.display = 'block';
    }
    // Sinon, si on l'a trouvé via le DOM
    else if (art.sourceCountDisplay > 0) {
        artifactDetails.innerHTML = `
            <div class="empty-state">
                <p>⚠️ Artefact détecté via le DOM (${art.sourceCountDisplay} sources).</p>
                <p class="help-text">Le lien technique vers les fichiers n'est pas accessible via le DOM seul.</p>
                <p class="help-text"><strong>Solution :</strong> Rechargez la page complète (F5) pour que l'extension capture les données réseau au démarrage.</p>
            </div>
        `;
        copyBtn.style.display = 'none';
    } else {
        artifactDetails.innerHTML = '<p class="empty-state">Aucune source trouvée pour cet artefact.</p>';
        copyBtn.style.display = 'none';
    }

    detailsSection.style.display = 'block';
}

async function copyToClipboard() {
    if (!selectedArtifactId) return;
    const art = currentNotebookData.artifacts[selectedArtifactId];
    if (!art || !art.sourceIds) return;

    const names = art.sourceIds.map(sid => {
        const src = currentNotebookData.sources[sid];
        return src ? src.name : `ID: ${sid}`;
    });

    const text = `Sources pour "${art.title}" (${names.length}):\n\n- ${names.join('\n- ')}`;

    try {
        await navigator.clipboard.writeText(text);

        // Feedback visuel sur le bouton
        const originalText = copyBtn.textContent;
        copyBtn.textContent = '✅ Copié !';
        setTimeout(() => copyBtn.textContent = originalText, 2000);

    } catch (err) {
        console.error('Erreur copie:', err);
        alert('Erreur: ' + err.message);
    }
}

function refreshData(userAction = false) {
    if (userAction) updateStatus('Actualisation...');
    loadData();
}

function escapeHtml(text) { return text ? String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") : ''; }
function escapeAttr(text) { return text ? String(text).replace(/"/g, "&quot;") : ''; }
