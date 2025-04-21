// ==UserScript==
// @name         Instagram Single Story View
// @namespace    https://github.com/eltoro0815/instagram-single-story-view
// @version      1.0.6
// @description  Erzwingt die Einzelansicht für Instagram-Stories und verhindert die Karussell-Navigation
// @author       eltoro0815
// @match        https://www.instagram.com/stories/*
// @grant        none
// @updateURL    https://raw.githubusercontent.com/eltoro0815/instagram-single-story-view/master/instagram-single-story.user.js
// @downloadURL  https://raw.githubusercontent.com/eltoro0815/instagram-single-story-view/master/instagram-single-story.user.js
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // Konfiguration
    const RETRY_INTERVAL = 250; // ms
    const MAX_RETRIES = 10;
    const DEBUG = true; // Debug-Modus für ausführlichere Logausgaben
    const ENABLE_DOM_ANALYSIS = true; // Aktiviert die DOM-Analyse für Debugging
    
    // Schutz vor Endlosschleifen
    let isProcessing = false;
    let lastRedirectTime = 0;
    const REDIRECT_COOLDOWN = 2000; // 2 Sekunden zwischen Umleitungen
    let processAttempts = 0;
    const MAX_PROCESS_ATTEMPTS = 5; // Maximale Anzahl Verarbeitungsversuche pro Seitenbesuch
    let redirectCount = 0;
    const MAX_REDIRECTS = 2; // Maximale Anzahl von Umleitungen pro Seitenbesuch
    
    // Status-Tracking für den Button
    let buttonShown = false;
    let buttonClicked = false;
    let lastObserverHandlingTime = 0;
    const OBSERVER_HANDLING_COOLDOWN = 1000; // 1 Sekunde zwischen DOM-Observer-Handlings
    let isInSingleView = false;
    
    // Speichere gefundene Story IDs
    let lastFoundStoryId = null;
    
    // Debug-Sammlung
    let domStructureData = null;
    
    // Initiale Meldung beim Laden
    console.log(`[Instagram Single Story] Skript wird geladen - Version 1.0.5`);

    // Logger-Funktion für Debug-Zwecke
    const log = (message) => {
        console.log(`[Instagram Single Story] ${message}`);
    };

    // Ausführlichere Logging-Funktion für den Debug-Modus
    const debugLog = (message) => {
        if (DEBUG) {
            console.log(`[Instagram Single Story Debug] ${message}`);
        }
    };
    
    /**
     * Analysiert die DOM-Struktur und speichert wichtige Informationen
     * @returns {Object} DOM-Struktur-Daten
     */
    function analyzeDOMStructure() {
        if (!ENABLE_DOM_ANALYSIS) return null;
        
        try {
            // Relevante Selektoren für die Analyse
            const selectors = {
                nextButtons: ['button[aria-label="Weiter"]', 'button[aria-label="Next"]', 'button[aria-label="Nächstes Element"]', '[aria-label*="next"]', '[aria-label*="Next"]', 'button[aria-label*="nächste"]'],
                prevButtons: ['button[aria-label="Zurück"]', 'button[aria-label="Previous"]', 'button[aria-label="Vorheriges Element"]', '[aria-label*="previous"]', '[aria-label*="Previous"]', 'button[aria-label*="vorherige"]'],
                progressBars: ['[role="progressbar"]', '[class*="progress"]', '[class*="Progress"]'],
                storyContainers: ['[data-visualcompletion="loading-state"]', '[class*="story"]', '[class*="Story"]'],
                mediaElements: ['img[srcset]', 'video source', 'img[src]', 'video'],
                storyCounters: ['div[class*="count"]', 'span[class*="count"]']
            };
            
            const results = {
                url: window.location.href,
                timestamp: new Date().toISOString(),
                foundElements: {},
                activeSelectors: {}
            };
            
            // Für jeden Selektor-Typ prüfen, welche konkreten Selektoren funktionieren
            for (const [type, selectorList] of Object.entries(selectors)) {
                results.foundElements[type] = [];
                results.activeSelectors[type] = [];
                
                for (const selector of selectorList) {
                    const elements = document.querySelectorAll(selector);
                    if (elements.length > 0) {
                        results.activeSelectors[type].push(selector);
                        
                        // Sammle Informationen zu den gefundenen Elementen
                        Array.from(elements).slice(0, 3).forEach(el => {
                            const elementInfo = {
                                tagName: el.tagName,
                                className: el.className,
                                id: el.id,
                                attributes: {},
                                parentInfo: el.parentElement ? {
                                    tagName: el.parentElement.tagName,
                                    className: el.parentElement.className
                                } : null
                            };
                            
                            // Attribute sammeln
                            Array.from(el.attributes).forEach(attr => {
                                elementInfo.attributes[attr.name] = attr.value;
                            });
                            
                            results.foundElements[type].push(elementInfo);
                        });
                    }
                }
            }
            
            // Zusätzliche Informationen über Medien sammeln
            const mediaElements = document.querySelectorAll('img[src], video source');
            results.mediaUrls = Array.from(mediaElements).slice(0, 5).map(el => el.src || el.srcset);
            
            // Für Story-IDs relevante Informationen
            results.potentialStoryIds = [];
            
            // Suche nach IDs in URLs
            const urlsWithIds = document.querySelectorAll('a[href*="stories"]');
            Array.from(urlsWithIds).forEach(el => {
                const match = el.href.match(/\/stories\/[^\/]+\/(\d+)/);
                if (match && match[1]) {
                    results.potentialStoryIds.push({
                        source: 'href',
                        id: match[1],
                        element: {
                            tagName: el.tagName,
                            className: el.className
                        }
                    });
                }
            });
            
            // Suche nach IDs in Attributen
            const elementsWithDataId = document.querySelectorAll('[data-id], [id*="story"], [class*="story"], [id*="media"], [class*="media"]');
            Array.from(elementsWithDataId).slice(0, 10).forEach(el => {
                const dataId = el.getAttribute('data-id');
                if (dataId && /^\d+$/.test(dataId)) {
                    results.potentialStoryIds.push({
                        source: 'data-id',
                        id: dataId,
                        element: {
                            tagName: el.tagName,
                            className: el.className
                        }
                    });
                }
            });
            
            // Speichere die Ergebnisse
            domStructureData = results;
            
            // Wenn Debug aktiviert ist, in die Konsole ausgeben
            if (DEBUG) {
                console.log('==== DOM-STRUKTUR-ANALYSE ====');
                console.log(JSON.stringify(results, null, 2));
                console.log('==============================');
            }
            
            return results;
        } catch (e) {
            console.error(`[Instagram Single Story] Fehler bei DOM-Analyse: ${e.message}`);
            return null;
        }
    }
    
    /**
     * Exportiert die gesammelten Debug-Daten als JSON zum Download
     */
    function exportDebugData() {
        if (!domStructureData) {
            analyzeDOMStructure();
        }
        
        if (!domStructureData) {
            alert('Keine Debug-Daten verfügbar. Bitte versuche es erneut.');
            return;
        }
        
        // Daten vorbereiten
        const data = {
            scriptVersion: '1.0.5',
            timestamp: new Date().toISOString(),
            url: window.location.href,
            userAgent: navigator.userAgent,
            domStructure: domStructureData
        };
        
        // JSON erstellen und zum Download anbieten
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        // Download-Link erstellen
        const a = document.createElement('a');
        a.href = url;
        a.download = `instagram-story-debug-${new Date().toISOString().replace(/:/g, '-')}.json`;
        a.click();
        
        // Ressourcen freigeben
        setTimeout(() => {
            URL.revokeObjectURL(url);
        }, 100);
    }

    // Füge eine Debug-Taste hinzu (STRG+SHIFT+I)
    document.addEventListener('keydown', e => {
        if (e.ctrlKey && e.shiftKey && e.key === 'I') {
            debugLog('Debug-Taste gedrückt - exportiere Daten');
            exportDebugData();
        }
    });

    /**
     * Überprüft, ob es sich um eine Story-URL handelt
     * @returns {boolean}
     */
    function isStoryPage() {
        return window.location.pathname.startsWith('/stories/');
    }

    /**
     * Überprüft, ob die URL eine vollständige Einzel-Story-URL ist (mit ID)
     * @returns {boolean}
     */
    function isFullStoryUrl() {
        return /\/stories\/[^\/]+\/\d+/.test(window.location.pathname);
    }

    /**
     * Extrahiert den Benutzernamen aus der aktuellen URL
     * @returns {string|null}
     */
    function extractUsername() {
        const match = window.location.pathname.match(/\/stories\/([^\/]+)/);
        return match ? match[1] : null;
    }

    /**
     * Extrahiert die Story-ID aus der aktuellen URL, falls vorhanden
     * @returns {string|null}
     */
    function extractStoryIdFromUrl() {
        const match = window.location.pathname.match(/\/stories\/[^\/]+\/(\d+)/);
        return match ? match[1] : null;
    }

    /**
     * Erkennt, ob die aktuelle Ansicht ein Karussell ist
     * (Erkennt die Mehrfach-Story-Ansicht durch prüfen der DOM-Struktur)
     * @returns {boolean}
     */
    function isCarouselView() {
        try {
            // Bei URL ohne Story-ID ist es immer ein Karussell
            if (!isFullStoryUrl()) {
                debugLog("URL ohne Story-ID - definitiv ein Karussell");
                return true;
            }
            
            // Wenn keine Seite geladen ist
            if (!document.body) {
                debugLog("Document body noch nicht verfügbar");
                return true;
            }
            
            // Prüfen auf Navigations-Elemente, die typisch für das Karussell sind
            const nextStoryBtn = document.querySelector('button[aria-label="Weiter"], button[aria-label="Next"], button[aria-label="Nächstes Element"], [aria-label*="next"], [aria-label*="Next"], button[aria-label*="nächste"]');
            const prevStoryBtn = document.querySelector('button[aria-label="Zurück"], button[aria-label="Previous"], button[aria-label="Vorheriges Element"], [aria-label*="previous"], [aria-label*="Previous"], button[aria-label*="vorherige"]');
            
            // Prüfe auf mehrere Fortschrittsbalken/Indikatoren
            const progressBars = document.querySelectorAll('[role="progressbar"], [class*="progress"], [class*="Progress"]');
            const multipleProgressBars = progressBars.length > 1;
            
            // Prüfe auf Story-Ringe oder mehrere Story-Container
            const storyContainers = document.querySelectorAll('[data-visualcompletion="loading-state"], [class*="story"], [class*="Story"]');
            const multipleStoryElements = storyContainers.length > 2;
            
            // Prüfe auf typische Story-Karussell-Container
            const storyTray = document.querySelector('[data-visualcompletion="loading-state"], div[style*="transform"]');
            
            // Prüfe auf Seitennummern oder Indikatoren (z.B. 1/5)
            const storyCounters = document.querySelectorAll('div[class*="count"], span[class*="count"]');
            
            const isCarousel = (nextStoryBtn !== null || prevStoryBtn !== null || multipleProgressBars || multipleStoryElements || storyCounters.length > 0);
            
            if (DEBUG) {
                const elementsFound = [];
                if (nextStoryBtn !== null) elementsFound.push("Nächste-Button");
                if (prevStoryBtn !== null) elementsFound.push("Vorherige-Button");
                if (multipleProgressBars) elementsFound.push("Mehrere Fortschrittsbalken");
                if (multipleStoryElements) elementsFound.push("Mehrere Story-Elemente");
                if (storyTray !== null) elementsFound.push("Story-Tray");
                if (storyCounters.length > 0) elementsFound.push("Story-Zähler");
                
                debugLog(`Karussell-Erkennung: ${isCarousel} (Elemente: ${elementsFound.join(', ') || 'keine gefunden'})`);
            }
            
            return isCarousel;
        } catch (e) {
            log(`Fehler bei Karussell-Erkennung: ${e.message}`);
            return true; // Im Zweifelsfall als Karussell behandeln
        }
    }

    /**
     * Extrahiert die Story-ID aus dem DOM der aktuellen Seite
     * @returns {string|null}
     */
    function extractStoryIdFromDOM() {
        try {
            debugLog("Versuche Story-ID aus DOM zu extrahieren");
            
            // Verwende die letzte gefundene ID, wenn wir eine haben
            // Dies hilft bei Stories, bei denen wir die ID schwer finden können
            if (lastFoundStoryId) {
                debugLog(`Verwende letzte bekannte Story-ID: ${lastFoundStoryId}`);
                return lastFoundStoryId;
            }
            
            // Versuche zuerst, die Story-ID aus der URL zu extrahieren
            const urlStoryId = extractStoryIdFromUrl();
            if (urlStoryId) {
                debugLog(`Story-ID aus URL gefunden: ${urlStoryId}`);
                lastFoundStoryId = urlStoryId;
                return urlStoryId;
            }
            
            // Strategie 1: Suche nach ersten geteilten Story-Elementen
            // Diese sind oft leichter zu identifizieren als unten in der Media-Liste
            const storyLinks = document.querySelectorAll('a[href*="stories"]');
            for (const link of storyLinks) {
                debugLog(`Prüfe Story-Link: ${link.href}`);
                const match = link.href.match(/\/stories\/[^\/]+\/(\d+)/);
                if (match && match[1]) {
                    debugLog(`ID aus Story-Link extrahiert: ${match[1]}`);
                    lastFoundStoryId = match[1];
                    return match[1];
                }
            }
            
            // Strategie 2: Suche nach Bild/Video-Elementen mit src/srcset-Attributen
            const mediaElements = document.querySelectorAll('img[srcset], video source, img[src], video');
            debugLog(`Gefundene Medienelemente: ${mediaElements.length}`);
            
            for (const element of mediaElements) {
                const src = element.src || element.srcset || '';
                if (src) {
                    debugLog(`Prüfe src: ${src}`);
                    // Instagram speichert oft IDs in Format /12345_67890_12345/
                    const patterns = [
                        /\/(\d+)_\d+_\d+/, // Standard Instagram Media ID Format
                        /stories\/[^\/]+\/(\d+)/, // Story URL Format
                        /stories%2F[^%]+%2F(\d+)/, // Encoded Story URL
                        /story_media%2F(\d+)/, // Story Media
                        /(\d{15,25})/, // Sehr lange Zahlen sind oft IDs
                    ];
                    
                    for (const pattern of patterns) {
                        const match = src.match(pattern);
                        if (match && match[1]) {
                            const potentialId = match[1];
                            debugLog(`Potentielle ID gefunden: ${potentialId} mit Pattern ${pattern}`);
                            // Prüfe, ob die ID plausibel ist (Instagram IDs sind meist 15-25 Ziffern lang)
                            if (potentialId.length >= 5 && potentialId.length <= 25) {
                                lastFoundStoryId = potentialId;
                                return potentialId;
                            }
                        }
                    }
                }
            }
            
            // Strategie 3: Suche nach data-Attributen, die IDs enthalten könnten
            const allElements = document.querySelectorAll('[data-id], [id*="story"], [class*="story"], [id*="media"], [class*="media"]');
            debugLog(`Elemente mit relevanten Attributen: ${allElements.length}`);
            
            for (const element of allElements) {
                const dataId = element.getAttribute('data-id');
                if (dataId && /^\d+$/.test(dataId)) {
                    debugLog(`ID aus data-id Attribut: ${dataId}`);
                    lastFoundStoryId = dataId;
                    return dataId;
                }
                
                // Prüfe zusätzliche Attribute
                const attributes = ['id', 'data-media-id', 'data-story-id'];
                for (const attr of attributes) {
                    if (element.hasAttribute(attr)) {
                        const value = element.getAttribute(attr);
                        const match = value.match(/(\d{5,})/);
                        if (match) {
                            debugLog(`ID aus ${attr} extrahiert: ${match[1]}`);
                            lastFoundStoryId = match[1];
                            return match[1];
                        }
                    }
                }
            }
            
            // Strategie 4: Extrahiere aus der aktuellen URL-Pfadkomponente
            const pathParts = window.location.pathname.split('/');
            for (const part of pathParts) {
                if (/^\d{5,}$/.test(part)) {
                    debugLog(`ID aus URL-Pfad extrahiert: ${part}`);
                    lastFoundStoryId = part;
                    return part;
                }
            }
            
            // Strategie 5: Prüfe, ob aktuelle Story-Elemente einen identifizierbaren Pfad haben
            const activeStoryElements = document.querySelectorAll('[aria-selected="true"], .active, [class*="active"], [class*="current"]');
            for (const element of activeStoryElements) {
                const allLinks = element.querySelectorAll('a');
                for (const link of allLinks) {
                    const href = link.getAttribute('href') || '';
                    const match = href.match(/\/stories\/[^\/]+\/(\d+)/);
                    if (match && match[1]) {
                        debugLog(`ID von aktivem Story-Element: ${match[1]}`);
                        lastFoundStoryId = match[1];
                        return match[1];
                    }
                }
            }
            
            // Strategie 6: Schau nach Daten-Attributen in globalen Script-Tags
            const scripts = document.querySelectorAll('script:not([src])');
            for (const script of scripts) {
                const text = script.textContent;
                if (text && text.includes('story_id') || text.includes('media_id')) {
                    const match = text.match(/"(story_id|media_id)"\s*:\s*"?(\d{5,})"?/);
                    if (match && match[2]) {
                        debugLog(`ID aus Script-Tag: ${match[2]}`);
                        lastFoundStoryId = match[2];
                        return match[2];
                    }
                }
            }
            
            debugLog("Keine Story-ID gefunden");
            return null;
        } catch (e) {
            log(`Fehler bei ID-Extraktion: ${e.message}`);
            return null;
        }
    }
    
    /**
     * Prüft, ob wir bereits auf der korrekten Einzelansicht-URL sind
     * @param {string} username 
     * @param {string} storyId 
     * @returns {boolean}
     */
    function isAlreadyOnSingleViewUrl(username, storyId) {
        const currentUrl = window.location.href;
        const targetUrl = `https://www.instagram.com/stories/${username}/${storyId}/`;
        
        // Vergleiche ohne Ankertext oder Suchparameter
        const normalizedCurrentUrl = currentUrl.split('#')[0].split('?')[0];
        const normalizedTargetUrl = targetUrl.split('#')[0].split('?')[0];
        
        const isOnCorrectUrl = normalizedCurrentUrl === normalizedTargetUrl;
        debugLog(`URL-Vergleich: ${normalizedCurrentUrl} vs ${normalizedTargetUrl} = ${isOnCorrectUrl}`);
        
        return isOnCorrectUrl;
    }

    /**
     * Leitet zur Einzelansicht der Story um
     * @param {string} username 
     * @param {string} storyId 
     */
    function redirectToSingleStoryView(username, storyId) {
        if (!username || !storyId) {
            log('Fehler: Benutzername oder Story-ID fehlt für die Umleitung');
            return;
        }
        
        // Wenn wir bereits auf der richtigen URL sind, nichts tun
        if (isAlreadyOnSingleViewUrl(username, storyId)) {
            log('Bereits auf der korrekten Einzelansicht-URL');
            isInSingleView = true;
            return;
        }
        
        // Prüfe Cooldown, um zu viele Weiterleitungen zu vermeiden
        const now = Date.now();
        if (now - lastRedirectTime < REDIRECT_COOLDOWN) {
            log(`Umleitung zu schnell nach letzter Umleitung. Warte ${REDIRECT_COOLDOWN}ms.`);
            return;
        }
        
        // Prüfe maximale Umleitungen
        if (redirectCount >= MAX_REDIRECTS) {
            log(`Maximale Anzahl von Umleitungen (${MAX_REDIRECTS}) erreicht. Stoppe weitere Versuche.`);
            return;
        }
        
        const singleViewUrl = `https://www.instagram.com/stories/${username}/${storyId}/`;
        
        log(`Leite um zu: ${singleViewUrl}`);
        lastRedirectTime = now;
        redirectCount++;
        buttonClicked = true;
        
        try {
            // Deaktiviere temporär den MutationObserver, um Endlosschleifen zu vermeiden
            if (window.instagramSingleStoryObserver) {
                window.instagramSingleStoryObserver.disconnect();
                debugLog('MutationObserver temporär deaktiviert');
            }
            
            // Versuche, die URL zu ändern
            window.location.href = singleViewUrl;
            
            // Reaktiviere den Observer nach einer angemessenen Verzögerung
            setTimeout(() => {
                if (window.instagramSingleStoryObserver) {
                    window.instagramSingleStoryObserver.observe(document.body, { childList: true, subtree: false });
                    debugLog('MutationObserver wieder aktiviert');
                    // Nach der Navigation zurücksetzen
                    processAttempts = 0;
                    buttonClicked = false;
                }
            }, 3000);
        } catch (e) {
            log(`Fehler bei Umleitung: ${e.message}`);
        }
    }
    
    /**
     * Aktualisiert die Sichtbarkeit und den Zustand des Toggle-Buttons
     * @param {boolean} isCarousel 
     * @param {string|null} storyId 
     */
    function updateButtonState(isCarousel, storyId) {
        const existingButton = document.getElementById('single-story-toggle');
        
        // Entferne den Button, wenn wir nicht in einer Karussell-Ansicht sind oder keine Story-ID haben
        if (!isCarousel || !storyId) {
            if (existingButton) {
                existingButton.remove();
                buttonShown = false;
            }
            return;
        }
        
        // Wenn der Button bereits existiert, aktualisiere ihn nur
        if (existingButton) {
            if (buttonClicked) {
                existingButton.textContent = 'Einzelansicht wird geladen...';
                existingButton.disabled = true;
                existingButton.style.opacity = '0.5';
                existingButton.style.cursor = 'default';
            }
            return;
        }
        
        // Ansonsten erstelle einen neuen Button
        addManualToggleButton();
    }

    /**
     * Fügt eine Schaltfläche zur manuellen Umschaltung hinzu
     */
    function addManualToggleButton() {
        // Wenn der Button bereits angezeigt wird oder wir bereits geklickt haben, nichts tun
        if (buttonShown || buttonClicked) {
            return;
        }
        
        const existingButton = document.getElementById('single-story-toggle');
        if (existingButton) {
            return;
        }
        
        const button = document.createElement('button');
        button.id = 'single-story-toggle';
        button.textContent = 'Zur Einzelansicht';
        button.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            z-index: 999999;
            background: rgba(0, 0, 0, 0.7);
            color: white;
            border: none;
            border-radius: 4px;
            padding: 8px 12px;
            font-weight: bold;
            cursor: pointer;
            font-family: Arial, sans-serif;
        `;
        
        button.addEventListener('click', () => {
            if (buttonClicked) return;
            
            log('Manueller Wechsel zur Einzelansicht angefordert');
            const username = extractUsername();
            const storyId = extractStoryIdFromDOM() || extractStoryIdFromUrl();
            
            if (username && storyId) {
                buttonClicked = true;
                button.textContent = 'Einzelansicht wird geladen...';
                button.disabled = true;
                button.style.opacity = '0.5';
                button.style.cursor = 'default';
                
                redirectToSingleStoryView(username, storyId);
            } else {
                alert('Konnte keine Story-ID finden. Bitte versuche es später erneut.');
            }
        });
        
        document.body.appendChild(button);
        buttonShown = true;
        log('Button zur Einzelansicht hinzugefügt');
    }

    /**
     * Hauptfunktion zum Verarbeiten der Story-Ansicht
     */
    function processSingleStoryView(retryCount = 0) {
        // Verhindere gleichzeitige/überlappende Ausführungen
        if (isProcessing) {
            debugLog('Bereits in Verarbeitung, überspringe');
            return;
        }
        
        // Prüfe maximale Anzahl von Verarbeitungsversuchen
        if (processAttempts >= MAX_PROCESS_ATTEMPTS) {
            log(`Maximale Anzahl von Verarbeitungsversuchen (${MAX_PROCESS_ATTEMPTS}) erreicht.`);
            
            // Zeige den Button trotzdem an, wenn wir in einer Karussell-Ansicht sind
            const isCarousel = isCarouselView();
            if (isCarousel) {
                const storyId = extractStoryIdFromDOM() || extractStoryIdFromUrl();
                if (storyId) {
                    updateButtonState(true, storyId);
                }
            }
            
            return;
        }
        
        isProcessing = true;
        processAttempts++;
        
        try {
            if (!isStoryPage()) {
                debugLog('Keine Story-Seite, überspringe Verarbeitung');
                isProcessing = false;
                return;
            }
            
            debugLog(`Verarbeite Story-Ansicht (Versuch ${retryCount + 1}, Gesamt: ${processAttempts})`);
            
            const username = extractUsername();
            if (!username) {
                log('Konnte keinen Benutzernamen finden');
                isProcessing = false;
                return;
            }
            
            // URL ohne Story-ID erkannt, zeige Button an
            if (!isFullStoryUrl()) {
                log('URL ohne Story-ID erkannt, zeige Button an');
                const storyId = extractStoryIdFromDOM();
                if (storyId) {
                    log(`Story-ID aus DOM gefunden: ${storyId}`);
                    updateButtonState(true, storyId);
                } else if (retryCount < MAX_RETRIES) {
                    // Wenn keine Story-ID gefunden wurde, erneut versuchen
                    log(`Konnte keine Story-ID finden. Versuche erneut (${retryCount + 1}/${MAX_RETRIES})...`);
                    isProcessing = false;
                    setTimeout(() => processSingleStoryView(retryCount + 1), RETRY_INTERVAL);
                    return;
                } else {
                    log('Konnte keine Story-ID für URL ohne ID finden. Versuche den Button zu zeigen.');
                    addManualToggleButton();
                }
                
                isProcessing = false;
                return;
            }
            
            // Story-ID aus URL extrahieren
            const urlStoryId = extractStoryIdFromUrl();
            debugLog(`Story-ID aus URL: ${urlStoryId || 'keine'}`);
            
            // WICHTIG: Prüfe immer die tatsächliche DOM-Struktur
            const carousel = isCarouselView();
            debugLog(`Karussell-Ansicht erkannt: ${carousel}`);
            
            // Zeige immer den Button an, wenn wir uns in einer Karussell-Ansicht befinden
            if (carousel) {
                const storyId = extractStoryIdFromDOM() || urlStoryId;
                updateButtonState(true, storyId);
            } else if (!carousel && urlStoryId) {
                // Wenn wir in einer Einzelansicht sind und eine URL-ID haben, entferne den Button falls vorhanden
                log('Bereits in Einzelansicht, keine Aktion notwendig');
                isInSingleView = true;
                
                // Entferne den Button, wenn er existiert
                const existingButton = document.getElementById('single-story-toggle');
                if (existingButton) {
                    existingButton.remove();
                    buttonShown = false;
                }
            }
            
            isProcessing = false;
        } catch (e) {
            log(`Fehler bei der Verarbeitung: ${e.message}`);
            isProcessing = false;
        }
    }

    // Bei document-start initialisieren - garantiert frühe Ausführung
    debugLog("Instagram Single Story View gestartet - Warte auf DOM");
    
    // Warten, bis das Dokument geladen ist, bevor wir starten
    function init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', onReady);
        } else {
            onReady();
        }
    }
    
    function onReady() {
        debugLog("DOM geladen, starte Verarbeitung");
        setTimeout(() => {
            processSingleStoryView();
        }, 500);
        
        // MutationObserver mit stärkerem Ratelimiting
        const observerCallback = (mutations) => {
            const now = Date.now();
            if (now - lastObserverHandlingTime < OBSERVER_HANDLING_COOLDOWN) {
                return;
            }
            
            lastObserverHandlingTime = now;
            
            // Prüfe, ob wir die maximale Anzahl von Versuchen erreicht haben
            if (processAttempts >= MAX_PROCESS_ATTEMPTS && !buttonClicked) {
                // Selbst bei maximalen Versuchen zeigen wir den Button an, wenn ein Karussell erkannt wurde
                const isCarousel = isCarouselView();
                if (isCarousel) {
                    const storyId = extractStoryIdFromDOM() || extractStoryIdFromUrl();
                    if (storyId) {
                        updateButtonState(isCarousel, storyId);
                    }
                }
                return;
            }
            
            for (const mutation of mutations) {
                if (mutation.type === 'childList' && isStoryPage() && !isProcessing && !buttonClicked) {
                    debugLog('DOM-Änderung erkannt, starte Verarbeitung neu');
                    setTimeout(() => processSingleStoryView(), 500);
                    break;
                }
            }
        };
        
        const observer = new MutationObserver(observerCallback);
        window.instagramSingleStoryObserver = observer;
        
        // Beobachtung des Body-Elements für Änderungen starten
        if (document.body) {
            observer.observe(document.body, { childList: true, subtree: false });
        }
        
        // Bei Änderungen der URL (History API) ebenfalls die Funktion ausführen
        // Verwende das originale history nur einmal
        const originalPushState = history.pushState;
        history.pushState = function() {
            originalPushState.apply(this, arguments);
            
            if (isStoryPage() && !isProcessing) {
                debugLog('pushState erkannt');
                // Zurücksetzen der Versuche bei URL-Änderung
                processAttempts = 0;
                redirectCount = 0;
                buttonClicked = false;
                isInSingleView = false;
                // Wichtig: Bei URL-Änderung auch die lastFoundStoryId zurücksetzen
                lastFoundStoryId = null;
                setTimeout(() => processSingleStoryView(), 1000);
            }
        };
        
        // Reagieren auf popstate-Events (z.B. Zurück-Button im Browser)
        window.addEventListener('popstate', () => {
            if (isStoryPage() && !isProcessing) {
                debugLog('popstate erkannt');
                // Zurücksetzen der Versuche bei URL-Änderung
                processAttempts = 0;
                redirectCount = 0;
                buttonClicked = false;
                isInSingleView = false;
                // Wichtig: Bei URL-Änderung auch die lastFoundStoryId zurücksetzen
                lastFoundStoryId = null;
                setTimeout(() => processSingleStoryView(), 1000);
            }
        });
    
        // Event-Listener für Klicks mit Ratelimiting
        let lastClickProcess = 0;
        const CLICK_PROCESS_COOLDOWN = 1000; // ms
        
        document.addEventListener('click', (event) => {
            const now = Date.now();
            if (now - lastClickProcess < CLICK_PROCESS_COOLDOWN) {
                return;
            }
            
            lastClickProcess = now;
            
            // Verzögere die Prüfung um der Navigation Zeit zu geben
            setTimeout(() => {
                if (isStoryPage() && !isProcessing && !buttonClicked) {
                    debugLog('Story-Navigation nach Klick erkannt');
                    // Zurücksetzen der Versuche bei neuer Navigation
                    processAttempts = 0;
                    redirectCount = 0;
                    isInSingleView = false;
                    // Wichtig: Bei Klick auch die lastFoundStoryId zurücksetzen
                    lastFoundStoryId = null;
                    processSingleStoryView();
                }
            }, 1000);
        }, true);
    }
    
    // Initialisierung starten
    init();

    // Analyse bei DOM-Ready und nach jedem Navigationsvorgang durchführen
    function runDOMAnalysis() {
        if (ENABLE_DOM_ANALYSIS && isStoryPage()) {
            setTimeout(() => {
                analyzeDOMStructure();
                debugLog('DOM-Analyse abgeschlossen');
            }, 1500); // Verzögerung, um sicherzustellen, dass die Seite geladen ist
        }
    }
    
    // Füge die Analyse zu vorhandenen Funktionen hinzu
    const originalProcessSingleStoryView = processSingleStoryView;
    processSingleStoryView = function(retryCount = 0) {
        // Original-Funktion ausführen
        const result = originalProcessSingleStoryView.call(this, retryCount);
        
        // DOM-Analyse hinzufügen
        runDOMAnalysis();
        
        return result;
    };
})(); 