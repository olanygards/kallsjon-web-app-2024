# Audit-verifiering (juli 2026)

Granskning av extern kodaudit mot **aktuell** kodbas (`kallsjon-web-app-2024`). Ingen kod ändrad – endast verifiering.

**Sammanfattning:** Auditen träffar många verkliga problem, men flera punkter refererar till **äldre kod** som redan refaktorerats. Nedan: ✅ bekräftad, ⚠️ delvis, ❌ föråldrad/ej reproducerbar.

---

## Build blocker

### Saknade dependencies (`react-icons`, `sunrise-sunset-js`)

**Status: ⚠️ Delvis korrekt**

- Importer finns i `WindRating.tsx` (`react-icons/fa`) och `Home.tsx` (`sunrise-sunset-js`).
- **Varken paketet finns i `package.json` eller i repots egna `node_modules`.**
- Build kan ändå lyckas lokalt om paket finns i **föräldermappens** `node_modules` (npm hoisting från `kallsjon-web-app/`).
- På ren CI/ny klon: **`npm install && npm run build` riskerar att fallera** tills dependencies deklareras.

---

## Critical runtime

### 1. WindMap animation race condition

**Status: ✅ Bekräftad**

`WindMap.tsx` rad 284–350:

- `animate()` läser `mergedData[timeIndex]` via closure.
- `useEffect` körs vid `timeIndex`-ändring, startar `Promise.all([loadImage...]).then(() => animate())`.
- Cleanup avbryter bara `requestAnimationFrame`, **inte** väntande promise.
- Snabb slider-scrubbing kan starta animation med **inaktuellt** `timeIndex` och konkurrerande loops.

**Korrigering i audit:** `timeIndex` initieras till **`0`**, inte `2` som audit nämnde.

### 2. WindMap crash vid kort data

**Status: ✅ Bekräftad**

Rad 300: `const { speed, direction } = mergedData[timeIndex]` utan guard i `animate()`. Tom `mergedData` eller ogiltigt index → `TypeError`.

UI-renderingen har optional chaining (`mergedData[timeIndex]?.time`); animationsloopen har inte.

---

## High severity

### 3. Date picker timezone (`Home.tsx`)

**Status: ✅ Bekräftad**

```397:397:src/pages/Home.tsx
value={currentDate.toISOString().split('T')[0]}
```

`toISOString()` är UTC. I Sverige runt midnatt kan datumväljaren visa **föregående dag**. `new Date(event.target.value)` tolkas som UTC midnatt → fel kalenderdag vid Firestore-hämtning.

Samma mönster finns **inte** i andra vyer (endast `/home`).

### 4. Pull-to-refresh bypassar inte cache

**Status: ⚠️ Delvis korrekt (annorlunda implementation än audit)**

Audit beskriver en enkel modul-`Map` med nyckel `startDate-endDate`. Nuvarande kod använder **`memoryCache` + localStorage** i `useWindData.ts`.

**Problem kvarstår:**

- `Home.handleRefresh` sätter bara `currentDate` till `now` – anropar **inte** `clearCache()`.
- Om datumintervallet (`forecastRange`) är oförändrat träffas L1/L2-cache.
- `IgnoreCacheProvider` / `useCacheManager.setIgnoreCache` används inte från pull-to-refresh.

**PullToRefresh scope:** Audit säger att bara header (~56 px) wrappas. **Fel i nuvarande kod** – `PullToRefresh` wrappar hela `<main>` i `Home.tsx` (rad 370–625). Header ligger utanför. Gester fungerar på huvudinnehållet, men kräver `scrollY === 0`.

### 5. Chart svarar inte på window resize

**Status: ✅ Bekräftad**

`WindChart.tsx` rad 676 och 825: `window.innerWidth` i `useMemo` utan `resize`-listener. React re-renderar inte vid viewport-ändring → `maxTicksLimit` m.m. låses vid initial bredd.

