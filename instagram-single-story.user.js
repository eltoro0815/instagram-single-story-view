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
    
    // Absolute minimale Funktionalität: Nur Laden melden
    console.log(`[ISV] SCRIPT GELADEN: ${new Date().toISOString()} - URL: ${window.location.href}`);
    console.log('[ISV] Dies ist ein Test, ob das Skript überhaupt geladen wird');
})(); 