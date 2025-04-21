// ==UserScript==
// @name         Instagram Single Story View
// @namespace    https://github.com/eltoro0815/instagram-single-story-view
// @version      1.0.38
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
    
    // Status-Tracking
    let buttonShown = false;
    let lastActionTime = 0;

    // Logger-Funktion für wichtige Statusänderungen
    function logStatus(...args) {
        console.log('[ISV]', ...args);
    }

    // Überprüfen, ob es sich um ein mobiles Gerät handelt
    function isMobileDevice() {
        return (
            /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
            window.innerWidth <= 768
        );
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
            return true;
        }
        
        // Keine Karussell-Indikatoren gefunden
        return false;
    }

    // Button zum Wechseln zur Einzelansicht
    function addSingleViewButton() {
        // Nicht doppelt hinzufügen
        if (buttonShown || document.getElementById('isv-button')) {
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
            `;
        }

        // Klick-Handler
        button.addEventListener('click', function (e) {
            // Verhindern, dass das Event weitergeleitet wird
            e.stopPropagation();
            e.preventDefault();
            
            const now = Date.now();
            if (now - lastActionTime < COOLDOWN) {
                logStatus(`Aktion zu schnell nach letzter Aktion. Warte ${COOLDOWN}ms.`);
                return;
            }

            logStatus('Button geklickt');
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

        // Button mit Verzögerung hinzufügen, um sicherzustellen, dass alle anderen Elemente bereits geladen sind
        setTimeout(() => {
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
            `;
            
            // Button zum Container hinzufügen
            container.appendChild(button);
            
            // Container zum DOM hinzufügen
            document.body.appendChild(container);
            
            buttonShown = true;
            logStatus('Button wurde verzögert hinzugefügt');
        }, BUTTON_ADD_DELAY);
    }

    // Entferne den Button
    function removeSingleViewButton() {
        const container = document.getElementById('isv-button-container');
        if (container) {
            container.remove();
            buttonShown = false;
            logStatus('Button entfernt');
        }
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
    }

    // Hauptfunktion
    function init() {
        logStatus('Initialisiere');
        
        // Wenn DOM noch nicht geladen, warten
        if (document.readyState === 'loading') {
            logStatus('Dokument wird noch geladen, warte auf DOMContentLoaded');
            document.addEventListener('DOMContentLoaded', onReady);
        } else {
            logStatus('Dokument bereits geladen');
            onReady();
        }
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

    // Skript starten
    init();
})(); 