// ==UserScript==
// @name         Instagram Single Story View
// @namespace    https://github.com/eltoro0815/instagram-single-story-view
// @version      1.0.0
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
   //...
    const RETRY_INTERVAL = 100; // ms
    const MAX_RETRIES = 50;

    // Logger-Funktion für Debug-Zwecke
    const log = (message) => {
        console.log(`[Instagram Single Story] ${message}`);
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
        const nextStoryBtn = document.querySelector('button[aria-label="Weiter"] svg, button[aria-label="Next"] svg');
        const prevStoryBtn = document.querySelector('button[aria-label="Zurück"] svg, button[aria-label="Previous"] svg');
        
        // Alternativ: Prüfe auf mehrere Story-Container
        const multipleStoryContainers = document.querySelectorAll('[role="progressbar"]').length > 1;
        
        return (nextStoryBtn !== null || prevStoryBtn !== null || multipleStoryContainers);
    }

    /**
     * Extrahiert die Story-ID aus dem DOM der aktuellen Seite
     * @returns {string|null}
     */
    function extractStoryIdFromDOM() {
        // Versuchen, die Story-ID aus dem DOM zu extrahieren
        // Instagram speichert die ID oft in data-Attributen oder als Teil der Medien-URLs
        
        // Versuch 1: Suche nach Bild/Video-Elementen, die die Story darstellen
        const mediaElements = document.querySelectorAll('img[srcset], video source');
        for (const element of mediaElements) {
            const src = element.src || element.srcset;
            if (src) {
                const match = src.match(/\/(\d+)_\d+_\d+/);
                if (match && match[1]) {
                    return match[1];
                }
            }
        }
        
        // Versuch 2: Suche nach Links, die möglicherweise die Story-ID enthalten
        const links = document.querySelectorAll('a[href*="stories"]');
        for (const link of links) {
            const match = link.href.match(/\/stories\/[^\/]+\/(\d+)/);
            if (match && match[1]) {
                return match[1];
            }
        }
        
        return null;
    }

    /**
     * Leitet zur Einzelansicht der Story um
     * @param {string} username 
     * @param {string} storyId 
     */
    function redirectToSingleStoryView(username, storyId) {
        const singleViewUrl = `https://www.instagram.com/stories/${username}/${storyId}/`;
        
        // Nur umleiten, wenn wir nicht bereits auf der richtigen URL sind
        if (window.location.href !== singleViewUrl) {
            log(`Leite um zu: ${singleViewUrl}`);
            window.location.href = singleViewUrl;
        }
    }

    /**
     * Hauptfunktion zum Verarbeiten der Story-Ansicht
     */
    function processSingleStoryView(retryCount = 0) {
        if (!isStoryPage()) return;
        
        const username = extractUsername();
        if (!username) {
            log('Konnte keinen Benutzernamen finden');
            return;
        }
        
        // Wenn wir bereits eine Story-ID in der URL haben, aber es immer noch
        // eine Karussell-Ansicht ist, müssen wir die ID aus dem DOM extrahieren
        const urlStoryId = extractStoryIdFromUrl();
        
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
    processSingleStoryView();
    
    // MutationObserver, um Änderungen im DOM zu überwachen (z.B. SPA-Navigation)
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.type === 'childList' && isStoryPage()) {
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
        processSingleStoryView();
    };
    
    const originalReplaceState = history.replaceState;
    history.replaceState = function() {
        originalReplaceState.apply(this, arguments);
        processSingleStoryView();
    };
    
    // Reagieren auf popstate-Events (z.B. Zurück-Button im Browser)
    window.addEventListener('popstate', () => {
        processSingleStoryView();
    });
})(); 