// Content script pour NotebookLM Sources Extractor
// Ce script s'exécute dans le MAIN world pour pouvoir intercepter les requêtes fetch

console.log('[NotebookLM Sources] Content script rechargé (v1.2)');

// Stocker les données du notebook
const notebookData = {
  sources: {},
  artifacts: {}
};

// Clé pour stocker dans localStorage
const STORAGE_KEY = 'notebooklm_sources_extension_data';
const DEBUG_KEY = 'notebooklm_sources_debug_log';

// Logger pour le debug
function log(msg, data = null) {
  const logEntry = `[${new Date().toLocaleTimeString()}] ${msg}`;
  console.log('[NotebookLM Sources]', msg, data || '');

  // Sauvegarder les derniers logs pour le popup
  try {
    const existingLogs = JSON.parse(localStorage.getItem(DEBUG_KEY) || '[]');
    existingLogs.unshift(logEntry);
    if (existingLogs.length > 50) existingLogs.pop();
    localStorage.setItem(DEBUG_KEY, JSON.stringify(existingLogs));
  } catch (e) { }
}

// Sauvegarder les données
function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notebookData));
    // Envoyer un événement custom pour notifier les changements
    window.dispatchEvent(new CustomEvent('notebooklm-sources-updated', {
      detail: notebookData
    }));
  } catch (e) {
    console.error('Save error:', e);
  }
}

// === PARTIE 1: INTERCEPTION RÉSEAU ===

const originalFetch = window.fetch;
window.fetch = async function (...args) {
  const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';

  try {
    const response = await originalFetch.apply(this, args);

    // Si c'est une requête NotebookLM intéressante
    if (url.includes('notebooklm') || url.includes('batchexecute')) {
      const cloned = response.clone();
      cloned.text().then(text => {
        scanTextForIds(text);
      }).catch(e => { });
    }

    return response;
  } catch (error) {
    throw error;
  }
};

// Intercepter XHR aussi
const originalXHROpen = XMLHttpRequest.prototype.open;
const originalXHRSend = XMLHttpRequest.prototype.send;

XMLHttpRequest.prototype.open = function (method, url, ...rest) {
  this._url = url;
  return originalXHROpen.apply(this, [method, url, ...rest]);
};

XMLHttpRequest.prototype.send = function (body) {
  this.addEventListener('load', function () {
    if (this._url && (this._url.includes('notebooklm') || this._url.includes('batchexecute'))) {
      scanTextForIds(this.responseText);
    }
  });
  return originalXHRSend.apply(this, [body]);
};

// Analyse brute du texte pour trouver des patterns intéressants
function scanTextForIds(text) {
  if (!text || text.length < 100) return;

  let foundSomething = false;

  // 1. Chercher les associations Artifact -> Sources (sourceDocumentIds)
  // Pattern: "sourceDocumentIds":["id1","id2"] ou "source_ids":["id1"]
  // On capture le contexte autour pour essayer de trouver le tire de l'artefact
  const contextRegex = /"((?:Vidéo|Video|Podcast|Audio|Résumé|Summary|Briefing)[^"]{0,50})".{0,500}"(sourceDocumentIds|source_ids)"\s*:\s*\[([^\]]+)\]/gi;
  let match;
  while ((match = contextRegex.exec(text)) !== null) {
    const title = match[1];
    const idsStr = match[3];
    const ids = idsStr.match(/"([^"]+)"/g)?.map(s => s.replace(/"/g, '')) || [];

    const artifactId = 'art-' + btoa(unescape(encodeURIComponent(title))).replace(/[^a-zA-Z0-9]/g, '').substring(0, 15);

    if (ids.length > 0) {
      notebookData.artifacts[artifactId] = {
        id: artifactId,
        title: title,
        type: 'artifact',
        sourceIds: ids
      };
      foundSomething = true;
      log(`Artifact trouvé via Network: ${title} (${ids.length} sources)`);
    }
  }

  // 2. Chercher les définitions de sources
  // Pattern: ["ID_LONG", "Nom du fichier", ...]
  // Google Batch format souvent: ["12345...","MonFichier.pdf",...]
  const sourceRegex = /\[\s*"([a-zA-Z0-9_-]{20,})"\s*,\s*"([^"]{3,100})"\s*,\s*"/g;
  while ((match = sourceRegex.exec(text)) !== null) {
    const id = match[1];
    const name = match[2];

    // Filtrer les faux positifs (URL, types mime, etc.)
    if (!name.startsWith('http') && !name.includes('/') && !name.includes('application')) {
      notebookData.sources[id] = {
        id: id,
        name: name,
        type: 'document'
      };
      foundSomething = true;
      // log(`Source trouvée via Network: ${name}`);
    }
  }

  if (foundSomething) saveData();
}


