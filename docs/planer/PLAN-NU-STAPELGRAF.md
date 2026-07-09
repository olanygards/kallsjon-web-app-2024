# Implementationsplan – NU-stapeldiagram (Läget)

Plan för omstrukturering av **NU-kortet** i fliken **Läget**: stapeldiagram med färgad medelvind, grå byvind, 60 min observation och 30 min prognos i 5-minutersupplösning.

Relaterat: [OVERSIKT.md – Nyckelkomponenter](../OVERSIKT.md#nyckelkomponenter) · [docs/ux/BESLUT.md](../ux/BESLUT.md) · [docs/ux/VINDSKALA.md](../ux/VINDSKALA.md) · [ATGARDPLAN.md](./ATGARDPLAN.md)

**Status:** Planerad (2026-07-09)

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

## Nuläge

| Del | Status |
|-----|--------|
| `HeroStats` | Stora tal (medel/by), nivåbadge, liten riktningspil, `WindScaleMeter` — **ingen stapelgraf** |
| `WindOverviewChart` | Separat linjegraf *Utveckling kring nu* med valbara tidsfönster |
| Data | `useKallsurfTimeline` → `timeline` med 5-minuterspunkter (`POINTS_PER_HOUR: 12`) |
| Observation | Firestore `wind`, mätning ca var 5:e minut |
| Prognos | Timdata via `resampleToHourly` i adapters (`metNorwayAdapter.ts` m.fl.) |
| Färger | `getWindColor()` i `src/utils/windColors.ts` — läser `windScale.ts` |

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

1. Hämta prognospunkter från `timeline` där `isForecast === true`.
2. **Linjär interpolation** mellan timpunkter för varje 5-min-bucket där `time > now`:
   - `avg` och `gust` interpoleras linjärt
   - `dir` interpoleras cirkulärt (återanvänd `circularMean`-logik från `timeUtils.ts`)
3. Markera alla framtida buckets med `isForecast: true`.

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
| `src/utils/nowWindChartData.ts` | `buildNowWindChartData(timeline, now)` — buckets, interpolation, sammanfattning |
| `src/components/kallsurf/NowWindChart.tsx` | Recharts-stapeldiagram, zon-etiketter, sammanfattningsrad, stor riktningspil |

### Ändrade filer

| Fil | Ändring |
|-----|---------|
| `src/components/kallsurf/HeroStats.tsx` | Integrera `NowWindChart`; flytta `WindScaleMeter` under grafen; justera riktningslayout |
| `src/pages/KallsurfHome.tsx` | Skicka `timeline` till `HeroStats` |
| `src/utils/timeUtils.ts` | Ev. `interpolateWindAtTime()` för linjär + cirkulär interpolation |

### Oförändrade

| Fil | Motivering |
|-----|------------|
| `useKallsurfTimeline.ts` | Timeline har redan rätt upplösning |
| `WindOverviewChart.tsx` | Längre trendvy — separat syfte |
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

**Prognos:** Custom `shape` — `stroke` med färg, `strokeDasharray`, `fill="none"` eller halvtransparent. Medel och by-topp följer samma färg/grå-regel men i streckat.

**Lucka:** Ingen fyllning, ev. tunn neutral kant eller helt tom yta.

### Övriga graf-element

| Element | Implementation |
|---------|----------------|
| NU-linje | `ReferenceLine` vid `now` med etikett "NU" |
| Y-axel | m/s, dynamisk max: `Math.max(15, ceil(maxGust + 2))` |
| X-axel | Tick var 10:e minut (läsbart på mobil); data var 5:e minut |
| Zon-rubriker | Text ovanför grafen: `senaste timmen` · `NU` · `nästa 30 min` |

### Stor riktningspil

Placering: höger om stapelområdet (flex-layout i `NowWindChart` eller `HeroStats`).

| Element | Innehåll |
|---------|----------|
| Pil | Stor `ArrowUp`, roterad `dir + 180°` |
| Under pil | Kortriktning (t.ex. `Väst`) + grader (`270°`) |

Värden hämtas från `currentWind` (aktuell observation, aldrig prognos).

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
| Touch/scrubb | **Ej i v1** — NU-kortet är översikt; scrubb finns i trendgrafen |

---

## Implementeringsordning

| Steg | Uppgift | Verifiering |
|------|---------|-------------|
| **1** | `buildNowWindChartData()` — obs-buckets, luckor, sammanfattning | Enhetstestbar ren funktion |
| **2** | Prognos-interpolation till 5-min i samma utility | Jämför mot kända timpunkter |
| **3** | `NowWindChart` — obs-staplar (fyllda, färg + grå topp) | Visuell kontroll desktop + mobil |
| **4** | NU-linje, zon-etiketter, axlar | Matchar skiss |
| **5** | Prognos-staplar (streckat custom shape) | Tydlig skillnad obs/prog |
| **6** | Stor riktningspil + sammanfattningsrad | Layout som referensbild |
| **7** | Integrera i `HeroStats`, `WindScaleMeter` under | Hela NU-kortet i Läget |
| **8** | Kantfall: saknad prognos, luckor, gammal data | Manuell test i dev |

---

## Testplan

- [ ] Surfbart läge (medel ≥ 10, blå staplar) — färger stämmer med badge och skala
- [ ] Lugnt läge (gröna/grå staplar) — läsbar kontrast
- [ ] Prognos streckad till höger om NU-linjen
- [ ] Tomma staplar vid luckor i obs (simulera genom att filtrera bort punkter i dev)
- [ ] Sammanfattning min/max stämmer med staplarna
- [ ] Stor pil visar aktuell riktning, uppdateras med live-data
- [ ] `WindScaleMeter` under grafen, pil vid rätt nivå
- [ ] `WindOverviewChart` oförändrad under NU-kortet
- [ ] Mobilbredd ~375 px — alla 18 staplar syns utan scroll
- [ ] Varning vid saknad prognos — obs-delen fungerar ändå

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

*Skapad: 2026-07-09*
