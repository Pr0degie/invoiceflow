# Prompt 14 — invoiceflow: Frontend-Security (CSP + Token raus aus dem Browser)

**Repo:** `invoiceflow` | **Session-Scope:** nur Frontend, keine invoice-api-Änderungen

## Kontext

Zwei zusammenhängende Findings: (a) Das Frontend setzt keinerlei Security-Header — insbesondere keine Content-Security-Policy. (b) Das invoice-api-Access-Token liegt über `session.accessToken` im Client-JS und wird von den Hooks als Bearer-Header mitgeschickt — jede XSS-Lücke bedeutet damit 15 Minuten API-Vollzugriff. Beides zusammen ist die XSS-Verteidigung dieser Session: Token unerreichbar machen und CSP als zweite Schicht. Lies vorab `CLAUDE.md` und `src/lib/api/client.ts` (der Kommentar dort erklärt das aktuelle Proxy-Setup).

## Aufgaben

1. **Auth-Proxy statt Client-Token**: Ersetze den passiven Next.js-Rewrite `/api/backend/:path*` durch einen Route Handler (`app/api/backend/[...path]/route.ts`), der serverseitig die Session aus dem httpOnly-Cookie liest (`auth()`), den `Authorization: Bearer`-Header injiziert und die Anfrage an `NEXT_PUBLIC_API_BASE_URL` weiterleitet. Unterstütze GET/POST/PUT/PATCH/DELETE, streame Binary-Responses (PDF/XML) durch und reiche Status + Fehler-Body unverändert weiter. Danach:
   - Entferne `accessToken` aus dem `session`-Callback in `src/lib/auth.ts` (bleibt nur im server-only JWT).
   - Entferne `bearerHeader`/Token-Parameter aus den Hooks (`useInvoices`, `useStats`, `useMe`) — die Hooks rufen einfach `/api/backend/...` ohne Auth-Header auf.
   - Der Refresh-Flow in `src/lib/auth/refresh.ts` läuft weiter serverseitig direkt gegen die API (nicht durch den eigenen Proxy).
   - Bei 401 vom Backend (Session abgelaufen/Account gelöscht): bestehendes `sign-out-on-auth-error`-Verhalten muss weiter funktionieren.

2. **Security-Header in `next.config.ts`** via `headers()`: `Content-Security-Policy` (restriktiv: `default-src 'self'`; `script-src` so eng wie Next.js es erlaubt — prüfe, was der App-Router-Build tatsächlich braucht, und dokumentiere, warum jede Lockerung nötig ist), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (Kamera/Mikro/Geolocation aus), `X-Frame-Options: DENY`. HSTS macht Vercel — nicht doppeln.

3. **next-auth pinnen**: `next-auth` ist eine Beta (`^5.0.0-beta.30`) — Caret entfernen und exakt pinnen, damit `npm i` keine Breaking Changes nachzieht.

## Akzeptanzkriterien

- Login, Dashboard, Rechnungsliste, Detail, PDF-Download und Logout funktionieren manuell durchgeklickt; kein Access Token mehr im Client sichtbar (prüfbar: `session.accessToken` ist undefined, Network-Tab zeigt keine Bearer-Header vom Browser).
- CSP produziert im Dev- und Prod-Build (`npm run build && npm start`) keine Console-Violations bei normalem Durchklicken.
- `npm run lint` und bestehende CI grün.

## Abschluss (Pflicht, letzter Schritt der Session)

1. Aktualisiere die Projekt-Doku: `progress.md` (was wurde umgesetzt, was bleibt offen), `CLAUDE.md` nur falls sich Konventionen/Architektur geändert haben, betroffene ADRs.
2. Committe in logischen Einheiten mit aussagekräftigen Messages und pushe den Branch.
3. Die nächste Session startet ohne Kenntnis dieser Konversation — alles, was sie wissen muss, muss in Repo-Doku oder Commit-Messages stehen.

## Leitplanken

- Nicht mehr bauen als die drei Aufgaben — keine zusätzlichen Header-Experimente, kein Umbau der Hook-Architektur über das Token-Entfernen hinaus.
- Wenn die CSP mit Next.js-Inline-Scripts kollidiert und nur mit `'unsafe-inline'` für styles o. ä. lauffähig ist: nimm die pragmatische Variante und dokumentiere den Trade-off in einem Kommentar, statt einen Nonce-Mechanismus zu erfinden, den die Aufgabe nicht verlangt.
- Melde nur Fortschritt, den du mit einem Tool-Ergebnis belegen kannst; ungetestete Pfade explizit als ungetestet nennen.
- Abschluss-Zusammenfassung: Ergebnis zuerst, dann Details, vollständige Sätze.
