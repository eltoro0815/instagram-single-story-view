# Instagram Single Story View

Dieses Tampermonkey-Userscript erzwingt die Einzelansicht für Instagram-Stories und verhindert das Karussell mit anderen Stories, auch wenn Instagram dies standardmäßig anzeigen würde.

## Funktionsweise

- Erkennt Instagram-Story-Seiten und analysiert, ob es sich um eine Karussell- oder Einzelansicht handelt
- Extrahiert die Story-ID entweder aus der URL oder dem DOM
- Leitet bei Bedarf zur richtigen Einzelansicht-URL um
- Funktioniert sowohl auf Desktop- als auch auf mobilen Browsern mit Tampermonkey

## Installation

### Desktop-Browser

1. Installiere die [Tampermonkey-Erweiterung](https://www.tampermonkey.net/) für deinen Browser
2. Klicke auf diesen direkten Installationslink: [Instagram Single Story View Script](https://raw.githubusercontent.com/eltoro0815/instagram-single-story-view/master/instagram-single-story.user.js)
3. Klicke im Tampermonkey-Installationsdialog auf "Installieren"

Alternativ:
1. Öffne das Tampermonkey-Dashboard
2. Gehe zum Tab "Dienstprogramme"
3. Füge diese URL in das Feld "URL importieren" ein: `https://raw.githubusercontent.com/eltoro0815/instagram-single-story-view/master/instagram-single-story.user.js`
4. Klicke auf "Installieren"

### Mobile Browser (Android)

1. Installiere den [Kiwi Browser](https://play.google.com/store/apps/details?id=com.kiwibrowser.browser) aus dem Google Play Store
2. Installiere die [Tampermonkey-Erweiterung](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo) aus dem Chrome Web Store im Kiwi Browser
3. Öffne diesen Link im Kiwi Browser: [Instagram Single Story View Script](https://raw.githubusercontent.com/eltoro0815/instagram-single-story-view/master/instagram-single-story.user.js)
4. Installiere das Script wie oben beschrieben

## Automatische Updates

Das Script aktualisiert sich automatisch, wenn eine neue Version verfügbar ist. Die Version wird durch einen GitHub Actions Workflow erhöht, der bei jedem Commit auf den `master`-Branch ausgeführt wird.

### Wie funktioniert die automatische Versionierung?

1. Bei jedem Push auf den `master`-Branch wird die GitHub Action `.github/workflows/bump-version.yml` ausgeführt
2. Die Action extrahiert die aktuelle Versionsnummer aus dem Script
3. Die Patch-Version wird um 1 erhöht (z.B. 1.0.0 → 1.0.1)
4. Die neue Version wird ins Script zurückgeschrieben und committet
5. Tampermonkey prüft regelmäßig die @updateURL und aktualisiert das Script bei einer neuen Version

## Erkennung der Karussell-Ansicht

Das Script erkennt die Karussell-Ansicht anhand mehrerer Merkmale im DOM:

- Vorhandensein von Navigationsbuttons (Weiter/Zurück)
- Mehrere Fortschrittsbalken für unterschiedliche Stories
- Die DOM-Struktur wird kontinuierlich überwacht, um auch bei dynamischen Änderungen der Seite korrekt zu reagieren

## Fehler melden

Wenn du einen Fehler findest oder Verbesserungsvorschläge hast, erstelle bitte ein [Issue auf GitHub](https://github.com/eltoro0815/instagram-single-story-view/issues). 