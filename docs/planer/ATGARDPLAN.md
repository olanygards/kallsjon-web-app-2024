# Åtgärdsplan

Prioriterad plan för bugfixar ([AUDIT-VERIFIERING.md](./AUDIT-VERIFIERING.md)) och planerade förbättringar. Varje steg är avgränsat för att kunna göras som separat PR.

**Status:** Media-auth (Fas 9) är dokumenterad och **uppskjuten** – implementeras senare.

---

## Fas 0 – Build & reproducerbarhet

**Problem:** `react-icons` och `sunrise-sunset-js` importeras men saknas i `package.json`.

### Steg

1. Lägg till dependencies:
   ```bash
   npm install react-icons sunrise-sunset-js
   npm install -D @types/sunrise-sunset-js   # om typer behövs
   ```
2. Alternativ för soltider: byt `sunrise-sunset-js` till befintlig `suncalc` (redan i projektet via `utils/sunTimes.ts`) och ta bort duplicerat bibliotek.
3. Verifiera ren build:
   ```bash
   rm -rf node_modules && npm install && npm run build
   ```
4. Säkerställ att CI kör build från reporoten utan föräldra-`node_modules`.

**Acceptanskriterier:** Build grön på ren klon. Inga implicita hoisted dependencies.

**Berörda filer:** `package.json`, ev. `Home.tsx` (om solbibliotek byts).

**Uppskattad insats:** 30 min.

---

## Fas 1 – Critical: WindMap

**Problem A:** Race condition mellan `Promise.all` och `timeIndex`.  
**Problem B:** Crash vid tom/för kort `mergedData` i `animate()`.

### Steg

1. **Abort/stale guard:** Lägg `let cancelled = false` i effect; sätt `cancelled = true` i cleanup. I `.then()`, returnera tidigt om `cancelled`.
2. **Läs index via ref:** `timeIndexRef.current = timeIndex` uppdateras synkront; `animate()` läser från ref istället för closure.
3. **Guard i animate:**
   ```ts
   const point = mergedData[timeIndexRef.current];
   if (!point) return; // eller avbryt loop
   const { speed, direction } = point;
   ```
4. **Clamp timeIndex** när `mergedData.length` ändras (useEffect som sätter `timeIndex` till `Math.min(timeIndex, length - 1)`).
5. Manuell test: öppna vindkarta (DailyView / Experiments / WindDetailModal), scrubba slider snabbt före SVG laddat.

**Acceptanskriterier:** Ingen konkurrerande animation; ingen crash med 0–2 datapunkter.

**Berörda filer:** `src/components/WindMap.tsx`

**Uppskattad insats:** 1–2 h.

---

## Fas 2 – High: Datumväljare timezone

**Problem:** `toISOString().split('T')[0]` i `/home` ger fel datum i CET/CEST.

### Steg

1. Inför hjälpare (eller använd `date-fns-tz` som redan finns):
   ```ts
   import { format } from 'date-fns';
   const toLocalDateInputValue = (d: Date) => format(d, 'yyyy-MM-dd');
   ```
2. Ersätt `value={currentDate.toISOString()...}` i `Home.tsx`.
3. I `handleDateChange`, tolka input som **lokal** dag:
   ```ts
   const [y, m, day] = event.target.value.split('-').map(Number);
   setCurrentDate(startOfDay(new Date(y, m - 1, day)));
   ```
4. Sök repo efter samma anti-mönster (`toISOString().split`) – idag bara `Home.tsx`.
5. Test: sätt system/simulera UTC+1 runt 00:30 – datumväljare ska visa idag.

**Acceptanskriterier:** Vald dag i picker = kalenderdag i Sverige oavsett UTC-offset.

**Berörda filer:** `src/pages/Home.tsx`, ev. `src/utils/timeUtils.ts`

**Uppskattad insats:** 45 min.

---

## Fas 3 – High: Pull-to-refresh & cache

**Problem:** Refresh nollställer inte cache; stale data returneras.

### Steg

