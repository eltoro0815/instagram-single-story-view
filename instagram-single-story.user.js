// ==UserScript==
// @name         Instagram Single Story View
// @namespace    https://github.com/eltoro0815/instagram-single-story-view
// @version      1.0.43
// @description  Erzwingt die Einzelansicht für Instagram-Stories und verhindert die Karussell-Navigation. Button ist verschiebbar.
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
    const COOLDOWN = GM_getValue('COOLDOWN', 2000);          // Cooldown zwischen Aktionen in ms
    const BUTTON_ADD_DELAY = 500;                            // Verzögerung beim Hinzufügen des Buttons in ms
    const DEBUG_MODE = false;                                // Debug-Modus aktivieren
    const BUTTON_DEFAULT_POS_DESKTOP = { top: '10px', left: 'auto', right: '10px', bottom: 'auto' };
    const BUTTON_DEFAULT_POS_MOBILE = { top: 'auto', left: '50%', right: 'auto', bottom: '70px', transform: 'translateX(-50%)' };
    
    // Status-Tracking
    let buttonShown = false;
    let lastActionTime = 0;
    let debugInfo = {};
    let debounceTimer = null;
    const DEBOUNCE_DELAY = 300; // Verzögerung für Debounce
    let isDragging = false;
    let startX, startY, initialLeft, initialTop;
    let buttonElement = null; // Referenz zum Button-Element

    // Logger-Funktion für wichtige Statusänderungen
    function logStatus(...args) {
        if (args[0] === 'DEBUG' && !DEBUG_MODE) return;
        console.log('[ISV]', ...args);
        
        if (DEBUG_MODE) {
            const timestamp = new Date().toISOString();
            if (!debugInfo.logs) debugInfo.logs = [];
            debugInfo.logs.push({
                timestamp,
                message: args.join(' ')
            });
            if (document.getElementById('isv-debug-panel')) {
                injectDebugInfo();
            }
        }
    }

    // Debounce-Funktion
    function debounce(func, delay) {
        return function(...args) {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                func.apply(this, args);
            }, delay);
        };
    }

    // Debug-Informationen in die Seite einfügen (falls DEBUG_MODE = true)
    function injectDebugInfo() {
        if (!DEBUG_MODE || !document.body) return;
        
        const existingDebug = document.getElementById('isv-debug-panel');
        if (existingDebug) existingDebug.remove();
        
        debugInfo.userAgent = navigator.userAgent;
        debugInfo.screenWidth = window.innerWidth;
        debugInfo.screenHeight = window.innerHeight;
        debugInfo.isMobileDetected = isMobileDevice();
        debugInfo.url = window.location.href;
        debugInfo.buttonShown = buttonShown;
        
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

    // Überprüfen, ob es sich um ein mobiles Gerät handelt
    function isMobileDevice() {
        const uaCheck = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const viewportCheck = window.innerWidth <= 768;
        const touchCheck = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        const mqCheck = window.matchMedia("(max-width: 768px)").matches;
        return [uaCheck, viewportCheck, touchCheck, mqCheck].filter(Boolean).length >= 2;
    }

    // Hilfsfunktionen
    function extractUsername() {
        const match = window.location.pathname.match(/\/stories\/([^\/]+)/);
        return match ? match[1] : null;
    }

    function extractStoryIdFromUrl() {
        const match = window.location.pathname.match(/\/stories\/[^\/]+\/(\d{19})/);
        return match ? match[1] : null;
    }

    function extractStoryIdFromMeta() {
        const ogUrlMeta = document.querySelector('meta[property="og:url"], meta[name="og:url"]');
        if (ogUrlMeta) {
            const content = ogUrlMeta.getAttribute('content') || '';
            const match = content.match(/\/stories\/[^\/]+\/(\d{19})/);
            return match ? match[1] : null;
        }
        return null;
    }

    function extractStoryId() {
        return extractStoryIdFromUrl() || extractStoryIdFromMeta();
    }

    // --- Drag & Drop Logik --- 

    function getClientCoords(e) {
        if (e.touches) {
            return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
        return { x: e.clientX, y: e.clientY };
    }

    function onDragStart(e) {
        if (!buttonElement) return;
        // Verhindern, dass Text ausgewählt wird etc.
        e.preventDefault(); 

        isDragging = true;
        const coords = getClientCoords(e);
        startX = coords.x;
        startY = coords.y;

        // Aktuelle Position als Zahl holen (oder 0 wenn nicht gesetzt)
        const style = window.getComputedStyle(buttonElement);
        initialLeft = parseFloat(style.left) || 0;
        initialTop = parseFloat(style.top) || 0;
        
        // Style anpassen während des Ziehens
        buttonElement.style.cursor = 'grabbing';
        buttonElement.style.transition = 'none'; // Deaktiviere Transition während des Ziehens

        // Event Listener für Bewegung und Loslassen an document anhängen
        document.addEventListener('mousemove', onDragMove);
        document.addEventListener('mouseup', onDragEnd);
        document.addEventListener('touchmove', onDragMove, { passive: false }); // passive: false um preventDefault zu erlauben
        document.addEventListener('touchend', onDragEnd);
        logStatus('DEBUG', 'Drag Start');
    }

    function onDragMove(e) {
        if (!isDragging || !buttonElement) return;
        // preventDefault bei touchmove ist wichtig, um das Scrollen der Seite zu verhindern
        if (e.touches) e.preventDefault(); 

        const coords = getClientCoords(e);
        const dx = coords.x - startX;
        const dy = coords.y - startY;

        // Neue Position berechnen
        let newLeft = initialLeft + dx;
        let newTop = initialTop + dy;

        // Sicherstellen, dass der Button im sichtbaren Bereich bleibt (optional, aber empfohlen)
        const rect = buttonElement.getBoundingClientRect();
        newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - rect.width));
        newTop = Math.max(0, Math.min(newTop, window.innerHeight - rect.height));

        // Position aktualisieren
        buttonElement.style.left = `${newLeft}px`;
        buttonElement.style.top = `${newTop}px`;
        // right und bottom zurücksetzen, da left/top jetzt maßgeblich sind
        buttonElement.style.right = 'auto'; 
        buttonElement.style.bottom = 'auto';
        buttonElement.style.transform = 'none'; // Transform zurücksetzen
        logStatus('DEBUG', `Drag Move: dx=${dx}, dy=${dy}, newPos=(${newLeft}, ${newTop})`);
    }

    function onDragEnd(e) {
        if (!isDragging || !buttonElement) return;
        isDragging = false;

        // Event Listener entfernen
        document.removeEventListener('mousemove', onDragMove);
        document.removeEventListener('mouseup', onDragEnd);
        document.removeEventListener('touchmove', onDragMove);
        document.removeEventListener('touchend', onDragEnd);

        // Style zurücksetzen
        buttonElement.style.cursor = 'default'; 
        buttonElement.style.transition = ''; // Transition wieder aktivieren

        // Finale Position speichern
        const finalRect = buttonElement.getBoundingClientRect();
        const finalPos = { top: `${finalRect.top}px`, left: `${finalRect.left}px` };
        GM_setValue('buttonPosition', JSON.stringify(finalPos));
        logStatus('Drag End. Position gespeichert:', finalPos);
    }

    // --- Button Erstellung und Management --- 

    function addSingleViewButton() {
        if (buttonShown || document.getElementById('isv-button-container')) return;
        
        logStatus('Füge Button hinzu');
        const isMobile = isMobileDevice();
        logStatus('Gerätetyp: ' + (isMobile ? 'Mobil' : 'Desktop'));

        // --- Button Container --- 
        buttonElement = document.createElement('div'); // Verwende div als Hauptcontainer
        buttonElement.id = 'isv-button-container';
        const zIndexValue = 2147483647;
        
        // Gespeicherte Position laden oder Standard verwenden
        let savedPos = null;
        try {
            savedPos = JSON.parse(GM_getValue('buttonPosition', null));
        } catch (e) {
            logStatus('Fehler beim Laden der Button-Position:', e);
        }
        const initialPos = savedPos || (isMobile ? BUTTON_DEFAULT_POS_MOBILE : BUTTON_DEFAULT_POS_DESKTOP);

        buttonElement.style.cssText = `
            position: fixed;
            z-index: ${zIndexValue};
            background: rgba(0, 0, 0, ${isMobile ? 0.8 : 0.7});
            color: white;
            border: none;
            border-radius: ${isMobile ? '20px' : '4px'};
            font-family: Arial, sans-serif;
            transition: opacity 0.3s, background-color 0.3s;
            display: flex; /* Flexbox für Griff und Text */
            align-items: center; /* Vertikal zentrieren */
            padding: 0; /* Innenabstand wird von den Kindelementen gesteuert */
            cursor: default; /* Standard-Cursor für den Container */
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
            top: ${initialPos.top};
            left: ${initialPos.left};
            right: ${initialPos.right || 'auto'}; 
            bottom: ${initialPos.bottom || 'auto'};
            transform: ${initialPos.transform || 'none'};
        `;

        // --- Drag Handle (Griff) --- 
        const dragHandle = document.createElement('div');
        dragHandle.id = 'isv-drag-handle';
        dragHandle.style.cssText = `
            padding: ${isMobile ? '10px 8px' : '8px 6px'};
            cursor: move;
            border-right: 1px solid rgba(255, 255, 255, 0.3);
            margin-right: ${isMobile ? '8px' : '6px'};
            user-select: none; /* Verhindert Textauswahl beim Ziehen */
            /* Optional: Visueller Indikator (z.B. Punkte) */
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            gap: 2px;
        `;
        // Kleine Punkte als visueller Indikator für den Griff
        for (let i = 0; i < 3; i++) {
            const dot = document.createElement('span');
            dot.style.cssText = 'width: 3px; height: 3px; background-color: rgba(255, 255, 255, 0.7); border-radius: 50%;';
            dragHandle.appendChild(dot);
        }

        // Event Listener NUR an den Griff hängen
        dragHandle.addEventListener('mousedown', onDragStart);
        dragHandle.addEventListener('touchstart', onDragStart, { passive: false });
        
        // --- Click Area (Text) --- 
        const clickArea = document.createElement('span');
        clickArea.id = 'isv-click-area';
        clickArea.textContent = 'Zur Einzelansicht';
        clickArea.style.cssText = `
            padding: ${isMobile ? '10px 16px 10px 0' : '8px 12px 8px 0'}; /* Padding nur rechts/oben/unten */
            font-weight: bold;
            cursor: pointer;
            font-size: ${isMobile ? '14px' : 'inherit'};
            flex-grow: 1; /* Nimmt verfügbaren Platz ein */
            text-align: center;
        `;

        // Klick-Handler NUR an den Textbereich hängen
        clickArea.addEventListener('click', function (e) {
            // Nur ausführen, wenn nicht gerade gezogen wird
            if (isDragging) {
                logStatus('DEBUG', 'Click verhindert, da gerade gezogen wird.');
                return;
            }
            
            logStatus('Button geklickt');
            const now = Date.now();
            if (now - lastActionTime < COOLDOWN) {
                logStatus(`Aktion zu schnell nach letzter Aktion. Warte ${COOLDOWN}ms.`);
                return;
            }

            buttonElement.style.opacity = '0.5';
            clickArea.textContent = 'Wird geladen...'; // Nur Text ändern

            const username = extractUsername();
            const storyId = extractStoryId();
            lastActionTime = now;

            if (username) {
                const targetUrl = storyId 
                    ? `https://www.instagram.com/stories/${username}/${storyId}/` 
                    : `https://www.instagram.com/stories/${username}/`;
                logStatus(`Leite um zu: ${targetUrl}`);
                window.location.href = targetUrl;
            } else {
                logStatus('Fehler: Kein Benutzername gefunden für Umleitung');
                alert('Fehler: Kein Benutzername in der URL gefunden!');
                // Style zurücksetzen bei Fehler
                buttonElement.style.opacity = '1';
                clickArea.textContent = 'Zur Einzelansicht';
            }
        });

        // --- Elemente zusammensetzen ---
        buttonElement.appendChild(dragHandle);
        buttonElement.appendChild(clickArea);

        // --- Button zum DOM hinzufügen (verzögert) ---
        setTimeout(() => {
            try {
                if (document.body) {
                    document.body.appendChild(buttonElement);
                    buttonShown = true;
                    logStatus('Button wurde hinzugefügt');
                    injectDebugInfo();
                } else {
                    logStatus('FEHLER: document.body nicht gefunden beim Hinzufügen des Buttons.');
                }
            } catch (error) {
                logStatus('FEHLER beim Hinzufügen des Buttons:', error.message);
            }
        }, BUTTON_ADD_DELAY);
    }

    function removeSingleViewButton() {
        if (buttonElement) {
            buttonElement.remove();
            buttonElement = null; // Referenz löschen
            logStatus('Button entfernt');
        }
        if (buttonShown) {
            buttonShown = false;
            logStatus('Button-Status: entfernt');
            injectDebugInfo();
        }
    }

    // Prüfe, ob wir auf einer Story-Seite sind und füge ggf. den Button hinzu
    const debouncedCheckForStoryAndAddButton = debounce(function() {
        const isOnStoryPage = window.location.pathname.startsWith('/stories/');
        logStatus('DEBUG', `Debounced Check: isOnStoryPage=${isOnStoryPage}, buttonShown=${buttonShown}`);

        if (isOnStoryPage) {
            if (!buttonShown) {
                logStatus('Füge Button hinzu (debounced)');
                addSingleViewButton();
            }
        } else {
            if (buttonShown) {
                logStatus('Entferne Button (debounced)');
                removeSingleViewButton();
            }
        }
        if (DEBUG_MODE && document.body) injectDebugInfo();
    }, DEBOUNCE_DELAY);

    // Hauptfunktion
    function init() {
        logStatus('Initialisiere ISV v' + GM_info.script.version);
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', onReady);
        } else {
            onReady();
        }
    }

    // DOM ist bereit
    function onReady() {
        try {
            logStatus('DOM bereit');
            debouncedCheckForStoryAndAddButton(); // Initialer Check
            observeUrlChanges(); // URL Beobachtung starten
            if (DEBUG_MODE) injectDebugInfo();
        } catch (error) {
            logStatus('Fehler in onReady:', error.message);
        }
    }

    // Überwache URL-Änderungen
    function observeUrlChanges() {
        let lastUrl = location.href;
        logStatus('URL Observer gestartet');
        
        const handleUrlChange = () => {
            const currentUrl = location.href;
            if (currentUrl !== lastUrl) {
                 logStatus('URL geändert:', currentUrl);
                 lastUrl = currentUrl;
                 debouncedCheckForStoryAndAddButton();
            }
        };

        const historyPushState = history.pushState;
        history.pushState = function() { historyPushState.apply(history, arguments); handleUrlChange(); };
        const historyReplaceState = history.replaceState;
        history.replaceState = function() { historyReplaceState.apply(history, arguments); handleUrlChange(); };
        window.addEventListener('popstate', handleUrlChange);
        
        // Head Observer für robustere Erkennung
        if ('MutationObserver' in window && document.head) {
             const headObserver = new MutationObserver(handleUrlChange);
             headObserver.observe(document.head, { childList: true, subtree: true });
        }
        handleUrlChange(); // Initialer Check
    }

    // Skript starten
    init();
})(); 