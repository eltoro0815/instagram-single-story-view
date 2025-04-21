// ==UserScript==
// @name         Instagram Single Story View
// @namespace    https://github.com/eltoro0815/instagram-single-story-view
// @version      1.0.2
// @description  Erzwingt die Einzelansicht für Instagram-Stories und verhindert die Karussell-Navigation
// @author       eltoro0815
// @match        https://www.instagram.com/stories/*
// @grant        none
// @updateURL    https://raw.githubusercontent.com/eltoro0815/instagram-single-story-view/master/instagram-single-story.user.js
// @downloadURL  https://raw.githubusercontent.com/eltoro0815/instagram-single-story-view/master/instagram-single-story.user.js
// ==/UserScript==

(function() {
    'use strict';

    // Konfiguration
    const RETRY_INTERVAL = 150; // ms
    const MAX_RETRIES = 50;
    const DEBUG = true; // Debug-Modus für ausführlichere Logausgaben

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
     * Überprüft, ob es sich um eine Story-URL handelt
     * @returns {boolean}
     */
    function isStoryPage() {
        return window.location.pathname.startsWith('/stories/');
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
        // Prüfen auf Navigations-Elemente, die typisch für das Karussell sind
        const nextStoryBtn = document.querySelector('button[aria-label="Weiter"] svg, button[aria-label="Next"] svg, button[aria-label="Nächstes Element"] svg, [aria-label*="next"], [aria-label*="Next"]');
        const prevStoryBtn = document.querySelector('button[aria-label="Zurück"] svg, button[aria-label="Previous"] svg, button[aria-label="Vorheriges Element"] svg, [aria-label*="previous"], [aria-label*="Previous"]');
        
        // Prüfe auf mehrere Fortschrittsbalken/Indikatoren
        const progressBars = document.querySelectorAll('[role="progressbar"], [class*="progress"], [class*="Progress"]');
        const multipleProgressBars = progressBars.length > 1;
        
        // Prüfe auf Story-Ringe oder mehrere Story-Container
        const storyContainers = document.querySelectorAll('[data-visualcompletion="loading-state"], [class*="story"], [class*="Story"]');
        const multipleStoryElements = storyContainers.length > 2;

        const isCarousel = (nextStoryBtn !== null || prevStoryBtn !== null || multipleProgressBars || multipleStoryElements);
        
        debugLog(`Karussell-Erkennung: ${isCarousel} (Nächste: ${nextStoryBtn !== null}, Vorherige: ${prevStoryBtn !== null}, Mehrere Fortschrittsbalken: ${multipleProgressBars}, Mehrere Story-Elemente: ${multipleStoryElements})`);
        
        return isCarousel;
    }

    /**
     * Extrahiert die Story-ID aus dem DOM der aktuellen Seite
     * @returns {string|null}
     */
    function extractStoryIdFromDOM() {
        debugLog("Versuche Story-ID aus DOM zu extrahieren");
        
        // Verbesserte Strategien zur Extraktion der Story-ID
        
        // Strategie 1: Suche nach Bild/Video-Elementen mit src/srcset-Attributen
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
                            return potentialId;
                        }
                    }
                }
            }
        }
        
        // Strategie 2: Suche nach Links, die möglicherweise die Story-ID enthalten
        const links = document.querySelectorAll('a[href*="stories"]');
        debugLog(`Gefundene Story-Links: ${links.length}`);
        
        for (const link of links) {
            debugLog(`Prüfe Link: ${link.href}`);
            const match = link.href.match(/\/stories\/[^\/]+\/(\d+)/);
            if (match && match[1]) {
                debugLog(`ID aus Link extrahiert: ${match[1]}`);
                return match[1];
            }
        }
        
        // Strategie 3: Suche nach data-Attributen, die IDs enthalten könnten
        const allElements = document.querySelectorAll('[data-id], [id*="story"], [class*="story"], [id*="media"], [class*="media"]');
        debugLog(`Elemente mit relevanten Attributen: ${allElements.length}`);
        
        for (const element of allElements) {
            const dataId = element.getAttribute('data-id');
            if (dataId && /^\d+$/.test(dataId)) {
                debugLog(`ID aus data-id Attribut: ${dataId}`);
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
                        return match[1];
                    }
                }
            }
        }
        
        // Strategie 4: Suche in Skript-Tags nach JSON-Daten, die IDs enthalten könnten
        const scripts = document.querySelectorAll('script:not([src])');
        
        for (const script of scripts) {
            const content = script.textContent;
            if (content.includes('stories') && (content.includes('media_id') || content.includes('story_id'))) {
                try {
                    // Suche nach Mustern für JSON-Objekte mit story_id oder media_id
                    const jsonMatch = content.match(/(\{.*"(story_id|media_id)"\s*:\s*"?\d+"?.*\})/);
                    if (jsonMatch) {
                        // Extrahiere ID aus dem gefundenen JSON-Objekt
                        const idMatch = jsonMatch[1].match(/"(story_id|media_id)"\s*:\s*"?(\d+)"?/);
                        if (idMatch && idMatch[2]) {
                            debugLog(`ID aus Script-Tag extrahiert: ${idMatch[2]}`);
                            return idMatch[2];
                        }
                    }
                } catch (e) {
                    debugLog(`Fehler beim Parsen des Skripts: ${e.message}`);
                }
            }
        }
        
        debugLog("Keine Story-ID gefunden");
        return null;
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
        
        const singleViewUrl = `https://www.instagram.com/stories/${username}/${storyId}/`;
        
        // Nur umleiten, wenn wir nicht bereits auf der richtigen URL sind
        if (window.location.href !== singleViewUrl) {
            log(`Leite um zu: ${singleViewUrl}`);
            
            // Verwende history.replaceState anstatt location.href für sanftere Navigation
            try {
                history.replaceState(null, document.title, singleViewUrl);
                
                // Manchmal ist ein vollständiger Seitenneuladen notwendig
                // Füge einen Fallback hinzu, der prüft, ob wir nach kurzem Warten immer noch im Karussell sind
                setTimeout(() => {
                    if (isCarouselView()) {
                        log('Karussell immer noch aktiv nach URL-Änderung, erzwinge Neuladen');
                        window.location.href = singleViewUrl;
                    }
                }, 500);
            } catch (e) {
                log(`Fehler bei history.replaceState: ${e.message}, verwende location.href`);
                window.location.href = singleViewUrl;
            }
        } else {
            log('Bereits auf der korrekten Einzelansicht-URL');
        }
    }

    /**
     * Fügt eine Schaltfläche zur manuellen Umschaltung hinzu
     */
    function addManualToggleButton() {
        // Entferne existierende Buttons zuerst, um Duplikate zu vermeiden
        const existingButton = document.getElementById('single-story-toggle');
        if (existingButton) {
            existingButton.remove();
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
        `;
        
        button.addEventListener('click', () => {
            log('Manueller Wechsel zur Einzelansicht angefordert');
            const username = extractUsername();
            const storyId = extractStoryIdFromDOM();
            
            if (username && storyId) {
                redirectToSingleStoryView(username, storyId);
            } else {
                alert('Konnte keine Story-ID finden. Bitte versuche es später erneut.');
            }
        });
        
        document.body.appendChild(button);
    }

    /**
     * Hauptfunktion zum Verarbeiten der Story-Ansicht
     */
    function processSingleStoryView(retryCount = 0) {
        if (!isStoryPage()) {
            debugLog('Keine Story-Seite, überspringe Verarbeitung');
            return;
        }
        
        debugLog(`Verarbeite Story-Ansicht (Versuch ${retryCount + 1})`);
        
        const username = extractUsername();
        if (!username) {
            log('Konnte keinen Benutzernamen finden');
            return;
        }
        
        // Wenn wir bereits eine Story-ID in der URL haben, aber es immer noch
        // eine Karussell-Ansicht ist, müssen wir die ID aus dem DOM extrahieren
        const urlStoryId = extractStoryIdFromUrl();
        debugLog(`Story-ID aus URL: ${urlStoryId || 'keine'}`);
        
        // Füge einen manuellen Toggle-Button hinzu, für den Fall dass die Automatik versagt
        addManualToggleButton();
        
        // Warten bis die Seite geladen ist und prüfen, ob es sich um eine Karussell-Ansicht handelt
        if (isCarouselView()) {
            log('Karussell-Ansicht erkannt');
            
            // Versuchen, die aktuelle Story-ID aus dem DOM zu extrahieren
            const domStoryId = extractStoryIdFromDOM();
            
            if (domStoryId) {
                log(`Story-ID aus DOM extrahiert: ${domStoryId}`);
                redirectToSingleStoryView(username, domStoryId);
            } else if (retryCount < MAX_RETRIES) {
                // Wenn keine Story-ID gefunden wurde, erneut versuchen
                log(`Konnte keine Story-ID finden. Versuche erneut (${retryCount + 1}/${MAX_RETRIES})...`);
                setTimeout(() => processSingleStoryView(retryCount + 1), RETRY_INTERVAL);
            } else {
                log('Maximale Anzahl an Versuchen erreicht. Konnte keine Story-ID finden.');
            }
        } else if (!urlStoryId) {
            // Wenn wir keine Story-ID in der URL haben, versuchen wir, sie aus dem DOM zu extrahieren
            log('Keine Story-ID in der URL gefunden, versuche aus DOM zu extrahieren');
            
            const domStoryId = extractStoryIdFromDOM();
            if (domStoryId) {
                log(`Story-ID aus DOM extrahiert: ${domStoryId}`);
                redirectToSingleStoryView(username, domStoryId);
            } else if (retryCount < MAX_RETRIES) {
                // Wenn keine Story-ID gefunden wurde, erneut versuchen
                log(`Konnte keine Story-ID finden. Versuche erneut (${retryCount + 1}/${MAX_RETRIES})...`);
                setTimeout(() => processSingleStoryView(retryCount + 1), RETRY_INTERVAL);
            } else {
                log('Maximale Anzahl an Versuchen erreicht. Konnte keine Story-ID finden.');
            }
        } else {
            log('Einzelansicht bereits aktiv');
        }
    }

    // Starten der Hauptfunktion, sobald die Seite geladen ist
    // Warte einen Moment, damit die Seite vollständig geladen ist
    setTimeout(() => {
        processSingleStoryView();
    }, 500);
    
    // MutationObserver, um Änderungen im DOM zu überwachen (z.B. SPA-Navigation)
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.type === 'childList' && isStoryPage()) {
                debugLog('DOM-Änderung erkannt, starte Verarbeitung neu');
                processSingleStoryView();
                break;
            }
        }
    });
    
    // Beobachtung des Body-Elements für Änderungen starten
    observer.observe(document.body, { childList: true, subtree: true });
    
    // Bei Änderungen der URL (History API) ebenfalls die Funktion ausführen
    const originalPushState = history.pushState;
    history.pushState = function() {
        originalPushState.apply(this, arguments);
        debugLog('pushState erkannt');
        setTimeout(() => processSingleStoryView(), 300);
    };
    
    const originalReplaceState = history.replaceState;
    history.replaceState = function() {
        originalReplaceState.apply(this, arguments);
        debugLog('replaceState erkannt');
        setTimeout(() => processSingleStoryView(), 300);
    };
    
    // Reagieren auf popstate-Events (z.B. Zurück-Button im Browser)
    window.addEventListener('popstate', () => {
        debugLog('popstate erkannt');
        setTimeout(() => processSingleStoryView(), 300);
    });

    // Event-Listener für Klicks hinzufügen, um die Verarbeitung auszulösen wenn der Nutzer auf einen Story-Link klickt
    document.addEventListener('click', (event) => {
        // Verzögere die Prüfung um der Navigation Zeit zu geben
        setTimeout(() => {
            if (isStoryPage()) {
                debugLog('Story-Navigation nach Klick erkannt');
                processSingleStoryView();
            }
        }, 300);
    }, true);
})(); 