1. I `Home.tsx`: destructura `clearCache` från `useWindData`.
2. Uppdatera `handleRefresh`:
   ```ts
   const handleRefresh = async () => {
     clearCache();
     // ev. rensa prognos-cache via useForecastModels om exponerat
     setCurrentDate(new Date());
     ...
   };
   ```
3. **Alternativ/ komplement:** Wrappa pull-to-refresh-vyer med `IgnoreCacheProvider` och toggla `ignoreCache` en gång per refresh (finns i `useCacheManager`).
4. Applicera samma mönster i `ChartView.tsx` (`handleRefresh` ändrar bara datum +1 ms idag).
5. Överväg att exportera `memoryCache.clearAll()` eller range-specifik invalidering för live-data (30 s TTL).

**Acceptanskriterier:** Efter pull-to-refresh hämtas färsk data från Firestore/API, inte L1/L2 inom TTL.

**Berörda filer:** `src/pages/Home.tsx`, `src/pages/ChartView.tsx`, ev. `src/hooks/useWindData.ts`

**Uppskattad insats:** 1–2 h.

---

## Fas 4 – High: WindChart resize

**Problem:** `window.innerWidth` i `useMemo` utan resize-listener.

### Steg

1. Lägg till state:
   ```ts
   const [viewportWidth, setViewportWidth] = useState(window.innerWidth);
   useEffect(() => {
     const onResize = () => setViewportWidth(window.innerWidth);
     window.addEventListener('resize', onResize);
     return () => window.removeEventListener('resize', onResize);
   }, []);
   ```
2. Ersätt `window.innerWidth` med `viewportWidth` i chart options `useMemo` deps och innehåll.
3. Alternativ: `ResizeObserver` på chart-container för mer exakt bredd.
4. Test: rotera mobil / ändra fönsterbredd – tick-antal ska uppdateras.

**Acceptanskriterier:** Diagramticks anpassas efter viewport utan sidladdning.

**Berörda filer:** `src/components/WindChart.tsx`

**Uppskattad insats:** 45 min.

---

## Fas 5 – Medium: Delad chart-tooltip

**Problem:** Alla charts använder samma `#chartjs-tooltip`; unmount tar bort den globalt.

### Steg

1. Unik tooltip per chart-instans: `useId()` → `chartjs-tooltip-${id}`.
2. Spara tooltip-ref i `useRef` istället för `getElementById` globalt.
3. Vid unmount: ta bara bort **egen** tooltip-node om den skapades av den instansen.
4. Uppdatera `hideTooltip` och `customTooltip` därefter.
5. Samma fix i `WindOverview.tsx` (duplicerad tooltip-logik rad ~612+).

**Acceptanskriterier:** Flera diagram på samma sida; stängning av ett påverkar inte andra.

**Berörda filer:** `src/components/WindChart.tsx`, `src/components/WindOverview.tsx`

**Uppskattad insats:** 1–2 h.

---

## Fas 6 – Medium: Windy-day search double-step

**Problem:** `useNextWindyDay` effect triggas när `groupedByDate` och `groupedForecastData` uppdateras separat.

### Steg

1. Kombinera till en “data ready”-signal:
   - Memo `const windySearchInputsReady = !loading && (windData !== undefined)`  
   - Eller debounce effect med `requestAnimationFrame` / 0 ms timeout.
2. Bättre: incrementera `searchAttemptsRef` **endast efter** att båda grupperingarna reflekterar samma `currentDate`-chunk.
3. Lägg till enhetstest eller manuell test: klick “nästa blåsiga dag” efter dataladdning – exakt ett steg per chunk.

**Acceptanskriterier:** Max ett datumssteg per sökcykel när data laddats klart.

**Berörda filer:** `src/hooks/useNextWindyDay.ts`, ev. `src/pages/Home.tsx`

**Uppskattad insats:** 1 h.

---

## Fas 7 – Medium/Low: useForecast loading-state

**Problem:** `setError(null)` saknas vid ny fetch; loading kan flimra.

