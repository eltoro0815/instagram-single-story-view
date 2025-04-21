// ==UserScript==
// @name         Instagram Single Story View
// @namespace    https://github.com/eltoro0815/instagram-single-story-view
// @version      1.0.41
// @description  Erzwingt die Einzelansicht für Instagram-Stories und verhindert die Karussell-Navigation
// @author       eltoro0815
// @match        https://www.instagram.com/stories/*
// @match        *://*.instagram.com/stories/*
// @match        https://www.instagram.com/*
// @match        *://*.instagram.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_info
// @updateURL    https://raw.githubusercontent.com/eltoro0815/instagram-single-story-view/master/instagram-single-story.user.js
// @downloadURL  https://raw.githubusercontent.com/eltoro0815/instagram-single-story-view/master/instagram-single-story.user.js
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    // Konfigurationsvariablen
    const CHECK_INTERVAL = GM_getValue('CHECK_INTERVAL', 250); // Prüfintervall in ms
    const COOLDOWN = GM_getValue('COOLDOWN', 2000);          // Cooldown zwischen Aktionen in ms
    const BUTTON_ADD_DELAY = 500;                            // Verzögerung beim Hinzufügen des Buttons in ms
    const DEBUG_MODE = true;                                 // Debug-Modus aktivieren
    
    // Status-Tracking
    let buttonShown = false;
    let lastActionTime = 0;
    let debugInfo = {};

    // Logger-Funktion für wichtige Statusänderungen
    function logStatus(...args) {
        if (args[0] === 'DEBUG' && !DEBUG_MODE) return;
        console.log('[ISV]', ...args);
        
        // In DEBUG_MODE speichern wir zusätzliche Informationen
        if (DEBUG_MODE) {
            const timestamp = new Date().toISOString();
            if (!debugInfo.logs) debugInfo.logs = [];
            debugInfo.logs.push({
                timestamp,
                message: args.join(' ')
            });
        }
    }

    // Debug-Informationen in die Seite einfügen
    function injectDebugInfo() {
        if (!DEBUG_MODE) return;
        
        const existingDebug = document.getElementById('isv-debug-panel');
        if (existingDebug) {
            existingDebug.remove();
        }
        
        // Aktuelle Device-Informationen sammeln
        debugInfo.userAgent = navigator.userAgent;
        debugInfo.screenWidth = window.innerWidth;
        debugInfo.screenHeight = window.innerHeight;
        debugInfo.isMobileDetected = isMobileDevice();
        debugInfo.url = window.location.href;
        debugInfo.buttonShown = buttonShown;
        debugInfo.isKarusellViewResult = isKarusellView();
        
        const debugPanel = document.createElement('div');
        debugPanel.id = 'isv-debug-panel';
        debugPanel.style.cssText = `
            position: fixed;
            bottom: 10px;
            left: 10px;
            z-index: 2147483646;
            background: rgba(0, 0, 0, 0.8);
            color: #0f0;
            border: 1px solid #0f0;
            border-radius: 4px;
            padding: 8px;
            font-size: 10px;
            font-family: monospace;
            max-height: 200px;
            overflow-y: auto;
            width: 280px;
            pointer-events: auto;
        `;
        
        let debugContent = `<p>ISV Debug v${GM_info.script.version}</p>`;
        debugContent += `<p>UA: ${debugInfo.userAgent.slice(0, 50)}...</p>`;
        debugContent += `<p>Screen: ${debugInfo.screenWidth}x${debugInfo.screenHeight}</p>`;
        debugContent += `<p>Mobile: ${debugInfo.isMobileDetected}</p>`;
        debugContent += `<p>Button shown: ${debugInfo.buttonShown}</p>`;
        debugContent += `<p>Karusell: ${debugInfo.isKarusellViewResult}</p>`;
        debugContent += `<p>URL: ${debugInfo.url.slice(0, 40)}...</p>`;
        
        if (debugInfo.logs && debugInfo.logs.length > 0) {
            debugContent += `<p>---Logs (${debugInfo.logs.length})---</p>`;
            debugInfo.logs.slice(-10).forEach(log => {
                debugContent += `<p>${log.timestamp.slice(11, 19)}: ${log.message}</p>`;
            });
        }
        
        debugPanel.innerHTML = debugContent;
        document.body.appendChild(debugPanel);
        
        // Klick-Handler zum Anzeigen aller Logs
        debugPanel.addEventListener('click', function() {
            console.log('ISV Full Debug Info:', debugInfo);
            alert('Debug-Infos wurden in die Konsole geschrieben');
        });
    }

    // Überprüfen, ob es sich um ein mobiles Gerät handelt (verbesserte Version)
    function isMobileDevice() {
        // 1. User-Agent Check
        const uaCheck = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        // 2. Viewport-Breite Check
        const viewportCheck = window.innerWidth <= 768;
        
        // 3. Touch Points Check
        const touchCheck = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        
        // 4. Media Query Check
        const mqCheck = window.matchMedia("(max-width: 768px)").matches;
        
        logStatus('DEBUG', `Mobile Detection: UA=${uaCheck}, Viewport=${viewportCheck}, Touch=${touchCheck}, MQ=${mqCheck}`);
        
        // Wir betrachten ein Gerät als mobil, wenn mindestens zwei der Checks positiv sind
        const isMobile = [uaCheck, viewportCheck, touchCheck, mqCheck].filter(Boolean).length >= 2;
        
        return isMobile;
    }

    // Hilfsfunktionen
    function extractUsername() {
        const match = window.location.pathname.match(/\/stories\/([^\/]+)/);
        return match ? match[1] : null;
    }

    // Extrahiere die Story-ID aus der URL
    function extractStoryIdFromUrl() {
        const match = window.location.pathname.match(/\/stories\/[^\/]+\/(\d{19})/);
        if (match && match[1]) {
            logStatus('Story-ID aus URL extrahiert:', match[1]);
            return match[1];
        }
        return null;
    }

    // Extrahiere die Story-ID aus Meta-Tags
    function extractStoryIdFromMeta() {
        const ogUrlMeta = document.querySelector('meta[property="og:url"], meta[name="og:url"]');
        
        if (ogUrlMeta) {
            const content = ogUrlMeta.getAttribute('content') || '';
            if (content) {
                const match = content.match(/\/stories\/[^\/]+\/(\d{19})/);
                if (match && match[1]) {
                    logStatus('Story-ID aus og:url Meta-Tag extrahiert:', match[1]);
                    return match[1];
                }
            }
        }
        return null;
    }

    // Hauptfunktion zur Story-ID-Extraktion
    function extractStoryId() {
        // 1. Zuerst in der aktuellen URL suchen
        const urlStoryId = extractStoryIdFromUrl();
        if (urlStoryId) {
            return urlStoryId;
        }
        
        // 2. Wenn in URL nicht gefunden, im og:url Meta-Tag suchen
        const metaStoryId = extractStoryIdFromMeta();
        if (metaStoryId) {
            return metaStoryId;
        }
        
        // 3. Keine ID gefunden
        logStatus('Keine gültige Story-ID gefunden');
        return null;
    }

    // Prüft, ob wir uns in einer Karussell-Ansicht befinden
    function isKarusellView() {
        // Suche nach typischen Navigationselementen für Stories
        const nextStoryBtn = document.querySelector('button[aria-label="Weiter"], button[aria-label="Next"], [aria-label*="next"], [aria-label*="Next"]');
        const prevStoryBtn = document.querySelector('button[aria-label="Zurück"], button[aria-label="Previous"], [aria-label*="previous"], [aria-label*="Previous"]');
        
        if (nextStoryBtn || prevStoryBtn) {
            // Debug-Info zur gefundenen Navigation
            if (DEBUG_MODE) {
                if (nextStoryBtn) {
                    logStatus('DEBUG', 'Next-Button gefunden:', nextStoryBtn.outerHTML.slice(0, 100));
                }
                if (prevStoryBtn) {
                    logStatus('DEBUG', 'Prev-Button gefunden:', prevStoryBtn.outerHTML.slice(0, 100));
                }
            }
            return true;
        }
        
        // Alternative Erkennung für mobile Seiten
        const storyNavs = document.querySelectorAll('[role="button"]');
        for (const nav of storyNavs) {
            const rect = nav.getBoundingClientRect();
            // Große Buttons an den Seiten sind wahrscheinlich Story-Navigation
            if ((rect.left <= 50 || rect.right >= window.innerWidth - 50) && rect.height > 100) {
                logStatus('DEBUG', 'Alternative Story-Navigation gefunden');
                return true;
            }
        }
        
        // Keine Karussell-Indikatoren gefunden
        return false;
    }

    // Button zum Wechseln zur Einzelansicht
    function addSingleViewButton() {
        // Nicht doppelt hinzufügen
        if (buttonShown || document.getElementById('isv-button')) {
            logStatus('DEBUG', 'Button bereits vorhanden, wird nicht erneut hinzugefügt');
            return;
        }
        
        logStatus('Füge Button hinzu');

        // Prüfen, ob mobiles Gerät
        const isMobile = isMobileDevice();
        logStatus('Gerätetyp: ' + (isMobile ? 'Mobil' : 'Desktop'));

        // Button erstellen
        const button = document.createElement('button');
        button.id = 'isv-button';
        button.textContent = 'Zur Einzelansicht';

        // Extrem hoher z-index sicherstellt, dass der Button über allen Elementen ist
        const zIndexValue = 2147483647; // Höchstmöglicher z-index-Wert (2^31 - 1)

        // CSS je nach Gerätetyp anpassen
        if (isMobile) {
            button.style.cssText = `
                position: fixed;
                bottom: 70px;
                left: 50%;
                transform: translateX(-50%);
                z-index: ${zIndexValue};
                background: rgba(0, 0, 0, 0.8);
                color: white;
                border: none;
                border-radius: 20px;
                padding: 10px 16px;
                font-weight: bold;
                cursor: pointer;
                font-family: Arial, sans-serif;
                transition: opacity 0.3s;
                font-size: 14px;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
                pointer-events: auto !important;
                opacity: 1;
                max-width: 90%;
                overflow: visible;
                display: block !important;
                visibility: visible !important;
            `;
        } else {
            button.style.cssText = `
                position: fixed;
                top: 10px;
                right: 10px;
                z-index: ${zIndexValue};
                background: rgba(0, 0, 0, 0.7);
                color: white;
                border: none;
                border-radius: 4px;
                padding: 8px 12px;
                font-weight: bold;
                cursor: pointer;
                font-family: Arial, sans-serif;
                transition: opacity 0.3s;
                pointer-events: auto !important;
                opacity: 1;
                display: block !important;
                visibility: visible !important;
            `;
        }

        // Klick-Handler
        button.addEventListener('click', function (e) {
            // Verhindern, dass das Event weitergeleitet wird
            e.stopPropagation();
            e.preventDefault();
            
            logStatus('Button geklickt');
            
            const now = Date.now();
            if (now - lastActionTime < COOLDOWN) {
                logStatus(`Aktion zu schnell nach letzter Aktion. Warte ${COOLDOWN}ms.`);
                return;
            }

            button.disabled = true;
            button.style.opacity = '0.5';
            button.textContent = 'Wird geladen...';

            const username = extractUsername();
            const storyId = extractStoryId();

            if (username) {
                if (storyId) {
                    logStatus(`Leite um zu Einzelansicht: ${username}/${storyId}`);
                    lastActionTime = now;
                    window.location.href = `https://www.instagram.com/stories/${username}/${storyId}/`;
                } else {
                    // Wenn keine Story-ID gefunden wurde, navigieren wir zur Benutzerseite ohne ID
                    logStatus(`Keine Story-ID gefunden. Leite zur Benutzerseite um: ${username}`);
                    lastActionTime = now;
                    window.location.href = `https://www.instagram.com/stories/${username}/`;
                }
            } else {
                button.textContent = 'Fehler: Kein Benutzername gefunden';
                button.style.opacity = '1';
                button.disabled = false;
                setTimeout(() => {
                    button.textContent = 'Zur Einzelansicht';
                }, 2000);
                
                // Meldung anzeigen
                alert('Fehler: Kein Benutzername in der URL gefunden!');
                
                logStatus('Kein Benutzername für Umleitung gefunden');
            }
        });

        // Button sofort hinzufügen (für Debugging)
        if (DEBUG_MODE) {
            const testButton = button.cloneNode(true);
            testButton.id = 'isv-test-button';
            testButton.style.bottom = '200px';
            testButton.textContent = 'TEST BUTTON';
            testButton.addEventListener('click', function(e) {
                e.stopPropagation();
                e.preventDefault();
                alert('Test Button funktioniert!');
            });
            document.body.appendChild(testButton);
            logStatus('DEBUG', 'Test-Button wurde direkt hinzugefügt');
        }

        // Button mit Verzögerung hinzufügen, um sicherzustellen, dass alle anderen Elemente bereits geladen sind
        setTimeout(() => {
            try {
                // Button-Container erstellen für bessere z-index-Kontrolle
                const container = document.createElement('div');
                container.id = 'isv-button-container';
                container.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    z-index: ${zIndexValue - 1};
                    pointer-events: none;
                    display: block !important;
                    visibility: visible !important;
                `;
                
                // Button zum Container hinzufügen
                container.appendChild(button);
                
                // Container zum DOM hinzufügen
                document.body.appendChild(container);
                
                buttonShown = true;
                logStatus('Button wurde verzögert hinzugefügt');
                
                // Debug-Informationen in die Seite einfügen
                injectDebugInfo();
            } catch (error) {
                logStatus('FEHLER beim Hinzufügen des Buttons:', error.message);
            }
        }, BUTTON_ADD_DELAY);
        
        // Sicherheitsmaßnahme: Button nach längerer Zeit erneut hinzufügen, falls er nicht angezeigt wird
        setTimeout(() => {
            if (!document.getElementById('isv-button-container') || !document.getElementById('isv-button')) {
                logStatus('DEBUG', 'Button nach Timeout nicht gefunden, füge erneut hinzu');
                try {
                    const fallbackButton = button.cloneNode(true);
                    fallbackButton.id = 'isv-fallback-button';
                    fallbackButton.textContent = 'Zur Einzelansicht (Fallback)';
                    document.body.appendChild(fallbackButton);
                    buttonShown = true;
                    logStatus('Fallback-Button hinzugefügt');
                    
                    // Debug-Informationen in die Seite einfügen
                    injectDebugInfo();
                } catch (error) {
                    logStatus('FEHLER beim Hinzufügen des Fallback-Buttons:', error.message);
                }
            }
        }, 3000);
    }

    // Entferne den Button
    function removeSingleViewButton() {
        const container = document.getElementById('isv-button-container');
        const button = document.getElementById('isv-button');
        const fallbackButton = document.getElementById('isv-fallback-button');
        const testButton = document.getElementById('isv-test-button');
        
        if (container) {
            container.remove();
            logStatus('Button-Container entfernt');
        }
        
        if (button) {
            button.remove();
            logStatus('Button entfernt');
        }
        
        if (fallbackButton) {
            fallbackButton.remove();
            logStatus('Fallback-Button entfernt');
        }
        
        if (testButton) {
            testButton.remove();
            logStatus('Test-Button entfernt');
        }
        
        buttonShown = false;
        logStatus('Button entfernt');
    }

    // Prüfe, ob wir auf einer Story-Seite sind und füge ggf. den Button hinzu
    function checkForStoryAndAddButton() {
        if (!window.location.pathname.startsWith('/stories/')) {
            logStatus('Keine Story-Seite');
            removeSingleViewButton();
            return;
        }
            
        logStatus('Story-Seite erkannt');
        
        // Prüfe, ob es sich um ein Karussell handelt
        const carousel = isKarusellView();
        
        if (carousel) {
            logStatus('Karussell-Ansicht erkannt');
            if (!buttonShown) {
                logStatus('Karussell-Modus: Füge Button hinzu');
                addSingleViewButton();
            }
        } else {
            logStatus('Einzelansicht erkannt');
            if (buttonShown) {
                logStatus('Einzelansicht: Entferne Button');
                removeSingleViewButton();
            }
        }
        
        // Debug-Informationen aktualisieren
        if (DEBUG_MODE && document.body) {
            injectDebugInfo();
        }
    }

    // Hauptfunktion
    function init() {
        logStatus('Initialisiere');
        
        // Skript-Informationen loggen
        logStatus('Version:', GM_info.script.version);
        logStatus('UserAgent:', navigator.userAgent);
        
        // Wenn DOM noch nicht geladen, warten
        if (document.readyState === 'loading') {
            logStatus('Dokument wird noch geladen, warte auf DOMContentLoaded');
            document.addEventListener('DOMContentLoaded', onReady);
        } else {
            logStatus('Dokument bereits geladen');
            onReady();
        }
        
        // Regelmäßige Prüfung, ob der Button hinzugefügt werden muss
        setInterval(() => {
            if (window.location.pathname.startsWith('/stories/')) {
                checkForStoryAndAddButton();
            }
        }, CHECK_INTERVAL);
    }

    // DOM ist bereit
    function onReady() {
        try {
            logStatus('DOM bereit');
            
            // Prüfe, ob wir auf einer Story-Seite sind
            if (window.location.href.includes("/stories/")) {
                logStatus('Story-Seite erkannt, initialisiere...');
                checkForStoryAndAddButton();
            }
            
            // Überwache URL-Änderungen
            observeUrlChanges();
            
            // Debug-Informationen anzeigen, wenn im Debug-Modus
            if (DEBUG_MODE) {
                injectDebugInfo();
            }
        } catch (error) {
            logStatus('Fehler in onReady:', error.message);
        }
    }

    // Überwache URL-Änderungen
    function observeUrlChanges() {
        // Überwache Navigation-Events
        const pushState = history.pushState;
        history.pushState = function() {
            pushState.apply(history, arguments);
            handleUrlChange();
        };
        
        window.addEventListener('popstate', handleUrlChange);
        
        // Initial aufrufen
        handleUrlChange();
    }

    // Behandle URL-Änderungen
    function handleUrlChange() {
        try {
            const url = window.location.href;
            logStatus('URL geändert:', url);
            
            // Prüfe, ob wir auf einer Story-Seite sind
            if (url.includes("/stories/")) {
                logStatus('Story-Seite nach URL-Änderung erkannt');
                checkForStoryAndAddButton();
            }
        } catch (error) {
            logStatus('Fehler in handleUrlChange:', error.message);
        }
    }

    // Überwache DOM-Mutationen für dynamische Änderungen
    function observeDOMChanges() {
        if (!('MutationObserver' in window)) {
            logStatus('MutationObserver wird von diesem Browser nicht unterstützt');
            return;
        }
        
        const observer = new MutationObserver(function(mutations) {
            // Wir überprüfen, ob wir auf einer Story-Seite sind und der Button hinzugefügt werden sollte
            if (window.location.pathname.startsWith('/stories/')) {
                checkForStoryAndAddButton();
            }
        });
        
        // Konfiguration des Observers: Beobachte Änderungen am DOM
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        logStatus('DOM-Mutation Observer gestartet');
    }

    // Skript starten
    init();
    
    // Starte den DOM-Observer, sobald der Body verfügbar ist
    if (document.body) {
        observeDOMChanges();
    } else {
        window.addEventListener('DOMContentLoaded', observeDOMChanges);
    }
})(); 