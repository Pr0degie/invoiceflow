# Prompt 17 — invoiceflow: PDF-Vorschau neben dem Download

**Repo:** `invoiceflow` | **Session-Scope:** nur Frontend — das Backend liefert bereits alles Nötige

⚠️ **Reihenfolge:** Nach Prompt 14 ausführen, falls der Auth-Proxy umgesetzt wurde — die Vorschau nutzt denselben Fetch-Pfad wie der Download.

## Kontext

Um zu sehen, wie eine Rechnung aussieht, muss man das PDF aktuell herunterladen und lokal öffnen — bei jedem Iterieren an einer Draft-Rechnung nervt das. Gewünscht: ein Vorschau-Button direkt neben dem PDF-Download in der Rechnungs-Detailansicht, der das PDF in einem Dialog anzeigt, ohne Download. Der bestehende Download-Flow (`useInvoices.ts`, ~Zeile 287) holt das PDF schon als Blob über `/api/backend/api/invoices/{id}/pdf` — die Vorschau verwendet exakt denselben Fetch und hängt den Blob per Object-URL in ein `<iframe>`/`<embed>` statt in einen `<a download>`.

## Aufgaben

1. **Vorschau-Button** in `invoice-detail-view.tsx` neben dem PDF-Download (Icon: `Eye` aus lucide-react, i18n-Label in `de` und `en` ergänzen). Für Drafts zeigt er den aktuellen Render-Stand ("Entwurf"-Wasserzeichen kommt vom Backend, nichts zu tun), für finalisierte das archivierte PDF — der Endpoint unterscheidet das selbst.
2. **Vorschau-Dialog**: shadcn `Dialog` (oder `Sheet`, falls das auf Mobile besser passt — entscheide anhand der bestehenden Patterns im Repo), möglichst großflächig (~90 % Viewport), darin das PDF via `URL.createObjectURL(blob)` in einem `iframe`. Loading-State während des Fetches, Fehler-State per vorhandenem `sonner`-Toast-Muster. Object-URL beim Schließen mit `revokeObjectURL` freigeben.
3. **Mobile-Fallback**: iOS-Safari rendert PDFs in iframes nur als erste Seite oder gar nicht zuverlässig. Prüfe das Verhalten nicht spekulativ weg, sondern baue einen simplen Fallback: wenn das Rendering-Umfeld PDFs im iframe nicht darstellt (oder pauschal auf kleinen Viewports), stattdessen `window.open(objectUrl)` in neuem Tab. Halte die Weiche einfach — Viewport-Breite als Kriterium reicht.
4. **Wiederverwendung**: Wenn die Rechnungsliste (`invoice-row-actions.tsx`) bereits einen PDF-Download pro Zeile hat, biete die Vorschau dort ebenfalls an — gleiche Komponente, kein Duplikat. Hat sie keinen, lass die Liste unangetastet.

## Akzeptanzkriterien

- Vorschau funktioniert für Draft- und finalisierte Rechnungen (manuell verifiziert im Dev-Server).
- Kein Download wird ausgelöst, keine Object-URL leakt (revoke beim Schließen).
- Beide Sprachen haben Labels, `npm run lint` grün, bestehende Tests grün.

## Abschluss (Pflicht, letzter Schritt der Session)

1. Aktualisiere die Projekt-Doku: `progress.md` (was wurde umgesetzt, was bleibt offen), `CLAUDE.md` nur falls sich Konventionen/Architektur geändert haben, betroffene ADRs.
2. Committe in logischen Einheiten mit aussagekräftigen Messages und pushe den Branch.
3. Die nächste Session startet ohne Kenntnis dieser Konversation — alles, was sie wissen muss, muss in Repo-Doku oder Commit-Messages stehen.

## Leitplanken

- Kein PDF.js, kein eigener Viewer mit Zoom/Seiten-Navigation — der native Browser-Viewer im iframe genügt. Kein Backend-Touch.
- Nicht mehr bauen als die Aufgabe verlangt; bestehende UI-Patterns des Repos wiederverwenden statt neue erfinden.
- Fortschritt nur mit Belegen melden; ungetestete Umgebungen (z. B. echtes iOS) explizit als ungetestet nennen. Zusammenfassung mit dem Ergebnis beginnen.