### Steg

1. I början av `fetchData`: `setError(null)`.
2. Introducera `AbortController` per effect; avbryt vid cleanup.
3. I catch/finally: sätt `setLoading(false)` **endast** om request inte aborterades.
4. Överväg att behålla tidigare `data` synlig med overlay-spinner istället för `setLoading(true)` som tömmer vy.

**Acceptanskriterier:** Datumbyte visar konsekvent loading; inga kvarhängande fel efter lyckad fetch.

**Berörda filer:** `src/hooks/useForecast.ts`

**Uppskattad insats:** 1 h.

---

## Fas 8 – Low priority (valfritt)

### 8a. Månfas negativ procent (`Home.tsx`)

```ts
const phase = ((date.getTime() - reference) % (synmonth * 86400000) + synmonth * 86400000) % (synmonth * 86400000);
// eller Math.abs / normalisera till [0,1)
```

### 8b. Chart.js `drawBorder` deprecated

Byt till `border: { display: true }` på grid enligt Chart.js v4-dokumentation (`WindChart.tsx` rad 707).

### 8c. Gust-fallback `* 1.5`

Behåll som fallback men dokumentera; eller använd `forceMax`-logik konsekvent. Inte kritiskt där SMHI/MET levererar gust.

---

## Fas 9 – Media-auth (uppskjuten)

**Status:** Planerad – **inte påbörjad**. Full specifikation i [PLAN-MEDIA-AUTH.md](./PLAN-MEDIA-AUTH.md).

**Problem:** Uppladdning styrs av hårdkodad delad kod + anonym Auth (`MediaUpload.tsx`, `DailyGallery.tsx`). Ingen riktig användaridentitet; kod synlig i klienten.

**Mål:** Firebase-konton med inbjudan/verifiering, custom claim `uploader`, behörighet via Storage/Firestore Rules.

### Sammanfattning (6 delsteg när vi tar tag i det)

| Del | Innehåll |
|-----|----------|
| 9.0 | Inventera Firebase Rules; Auth-providers; App Check |
| 9.1 | Backend: `users/`, `invites/`, Cloud Functions, Rules med claims |
| 9.2 | Frontend: login/registrering, ta bort delad klientkod |
| 9.3 | Admin: inbjudningsscript / manuellt godkännande |
| 9.4 | Spam-skydd (rate limit, reCAPTCHA) |
| 9.5 | Migration från `guest_with_code`; stäng anonym Auth |

**Uppskattad insats:** ~3–5 dagar (v1).

**Öppna beslut:** se checklista i [PLAN-MEDIA-AUTH.md](./PLAN-MEDIA-AUTH.md#öppna-beslut-fyll-i-innan-implementation).

**Relaterat:** [OVERSIKT.md – Autentisering media](../OVERSIKT.md#autentisering-idag)

---

## Rekommenderad ordning

```
Fas 0–8  →  bugfixar och UX (audit)
Fas 9    →  media-auth (senare, se PLAN-MEDIA-AUTH.md)
```

```
Fas 0 → Fas 1 → Fas 2 → Fas 3 → Fas 4 → Fas 5 → Fas 6 → Fas 7 → Fas 8
  │       │       │       │
 build   crash   UX      data freshness

Fas 9 (senare): media-auth – inbjudan, Firebase-konton, Rules
```

## Testplan (gemensam)

- [ ] `npm run build` på ren `node_modules`
- [ ] WindMap: snabb slider + tom data
- [ ] `/home`: datumväljare runt midnatt (simulera timezone)
- [ ] Pull-to-refresh: verifiera nätverksanrop / cache bypass
- [ ] WindChart: resize desktop + mobil
- [ ] Två WindChart på samma sida (Experiments/Home): tooltips
- [ ] “Nästa blåsiga dag”-knapp: ett steg i taget
- [ ] Snabb datumväxling i vy som använder `useForecast`

---

*Senast uppdaterad: 2026-07-02 (Fas 9 media-auth tillagd, uppskjuten)*
