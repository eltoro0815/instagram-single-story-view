// ==UserScript==
// @name         Instagram Single Story View
// @namespace    https://github.com/eltoro0815/instagram-single-story-view
// @version      1.0.14
// @description  Erzwingt die Einzelansicht für Instagram-Stories und verhindert die Karussell-Navigation
// @author       eltoro0815
// @match        https://www.instagram.com/stories/*
// @match        *://*.instagram.com/stories/*
// @match        https://www.instagram.com/*
// @match        *://*.instagram.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @updateURL    https://raw.githubusercontent.com/eltoro0815/instagram-single-story-view/master/instagram-single-story.user.js
// @downloadURL  https://raw.githubusercontent.com/eltoro0815/instagram-single-story-view/master/instagram-single-story.user.js
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    // Konfiguration aus GM_getValue mit Standardwerten
    const getConfig = (key, defaultValue) => {
        return GM_getValue(key, defaultValue);
    };

    // Konfiguration speichern
    const saveConfig = (key, value) => {
        GM_setValue(key, value);
        return value;
    };

    // Konfigurationsvariablen
    let DEBUG = getConfig('DEBUG', true);                // Ausführliche Logs in der Konsole
    let CHECK_INTERVAL = getConfig('CHECK_INTERVAL', 250); // Prüfintervall in ms
    let COOLDOWN = getConfig('COOLDOWN', 2000);          // Cooldown zwischen Aktionen in ms
    let RESEARCH_MODE = getConfig('RESEARCH_MODE', true); // Aktiviert den Research-Modus
    let FORCE_RESEARCH = getConfig('FORCE_RESEARCH', true); // Erzwingt die Durchführung des Research-Modus

    // Status-Tracking
    let buttonShown = false;
    let lastActionTime = 0;
    let currentUrl = location.href;
    let mainTimer = null;
    let lastStatusMessages = {};     // Für das Tracking wiederholter Nachrichten
    let researchDone = false;        // Vermeidet wiederholte Research-Ausführungen
    let researchButtonAdded = false; // Verfolgt, ob der Research-Button bereits hinzugefügt wurde

    // Logger-Funktion
    const log = (...args) => {
        if (DEBUG) {
            // Nur für einfache Meldungen ohne Objekte
            if (args.length === 1) {
                const message = args[0];
                if (lastStatusMessages[message] === true) {
                    // Wiederholte Meldung nicht erneut ausgeben
                    return;
                }
                lastStatusMessages[message] = true;
            } else if (args.length === 2 && typeof args[1] === 'string') {
                // Für Meldungen mit einem zusätzlichen String-Parameter
                const key = args[0] + ' ' + args[1];
                if (lastStatusMessages[key] === true) {
                    // Wiederholte Meldung nicht erneut ausgeben
                    return;
                }
                lastStatusMessages[key] = true;
            }

            console.log('[ISV]', ...args);
        }
    };

    // Wichtige Statusänderungen immer loggen
    const logStatus = (...args) => {
        if (DEBUG) {
            console.log('[ISV]', ...args);
        }
    };

    // Research-Logger - immer ausgeben, um DOM-Strukturen zu analysieren
    const logResearch = (...args) => {
        // Immer in die Konsole schreiben, unabhängig vom DEBUG-Flag
        console.log('[ISV-RESEARCH]', ...args);

        // Speichere alle Research-Ausgaben für die Zwischenablage
        if (!window.isvResearchData) {
            window.isvResearchData = [];
        }

        // Formatierte Ausgabe hinzufügen
        window.isvResearchData.push('[ISV-RESEARCH] ' + args.map(arg => {
            if (typeof arg === 'object') {
                try {
                    return JSON.stringify(arg, null, 2);
                } catch (e) {
                    return String(arg);
                }
            }
            return String(arg);
        }).join(' '));
    };

    // Hilfsfunktion zum Kopieren in die Zwischenablage
    function copyResearchToClipboard() {
        if (!window.isvResearchData || window.isvResearchData.length === 0) {
            console.warn('[ISV] Keine Research-Daten zum Kopieren vorhanden.');
            return;
        }

        // Daten in die Zwischenablage kopieren
        const textToCopy = window.isvResearchData.join('\n');

        try {
            // Moderne Clipboard API
            navigator.clipboard.writeText(textToCopy).then(() => {
                console.log('[ISV] Research-Daten in die Zwischenablage kopiert!');

                // Benachrichtigung anzeigen
                const notification = document.createElement('div');
                notification.textContent = 'Instagram Research-Daten kopiert!';
                notification.style.cssText = `
                    position: fixed;
                    bottom: 20px;
                    left: 20px;
                    background: rgba(0, 0, 0, 0.8);
                    color: white;
                    padding: 10px 15px;
                    border-radius: 4px;
                    z-index: 999999;
                    font-family: Arial, sans-serif;
                `;
                document.body.appendChild(notification);

                // Nach 3 Sekunden ausblenden
                setTimeout(() => {
                    notification.style.opacity = '0';
                    notification.style.transition = 'opacity 0.5s';
                    setTimeout(() => notification.remove(), 500);
                }, 3000);

            }).catch(err => {
                console.error('[ISV] Fehler beim Kopieren in die Zwischenablage:', err);
                // Fallback-Methode bei Fehler
                fallbackCopy(textToCopy);
            });
        } catch (e) {
            // Fallback für ältere Browser
            fallbackCopy(textToCopy);
        }
    }

    // Fallback-Methode
    function fallbackCopy(text) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();

        try {
            document.execCommand('copy');
            console.log('[ISV] Research-Daten in die Zwischenablage kopiert (Fallback-Methode)');

            // Benachrichtigung anzeigen
            const notification = document.createElement('div');
            notification.textContent = 'Instagram Research-Daten kopiert!';
            notification.style.cssText = `
                position: fixed;
                bottom: 20px;
                left: 20px;
                background: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 10px 15px;
                border-radius: 4px;
                z-index: 999999;
                font-family: Arial, sans-serif;
            `;
            document.body.appendChild(notification);

            // Nach 3 Sekunden ausblenden
            setTimeout(() => {
                notification.style.opacity = '0';
                notification.style.transition = 'opacity 0.5s';
                setTimeout(() => notification.remove(), 500);
            }, 3000);

        } catch (e) {
            console.error('[ISV] Fehler beim Kopieren (Fallback):', e);
        }

        document.body.removeChild(textarea);
    }

    // Button zum manuellen Starten des Research-Modus
    function addResearchButton() {
        if (document.getElementById('isv-research-button') || researchButtonAdded) {
            return;
        }
        
        const button = document.createElement('button');
        button.id = 'isv-research-button';
        button.textContent = 'Instagram DOM Research';
        button.style.cssText = `
            position: fixed;
            top: 10px;
            left: 10px;
            z-index: 9999999;
            background: rgba(128, 0, 128, 0.9);
            color: white;
            border: none;
            border-radius: 4px;
            padding: 8px 12px;
            font-weight: bold;
            cursor: pointer;
            font-family: Arial, sans-serif;
            transition: opacity 0.3s;
            box-shadow: 0 2px 5px rgba(0,0,0,0.3);
        `;
        
        button.addEventListener('click', function() {
            researchDone = false;  // Reset, damit es erneut ausgeführt werden kann
            researchInstagramDOM();
        });
        
        // Füge den Button direkt zum body hinzu - Instagram hat manchmal verschachtelte Container
        document.body.appendChild(button);
        researchButtonAdded = true;
        
        // Stelle sicher, dass der Button sichtbar ist
        setTimeout(() => {
            if (document.getElementById('isv-research-button')) {
                document.getElementById('isv-research-button').style.display = 'block';
                logStatus('Research-Button hinzugefügt und sichtbar gemacht');
            }
        }, 500);
    }

    // Funktion, die den Research-Button zur Seite hinzufügt
    function ensureResearchButtonExists() {
        if (RESEARCH_MODE && !researchButtonAdded && document.body) {
            addResearchButton();
            logStatus('Research-Button zur Seite hinzugefügt');
        }
    }

    // Füge den Button so früh wie möglich hinzu
    document.addEventListener('DOMContentLoaded', ensureResearchButtonExists);
    
    // Falls DOMContentLoaded bereits abgefeuert wurde, direkt hinzufügen
    if (document.readyState !== 'loading') {
        ensureResearchButtonExists();
    }
    
    // Periodische Prüfung, ob der Button noch existiert
    setInterval(ensureResearchButtonExists, 2000);

    // Hilfsfunktion zum Sammeln von Klassennamen
    function collectClasses(elements) {
        const classMap = {};
        elements.forEach(el => {
            if (el.className && typeof el.className === 'string') {
                el.className.split(' ').forEach(cls => {
                    if (cls && cls.trim()) {
                        classMap[cls.trim()] = (classMap[cls.trim()] || 0) + 1;
                    }
                });
            }
        });
        return classMap;
    }

    // Führt Research für Instagram-DOM durch
    function researchInstagramDOM() {
        if (researchDone && !FORCE_RESEARCH) return;

        try {
            console.clear(); // Konsole leeren für bessere Übersicht

            // Zurücksetzen der Research-Daten
            window.isvResearchData = [];

            logResearch('---- INSTAGRAM DOM RESEARCH GESTARTET ----');
            logResearch('URL:', window.location.href);
            logResearch('Seitentitel:', document.title);

            // Sammle alle Buttons
            const buttons = document.querySelectorAll('button');
            logResearch(`${buttons.length} Buttons gefunden`);

            // Analysiere ARIA Labels
            const buttonLabels = {};
            buttons.forEach(btn => {
                const label = btn.getAttribute('aria-label');
                if (label) {
                    buttonLabels[label] = (buttonLabels[label] || 0) + 1;
                }
            });
            logResearch('Button ARIA Labels:', buttonLabels);

            // Sammle alle Rollen
            const roles = {};
            document.querySelectorAll('[role]').forEach(el => {
                const role = el.getAttribute('role');
                roles[role] = (roles[role] || 0) + 1;
            });
            logResearch('Rollen im DOM:', roles);

            // Sammle häufige Klassennamen
            const allElements = document.querySelectorAll('*');
            const classMap = collectClasses(allElements);

            // Sortiere nach Häufigkeit
            const sortedClasses = Object.entries(classMap)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 50); // Erhöhen auf 50 für mehr Daten

            logResearch('Top 50 Klassennamen:', sortedClasses);

            // Suche nach Story-spezifischen Elementen
            const classPatterns = [
                /story/i, /carousel/i, /slider/i, /navigation/i, /progress/i,
                /next/i, /prev/i, /swipe/i, /viewer/i, /tray/i, /pager/i, /dots/i
            ];

            const storyRelatedClasses = {};
            Object.keys(classMap).forEach(cls => {
                for (const pattern of classPatterns) {
                    if (pattern.test(cls)) {
                        storyRelatedClasses[cls] = classMap[cls];
                        break;
                    }
                }
            });

            logResearch('Story-bezogene Klassen:', storyRelatedClasses);

            // Finde Navigations-Container
            const potentialNavContainers = [];
            document.querySelectorAll('div').forEach(div => {
                // Prüfe Position und Größe
                const rect = div.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                    // Links- oder rechts-positioniert
                    const isLeftOrRight = (rect.left < 100 || rect.right > window.innerWidth - 100);
                    // Ausreichend hoch
                    const isTallEnough = rect.height > window.innerHeight * 0.3;

                    if (isLeftOrRight && isTallEnough) {
                        potentialNavContainers.push({
                            position: rect.left < 100 ? 'links' : 'rechts',
                            classes: div.className,
                            children: div.children.length,
                            rect: {
                                left: rect.left,
                                top: rect.top,
                                width: rect.width,
                                height: rect.height
                            }
                        });
                    }
                }
            });

            logResearch('Potenzielle Navigations-Container:', potentialNavContainers);

            // Suche nach Fortschrittsanzeigen
            const progressElements = document.querySelectorAll('[role="progressbar"], [class*="progress"], [class*="Progress"]');

            if (progressElements.length > 0) {
                const progressData = Array.from(progressElements).map(el => ({
                    classes: el.className,
                    rect: el.getBoundingClientRect(),
                    parent: el.parentElement ? {
                        classes: el.parentElement.className,
                        childCount: el.parentElement.children.length
                    } : null
                }));

                logResearch(`${progressElements.length} Fortschrittsanzeigen gefunden:`, progressData);
            }

            // Instagram nutzt oft SVG für UI-Elemente
            const svgElements = document.querySelectorAll('svg');
            const svgData = Array.from(svgElements).map(svg => {
                const rect = svg.getBoundingClientRect();
                // Nur relevante SVGs (ignoriere kleine Icons)
                if (rect.width > 20 || rect.height > 20) {
                    return {
                        rect: {
                            left: rect.left,
                            top: rect.top,
                            width: rect.width,
                            height: rect.height
                        },
                        ariaLabel: svg.getAttribute('aria-label'),
                        parentClasses: svg.parentElement ? svg.parentElement.className : null
                    };
                }
                return null;
            }).filter(Boolean);

            logResearch(`${svgData.length} relevante SVG-Elemente gefunden:`, svgData);

            // Identifiziere potenziell wichtige Elemente für die Story-Navigation
            const navElements = [...document.querySelectorAll('button, [role="button"], [tabindex="0"]')];
            const positionedNavElements = navElements.map(el => {
                const rect = el.getBoundingClientRect();
                const isLeftSide = rect.left < window.innerWidth * 0.3;
                const isRightSide = rect.right > window.innerWidth * 0.7;

                if ((isLeftSide || isRightSide) && rect.height > 100) {
                    return {
                        element: el.tagName,
                        position: isLeftSide ? 'links' : 'rechts',
                        classes: el.className,
                        ariaLabel: el.getAttribute('aria-label'),
                        role: el.getAttribute('role'),
                        rect: {
                            left: rect.left,
                            top: rect.top,
                            width: rect.width,
                            height: rect.height
                        }
                    };
                }
                return null;
            }).filter(Boolean);

            logResearch('Potenzielle Navigations-Elemente:', positionedNavElements);

            // Analysiere die DOM-Struktur auf typische Story-Container-Elemente
            const storyContainers = [...document.querySelectorAll('div')].filter(div => {
                const className = div.className || '';
                return /story|viewer|carousel|swipe|slider|tray/i.test(className);
            }).map(el => ({
                tagName: el.tagName,
                classes: el.className,
                children: el.children.length,
                rect: el.getBoundingClientRect()
            }));

            logResearch('Story-Container-Elemente:', storyContainers);

            // Analysiere strukturierte Elemente mit mehreren Kindern (könnte ein Indikator für Stories sein)
            const multiChildElements = [...document.querySelectorAll('div, section, nav')].filter(el =>
                el.children.length > 3 && el.children.length < 20
            ).map(el => ({
                tagName: el.tagName,
                classes: el.className,
                childCount: el.children.length,
                rect: el.getBoundingClientRect()
            }));

            logResearch('Strukturierte Container mit mehreren Kindern:', multiChildElements.slice(0, 20));

            logResearch('---- INSTAGRAM DOM RESEARCH ABGESCHLOSSEN ----');

            // In die Zwischenablage kopieren
            setTimeout(copyResearchToClipboard, 500);

            researchDone = true;
        } catch (error) {
            logResearch('Fehler beim DOM Research:', error.message);
        }
    }

    // Initialer Log
    logStatus('Instagram Single Story View gestartet', new Date().toISOString());
    logStatus('URL:', window.location.href);

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
        logStatus('Analysiere DOM für Karussell-Erkennung...');
        
        // Instagram verwendet ein SPA-Framework, daher können wir nicht auf URLs vertrauen
        // Wir müssen die DOM-Struktur analysieren
        
        try {
            // 1. Direkte Karussell-Indikatoren suchen
            // 1.1 Prüfen auf typische Story-Navigation-Elemente anhand von aria-labels
            const nextStoryBtn = document.querySelector('button[aria-label="Weiter"], button[aria-label="Next"], [aria-label*="next"], [aria-label*="Next"], [aria-label="Weiter"], [aria-label="Next"]');
            const prevStoryBtn = document.querySelector('button[aria-label="Zurück"], button[aria-label="Previous"], [aria-label*="previous"], [aria-label*="Previous"], [aria-label="Zurück"], [aria-label="Previous"], [aria-label="Vorherige"], [aria-label="Vorherige"]');
            
            // 1.2 Suche auch nach SVG-Elementen mit diesen Labels (Research zeigt, dass diese oft vorhanden sind)
            const nextSvgIcon = document.querySelector('svg[aria-label="Weiter"], svg[aria-label="Next"]');
            const prevSvgIcon = document.querySelector('svg[aria-label="Zurück"], svg[aria-label="Previous"], svg[aria-label="Vorherige"]');
            
            if (nextStoryBtn) logStatus('Gefunden: Next-Button', nextStoryBtn.outerHTML.substring(0, 100));
            if (prevStoryBtn) logStatus('Gefunden: Previous-Button', prevStoryBtn.outerHTML.substring(0, 100));
            if (nextSvgIcon) logStatus('Gefunden: Next-SVG-Icon', nextSvgIcon.outerHTML.substring(0, 100));
            if (prevSvgIcon) logStatus('Gefunden: Previous-SVG-Icon', prevSvgIcon.outerHTML.substring(0, 100));
            
            if (nextStoryBtn || prevStoryBtn || nextSvgIcon || prevSvgIcon) {
                logStatus('Karussell-Erkennung: true (Navigation-Elemente gefunden)');
                return true;
            }
            
            // 2. Instagram-spezifische Klassen für Stories prüfen
            const storyClasses = ['IG_DWSTORY', 'IG_DWSTORY_ALL', 'IG_IMAGE_VIEWER'];
            const storyClassElements = document.querySelectorAll(storyClasses.map(cls => `.${cls}`).join(', '));
            
            // Wenn wir mehrere Story-Elemente finden, ist es wahrscheinlich ein Karussell
            if (storyClassElements.length > 2) {
                logStatus(`Gefunden: ${storyClassElements.length} Instagram-Story-Elemente`);
                logStatus('Karussell-Erkennung: true (Mehrere Story-Elemente gefunden)');
                return true;
            }
            
            // 3. Story-Fortschrittsanzeige analysieren
            const progressBars = document.querySelectorAll('[role="progressbar"], [class*="progress"], [class*="Progress"]');
            logStatus(`Gefunden: ${progressBars.length} Fortschrittsbalken-Elemente`);
            
            if (progressBars.length > 0) {
                logStatus('Karussell-Erkennung: true (Fortschrittsbalken gefunden)');
                return true;
            }
            
            // 4. Story-Container und Layout-Elemente prüfen
            const storyTrays = document.querySelectorAll('[data-visualcompletion="tray"], [class*="tray"], [class*="Tray"], [class*="stories-viewer"], [class*="StoriesViewer"]');
            
            if (storyTrays.length > 0) {
                logStatus(`Gefunden: ${storyTrays.length} Story-Trays/Container`);
                logStatus('Karussell-Erkennung: true (Story-Trays gefunden)');
                return true;
            }
            
            // 5. Prüfen auf mehrere Benutzerbilder oder Profilinformationen (typisch für Karussell)
            const profileIcons = document.querySelectorAll('img[alt*="profile"], img[data-visualcompletion="media-vc-image"]');
            if (profileIcons.length > 1) {
                logStatus(`Gefunden: ${profileIcons.length} Profilbilder`);
                logStatus('Karussell-Erkennung: true (Mehrere Profilbilder gefunden)');
                return true;
            }
            
            // 6. Prüfen auf positionierte Navigations-Elemente an den Bildschirmrändern
            // Research zeigt, dass Karussells oft Links am linken und rechten Bildschirmrand haben
            const navElements = [...document.querySelectorAll('[role="link"], a, [role="button"], [tabindex="0"]')]
                .filter(el => {
                    const rect = el.getBoundingClientRect();
                    if (rect.width === 0 || rect.height === 0) return false;
                    
                    const viewportWidth = window.innerWidth;
                    const viewportHeight = window.innerHeight;
                    
                    // Prüfen, ob das Element an der Seite des Bildschirms ist (typisch für Nav)
                    const isLeftSide = rect.left < viewportWidth * 0.2;
                    const isRightSide = rect.right > viewportWidth * 0.8;
                    const isTallEnough = rect.height > viewportHeight * 0.2;
                    
                    return (isLeftSide || isRightSide) && isTallEnough;
                });
            
            logStatus(`Gefunden: ${navElements.length} positionierte Navigations-Elemente`);
            
            // Wenn wir mindestens 2 Elemente haben (links und rechts), ist es wahrscheinlich ein Karussell
            if (navElements.length >= 2) {
                logStatus('Karussell-Erkennung: true (Navigations-Elemente an Bildschirmrändern gefunden)');
                return true;
            }
            
            // 7. Prüfen auf typische Karussell-Navigation via Event-Handler
            const clickHandlers = document.querySelectorAll('[role="button"], [tabindex="0"]');
            let potentialNavElements = 0;
            
            for (const el of clickHandlers) {
                // Position und Größe des Elements prüfen
                const rect = el.getBoundingClientRect();
                if (rect.width === 0 || rect.height === 0) continue;
                
                const viewportWidth = window.innerWidth;
                const viewportHeight = window.innerHeight;
                
                // Prüfen, ob das Element an der Seite des Bildschirms ist (typisch für Nav)
                const isLeftSide = rect.left < viewportWidth * 0.2 && rect.width < viewportWidth * 0.3;
                const isRightSide = rect.right > viewportWidth * 0.8 && rect.width < viewportWidth * 0.3;
                const isFullHeight = rect.height > viewportHeight * 0.5;
                
                if ((isLeftSide || isRightSide) && isFullHeight) {
                    potentialNavElements++;
                    logStatus(`Gefunden: Potenzielles Navigations-Element an ${isLeftSide ? 'linker' : 'rechter'} Seite`);
                }
            }
            
            if (potentialNavElements >= 2) {
                logStatus('Karussell-Erkennung: true (Story-Navigation an den Seiten gefunden)');
                return true;
            }
            
            // 8. DOM-Struktur auf typische Karussell-Klassen prüfen
            const allElements = document.querySelectorAll('*');
            let carouselClassFound = false;
            
            for (const el of allElements) {
                if (!el.className) continue;
                
                const classString = typeof el.className === 'string' ? el.className : '';
                if (classString.match(/carousel|swipe|slider|story-?viewer|story-?tray/i)) {
                    logStatus(`Gefunden: Element mit Karussell-Klasse: ${classString}`);
                    carouselClassFound = true;
                    break;
                }
            }
            
            if (carouselClassFound) {
                logStatus('Karussell-Erkennung: true (Karussell-Klassenname gefunden)');
                return true;
            }
            
            // Keine Karussell-Indikatoren gefunden
            logStatus('Karussell-Erkennung: false (keine Karussell-Elemente gefunden)');
            return false;
            
        } catch (error) {
            logStatus('Fehler bei Karussell-Erkennung:', error.message);
            return false;
        }
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
        button.addEventListener('click', function () {
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
        
        // Für Story-Seiten haben wir den Research-Modus bereits separat implementiert
        // Der Research-Button wird nun global für alle Instagram-Seiten hinzugefügt
        
        // Research durchführen, wenn noch nicht geschehen und wir auf einer Story-Seite sind
        if (RESEARCH_MODE && !researchDone && document.readyState === 'complete') {
            researchInstagramDOM();
        }
        
        // Prüfe, ob es sich um ein Karussell handelt
        const carousel = isKarusellView();
        
        if (carousel) {
            log('Karussell-Ansicht erkannt');
            if (!buttonShown) {
                logStatus('Karussell-Modus: Füge Button hinzu');
                addSingleViewButton();
            }
        } else {
            log('Einzelansicht erkannt');
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

    function onReady() {
        logStatus('DOM bereit, starte Überwachung');
        
        // Initiale Prüfung
        setTimeout(checkForStoryAndAddButton, 500);
        
        // Regelmäßige Prüfung
        mainTimer = setInterval(() => {
            // URL-Änderung erkennen
            if (currentUrl !== location.href) {
                logStatus('URL hat sich geändert', currentUrl, '->', location.href);
                currentUrl = location.href;
                buttonShown = false;
                // Bei URL-Änderung Cache für wiederholte Meldungen zurücksetzen
                lastStatusMessages = {};
            }
            
            checkForStoryAndAddButton();
        }, CHECK_INTERVAL);
        
        // URL-Änderungen überwachen (History API)
        const originalPushState = history.pushState;
        history.pushState = function() {
            originalPushState.apply(this, arguments);
            
            logStatus('pushState erkannt');
            currentUrl = location.href;
                buttonShown = false;
            // Bei URL-Änderung Cache für wiederholte Meldungen zurücksetzen
            lastStatusMessages = {};
            setTimeout(checkForStoryAndAddButton, 500);
        };
        
        // Zurück-Button überwachen
        window.addEventListener('popstate', () => {
            logStatus('popstate erkannt');
            currentUrl = location.href;
            buttonShown = false;
            // Bei URL-Änderung Cache für wiederholte Meldungen zurücksetzen
            lastStatusMessages = {};
            setTimeout(checkForStoryAndAddButton, 500);
        });
    }

    // Einstellungen-Dialog zum Bearbeiten der Konfiguration
    const createSettingsUI = () => {
        // Entferne vorhandenen Dialog, falls vorhanden
        const existingDialog = document.getElementById('isv-settings');
        if (existingDialog) existingDialog.remove();
        
        // Dialog erstellen
        const dialog = document.createElement('div');
        dialog.id = 'isv-settings';
        dialog.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            padding: 20px;
            z-index: 9999999;
            width: 400px;
            font-family: Arial, sans-serif;
            color: #333;
        `;
        
        // Titel
        const title = document.createElement('h2');
        title.textContent = 'Instagram Single Story View - Einstellungen';
        title.style.cssText = `
            margin-top: 0;
            margin-bottom: 15px;
            font-size: 18px;
            border-bottom: 1px solid #eee;
            padding-bottom: 10px;
        `;
        dialog.appendChild(title);
        
        // Einstellungen erstellen
        const createSetting = (id, label, value, type = 'checkbox') => {
            const container = document.createElement('div');
            container.style.cssText = 'margin-bottom: 15px;';
            
            const labelEl = document.createElement('label');
            labelEl.setAttribute('for', id);
            labelEl.style.cssText = 'display: block; margin-bottom: 5px; font-weight: bold;';
            labelEl.textContent = label;
            
            const input = document.createElement('input');
            input.id = id;
            input.type = type;
            if (type === 'checkbox') {
                input.checked = value;
                input.style.cssText = 'margin-right: 10px;';
            } else {
                input.value = value;
                input.style.cssText = 'width: 100%; padding: 5px; box-sizing: border-box;';
            }
            
            container.appendChild(labelEl);
            container.appendChild(input);
            return container;
        };
        
        // Einstellungen hinzufügen
        dialog.appendChild(createSetting('isv-debug', 'Debug-Modus aktivieren', DEBUG));
        dialog.appendChild(createSetting('isv-check-interval', 'Prüfintervall (ms)', CHECK_INTERVAL, 'number'));
        dialog.appendChild(createSetting('isv-cooldown', 'Cooldown zwischen Aktionen (ms)', COOLDOWN, 'number'));
        dialog.appendChild(createSetting('isv-research-mode', 'Research-Modus aktivieren', RESEARCH_MODE));
        dialog.appendChild(createSetting('isv-force-research', 'Research-Modus bei jedem Seitenaufruf ausführen', FORCE_RESEARCH));
        
        // Buttons
        const buttonsContainer = document.createElement('div');
        buttonsContainer.style.cssText = 'display: flex; justify-content: flex-end; margin-top: 20px;';
        
        const cancelButton = document.createElement('button');
        cancelButton.textContent = 'Abbrechen';
        cancelButton.style.cssText = `
            padding: 8px 15px;
            margin-right: 10px;
            border: none;
            background: #ccc;
            border-radius: 4px;
            cursor: pointer;
        `;
        cancelButton.onclick = () => dialog.remove();
        
        const saveButton = document.createElement('button');
        saveButton.textContent = 'Speichern';
        saveButton.style.cssText = `
            padding: 8px 15px;
            border: none;
            background: #5a32a3;
            color: white;
            border-radius: 4px;
            cursor: pointer;
        `;
        saveButton.onclick = () => {
            // Einstellungen speichern
            DEBUG = saveConfig('DEBUG', document.getElementById('isv-debug').checked);
            CHECK_INTERVAL = saveConfig('CHECK_INTERVAL', parseInt(document.getElementById('isv-check-interval').value) || 250);
            COOLDOWN = saveConfig('COOLDOWN', parseInt(document.getElementById('isv-cooldown').value) || 2000);
            RESEARCH_MODE = saveConfig('RESEARCH_MODE', document.getElementById('isv-research-mode').checked);
            FORCE_RESEARCH = saveConfig('FORCE_RESEARCH', document.getElementById('isv-force-research').checked);
            
            // Dialog schließen
            dialog.remove();
            
            // Benachrichtigung anzeigen
            const notification = document.createElement('div');
            notification.textContent = 'Einstellungen gespeichert!';
            notification.style.cssText = `
                position: fixed;
                bottom: 20px;
                left: 20px;
                background: rgba(90, 50, 163, 0.9);
                color: white;
                padding: 10px 15px;
                border-radius: 4px;
                z-index: 999999;
                font-family: Arial, sans-serif;
            `;
            document.body.appendChild(notification);
            
            // Nach 3 Sekunden ausblenden
            setTimeout(() => {
                notification.style.opacity = '0';
                notification.style.transition = 'opacity 0.5s';
                setTimeout(() => notification.remove(), 500);
            }, 3000);
        };
        
        buttonsContainer.appendChild(cancelButton);
        buttonsContainer.appendChild(saveButton);
        dialog.appendChild(buttonsContainer);
        
        // Dialog zum DOM hinzufügen
        document.body.appendChild(dialog);
    };
    
    // Menüeintrag in Tampermonkey registrieren
    GM_registerMenuCommand('Instagram Single Story View - Einstellungen', createSettingsUI);

    // Skript starten
    init();
})(); 