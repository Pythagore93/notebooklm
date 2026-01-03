// Service Worker pour NotebookLM Sources Extractor

// Écouter les messages du content script et du popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'UPDATE_NOTEBOOK_DATA') {
    // Stocker les données dans le storage de l'extension
    chrome.storage.local.set({
      notebookData: request.data,
      lastUpdated: new Date().toISOString()
    }).then(() => {
      console.log('[NotebookLM Sources] Données mises à jour dans le storage');
    }).catch(err => {
      console.error('[NotebookLM Sources] Erreur storage:', err);
    });
  }

  if (request.type === 'GET_NOTEBOOK_DATA') {
    chrome.storage.local.get(['notebookData', 'lastUpdated']).then(result => {
      sendResponse({
        data: result.notebookData || { sources: {}, artifacts: {} },
        lastUpdated: result.lastUpdated
      });
    }).catch(err => {
      sendResponse({ data: { sources: {}, artifacts: {} }, error: err.message });
    });
    return true; // Indique qu'on va répondre de manière asynchrone
  }

  return false;
});

// Nettoyer le storage au premier démarrage seulement
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.storage.local.clear();
    console.log('[NotebookLM Sources] Extension installed and storage cleared');
  }
});

console.log('[NotebookLM Sources] Background service worker started');
