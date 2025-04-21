// ==UserScript==
// @name         Instagram Single Story View
// @namespace    https://github.com/eltoro0815/instagram-single-story-view
// @version      1.0.8
// @description  Erzwingt die Einzelansicht für Instagram-Stories und verhindert die Karussell-Navigation
// @author       eltoro0815
// @match        https://www.instagram.com/stories/*
// @match        *://*.instagram.com/stories/*
// @grant        none
// @updateURL    https://raw.githubusercontent.com/eltoro0815/instagram-single-story-view/master/instagram-single-story.user.js
// @downloadURL  https://raw.githubusercontent.com/eltoro0815/instagram-single-story-view/master/instagram-single-story.user.js
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';
    
    // Konfiguration
    const DEBUG = true;               // Ausführliche Logs in der Konsole
    const CHECK_INTERVAL = 250;       // Prüfintervall in ms
    const COOLDOWN = 2000;            // Cooldown zwischen Aktionen in ms
    
    // Status-Tracking
    let buttonShown = false;
    let lastActionTime = 0;
    let currentUrl = location.href;
    let mainTimer = null;
    
    // Logger-Funktion
    const log = (...args) => {
        if (DEBUG) {
            console.log('[ISV]', ...args);
        }
    };
    
    // Initialer Log
    log('Instagram Single Story View gestartet', new Date().toISOString());
    log('URL:', window.location.href);
    
    // Hilfsfunktionen
    function isStoryPage() {
        return window.location.pathname.startsWith('/stories/');
    }
    
    function isFullStoryUrl() {
        return /\/stories\/[^\/]+\/\d+/.test(window.location.pathname);
    }
    
    function extractUsername() {
        const match = window.location.pathname.match(/\/stories\/([^\/]+)/);
        return match ? match[1] : null;
    }
    
    function extractStoryId() {
        // Aus URL extrahieren
        const match = window.location.pathname.match(/\/stories\/[^\/]+\/(\d+)/);
        if (match && match[1]) {
            log('Story-ID aus URL gefunden:', match[1]);
            return match[1];
        }
        
        // In DOM nach Medien-URLs suchen
        log('Suche Story-ID in Medien-Elementen');
        const mediaElements = document.querySelectorAll('img[srcset], video source, img[src], video');
        
        for (const element of mediaElements) {
            const src = element.src || element.srcset || '';
            if (!src) continue;
            
            log('Prüfe Medien-URL:', src);
            
            // Verschiedene Muster für die Story-ID
            const patterns = [
                /\/stories\/[^\/]+\/(\d+)/, // Story URL Format
                /stories%2F[^%]+%2F(\d+)/,  // Encoded Story URL
                /(\d{15,25})/              // Lange Zahlen sind oft IDs
            ];
            
            for (const pattern of patterns) {
                const match = src.match(pattern);
                if (match && match[1]) {
                    // Prüfen, ob die ID plausibel ist (Instagram IDs sind meist 15-25 Ziffern lang)
                    if (match[1].length >= 5 && match[1].length <= 25) {
                        log('Story-ID in Medien-Element gefunden:', match[1]);
                        return match[1];
                    }
                }
            }
        }
        
        log('Keine Story-ID gefunden');
        return null;
    }
    
    function isKarusellView() {
        // Bei URL ohne Story-ID ist es immer ein Karussell
        if (!isFullStoryUrl()) {
            log('URL ohne Story-ID - definitiv ein Karussell');
            return true;
        }
        
        // Prüfen auf typische Karussell-Elemente
        const nextStoryBtn = document.querySelector('button[aria-label="Weiter"], button[aria-label="Next"], [aria-label*="next"], [aria-label*="Next"]');
        const prevStoryBtn = document.querySelector('button[aria-label="Zurück"], button[aria-label="Previous"], [aria-label*="previous"], [aria-label*="Previous"]');
        
        // Prüfe auf mehrere Fortschrittsbalken
        const progressBars = document.querySelectorAll('[role="progressbar"], [class*="progress"], [class*="Progress"]');
        
        const isCarousel = (nextStoryBtn !== null || prevStoryBtn !== null || progressBars.length > 1);
        
        const elementsFound = [];
        if (nextStoryBtn !== null) elementsFound.push("Nächste-Button");
        if (prevStoryBtn !== null) elementsFound.push("Vorherige-Button");
        if (progressBars.length > 1) elementsFound.push(`${progressBars.length} Fortschrittsbalken`);
        
        log(`Karussell-Erkennung: ${isCarousel}`, elementsFound.length > 0 ? `(${elementsFound.join(', ')})` : '(keine Elemente gefunden)');
        
        return isCarousel;
    }
    
    function addSingleViewButton() {
        // Nicht doppelt hinzufügen
        if (buttonShown || document.getElementById('isv-button')) {
            return;
        }
        
        log('Füge Button hinzu');
        
        // Button erstellen
        const button = document.createElement('button');
        button.id = 'isv-button';
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
            transition: opacity 0.3s;
        `;
        
        // Klick-Handler
        button.addEventListener('click', function() {
            const now = Date.now();
            if (now - lastActionTime < COOLDOWN) {
                log(`Aktion zu schnell nach letzter Aktion. Warte ${COOLDOWN}ms.`);
                return;
            }
            
            log('Button geklickt');
            button.disabled = true;
            button.style.opacity = '0.5';
            button.textContent = 'Wird geladen...';
            
            const username = extractUsername();
            const storyId = extractStoryId();
            
            if (username && storyId) {
                log(`Leite um zu Einzelansicht: ${username}/${storyId}`);
                lastActionTime = now;
                window.location.href = `https://www.instagram.com/stories/${username}/${storyId}/`;
            } else {
                button.textContent = 'Fehler: Keine Story-ID gefunden';
                button.style.opacity = '1';
                button.disabled = false;
                setTimeout(() => {
                    button.textContent = 'Zur Einzelansicht';
                }, 2000);
                log('Keine Story-ID oder Username gefunden für Umleitung');
            }
        });
        
        // Button zum DOM hinzufügen
        document.body.appendChild(button);
        buttonShown = true;
    }
    
    function removeSingleViewButton() {
        const button = document.getElementById('isv-button');
        if (button) {
            button.remove();
            buttonShown = false;
            log('Button entfernt');
        }
    }
    
    function checkForStoryAndAddButton() {
        if (!isStoryPage()) {
            log('Keine Story-Seite');
            removeSingleViewButton();
            return;
        }
        
        log('Story-Seite erkannt');
        
        // Prüfe, ob es sich um ein Karussell handelt
        if (isKarusellView()) {
            log('Karussell-Ansicht erkannt');
            addSingleViewButton();
        } else {
            log('Einzelansicht erkannt');
            removeSingleViewButton();
        }
    }
    
    // Hauptfunktion
    function init() {
        log('Initialisiere');
        
        // Wenn DOM noch nicht geladen, warten
        if (document.readyState === 'loading') {
            log('Dokument wird noch geladen, warte auf DOMContentLoaded');
            document.addEventListener('DOMContentLoaded', onReady);
        } else {
            log('Dokument bereits geladen');
            onReady();
        }
    }
    
    function onReady() {
        log('DOM bereit, starte Überwachung');
        
        // Initiale Prüfung
        setTimeout(checkForStoryAndAddButton, 500);
        
        // Regelmäßige Prüfung
        mainTimer = setInterval(() => {
            // URL-Änderung erkennen
            if (currentUrl !== location.href) {
                log('URL hat sich geändert', currentUrl, '->', location.href);
                currentUrl = location.href;
                buttonShown = false;
            }
            
            checkForStoryAndAddButton();
        }, CHECK_INTERVAL);
        
        // URL-Änderungen überwachen (History API)
        const originalPushState = history.pushState;
        history.pushState = function() {
            originalPushState.apply(this, arguments);
            
            log('pushState erkannt');
            currentUrl = location.href;
            buttonShown = false;
            setTimeout(checkForStoryAndAddButton, 500);
        };
        
        // Zurück-Button überwachen
        window.addEventListener('popstate', () => {
            log('popstate erkannt');
            currentUrl = location.href;
            buttonShown = false;
            setTimeout(checkForStoryAndAddButton, 500);
        });
    }
    
    // Skript starten
    init();
})(); 