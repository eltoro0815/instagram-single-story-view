// ==UserScript==
// @name         Instagram Single Story View
// @namespace    https://github.com/eltoro0815/instagram-single-story-view
// @version      1.0.32
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

    // Wichtige Statusänderungen immer loggen
    const logStatus = (...args) => {
        if (DEBUG) {
            console.log('[ISV]', ...args);
        }
    };

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

        // Füge zusätzlich einen Einstellungsbutton hinzu
        addSettingsButton();
    }

    // Button zum Öffnen der Einstellungen
    function addSettingsButton() {
        if (document.getElementById('isv-settings-button')) {
            return;
        }
        
        const button = document.createElement('button');
        button.id = 'isv-settings-button';
        button.textContent = 'ISV Einstellungen';
        button.style.cssText = `
            position: fixed;
            top: 10px;
            left: 200px;
            z-index: 9999999;
            background: rgba(90, 50, 163, 0.9);
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
            createSettingsUI();
        });
        
        // Füge den Button direkt zum body hinzu
        document.body.appendChild(button);
        
        // Stelle sicher, dass der Button sichtbar ist
        setTimeout(() => {
            if (document.getElementById('isv-settings-button')) {
                document.getElementById('isv-settings-button').style.display = 'block';
                logStatus('Einstellungs-Button hinzugefügt und sichtbar gemacht');
            }
        }, 500);
    }

    // Button zum manuellen Starten der spezifischen ID-Suche
    function addSpecificIdSearchButton() {
        if (document.getElementById('isv-specific-id-search-button')) {
            return;
        }
        
        const button = document.createElement('button');
        button.id = 'isv-specific-id-search-button';
        button.textContent = 'Nach spezifischer ID suchen';  // Geändert: Kein direktes Anzeigen der ID
        button.style.cssText = `
            position: fixed;
            top: 50px;
            left: 10px;
            z-index: 9999999;
            background: rgba(255, 0, 0, 0.8);
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
        
        // Die ID ist nun nur im Eventhandler gespeichert, nicht im Button-Text
        button.addEventListener('click', function() {
            searchForSpecificId('3615862947608863320');
        });
        
        // Füge den Button direkt zum body hinzu
        document.body.appendChild(button);
        
        // Stelle sicher, dass der Button sichtbar ist
        setTimeout(() => {
            if (document.getElementById('isv-specific-id-search-button')) {
                document.getElementById('isv-specific-id-search-button').style.display = 'block';
            }
        }, 500);
    }

    // Button zum Hinzufügen der automatischen Navigation zum Extrahieren der Story-ID
    function addNavigationIDFinderButton() {
        if (document.getElementById('isv-navigation-id-button')) {
            return;
        }
        
        const button = document.createElement('button');
        button.id = 'isv-navigation-id-button';
        button.textContent = 'Story-ID durch Navigation finden';
        button.style.cssText = `
            position: fixed;
            top: 90px;
            left: 10px;
            z-index: 9999999;
            background: rgba(0, 128, 255, 0.8);
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
            findStoryIdByNavigation();
        });
        
        // Füge den Button direkt zum body hinzu
        document.body.appendChild(button);
        
        // Stelle sicher, dass der Button sichtbar ist
        setTimeout(() => {
            if (document.getElementById('isv-navigation-id-button')) {
                document.getElementById('isv-navigation-id-button').style.display = 'block';
            }
        }, 500);
    }

    // Funktion zum Finden der Story-ID durch Navigation
    function findStoryIdByNavigation() {
        console.log("[ISV-DEBUG] Starte Navigation zur Story-ID-Ermittlung");
        
        // Aktuelle URL speichern, um später zurückzukehren
        const originalUrl = window.location.href;
        const originalTitle = document.title;
        
        // Status anzeigen
        const statusIndicator = document.createElement('div');
        statusIndicator.id = 'isv-navigation-status';
        statusIndicator.style.cssText = `
            position: fixed;
            top: 130px;
            left: 10px;
            z-index: 9999999;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            border: none;
            border-radius: 4px;
            padding: 8px 12px;
            font-family: Arial, sans-serif;
            max-width: 300px;
        `;
        statusIndicator.textContent = 'Navigiere zu nächster Story...';
        document.body.appendChild(statusIndicator);
        
        // Finde den "Weiter"/"Next" Button für die nächste Story
        const nextButton = findNavigationButton('next');
        
        if (!nextButton) {
            statusIndicator.textContent = 'Fehler: Kann "Weiter"-Button nicht finden!';
            statusIndicator.style.background = 'rgba(255, 0, 0, 0.8)';
            console.error("[ISV-DEBUG] Kann keinen 'Weiter'-Button finden");
            
            // Nach 3 Sekunden ausblenden
            setTimeout(() => {
                if (document.getElementById('isv-navigation-status')) {
                    document.getElementById('isv-navigation-status').remove();
                }
            }, 3000);
            return;
        }
        
        // Klicke auf "Weiter" und warte auf URL-Änderung
        console.log("[ISV-DEBUG] Klicke auf 'Weiter'-Button:", nextButton);
        
        // Setze einen Timeout, falls die Navigation fehlschlägt
        let navigationTimeout = setTimeout(() => {
            if (document.getElementById('isv-navigation-status')) {
                statusIndicator.textContent = 'Fehler: Navigation zur nächsten Story fehlgeschlagen!';
                statusIndicator.style.background = 'rgba(255, 0, 0, 0.8)';
                
                // Nach 3 Sekunden ausblenden
                setTimeout(() => {
                    if (document.getElementById('isv-navigation-status')) {
                        document.getElementById('isv-navigation-status').remove();
                    }
                }, 3000);
            }
        }, 5000);
        
        // URL-Überwachung für Änderungen
        const originalUrlObj = new URL(originalUrl);
        const originalPathname = originalUrlObj.pathname;
        
        // Monitor für URL-Änderungen
        const urlCheckInterval = setInterval(() => {
            const currentUrl = window.location.href;
            const currentUrlObj = new URL(currentUrl);
            
            // Prüfe, ob sich die URL geändert hat
            if (currentUrlObj.pathname !== originalPathname) {
                clearInterval(urlCheckInterval);
                clearTimeout(navigationTimeout);
                
                console.log("[ISV-DEBUG] URL hat sich geändert:", currentUrl);
                statusIndicator.textContent = 'Story gewechselt! Analysiere neue URL...';
                
                // Analysiere die neue URL
                const storyIdMatch = currentUrl.match(/\/stories\/[^\/]+\/(\d+)/);
                if (storyIdMatch && storyIdMatch[1]) {
                    const storyId = storyIdMatch[1];
                    console.log("[ISV-DEBUG] Gefundene Story-ID:", storyId);
                    
                    statusIndicator.textContent = `Story-ID gefunden: ${storyId}. Kehre zur ursprünglichen Story zurück...`;
                    statusIndicator.style.background = 'rgba(0, 128, 0, 0.8)';
                    
                    // Warte einen Moment, um die neue Story anzuzeigen
                    setTimeout(() => {
                        // Zurück zur ursprünglichen Story navigieren
                        window.history.go(-1);
                        
                        // Warte, bis wir zurück sind
                        setTimeout(() => {
                            if (document.getElementById('isv-navigation-status')) {
                                statusIndicator.textContent = `Erfolgreich! Story-ID: ${storyId}`;
                                
                                // Kopiere ID in die Zwischenablage
                                try {
                                    navigator.clipboard.writeText(storyId).then(() => {
                                        statusIndicator.textContent = `Erfolgreich! Story-ID: ${storyId} (in Zwischenablage kopiert)`;
                                    });
                                } catch (e) {
                                    console.error("[ISV-DEBUG] Fehler beim Kopieren in die Zwischenablage:", e);
                                }
                                
                                // Nach 5 Sekunden ausblenden
                                setTimeout(() => {
                                    if (document.getElementById('isv-navigation-status')) {
                                        document.getElementById('isv-navigation-status').remove();
                                    }
                                }, 5000);
                            }
                        }, 1000);
                    }, 1000);
                } else {
                    statusIndicator.textContent = 'Fehler: Keine Story-ID in der neuen URL gefunden!';
                    statusIndicator.style.background = 'rgba(255, 0, 0, 0.8)';
                    
                    // Nach 3 Sekunden ausblenden
                    setTimeout(() => {
                        if (document.getElementById('isv-navigation-status')) {
                            document.getElementById('isv-navigation-status').remove();
                        }
                    }, 3000);
                }
            }
        }, 100);
        
        // Führe den Klick aus
        nextButton.click();
    }

    // Hilfsfunktion zum Finden des Navigationsbuttons
    function findNavigationButton(direction) {
        // "next" oder "prev"
        const isNext = direction === 'next';
        
        // Suche nach Button mit aria-label
        const ariaLabels = isNext ? 
            ['Weiter', 'Next', 'next', 'Nächste', 'weiter', 'Vor', 'vor'] : 
            ['Zurück', 'Previous', 'previous', 'Vorherige', 'zurück', 'Zurück zur vorherigen Story'];
        
        // Suche nach Button oder SVG mit aria-label
        for (const label of ariaLabels) {
            const button = document.querySelector(`button[aria-label="${label}"], [aria-label="${label}"]`);
            if (button) return button;
        }
        
        // Suche nach Button, der durch Position erkennbar ist
        const possibleButtons = document.querySelectorAll('button, [role="button"], [tabindex="0"]');
        
        for (const btn of possibleButtons) {
            const rect = btn.getBoundingClientRect();
            
            // Ignoriere unsichtbare Elemente
            if (rect.width === 0 || rect.height === 0) continue;
            
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            
            // Eigenschaften, die auf Navigationsbuttons hindeuten
            const isLeftSide = rect.left < viewportWidth * 0.25;
            const isRightSide = rect.right > viewportWidth * 0.75;
            const isTallEnough = rect.height > viewportHeight * 0.3;
            
            // Für "next" suchen wir nach einem Button auf der rechten Seite
            // Für "prev" suchen wir nach einem Button auf der linken Seite
            if (((isNext && isRightSide) || (!isNext && isLeftSide)) && isTallEnough) {
                return btn;
            }
        }
        
        // Suche nach SVG-Elementen, die als Buttons dienen können
        const svgElements = document.querySelectorAll('svg');
        for (const svg of svgElements) {
            const rect = svg.getBoundingClientRect();
            
            // Ignoriere unsichtbare Elemente
            if (rect.width === 0 || rect.height === 0) continue;
            
            // Nur größere SVGs betrachten (keine kleinen Icons)
            if (rect.width < 20 || rect.height < 20) continue;
            
            const viewportWidth = window.innerWidth;
            
            // Für "next" suchen wir nach einem SVG auf der rechten Seite
            // Für "prev" suchen wir nach einem SVG auf der linken Seite
            const isLeftSide = rect.left < viewportWidth * 0.25;
            const isRightSide = rect.right > viewportWidth * 0.75;
            
            if ((isNext && isRightSide) || (!isNext && isLeftSide)) {
                return svg;
            }
        }
        
        // Als letzten Versuch - suche nach DIVs, die als Buttons dienen könnten
        const divs = document.querySelectorAll('div');
        for (const div of divs) {
            const rect = div.getBoundingClientRect();
            
            // Ignoriere unsichtbare Elemente
            if (rect.width === 0 || rect.height === 0) continue;
            
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            
            // Eigenschaften, die auf Navigationsbuttons hindeuten
            const isLeftSide = rect.left < viewportWidth * 0.25;
            const isRightSide = rect.right > viewportWidth * 0.75;
            const isTallEnough = rect.height > viewportHeight * 0.3;
            const isWideEnough = rect.width > 50;
            
            if (((isNext && isRightSide) || (!isNext && isLeftSide)) && isTallEnough && isWideEnough) {
                return div;
            }
        }
        
        // Keine passenden Elemente gefunden
        return null;
    }

    // Funktion, die den Research-Button zur Seite hinzufügt
    function ensureResearchButtonExists() {
        if (RESEARCH_MODE && !researchButtonAdded && document.body) {
            addResearchButton();
            logStatus('Research-Button zur Seite hinzugefügt');
            
            // Füge auch den spezifischen ID-Suchbutton hinzu
            addSpecificIdSearchButton();
            logStatus('Spezifischer ID-Suchbutton zur Seite hinzugefügt');
            
            // Füge den Navigations-ID-Finder-Button hinzu
            addNavigationIDFinderButton();
            logStatus('Navigations-ID-Finder-Button zur Seite hinzugefügt');
        } else if (!document.getElementById('isv-settings-button') && document.body) {
            // Stelle sicher, dass der Einstellungsbutton auch existiert, selbst wenn Research deaktiviert ist
            addSettingsButton();
            logStatus('Einstellungs-Button hinzugefügt');
            
            // Füge auch den spezifischen ID-Suchbutton hinzu, unabhängig vom Research-Modus
            if (!document.getElementById('isv-specific-id-search-button')) {
                addSpecificIdSearchButton();
                logStatus('Spezifischer ID-Suchbutton zur Seite hinzugefügt');
            }
            
            // Füge auch den Navigations-ID-Finder-Button hinzu
            if (!document.getElementById('isv-navigation-id-button')) {
                addNavigationIDFinderButton();
                logStatus('Navigations-ID-Finder-Button zur Seite hinzugefügt');
            }
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
            // console.clear(); // Konsole leeren für bessere Übersicht
            console.log("[ISV-DEBUG] --------------------------------------------------------");
            console.log("[ISV-DEBUG] BEGINN DER RESEARCH-AUSGABEN - FRÜHERE AUSGABEN BLEIBEN ERHALTEN");
            console.log("[ISV-DEBUG] --------------------------------------------------------");

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

    // Mini-Skript zur Diagnose von Story-IDs
    console.log("[ISV-DEBUG] Diagnose-Skript gestartet");
    console.log("[ISV-DEBUG] URL:", window.location.href);

    // Diese Funktion analysiert die URL und sucht nach versteckten Story-IDs
    function analyzeUrlForStoryIds(url) {
        if (!url) return null;

        // Vereinfachen der URL für die Analyse
        const decodedUrl = decodeURIComponent(url);
        console.log("[ISV-DEBUG] Analysiere URL:", decodedUrl);

        // Extrahiere Zahlen, die potenziell Story-IDs sein könnten
        const matches = decodedUrl.match(/\d{10,25}/g) || [];
        if (matches.length > 0) {
            console.log("[ISV-DEBUG] Gefundene lange Zahlen in URL:", matches);
            
            // Validiere IDs basierend ausschließlich auf Länge (19 Stellen)
            const validIds = matches.filter(id => id.length === 19);
            const invalidLengthIds = matches.filter(id => id.length !== 19 && id.length >= 15);
            
            if (invalidLengthIds.length > 0) {
                console.warn("[ISV-DEBUG] IDs mit falscher Länge gefunden (ignoriere alle außer 19 Stellen):", invalidLengthIds);
            }
            
            if (validIds.length > 0) {
                console.log("[ISV-DEBUG] Gültige Story-IDs (19 Stellen):", validIds);
                return validIds[0]; // Nimm die erste gültige ID
            }
            
            // Kein Fallback mehr für kürzere IDs - nur noch 19-stellige IDs sind gültig
            console.log("[ISV-DEBUG] Keine 19-stellige Story-ID gefunden. Keine gültige ID verfügbar.");
        }
        
        return null;
    }

    // Neue Funktion für tiefe DOM-Suche nach Story-IDs
    function searchDOMForStoryIds() {
        console.log("[ISV-DEBUG] Führe tiefe DOM-Suche nach Story-IDs durch");
        const foundIds = new Map(); // Verwende Map für Eindeutigkeit und Häufigkeitszählung
        
        try {
            // 1. Suche in allen data-* Attributen
            const elementsWithDataAttr = document.querySelectorAll('[data-id], [data-item-id], [data-media-id], [data-post-id], [data-story-id], [data-story-media-id], [data-reel-id]');
            
            elementsWithDataAttr.forEach(el => {
                ['data-id', 'data-item-id', 'data-media-id', 'data-post-id', 'data-story-id', 'data-story-media-id', 'data-reel-id'].forEach(attr => {
                    const value = el.getAttribute(attr);
                    if (value && /^\d{15,25}$/.test(value)) {
                        console.log(`[ISV-DEBUG] Mögliche Story-ID in ${attr} gefunden:`, value);
                        // Speichere ID und ihren Ursprung
                        foundIds.set(value, {
                            weight: (foundIds.get(value)?.weight || 0) + 1,
                            source: `data-Attribut: ${attr}`
                        });
                    }
                });
            });
            
            // 2. Suche in ALLEN Attributen aller Elemente
            const allElements = document.querySelectorAll('*');
            allElements.forEach(el => {
                if (!el.attributes) return;
                
                Array.from(el.attributes).forEach(attr => {
                    const value = attr.value;
                    // Suche nach 19-stelligen Zahlen in Attributwerten
                    const matches = value.match(/\b\d{19}\b/g);
                    if (matches) {
                        matches.forEach(id => {
                            console.log(`[ISV-DEBUG] Mögliche Story-ID im Attribut ${attr.name} gefunden:`, id);
                            // Wenn nicht bereits erfasst durch data-* Attribute
                            if (!foundIds.has(id) || !foundIds.get(id).source.includes('data-Attribut')) {
                                foundIds.set(id, {
                                    weight: (foundIds.get(id)?.weight || 0) + 1,
                                    source: `Attribut: ${attr.name}`
                                });
                            }
                        });
                    }
                    
                    // Suche auch nach IDs in URL-Segmenten
                    if (value.includes('stories/') || value.includes('/story/')) {
                        const urlMatches = value.match(/stories\/[^\/]+\/(\d{19})/);
                        if (urlMatches && urlMatches[1]) {
                            console.log(`[ISV-DEBUG] Story-ID in URL-Segment gefunden:`, urlMatches[1]);
                            foundIds.set(urlMatches[1], {
                                weight: (foundIds.get(urlMatches[1])?.weight || 0) + 3, // Erhöhte Gewichtung für URL-Segmente
                                source: `URL-Segment in ${attr.name}`
                            });
                        }
                    }
                });
                
                // Prüfe auch den Textinhalt auf 19-stellige Zahlen
                if (el.textContent && !/^(script|style)$/i.test(el.tagName)) {
                    const matches = el.textContent.match(/\b\d{19}\b/g);
                    if (matches) {
                        matches.forEach(id => {
                            console.log(`[ISV-DEBUG] Mögliche Story-ID im Textinhalt gefunden:`, id);
                            foundIds.set(id, {
                                weight: (foundIds.get(id)?.weight || 0) + 1,
                                source: `Textinhalt im <${el.tagName.toLowerCase()}> Element`
                            });
                        });
                    }
                }
            });
            
            // 3. Suche in eingebetteten script-Tags mit JSON-Daten
            const scriptTags = document.querySelectorAll('script:not([src])');
            scriptTags.forEach(script => {
                const content = script.textContent || '';
                
                // Suche nach JSON-Daten
                if (content.includes('"id":') || content.includes('"story_id":') || content.includes('"media_id":')) {
                    // Extrahiere alle 19-stelligen Zahlen (typische Story-ID-Länge)
                    const matches = content.match(/\d{19}/g) || [];
                    matches.forEach(id => {
                        console.log("[ISV-DEBUG] Mögliche Story-ID in script-Tag gefunden:", id);
                        foundIds.set(id, {
                            weight: (foundIds.get(id)?.weight || 0) + 1,
                            source: `Script-Tag (direkter Text)`
                        });
                    });
                    
                    // Versuche, JSON-Objekte zu parsen
                    try {
                        // Suche nach JSON-Objekten in der Form { ... }
                        const jsonMatches = content.match(/\{[\s\S]*?\}/g) || [];
                        
                        jsonMatches.forEach(jsonStr => {
                            try {
                                const data = JSON.parse(jsonStr);
                                // Suche nach IDs in der JSON-Struktur
                                const extractedIds = extractIdsFromObject(data);
                                extractedIds.forEach(id => {
                                    if (id && id.length === 19) {
                                        console.log("[ISV-DEBUG] Story-ID aus JSON extrahiert:", id);
                                        foundIds.set(id, {
                                            weight: (foundIds.get(id)?.weight || 0) + 2, // Gewichtung für JSON-Daten angepasst
                                            source: `JSON-Daten in Script-Tag`
                                        });
                                    }
                                });
                            } catch (e) {
                                // Ignoriere ungültiges JSON
                            }
                        });
                    } catch (e) {
                        console.log("[ISV-DEBUG] Fehler beim Parsen der JSON-Daten:", e.message);
                    }
                }
            });
            
            // 4. Suche in window.__additionalDataLoaded
            // Instagram speichert manchmal Daten in diesem Objekt
            if (typeof unsafeWindow !== 'undefined' && unsafeWindow.__additionalDataLoaded) {
                console.log("[ISV-DEBUG] __additionalDataLoaded gefunden, durchsuche nach Story-IDs");
                const extractedIds = extractIdsFromObject(unsafeWindow.__additionalDataLoaded);
                extractedIds.forEach(id => {
                    if (id && id.length === 19) {
                        console.log("[ISV-DEBUG] Story-ID aus __additionalDataLoaded extrahiert:", id);
                        foundIds.set(id, {
                            weight: (foundIds.get(id)?.weight || 0) + 5, // Höchste Gewichtung für diese Quelle
                            source: `window.__additionalDataLoaded`
                        });
                    }
                });
            }
            
            // 5. NEUE METHODE: Durchsuche alle globalen Variablen im Window-Objekt
            if (typeof unsafeWindow !== 'undefined') {
                try {
                    // Versuche, in allen Window-Properties nach IDs zu suchen
                    for (const prop in unsafeWindow) {
                        try {
                            const value = unsafeWindow[prop];
                            if (value && typeof value === 'object') {
                                const extractedIds = extractIdsFromObject(value);
                                extractedIds.forEach(id => {
                                    if (id && id.length === 19) {
                                        console.log(`[ISV-DEBUG] Story-ID in window.${prop} gefunden:`, id);
                                        foundIds.set(id, {
                                            weight: (foundIds.get(id)?.weight || 0) + 4, // Hohe Gewichtung
                                            source: `window.${prop}`
                                        });
                                    }
                                });
                            }
                        } catch (e) {
                            // Ignoriere Fehler bei einzelnen Properties
                        }
                    }
                } catch (e) {
                    console.log("[ISV-DEBUG] Fehler beim Durchsuchen der Window-Properties:", e.message);
                }
            }
            
            // 6. NEUE METHODE: Direkte Suche in HTML-Inhalten
            const htmlContent = document.documentElement.outerHTML;
            const allIds = htmlContent.match(/\b\d{19}\b/g) || [];
            allIds.forEach(id => {
                if (!foundIds.has(id)) {
                    console.log("[ISV-DEBUG] Story-ID direkt im HTML gefunden:", id);
                    foundIds.set(id, {
                        weight: 1,
                        source: `HTML-Rohtext`
                    });
                }
            });
            
            // 7. NEU: Suche in localStorage und sessionStorage
            try {
                // Durchsuche localStorage
                for (let i = 0; i < localStorage.length; i++) {
                    try {
                        const key = localStorage.key(i);
                        const value = localStorage.getItem(key);
                        
                        // Suche nach 19-stelligen Zahlen
                        const matches = value.match(/\b\d{19}\b/g);
                        if (matches) {
                            matches.forEach(id => {
                                console.log(`[ISV-DEBUG] Mögliche Story-ID in localStorage[${key}] gefunden:`, id);
                                foundIds.set(id, {
                                    weight: (foundIds.get(id)?.weight || 0) + 3,
                                    source: `localStorage: ${key}`
                                });
                            });
                        }
                        
                        // Versuche, JSON zu parsen
                        try {
                            const parsedValue = JSON.parse(value);
                            const extractedIds = extractIdsFromObject(parsedValue);
                            extractedIds.forEach(id => {
                                if (id && id.length === 19) {
                                    console.log(`[ISV-DEBUG] Story-ID aus localStorage[${key}] JSON extrahiert:`, id);
                                    foundIds.set(id, {
                                        weight: (foundIds.get(id)?.weight || 0) + 3,
                                        source: `localStorage JSON: ${key}`
                                    });
                                }
                            });
                        } catch (e) {
                            // Ignoriere ungültiges JSON
                        }
                    } catch (e) {
                        // Ignoriere Fehler bei einzelnen localStorage-Items
                    }
                }
                
                // Durchsuche sessionStorage
                for (let i = 0; i < sessionStorage.length; i++) {
                    try {
                        const key = sessionStorage.key(i);
                        const value = sessionStorage.getItem(key);
                        
                        // Suche nach 19-stelligen Zahlen
                        const matches = value.match(/\b\d{19}\b/g);
                        if (matches) {
                            matches.forEach(id => {
                                console.log(`[ISV-DEBUG] Mögliche Story-ID in sessionStorage[${key}] gefunden:`, id);
                                foundIds.set(id, {
                                    weight: (foundIds.get(id)?.weight || 0) + 3,
                                    source: `sessionStorage: ${key}`
                                });
                            });
                        }
                        
                        // Versuche, JSON zu parsen
                        try {
                            const parsedValue = JSON.parse(value);
                            const extractedIds = extractIdsFromObject(parsedValue);
                            extractedIds.forEach(id => {
                                if (id && id.length === 19) {
                                    console.log(`[ISV-DEBUG] Story-ID aus sessionStorage[${key}] JSON extrahiert:`, id);
                                    foundIds.set(id, {
                                        weight: (foundIds.get(id)?.weight || 0) + 3,
                                        source: `sessionStorage JSON: ${key}`
                                    });
                                }
                            });
                        } catch (e) {
                            // Ignoriere ungültiges JSON
                        }
                    } catch (e) {
                        // Ignoriere Fehler bei einzelnen sessionStorage-Items
                    }
                }
            } catch (e) {
                console.log("[ISV-DEBUG] Fehler beim Durchsuchen von localStorage/sessionStorage:", e.message);
            }
            
            // 8. NEU: Suche in Instagram's Modellen und API-Daten
            try {
                // Instagram speichert manchmal Daten in diesen spezifischen Objekten
                const instagramKeys = ['__RELAY_STORE__', '__INITIAL_DATA__', 'REDUX_STATE', '_sharedData', 'require'];
                
                if (typeof unsafeWindow !== 'undefined') {
                    for (const key of instagramKeys) {
                        if (unsafeWindow[key]) {
                            console.log(`[ISV-DEBUG] Instagram-spezifisches Objekt '${key}' gefunden`);
                            const extractedIds = extractIdsFromObject(unsafeWindow[key]);
                            extractedIds.forEach(id => {
                                if (id && id.length === 19) {
                                    console.log(`[ISV-DEBUG] Story-ID aus Instagram-Objekt ${key} extrahiert:`, id);
                                    foundIds.set(id, {
                                        weight: (foundIds.get(id)?.weight || 0) + 4, // Hohe Priorität für Instagram-Objekte
                                        source: `Instagram ${key}`
                                    });
                                }
                            });
                        }
                    }
                }
            } catch (e) {
                console.log("[ISV-DEBUG] Fehler beim Durchsuchen von Instagram-spezifischen Objekten:", e.message);
            }
            
            // 9. NEU: Direktes Parsen vom HTML-Text für spezifische Strukturen
            try {
                const htmlContent = document.documentElement.outerHTML;
                
                // Spezifisches Format suchen: "mediaId":"XXXXXX" oder "story_media_id":"XXXXXX"
                const mediaIdMatches = htmlContent.match(/["'](?:mediaId|story_media_id|media_id)["']\s*:\s*["'](\d{19})["']/g) || [];
                mediaIdMatches.forEach(match => {
                    const id = match.match(/(\d{19})/)[1];
                    console.log("[ISV-DEBUG] Story-ID aus mediaId-Pattern im HTML gefunden:", id);
                    foundIds.set(id, {
                        weight: (foundIds.get(id)?.weight || 0) + 4,
                        source: `mediaId-Pattern im HTML`
                    });
                });
                
                // Suche nach URLs im Format /stories/username/XXXXXX/
                const storyUrlMatches = htmlContent.match(/\/stories\/[^\/]+\/(\d{19})\//g) || [];
                storyUrlMatches.forEach(match => {
                    const id = match.match(/(\d{19})/)[1];
                    console.log("[ISV-DEBUG] Story-ID aus Story-URL-Pattern im HTML gefunden:", id);
                    foundIds.set(id, {
                        weight: (foundIds.get(id)?.weight || 0) + 5, // Höchste Priorität für direkte Story-URLs
                        source: `Story-URL-Pattern im HTML`
                    });
                });
            } catch (e) {
                console.log("[ISV-DEBUG] Fehler beim Parsen spezieller Patterns im HTML:", e.message);
            }
            
            // Konvertiere zu Array und sortiere nach Häufigkeit (häufigere IDs priorisieren)
            const sortedIds = Array.from(foundIds.entries())
                .sort((a, b) => b[1].weight - a[1].weight)
                .map(entry => ({ id: entry[0], info: entry[1] }));
                
            if (sortedIds.length > 0) {
                console.log("[ISV-DEBUG] Gefundene Story-IDs (sortiert nach Relevanz):", sortedIds);
                return sortedIds;
            }
        } catch (error) {
            console.error("[ISV-DEBUG] Fehler bei der DOM-Suche:", error);
        }
        
        return [];
    }

    // Hilfsfunktion zum Extrahieren von IDs aus JavaScript-Objekten
    function extractIdsFromObject(obj, ids = new Set()) {
        if (!obj || typeof obj !== 'object') return ids;
        
        // Direkte ID-Eigenschaften prüfen
        const idProps = ['id', 'storyId', 'story_id', 'mediaId', 'media_id', 'reelId', 'reel_id', 'itemId', 'item_id'];
        
        for (const prop in obj) {
            const value = obj[prop];
            
            // Prüfe, ob die Eigenschaft eine ID sein könnte
            if (idProps.includes(prop) && typeof value === 'string' && /^\d{15,25}$/.test(value)) {
                ids.add(value);
            }
            
            // Rekursiv in verschachtelten Objekten und Arrays suchen
            if (value && typeof value === 'object') {
                extractIdsFromObject(value, ids);
            }
        }
        
        return Array.from(ids);
    }

    // Neue Funktion, die in URL, Meta-Tags und dann tief im DOM nach der ID sucht
    function extractStoryId() {
        // 1. Zuerst in der aktuellen URL suchen
        const urlStoryId = analyzeUrlForStoryIds(window.location.href);
        if (urlStoryId) {
            console.log("[ISV-DEBUG] Story-ID aus URL extrahiert:", urlStoryId);
            return urlStoryId;
        }
        
        // 2. Wenn in URL nicht gefunden, im og:url Meta-Tag suchen
        const ogUrlMeta = document.querySelector('meta[property="og:url"], meta[name="og:url"]');
        
        if (ogUrlMeta) {
            const content = ogUrlMeta.getAttribute('content') || '';
            if (content) {
                const metaStoryId = analyzeUrlForStoryIds(content);
                if (metaStoryId) {
                    console.log("[ISV-DEBUG] Story-ID aus og:url Meta-Tag extrahiert:", metaStoryId);
                    return metaStoryId;
                }
            }
        }
        
        // 3. Tiefe DOM-Suche
        const domIds = searchDOMForStoryIds();
        if (domIds.length > 0) {
            // Nehme die am häufigsten vorkommende ID (erste in der sortierten Liste)
            console.log("[ISV-DEBUG] Verwende Story-ID aus DOM-Analyse:", domIds[0].id);
            return domIds[0].id;
        }
        
        console.log("[ISV-DEBUG] Keine gültige Story-ID gefunden");
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
                
                // Alert-Nachricht aktualisieren
                alert('Fehler: Keine gültige Story-ID in der URL oder im og:url Meta-Tag gefunden!');
                
                log('Keine Story-ID oder Username gefunden für Umleitung');
            }
        });

        // Button zum DOM hinzufügen
        document.body.appendChild(button);
        buttonShown = true;
    }

    // Button hinzufügen, der alle gefundenen Story-IDs als Alert anzeigt
    function addStoryIdListButton() {
        // Nicht doppelt hinzufügen
        if (document.getElementById('isv-id-list-button')) {
            return;
        }
        
        log('Füge Story-ID-Liste-Button hinzu');

        // Button erstellen
        const button = document.createElement('button');
        button.id = 'isv-id-list-button';
        button.textContent = 'Story-IDs anzeigen';
        button.style.cssText = `
            position: fixed;
            top: 10px;
            right: 150px;
            z-index: 999999;
            background: rgba(0, 128, 128, 0.8);
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
            log('Story-ID-Liste-Button geklickt');
            
            // Sammle alle möglichen Story-IDs
            let idList = '';
            
            // 1. Analysiere die aktuelle URL für Story-IDs
            const urlStoryId = analyzeUrlForStoryIds(window.location.href);
            if (urlStoryId) {
                idList += `URL: ${urlStoryId} (Wird für die Einzelansicht verwendet)\n\n`;
            } else {
                idList += 'Keine ID in der URL gefunden\n\n';
            }
            
            // 2. Suche in Meta-Tags
            const metaTags = document.querySelectorAll('meta[property^="og:"], meta[name^="og:"]');
            let metaIdsFound = false;
            
            for (const meta of metaTags) {
                const content = meta.getAttribute('content') || '';
                if (!content) continue;
                
                const metaStoryId = analyzeUrlForStoryIds(content);
                if (metaStoryId) {
                    if (!metaIdsFound) {
                        idList += 'Meta-Tags:\n';
                        metaIdsFound = true;
                    }
                    const tag = meta.getAttribute('property') || meta.getAttribute('name');
                    idList += `- ${tag}: ${metaStoryId}\n`;
                }
            }
            
            if (!metaIdsFound) {
                idList += 'Keine IDs in Meta-Tags gefunden\n\n';
            } else {
                idList += '\n';
            }
            
            // 3. DOM-Tiefensuche durchführen
            const domIds = searchDOMForStoryIds();
            if (domIds.length > 0) {
                idList += 'DOM-Suche:\n';
                domIds.forEach((idObj, index) => {
                    const relevanceMarker = index === 0 ? ' (Höchste Relevanz)' : '';
                    idList += `- ${idObj.id}: [Quelle: ${idObj.info.source}]${relevanceMarker}\n`;
                });
                idList += '\n';
            } else {
                idList += 'Keine IDs in der DOM-Suche gefunden\n\n';
            }
            
            // Zeige das Ergebnis in einem Alert an
            if (idList.trim() === '') {
                alert('Keine Story-IDs gefunden!');
            } else {
                alert(`Gefundene Story-IDs:\n\n${idList}`);
            }
        });

        // Button zum DOM hinzufügen
        document.body.appendChild(button);
    }

    function removeSingleViewButton() {
        const button = document.getElementById('isv-button');
        if (button) {
            button.remove();
            buttonShown = false;
            log('Button entfernt');
        }
        
        const idListButton = document.getElementById('isv-id-list-button');
        if (idListButton) {
            idListButton.remove();
            log('ID-Liste-Button entfernt');
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
                // Füge auch den Story-ID-Liste-Button hinzu
                addStoryIdListButton();
            }
        } else {
            log('Einzelansicht erkannt');
            if (buttonShown) {
                logStatus('Einzelansicht: Entferne Button');
                removeSingleViewButton();
            }
        }
    }

    // Einstellungen-Dialog zum Bearbeiten der Konfiguration
    const createSettingsUI = () => {
        console.log('[ISV] Einstellungen-Dialog wird geöffnet');
        
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
            color: #121212; /* Dunklerer Text für bessere Lesbarkeit */
        `;
        
        // Titel
        const title = document.createElement('h2');
        title.textContent = 'Instagram Single Story View - Einstellungen';
        title.style.cssText = `
            margin-top: 0;
            margin-bottom: 15px;
            font-size: 18px;
            border-bottom: 1px solid #ccc;
            padding-bottom: 10px;
            color: #000; /* Schwarzer Text für den Titel */
            font-weight: bold;
        `;
        dialog.appendChild(title);
        
        // Versionsanzeige hinzufügen
        const versionInfo = document.createElement('div');
        versionInfo.textContent = 'Version: ' + GM_info.script.version;
        versionInfo.style.cssText = `
            margin-bottom: 15px;
            font-size: 14px;
            color: #666;
            font-style: italic;
        `;
        dialog.appendChild(versionInfo);
        
        // Einstellungen erstellen
        const createSetting = (id, label, value, type = 'checkbox') => {
            const container = document.createElement('div');
            container.style.cssText = 'margin-bottom: 15px;';
            
            const labelEl = document.createElement('label');
            labelEl.setAttribute('for', id);
            labelEl.style.cssText = 'display: block; margin-bottom: 5px; font-weight: bold; color: #000;'; /* Schwarzer Text für Labels */
            labelEl.textContent = label;
            
            const input = document.createElement('input');
            input.id = id;
            input.type = type;
            if (type === 'checkbox') {
                input.checked = value;
                input.style.cssText = 'margin-right: 10px; transform: scale(1.2);'; /* Größere Checkbox */
            } else {
                input.value = value;
                input.style.cssText = 'width: 100%; padding: 8px; box-sizing: border-box; border: 1px solid #aaa; color: #000; background: #fff;'; /* Bessere Eingabefelder */
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
            background: #ddd;
            color: #333;
            border-radius: 4px;
            cursor: pointer;
            font-weight: bold;
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
            font-weight: bold;
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
                font-weight: bold;
                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
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

    // Status-Tracking
    let buttonShown = false;
    let lastActionTime = 0;
    let currentUrl = location.href;
    let mainTimer = null;
    let lastStatusMessages = {};     // Für das Tracking wiederholter Nachrichten
    let researchDone = false;        // Vermeidet wiederholte Research-Ausführungen
    let researchButtonAdded = false; // Verfolgt, ob der Research-Button bereits hinzugefügt wurde

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

    // Funktion zum Suchen einer spezifischen ID im gesamten DOM
    function searchForSpecificId(specificId) {
        console.log(`[ISV-DEBUG] Starte gezielte Suche nach ID: ${specificId}`);
        
        // Ergebnisse sammeln
        const results = [];
        
        // 1. Suche im HTML-Rohtext, aber ignoriere unseren eigenen Button
        const htmlContent = document.documentElement.outerHTML;
        // Neuer Ansatz: Zähle die Vorkommen der ID
        const idRegex = new RegExp(specificId, 'g');
        const matches = htmlContent.match(idRegex) || [];
        const occurrences = matches.length;
        
        if (occurrences > 0) {
            results.push({
                source: "HTML-Gesamttext",
                matches: true,
                count: occurrences,
                context: `Die ID kommt ${occurrences} Mal im HTML-Text vor`
            });
            
            // Für jedes Vorkommen den Kontext extrahieren
            let lastIndex = 0;
            for (let i = 0; i < occurrences; i++) {
                lastIndex = htmlContent.indexOf(specificId, lastIndex);
                if (lastIndex !== -1) {
                    const start = Math.max(0, lastIndex - 100);
                    const end = Math.min(htmlContent.length, lastIndex + specificId.length + 100);
                    const contextText = htmlContent.substring(start, end);
                    
                    // Prüfe, ob es sich um unseren Button handelt
                    if (!contextText.includes('isv-specific-id-search-button')) {
                        results.push({
                            source: `HTML-Kontext (Vorkommen ${i+1})`,
                            context: contextText
                        });
                    } else {
                        results.push({
                            source: `HTML-Kontext (Vorkommen ${i+1})`,
                            context: "Dies ist unser eigener Such-Button (ignorieren)"
                        });
                    }
                    lastIndex += specificId.length;
                }
            }
        } else {
            results.push({
                source: "HTML-Gesamttext",
                matches: false,
                context: "Die ID kommt im HTML-Text NICHT vor"
            });
        }
        
        // 2. Suche in allen Attributen, aber ignoriere unseren eigenen Button
        const elementsWithAttributes = document.querySelectorAll('*');
        elementsWithAttributes.forEach((el, index) => {
            if (!el.attributes || el.id === 'isv-specific-id-search-button') return;
            
            for (const attr of el.attributes) {
                if (attr.value && attr.value.includes(specificId)) {
                    results.push({
                        source: `Element-Attribut [${index}]`,
                        element: el.tagName,
                        attribute: attr.name,
                        value: attr.value,
                        context: el.outerHTML.substring(0, 200) // Begrenze die Länge
                    });
                }
            }
        });
        
        // 3. Suche in allen Textinhalten, aber ignoriere unseren eigenen Button
        document.querySelectorAll('*').forEach((el, index) => {
            if (el.id === 'isv-specific-id-search-button') return;
            if (el.textContent && el.textContent.includes(specificId) && !/^(script|style)$/i.test(el.tagName)) {
                results.push({
                    source: `Textinhalt [${index}]`,
                    element: el.tagName,
                    context: el.textContent.substring(0, 200) // Begrenze die Länge
                });
            }
        });
        
        // 4. Suche in Script-Tags
        document.querySelectorAll('script').forEach((script, index) => {
            if (script.textContent && script.textContent.includes(specificId)) {
                results.push({
                    source: `Script-Tag [${index}]`,
                    context: `Script-Text enthält die ID`
                });
                
                // Versuche alle JSON-Objekte im Script zu finden, die die ID enthalten
                const jsonMatches = script.textContent.match(/\{[^{]*?3615862947608863320[^}]*?\}/g) || [];
                jsonMatches.forEach((match, i) => {
                    results.push({
                        source: `Script-Tag [${index}] JSON [${i}]`,
                        context: match
                    });
                });
            }
        });
        
        // 5. Suche in localStorage und sessionStorage
        try {
            // Durchsuche localStorage
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                const value = localStorage.getItem(key);
                
                if (value && value.includes(specificId)) {
                    results.push({
                        source: `localStorage [${key}]`,
                        context: value.substring(0, 200) // Begrenze die Länge
                    });
                }
            }
            
            // Durchsuche sessionStorage
            for (let i = 0; i < sessionStorage.length; i++) {
                const key = sessionStorage.key(i);
                const value = sessionStorage.getItem(key);
                
                if (value && value.includes(specificId)) {
                    results.push({
                        source: `sessionStorage [${key}]`,
                        context: value.substring(0, 200) // Begrenze die Länge
                    });
                }
            }
        } catch (e) {
            console.error("[ISV-DEBUG] Fehler beim Durchsuchen von Storage:", e);
        }
        
        // 6. Versuche, die ID in Window-Objekten zu finden
        if (typeof unsafeWindow !== 'undefined') {
            const windowObjectsToCheck = [
                '__RELAY_STORE__', 
                '__INITIAL_DATA__', 
                'REDUX_STATE', 
                '_sharedData', 
                'require',
                '__additionalDataLoaded'
            ];
            
            for (const objName of windowObjectsToCheck) {
                if (unsafeWindow[objName]) {
                    try {
                        const objString = JSON.stringify(unsafeWindow[objName]);
                        if (objString.includes(specificId)) {
                            results.push({
                                source: `window.${objName}`,
                                matches: true,
                                context: `Die ID wurde in window.${objName} gefunden`
                            });
                            
                            // Versuche, den genauen Pfad zu finden
                            findPathToId(unsafeWindow[objName], specificId, `window.${objName}`, results);
                        }
                    } catch (e) {
                        console.warn(`[ISV-DEBUG] Fehler beim Stringifizieren von window.${objName}:`, e);
                    }
                }
            }
        }
        
        // 7. Suche in URL
        if (window.location.href.includes(specificId)) {
            results.push({
                source: "URL",
                matches: true,
                context: window.location.href
            });
        }
        
        // 8. Suche in Meta-Tags
        document.querySelectorAll('meta').forEach((meta, index) => {
            const content = meta.getAttribute('content');
            if (content && content.includes(specificId)) {
                results.push({
                    source: `Meta-Tag [${index}]`,
                    attribute: meta.getAttribute('name') || meta.getAttribute('property'),
                    content: content
                });
            }
        });
        
        // 9. NEU: Suche nach Instagram-Story-URL-Mustern, die die ID enthalten könnten
        const storyUrlPatterns = [
            `stories/[^/]+/${specificId}`,
            `story/[^/]+/${specificId}`,
            `stories\\?story_id=${specificId}`,
            `stories\\?id=${specificId}`,
            `media\\?id=${specificId}`,
            `reel\\?id=${specificId}`
        ];
        
        storyUrlPatterns.forEach(pattern => {
            const regex = new RegExp(pattern, 'g');
            const matches = htmlContent.match(regex);
            if (matches && matches.length > 0) {
                matches.forEach(match => {
                    results.push({
                        source: "Story-URL-Pattern",
                        pattern: pattern,
                        match: match,
                        context: "Instagram-Story-URL-Muster gefunden"
                    });
                });
            }
        });
        
        // 10. NEU: Untersuche auch Network-Requests, falls in der DevConsole sichtbar
        // Dies ist experimentell und funktioniert nur in einem Browserkontext
        console.log(`[ISV-DEBUG] Hinweis: Überprüfe auch die Network-Tab in den Entwicklertools nach Anfragen, die "${specificId}" enthalten`);
        
        // 11. NEU: Suche nach Strukturen, die typisch für Instagram-Daten sind
        const instagramDataPatterns = [
            /"media_id"\s*:\s*"[^"]*?"/g,
            /"story_media_id"\s*:\s*"[^"]*?"/g,
            /"reel_id"\s*:\s*"[^"]*?"/g,
            /"story_id"\s*:\s*"[^"]*?"/g,
            /"id"\s*:\s*"[^"]*?"/g
        ];
        
        instagramDataPatterns.forEach(pattern => {
            const matches = htmlContent.match(pattern);
            if (matches && matches.length > 0) {
                results.push({
                    source: "Instagram-Datenstruktur",
                    pattern: pattern.toString(),
                    matches: matches.slice(0, 5), // Limitiere auf 5 Beispiele
                    count: matches.length,
                    context: "Mögliche Instagram-Datenstrukturen für Story-IDs"
                });
            }
        });
        
        // Ausgabe der Ergebnisse
        console.log(`[ISV-DEBUG] Suche nach ID ${specificId} abgeschlossen.`);
        console.log(`[ISV-DEBUG] ${results.length} Treffer gefunden:`);
        console.table(results);
        
        // Ergebnisse als Alert anzeigen
        let alertText = `Suchergebnisse für ID ${specificId}:\n\n`;
        
        if (results.length === 0) {
            alertText += "Keine Treffer gefunden. Die ID scheint nicht im DOM zu existieren.";
        } else {
            // Filtere unseren eigenen Button heraus
            const filteredResults = results.filter(result => 
                !result.context || !result.context.includes('isv-specific-id-search-button')
            );
            
            if (filteredResults.length === 0) {
                alertText += "Keine relevanten Treffer gefunden (nur unser eigener Button).";
            } else {
                filteredResults.forEach((result, index) => {
                    alertText += `${index + 1}. ${result.source}:\n`;
                    if (result.element) alertText += `   Element: ${result.element}\n`;
                    if (result.attribute) alertText += `   Attribut: ${result.attribute}\n`;
                    if (result.pattern) alertText += `   Pattern: ${result.pattern}\n`;
                    if (result.matches) alertText += `   Treffer: ${result.matches.length}\n`;
                    if (result.count) alertText += `   Anzahl: ${result.count}\n`;
                    if (result.context) {
                        // Kürze den Kontext für das Alert-Fenster
                        const shortContext = result.context.length > 100 
                            ? result.context.substring(0, 100) + "..." 
                            : result.context;
                        alertText += `   Kontext: ${shortContext}\n`;
                    }
                    alertText += "\n";
                });
            }
        }
        
        alert(alertText);
        
        return results;
    }

    // Hilfsfunktion zum Finden eines Pfades zu einer ID in einem komplexen Objekt
    function findPathToId(obj, id, currentPath, results) {
        if (!obj || typeof obj !== 'object') return;
        
        // Arrays und Objekte durchlaufen
        if (Array.isArray(obj)) {
            for (let i = 0; i < obj.length; i++) {
                // Direkte Übereinstimmung prüfen
                if (obj[i] === id || obj[i] === Number(id)) {
                    results.push({
                        source: `Pfad gefunden`,
                        path: `${currentPath}[${i}]`,
                        value: obj[i]
                    });
                }
                // Rekursiv weitermachen, aber Tiefenbegrenzung einbauen
                if (typeof obj[i] === 'object' && obj[i] !== null && currentPath.split('.').length < 10) {
                    findPathToId(obj[i], id, `${currentPath}[${i}]`, results);
                }
            }
        } else {
            for (const key in obj) {
                // Direkte Übereinstimmung prüfen
                if (obj[key] === id || obj[key] === Number(id)) {
                    results.push({
                        source: `Pfad gefunden`,
                        path: `${currentPath}.${key}`,
                        value: obj[key]
                    });
                }
                // Auch den Key selbst prüfen
                if (key === id) {
                    results.push({
                        source: `Key gefunden`,
                        path: `${currentPath}`,
                        key: key,
                        value: obj[key]
                    });
                }
                // Rekursiv weitermachen, aber Tiefenbegrenzung einbauen
                if (typeof obj[key] === 'object' && obj[key] !== null && currentPath.split('.').length < 10) {
                    findPathToId(obj[key], id, `${currentPath}.${key}`, results);
                }
            }
        }
    }

    // Skript starten
    init();
})(); 