// === PARTIE 2: SCAN DOM ===

function scanDOM() {
  log('Scanning DOM data...');
  let changes = false;
  const notebookTitle = document.querySelector('h1')?.textContent?.trim();

  // 1. Scanner le panneau des SOURCES (à gauche)
  // Sélecteur large pour trouver des listes d'éléments
  const treeItems = document.querySelectorAll('[role="treeitem"], [role="listitem"]');
  treeItems.forEach(el => {
    const text = el.innerText || el.textContent;
    // Si ça a une checkbox ou une icône de fichier, c'est probablement une source
    if (text && text.trim().length > 0 && (
      el.querySelector('input[type="checkbox"]') ||
      el.innerHTML.includes('svg')
    )) {
      // Nettoyer le texte (enlever les dates, tailles, etc.)
      const cleanName = text.split('\n')[0].trim();
      if (cleanName.length > 2) {
        // Essayer de trouver un ID dans les attributs
        let id = el.getAttribute('data-id') || el.getAttribute('id');
        if (!id) {
          // Créer un ID basé sur le nom si pas d'ID technique
          id = 'dom-source-' + btoa(unescape(encodeURIComponent(cleanName))).replace(/[^a-zA-Z0-9]/g, '');
        }

        notebookData.sources[id] = {
          id: id,
          name: cleanName,
          type: 'document'
        };
        changes = true;
      }
    }
  });

  // 2. Scanner le panneau STUDIO (Chips, Cartes)
  // Chercher les éléments avec "X sources" dans le texte
  const studioElements = document.querySelectorAll('*');
  for (let el of studioElements) {
    // Optimisation: ne regarder que les éléments qui contiennent du texte direct
    if (el.children.length > 2) continue;

    const text = el.innerText || el.textContent;
    if (!text) continue;

    if (text.match(/(\d+)\s*source/i)) {
      // C'est potentiellement un artefact
      // Remonter pour trouver le titre (souvent le sibling ou le parent)
      let container = el.closest('[role="button"]');
      if (container) {
        const titleEl = container.querySelector('h3, .title, [class*="Title"]');
        if (!titleEl) continue;
        const title = titleEl.textContent;
        const cleanTitle = title.trim();

        if (
          cleanTitle.length > 3 &&
          !cleanTitle.includes('source') &&
          (!notebookTitle || cleanTitle !== notebookTitle)
        ) {
          const id = 'dom-art-' + btoa(unescape(encodeURIComponent(cleanTitle))).replace(/[^a-zA-Z0-9]/g, '').substring(0, 15);
          const countMatch = text.match(/(\d+)\s*source/i);
          const count = countMatch ? parseInt(countMatch[1]) : 0;

          // On ne peut pas récupérer les IDs exacts via le DOM facilement,
          // mais on peut au moins montrer qu'on a trouvé l'artefact
          if (!notebookData.artifacts[id]) {
            notebookData.artifacts[id] = {
              id: id,
              title: cleanTitle,
              type: 'artifact',
              sourceIds: [], // On ne peut pas les deviner via le DOM
              sourceCountDisplay: count // Indicateur visuel
            };
            changes = true;
            log(`Artifact trouvé via DOM: ${cleanTitle}`);
          }
        }
      }
    }
  }

  if (changes) saveData();
}

// Observer les changements
const observer = new MutationObserver((mutations) => {
  // Debounce le scan
  if (window.scanTimeout) clearTimeout(window.scanTimeout);
  window.scanTimeout = setTimeout(scanDOM, 2000);
});

// Init
setTimeout(() => {
  observer.observe(document.body, { childList: true, subtree: true });
  scanDOM();
  log('Observer démarré');
}, 2000);

// Écouter les demandes manuelles
window.addEventListener('message', (event) => {
  if (event.data === 'MANUAL_SCAN_REQUEST') {
    scanDOM();
    log('Scan manuel demandé');
  }
});