### 6. Chart crash – saknad null guard (Medelvind)

**Status: ❌ Föråldrad**

Både **Byvind** och **Medelvind** har nu guard:

```497:497:src/components/WindChart.tsx
if (!ctx.p0?.parsed || !ctx.p1?.parsed) return undefined;
```

Auditens asymmetri mellan dataseten gäller inte längre.

### 7. AdvancedWindStats crash vid tom data

**Status: ❌ Föråldrad / redan åtgärdat**

`AdvancedWindStats` i `WindOverview.tsx`:

- `bestWindYear`: guard `Object.entries(...).length > 0` (rad 182–189)
- `highestGustDay`: guard `windyDays.length > 0` (rad 192–194)
- `bestSeason` / `seasonMonths`: ternary med `'Ingen data'` (rad 256–260, 331)

Tom `windyDays` ger tom UI, inte crash.

### 8. Duplicerade dagar vid incremental fetch

**Status: ❌ Föråldrad – kod borttagen**

Ingen `fetchWindyDays`, `lastFetchedDate`, `dailyMax` eller `where('time', '>', ...)` incremental merge i nuvarande `WindOverview.tsx`. Experiments deduplicerar via `dateMap` (en post per datum, högsta vind).

### 9. Fel vindinterpolation

**Status: ❌ Föråldrad – kod borttagen**

Ingen `prevHour`/`nextHour`-interpolation i nuvarande `src/`. WindMap använder diskreta index i `mergedData`, ingen tim-interpolation.

### 10. Forecast loading flicker vid datumbyte

**Status: ⚠️ Delvis korrekt**

`useForecast.ts` har **ingen AbortController** (audit nämner abort i `finally` – stämmer inte längre).

Kvarvarande problem:

- `setLoading(true)` vid varje effect-körning (rad 93) utan att nollställa `error` i början.
- Vid snabba `startDate`/`endDate`-byten kan `mounted`-flagga förhindra stale `setData`, men loading kan flimra.
- Cache-träff returnerar utan att rensa gammalt fel.

---

## Medium severity

| # | Issue | Status | Kommentar |
|---|-------|--------|-----------|
| 11 | Windy-day search double-fires | ✅ | `useNextWindyDay` effect deps: `groupedByDate` + `groupedForecastData` kan uppdateras separat → dubbel steg |
| 12 | Shared chart tooltip DOM | ✅ | Global `#chartjs-tooltip`; unmount i en chart tar bort element för andra |
| 13 | Slider gradient NaN | ❌ | `slider.tsx` rad 50–54 hanterar `data.length === 1` |
| 14 | Stale closure fetchWindyDays | ❌ | Funktionen finns inte längre |

---

## Low severity

| Issue | Status | Kommentar |
|-------|--------|-----------|
| Fabricated gust i `useForecast` | ❌ | `useForecast.ts` rad 62 hämtar SMHI `gust`. Fallback `* 1.5` finns kvar i `WindChart.tsx` och `windDataConverter.ts` när gust saknas |
| Negative moon phase | ✅ | `Home.tsx` rad 32: `%` kan ge negativ fas före referensdatum |
| Deprecated `drawBorder` | ✅ | `WindChart.tsx` rad 707 |
| Misleading slider labels WindMap | ❌ | Labels använder `mergedData[0]`, `[length/2]`, `[length-1]` (rad 422–425), inte hårdkodade tider |

---

## Räknad sammanfattning (verifierad)

| Severity | Audit | Verifierat kvar |
|----------|-------|-----------------|
| Build | 1 | 1 (deklaration i package.json) |
| Critical | 2 | 2 |
| High | 8 | 3 (+ 2 delvis) |
| Medium | 4 | 2 |
| Low | 4 | 2 (+ 1 delvis gust-fallback) |

**Totalt bekräftade åtgärder:** ~10 punkter (se [ATGARDPLAN.md](./ATGARDPLAN.md)).
