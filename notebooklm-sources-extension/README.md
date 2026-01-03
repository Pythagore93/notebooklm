# NotebookLM Sources Extractor v1.1

Extension Chrome pour extraire et afficher les sources exactes des contenus générés dans NotebookLM Studio (vidéos, podcasts, résumés audio).

## 🚀 Fonctionnalités

- **Capture automatique** : Intercepte les requêtes réseau pour capturer les données sources/artefacts en temps réel
- **Scanner manuel** : Bouton "Scanner la page" pour extraire les données depuis le DOM
- **Affichage clair** : Liste des artefacts générés avec le nombre de sources associées
- **Détails sources** : Cliquez sur un artefact pour voir la liste complète de ses sources
- **Copie facile** : Copiez la liste des sources dans le presse-papiers

## 📋 Installation

### 1. Télécharger l'extension
Décompressez l'archive dans un dossier de votre choix (par exemple : `notebooklm-sources-extension`).

### 2. Installer dans Chrome
1. Ouvrez Chrome et allez à : `chrome://extensions/`
2. Activez le **Mode développeur** (bouton en haut à droite)
3. Cliquez sur **"Charger l'extension non empaquetée"**
4. Sélectionnez le dossier `notebooklm-sources-extension`

### 3. Vérifier l'installation
Une icône 📚 devrait apparaître dans votre barre d'outils Chrome.

## 💡 Utilisation

### Méthode recommandée

1. **Ouvrez NotebookLM** : Allez sur [notebooklm.google.com](https://notebooklm.google.com)
2. **Naviguez dans votre notebook** : Ouvrez un notebook contenant des contenus générés
3. **Parcourez le Studio** : Cliquez sur vos vidéos, podcasts et résumés audio
4. **Ouvrez le popup** : Cliquez sur l'icône de l'extension 📚
5. **Rafraîchissez si nécessaire** : Utilisez le bouton "Actualiser" ou "Scanner la page"

### Boutons disponibles

- **🔄 Actualiser** : Recharge les données depuis le stockage
- **🔍 Scanner la page** : Analyse le DOM de la page actuelle pour extraire plus de données
- **📋 Copier** : Copie la liste des sources de l'artefact sélectionné

## 🔧 Comment ça marche

L'extension utilise plusieurs techniques pour capturer les données :

1. **Interception des requêtes** : Le content script intercepte les appels `fetch` et `XMLHttpRequest` pour capturer les réponses de l'API NotebookLM
2. **Parsing des réponses** : Les réponses JSON/batch de Google sont analysées pour extraire les IDs et noms des sources et artefacts
3. **Scan du DOM** : En fallback, l'extension peut scanner le DOM de la page pour identifier visuellement les sources et artefacts
4. **Stockage local** : Les données sont persistées dans le `localStorage` de la page et le storage de l'extension

## ⚠️ Limitations connues

- L'extension dépend de la structure interne de NotebookLM qui peut changer
- Les sources doivent être "vues" (chargées) pour que leurs noms soient capturés
- Certains artefacts peuvent avoir des sourceIds non résolus - naviguez vers le panneau Sources pour les capturer

## 🔐 Permissions

L'extension demande les permissions suivantes :

- `activeTab` : Pour accéder à l'onglet actif NotebookLM
- `scripting` : Pour injecter le script de capture et lire le localStorage
- `storage` : Pour persister les données entre les sessions
- `host_permissions` pour `notebooklm.google.com` : Nécessaire pour intercepter les requêtes

## 📁 Structure des fichiers

```
notebooklm-sources-extension/
├── manifest.json     # Configuration de l'extension
├── background.js     # Service worker pour le stockage
├── content.js        # Script injecté dans NotebookLM (intercepte les requêtes)
├── popup.html        # Interface utilisateur du popup
├── popup.js          # Logique du popup
├── popup.css         # Styles du popup
├── icons/            # Icônes de l'extension
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md         # Ce fichier
```

## 🐛 Dépannage

### "Aucune donnée trouvée"
- Assurez-vous d'être sur `notebooklm.google.com`
- Naviguez dans votre notebook (cliquez sur les sources et artefacts)
- Cliquez sur "Scanner la page"
- Actualisez la page NotebookLM et retentez

### "Les sources ne sont pas résolues (ID non résolu)"
- Naviguez vers le panneau "Sources" dans NotebookLM
- Cliquez sur chaque source pour la charger
- Retournez au popup et actualisez

### L'extension ne capture rien
- Vérifiez que l'extension est activée dans `chrome://extensions/`
- Rechargez la page NotebookLM
- Ouvrez la console (F12) et cherchez les messages `[NotebookLM Sources]`

## 📝 Changelog

### v1.1.0
- Exécution du content script dans le MAIN world pour une meilleure interception
- Ajout du bouton "Scanner la page" pour extraction manuelle
- Amélioration du parsing des réponses batch Google
- Ajout d'une barre de statut
- Meilleure gestion des erreurs et messages d'aide
- UI améliorée avec instructions intégrées

### v1.0.0
- Version initiale
- Capture des sources et artefacts via interception fetch
- Affichage des détails des sources par artefact
- Copie dans le presse-papiers

## 📄 Licence

Usage personnel uniquement. Non affilié à Google.
