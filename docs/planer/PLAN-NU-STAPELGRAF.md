# Implementationsplan – NU-stapeldiagram (Läget)

Plan för omstrukturering av **NU-kortet** i fliken **Läget**: stapeldiagram med färgad medelvind, grå byvind, 60 min observation och 30 min prognos i 5-minutersupplösning.

Relaterat: [OVERSIKT.md – Nyckelkomponenter](../OVERSIKT.md#nyckelkomponenter) · [docs/ux/BESLUT.md](../ux/BESLUT.md) · [docs/ux/VINDSKALA.md](../ux/VINDSKALA.md) · [ATGARDPLAN.md](./ATGARDPLAN.md)

**Status:** ✅ Implementerad (2026-07-09) — PR #7 inkl. prognosfix

---

## Vad som gjorts (2026-07-09)

### Grundimplementation

| Del | Leverans |
|-----|----------|
| `nowWindChartData.ts` | `buildNowWindChartData()` — 18 buckets (12 obs + 6 prog), luckor, min/max-sammanfattning, Y-max |
| `NowWindChart.tsx` | Recharts-stapeldiagram: färgad medelvind, grå by-topp, NU-linje, zon-etiketter, sammanfattningsrad |
| `HeroStats.tsx` | Tre kolumner (medel / by / riktning), stapelgraf, `WindScaleMeter` under, touch-scrubb |
| `KallsurfHome.tsx` | Skickar `timeline` + `forecastHourly` till `HeroStats` |

### Layout enligt skiss (med avvikelser)

- **Tre informationskolumner** ovanför grafen: medelvind, byvind, stor riktningspil (grader + kortriktning)
- **Nivåbadge** överst; vid scrubb visas tidsstämpel + `OBS`/`PROG` till höger
- **Stapeldiagram:** 60 min observation (fyllda) + 30 min prognos (streckad kant + lätt fyllnad)
- **Vindpilar** ovanför varje stapel (nedtonade vid prognos)
- **Vindskala** (`WindScaleMeter`) under sammanfattningsraden
- **Avvikelse:** Stor pil ligger i höger kolumn (inte bredvid staplarna) — samma information, annan placering

### Polish (samma dag)

- Touch-scrubb i stapelgrafen uppdaterar de tre rutorna; släpp återgår till NU
- Prognosstaplar med streckad kant och lätt färgfyllnad (bättre synlighet på mobil)

### Prognosfix (PR #7)

**Problem:** Prognos hämtades från deduplicerad `timeline`, där observation alltid ersätter prognos i samma 5-minutersbucket. Timprognosen för innevarande timme försvann → tomma eller osynliga prognosstaplar.

**Lösning:**

1. `useKallsurfTimeline` exponerar `forecastHourly` från `processedForecastData` (rå timprognos, ej deduplicerad)
2. `buildNowWindChartData(timeline, forecastHourly)` interpolerar prognos från timdata direkt
3. Brygga från **senaste observation** till första timprognos för mjuk övergång i nästa 30 min

---

## Mål

| Mål | Beskrivning |
|-----|-------------|
| **Omedelbar överblick** | Senaste timmen + närmaste halvtimmen i en kompakt stapelvy direkt i NU-kortet |
| **Konsekvent färgspråk** | Medelvind färgas via sjustegsskalan (`getWindColor`); byvind alltid grå |
| **Rätt upplösning** | 5-minutersintervall — samma som stationsmätningen i Vassnäs |
| **Tydlig obs/prog-split** | Observation heldragen, prognos streckad, med vertikal **NU**-markör |
| **Mobil först** | ~18 staplar ska fungera på 375 px utan horisontell scroll |

**I scope:** Ny stapelgraf i `HeroStats`, datapipeline för 60+30 min-fönster, layout enligt UX-skiss (referensbild juli 2026).

**Utanför scope:** Ändringar i `WindOverviewChart` (trendgrafen −3+6 / −6+12 / −12+24 h behålls oförändrad), ändringar i datahämtning (`useWindData`, Firestore), nya prognos-API:er.

---

## Designbeslut (fastställda 2026-07-09)

| Fråga | Beslut |
|-------|--------|
| **Vindriktning** | Stor pil till höger om staplarna med grader och kortriktning under — som i skissen. Den lilla pilen under huvudtalen ersätts/avlastas av denna. |
| **Prognos-upplösning** | Linjär interpolation från timdata (MET Norway / consensus) till 5-minutersbuckets för kommande 30 min. |
| **Luckor i observation** | Visa som **tomma staplar** (ingen interpolation av obs-data). |
| **Vindskala** | `WindScaleMeter` placeras **under** stapeldiagrammet, som i skissen. |

---

## Nuläge (efter implementation)

| Del | Status |
|-----|--------|
| `HeroStats` | NU-kort med tre kolumner, nivåbadge, `NowWindChart`, scrubb, `WindScaleMeter` under grafen |
| `NowWindChart` | Stapeldiagram 60+30 min, vindpilar, sammanfattning, zon-etiketter |
| `nowWindChartData.ts` | Bucket-pipeline, obs-luckor, prognosinterpolering via `forecastHourly` |
| `WindOverviewChart` | Oförändrad trendgraf under NU-kortet |
| Data obs | `timeline` (5-minuterspunkter från Firestore) |
| Data prog | `forecastHourly` från `processedForecastData` (MET Norway / Open-Meteo / consensus) |
| Färger | `getWindColor()` — sjustegsskalan |

### Mållayout (NU-kort)

```
┌─────────────────────────────────────────────────────┐
│  Nu · observation · m/s              [nivåbadge]    │
│  10,7 medel    16,2 by                              │
├─────────────────────────────────────────────────────┤
│  senaste timmen          NU        nästa 30 min     │
│  ┌────────────────────────────┐  ┌──┐               │
│  │ ████ staplar (obs, fyllda) │  │→ │  stor pil     │
│  │ ─── NU ───                 │  │  │  270° Väst   │
│  │ ░░░ staplar (prog, streck) │  └──┘               │
│  └─────────────────────────────────────────────────┘│
│  SENASTE TIMMEN                                     │
│  ● medel 6,2 – 11,3 m/s   ● by 12,1 – 18,9 m/s     │
│  [sjustegsmätare / WindScaleMeter]                  │
└─────────────────────────────────────────────────────┘
```

Trendgrafen (`WindOverviewChart`) ligger **under** NU-kortet och ändras inte.

---

## Datamodell

### Tidsfönster

```
start = now − 60 min  (snappat till 5-min-grid)
end   = now + 30 min  (snappat till 5-min-grid)
antal buckets = 18
```

### Interface

```ts
interface NowWindBar {
  time: Date;
  timeMs: number;
  timeStr: string;           // "09:45"
  avg: number | null;
  gust: number | null;
  gustDelta: number | null;  // gust − avg (grå staplad topp)
  dir: number | null;
  isForecast: boolean;
  isGap: boolean;            // saknad obs — tom stapel
}
```

### Observation (senaste 60 min)

1. Generera fasta 5-min-buckets från `start` till `now`.
2. Filtrera `timeline` där `isForecast === false` och `time` ligger i fönstret.
3. Mappa varje mätning till närmaste bucket (tolerans ≤ 2,5 min).
4. Flera träffar i samma bucket → behåll **senaste** mätningen.
5. Bucket utan träff → `isGap: true`, `avg`/`gust` = `null` (tom stapel).

### Prognos (kommande 30 min)

1. Hämta timprognos från `forecastHourly` (`processedForecastData` via `useKallsurfTimeline`) — **inte** deduplicerad `timeline`
2. Brygga från senaste giltiga observation (`nowSnap`) vid interpolation
3. **Linjär interpolation** mellan timpunkter för varje 5-min-bucket där `time > nowSnap`:
   - `avg` och `gust` interpoleras linjärt
   - `dir` interpoleras cirkulärt (`lerpAngle`)
4. Markera alla framtida buckets med `isForecast: true`
5. Fallback: om `forecastHourly` saknas, använd `timeline.filter(isForecast)` (bakåtkompatibelt)

### Sammanfattning (under grafen)

Beräknas från obs-buckets i 60-min-fönstret (ignorera `isGap`):

| Värde | Beräkning |
|-------|-----------|
| Medel min–max | `min(avg)` – `max(avg)` bland giltiga obs |
| By min–max | `min(gust)` – `max(gust)` bland giltiga obs |

---

## Komponenter och filer

### Nya filer

| Fil | Ansvar |
|-----|--------|
| `src/utils/nowWindChartData.ts` | `buildNowWindChartData(timeline, forecastHourly, now)` — buckets, interpolation, sammanfattning |
| `src/components/kallsurf/NowWindChart.tsx` | Recharts-stapeldiagram, zon-etiketter, sammanfattningsrad, vindpilar per stapel |

### Ändrade filer

| Fil | Ändring |
|-----|---------|
| `src/components/kallsurf/HeroStats.tsx` | Tre kolumner, `NowWindChart`, scrubb, `WindScaleMeter` under grafen |
| `src/pages/KallsurfHome.tsx` | Skickar `timeline` + `forecastHourly` till `HeroStats` |
| `src/hooks/useKallsurfTimeline.ts` | Exponerar `forecastHourly` från `processedForecastData` |

### Oförändrade

| Fil | Motivering |
|-----|------------|
| `WindOverviewChart.tsx` | Längre trendvy — separat syfte |
| `useWindData.ts` / prognos-API:er | Ingen ändring i datahämtning |
| `windScale.ts` / `windColors.ts` | Befintlig färglogik återanvänds |

---

## Graf – teknisk specifikation

### Bibliotek

**Recharts** (redan i projektet) — `ComposedChart` med stackade `Bar`.

### Staplar

| Serie | dataKey | Utseende |
|-------|---------|----------|
| Medelvind | `avg` | Fyllning: `getWindColor(avg)` per stapel via `<Cell>` |
| By-topp | `gustDelta` | Fast grå (`#D4D4D4` eller `APP_THEME`-nära neutral) |
| Total höjd | — | `avg + gustDelta` = byvind |

**Observation:** Heldragen, fylld stapel.

**Prognos:** Custom `shape` — streckad kant (`strokeDasharray`), lätt fyllnad (`fillOpacity` 0,18 / 0,35). Medel och by-topp följer samma färg/grå-regel.

**Lucka:** Ingen fyllning, ev. tunn neutral kant eller helt tom yta.

### Övriga graf-element

| Element | Implementation |
|---------|----------------|
| NU-linje | `ReferenceLine` vid `now` med etikett "NU" |
| Y-axel | m/s, dynamisk max: `Math.max(15, ceil(maxGust + 2))` |
| X-axel | Tick var 10:e minut (läsbart på mobil); data var 5:e minut |
| Zon-rubriker | Text ovanför grafen: `senaste timmen` · `NU` · `nästa 30 min` |

### Stor riktningspil

Placering: **höger kolumn** i tre-kolumnslayouten i `HeroStats` (inte bredvid staplarna som i skiss).

| Element | Innehåll |
|---------|----------|
| Pil | Stor `ArrowUp`, roterad `dir + 180°` |
| Under pil | Grader (`270°`) + kortriktning (t.ex. `Väst`) |

Vid scrubb uppdateras pilen från aktiv stapel; annars från `currentWind` (aktuell observation).

### Vindskala

`WindScaleMeter` renderas **under** sammanfattningsraden — oförändrad komponent, ny position i layouten.

---

## Kantfall

| Scenario | Beteende |
|----------|----------|
| Prognos saknas | Visa obs-delen; höger halva tom eller nedtonad; ingen falsk interpolation |
| Gles obs-data | Tomma staplar (`isGap`) i saknade buckets |
| Data äldre än 15 min | Header visar ofylld punkt (befintligt); graf visar senaste tillgängliga obs |
| `gust < avg` | Klampa `gustDelta` till 0 (stationsfel) |
| Mycket smal skärm | Tunna staplar, liten `barCategoryGap`; ingen horisontell scroll |
| Touch/scrubb | Uppdaterar tre kolumner + tidsstämpel; släpp återgår till NU |

---

## Implementeringsordning

| Steg | Uppgift | Status |
|------|---------|--------|
| **1** | `buildNowWindChartData()` — obs-buckets, luckor, sammanfattning | ✅ |
| **2** | Prognos-interpolation till 5-min i samma utility | ✅ (+ `forecastHourly` i PR #7) |
| **3** | `NowWindChart` — obs-staplar (fyllda, färg + grå topp) | ✅ |
| **4** | NU-linje, zon-etiketter, axlar | ✅ |
| **5** | Prognos-staplar (streckat custom shape) | ✅ |
| **6** | Stor riktningspil + sammanfattningsrad | ✅ (pil i kolumn, inte vid staplar) |
| **7** | Integrera i `HeroStats`, `WindScaleMeter` under | ✅ |
| **8** | Kantfall: saknad prognos, luckor, gammal data | ✅ |
| **9** | Touch-scrubb + vindpilar per stapel | ✅ |
| **10** | Prognosfix: `forecastHourly` i stället för deduplicerad timeline | ✅ PR #7 |

---

## Testplan

- [x] Surfbart läge (medel ≥ 10, blå staplar) — färger stämmer med badge och skala
- [x] Lugnt läge (gröna/grå staplar) — läsbar kontrast
- [x] Prognos streckad till höger om NU-linjen
- [x] Tomma staplar vid luckor i obs
- [x] Sammanfattning min/max stämmer med staplarna
- [x] Stor pil visar aktuell riktning, uppdateras vid scrubb
- [x] `WindScaleMeter` under grafen
- [x] `WindOverviewChart` oförändrad under NU-kortet
- [x] Mobilbredd ~375 px — alla 18 staplar syns utan scroll
- [x] Varning vid saknad prognos — obs-delen fungerar ändå (`Prognos saknas`)
- [x] Touch-scrubb uppdaterar tre kolumner

---

## Uppskattad insats

| Del | Tid |
|-----|-----|
| Data-utility + interpolation | 1–2 h |
| Recharts-komponent | 2–3 h |
| Integration i HeroStats + layout | 1 h |
| Test och polish | 1 h |
| **Totalt** | **~4–6 h** |

---

## Referenser

| Resurs | Plats |
|--------|-------|
| UX-skiss / referensbild | Konversation juli 2026 (NU-kort med stapeldiagram) |
| Befintlig NU-kort | `src/components/kallsurf/HeroStats.tsx` |
| Timeline-hook | `src/hooks/useKallsurfTimeline.ts` |
| Vindfärger | `src/config/windScale.ts`, `src/utils/windColors.ts` |
| Trendgraf (oförändrad) | `src/components/kallsurf/WindOverviewChart.tsx` |

---

*Skapad: 2026-07-09 · Implementerad: 2026-07-09 · Prognosfix: PR #7*
