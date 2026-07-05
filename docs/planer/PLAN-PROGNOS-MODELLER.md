# Implementationsplan – Prognosmodeller (modellmatris)

Plan för **Fas D** i [ATGARDPLAN.md](./ATGARDPLAN.md): fler öppna prognoskällor och en ny vy med **modelljämförelse** — **en dag i taget**, lodrätt per modell, i Kallifornias grafiska stil.

Relaterat: [OVERSIKT.md – Prognoser](../OVERSIKT.md#2-prognoser-externa-apier) · [docs/ux/BESLUT.md](../ux/BESLUT.md) · [docs/ux/VINDSKALA.md](../ux/VINDSKALA.md)

**Beslut (juli 2026):**

- Börja med **öppna modeller som är enkla** (Open-Meteo).
- **Jämtlandspalett** och **sjustegsskala** — se `src/config/windScale.ts`.
- **En dag i taget** i UI: dagremsa (7 dagar) + grid 8×6 för vald dag — inte 7-dagars sidscroll i matrisen.
- *Kommande 7 dagar* i Läget: **bästa vindtillfälle per dag** (beslut 01 i BESLUT.md).

### UX- och produktbeslut (fastställda)

| Beslut | Val |
|--------|-----|
| **Fliknamn** | Prognos |
| **Layout** | **En dag i taget** — dagremsa + 8 tidskolumner × 6 modellrader |
| **Modellnamn (vänsterkolumn)** | Neutral typografi — inga färgaccents per modell |
| **Antal dagar (data)** | 7 (`forecast_days=7`) |
| **Dagval** | Samma dagremsa-komponent som i Läget |
| **Passerade tidslots (idag)** | Visas **gråade** – behåller kontext |
| **Open-Meteo / drift** | Appen är **internt bruk** – icke-kommersiell Open-Meteo-licens OK; attribution kvar i UI |

---

## Mål

| Mål | Beskrivning |
|-----|-------------|
| **Transparens** | Surfaren ser flera modeller sida vid sida – inte bara ett sammanslaget värde |
| **Jämförbarhet** | Samma tidsaxel, samma cellformat (riktning, medel, by) för varje modell |
| **Mobil först** | En dag i taget — 8 kolumner ryms på 375 px; lodrät modelljämförelse |
| **Visuell enhet** | Jämtlandspalett + sjustegsskala (`windScale.ts`) i alla vyer |
| **Utbyggbart** | Arkitektur som senare kan ta in MET Norway, SMHI och consensus utan omskrivning av UI |

**I scope (v1):** Open-Meteo-modeller ECMWF, GFS, ICON + modellmatris-vy + data-adapter.

**Utanför scope (v1):** MET Norway/SMHI-rader, consensus-rad som full rad (kan finnas i v1.1), observerad rad, växlare 1 h / 3 h. *Kommande 7 dagar* i Läget uppdateras separat enligt [BESLUT.md](../ux/BESLUT.md).

---

## Nuläge

| Del | Status |
|-----|--------|
| Prognos i Läget | En modell i prod (MET Norway); `DailyForecast` visar förenklad daglista |
| Data-hook | `useForecastModels` – parallell fetch, `WindPoint[]` per modell, cache |
| Adapters | `smhiAdapter.ts`, `metNorwayAdapter.ts` |
| Modellmatris | Finns inte |
| Vindfärger | Duplicerad `getWindColor()` + emerald; ska centraliseras till `windScale.ts` / `windColors.ts` |

---

## v1 – Prognoskällor (Open-Meteo)

### Modeller att aktivera

| Rad i matrisen | Open-Meteo `models`-parameter | Kommentar |
|----------------|-------------------------------|-----------|
| **ECMWF** | `ecmwf_ifs` | Motsvarar global högupplöst modell i referensbilder |
| **GFS** | `gfs_seamless` | NOAA global |
| **ICON** | `icon_seamless` | DWD (Tyskland), relevant för Norden |

Tre parallella anrop (eller ett anrop per modell) – samma adapter med olika `modelId`.

### API-anrop (specifikation)

```
GET https://api.open-meteo.com/v1/forecast
  ?latitude=63.6275
  &longitude=13.0565
  &hourly=wind_speed_10m,wind_gusts_10m,wind_direction_10m
  &wind_speed_unit=ms
  &forecast_days=7
  &models={modelId}
  &timezone=Europe/Stockholm
```

Koordinater: `KALLSJON` i `src/config/constants.ts`.

### Mappning till befintlig typ

| Open-Meteo | `WindPoint` |
|------------|-------------|
| `time` (ISO) | `time` |
| `wind_speed_10m` | `wind` |
| `wind_gusts_10m` | `gust` |
| `wind_direction_10m` | `dir` |
| – | `source`: nytt enum-värde per modell |
| `generation_time` / response meta | `runTimestamp` (valfritt v1) |

Efter fetch: **resampla till 3-timmarsintervall** (se tidsgrid nedan) via befintlig `resampleToHourly` eller ny `resampleTo3Hourly`.

### Cache och fel

Samma mönster som MET/SMHI:

- localStorage via `cacheStorage`, nyckel inkl. modell-id och 15-min-bucket
- TTL: `FETCH_CONFIG.CACHE_DURATION_MS` (15 min)
- Vid fel: visa tom cell + gul varningsrad (som befintlig prognosvarning på Läget)
- Attribution i vyfot: *Weather data by Open-Meteo.com*

### Licens

Open-Meteo är gratis för **icke-kommersiell** användning. Kallifornien är **internt bruk** – OK att använda gratis-tier. Attribution (*Weather data by Open-Meteo.com*) ska ändå visas i vyfoten.

### Senare (v1.1 – inte i första implementationen)

| Källa | Blockering |
|-------|------------|
| MET Norway | Redan adapter – lägg till som rad när matrisen fungerar |
| SMHI | CORS i prod → Fas B (proxy) |
| Consensus | Beräknas från tillgängliga rader – efter fler källor |

---

## v1 – Vy: modelljämförelse — en dag i taget

### Placering

**Ny flik: Prognos** i bottennavigeringen (`KallsurfHome.tsx`).

| Flik | Ikon (förslag) | Label |
|------|----------------|-------|
| Prognos | `Layers` eller `Cloud` (lucide) | Prognos |

**Navigationsanpassning:** Fem flikar på `max-w-md` kräver smalare knappar eller kortare etikett. Testa i implementation.

Läget och övriga flikar **orörda** i v1 (utom *Kommande 7 dagar* enligt BESLUT 01).

### Layout (wireframe)

```
┌──────────────────────────────────────────┐
│  PROGNOS · Kallsjön · 7 dygn             │
├──────────────────────────────────────────┤
│  [Idag][Lör][Sön][Mån][Tis][Ons][Tor]    │  ← dagremsa (delad komponent med Läget)
├──────────────────────────────────────────┤
│  Fre 3 juli · medel/by m/s                 │
│ ┌ fixed ─┐ ┌ 8 tidskolumner ─────────────┐│
│ │ CONS.  │ │ 00 03 06 09 12▾ 15 18 21   ││
│ │ MET    │ │ celler per 3 h              ││
│ │ SMHI   │ │                             ││
│ │ ECMWF  │ │  lodrätt: jämför modeller   ││
│ │ GFS    │ │  horisontellt: tid på dagen ││
│ │ ICON   │ │                             ││
│ └────────┘ └─────────────────────────────┘│
├──────────────────────────────────────────┤
│  Vindskala (expanderbar) · Open-Meteo     │
└──────────────────────────────────────────┘
```

### Interaktion

| Handling | Resultat |
|----------|----------|
| Tryck dag i remsan | Grid visar den dagen |
| Svep på grid (ev.) | Föregående/nästa dag |
| Tryck tidskolumn | Detaljer med dagen + timme markerad |
| ▾ på tidsaxeln | Nu-position (idag) |

**Ingen** horisontell scroll genom 7 dagar i gridden — det offrar lodrät modelljämförelse på 375 px.

### Grid-dimensioner

| Dimension | Värde |
|-----------|--------|
| **Dagar (data)** | 7 (`forecast_days=7`) |
| **Dagar (synliga)** | 1 åt gången |
| **Tidskolumner** | 8 st, **3 h** — 00, 03, 06, 09, 12, 15, 18, 21 |
| **Rader (v1.1)** | Consensus + MET + SMHI + ECMWF + GFS + ICON (6 rader) |
| **Rader (v1 data)** | Consensus + ECMWF + GFS + ICON (4 rader) — MET/SMHI i v1.1 |

Sista dagen kan ha färre kolumner — visa bara tillgängliga slots.

**Passerade tider (idag):** Nedtonade (`opacity ~0.4`), inte dolda — jämför modell mot vad som hände.

**"Nu"-markör:** Markerad kolumn vid närmaste tidslot ≥ nu.

### Cellinnehåll

Varje cell (`ForecastModelCell`):

| Element | Stil |
|---------|------|
| Vindpil | `WindDirectionArrow`, ~12–14 px |
| Medelvind | Fet — färg från `windScale.ts` |
| Byvind | `(12.4)` — sekundär text |
| Bakgrund | Cellfyllnad enligt sjustegsskala |
| Natt | Ev. `☽` — samma logik som `isDaylight` |
| **Passerad** | Nedtonad — värden kvar synliga |

Tom cell (saknad data): neutral bakgrund, `–` som text.

### Laddning

- Skeleton-rader per modell (tre rader × shimmer) medan data hämtas
- Per-modell-fel: raden visas med "Kunde inte hämtas" i vänsterkolumn; celler tomma
- Global spinner endast vid första laddning utan cache

---

## Design – matcha Kallifornien

### Yttre skal (container)

Neutral chrome enligt `APP_THEME` i `windScale.ts`. Sektionskort med diskret ram — inte fullbredds vit tabell.

Matrisen bor **inuti ett kort** på sidan.

### Vindfärger – sjustegsskala

**Godkänt:** Sju nivåer med **konfigurerbara** trösklar och färger.

| Plats | Roll |
|-------|------|
| `src/config/windScale.ts` | Trösklar + hex (single source of truth) |
| `src/utils/windColors.ts` | `getWindStrengthColor()`, textkontrast |
| [VINDSKALA.md](../ux/VINDSKALA.md) | Dokumentation |

Ersätter emerald-tema, `WIND_CALENDAR_COLORS` och duplicerad `getWindColor()`.

### Legend (expanderbar)

Sjustegsskalan från [VINDSKALA.md](../ux/VINDSKALA.md) — kompakt rad med färgprover och trösklar (6 / 8 / 10 / 12 / 15 / 18 m/s). Not om by ≥ 15 → Surfbart.

### Modellnamn (vänsterkolumn)

Neutral typografi — **inga färgaccents per modell**. Consensus-raden kan ha kraftigare ram som förstahandssvar.

---

## Dataflöde (arkitektur)

```
Open-Meteo API (×3 modeller)
        ↓
openMeteoAdapter.ts  →  WindPoint[]
        ↓
useForecastModels.ts  (utökad enum + fetch)
        ↓
useForecastMatrix.ts (ny, valfritt)  →  normaliserat 3h-grid per modell
        ↓
ForecastView.tsx
    └── ModelComparisonGrid.tsx
            └── ForecastModelCell.tsx
```

### Ny hook: `useForecastMatrix` (rekommenderad)

Ansvar:

- Anropar `useForecastModels` med `[ECMWF, GFS, ICON]`
- Bygger gemensam tidsaxel (3 h-steg, `Europe/Stockholm`)
- Returnerar `{ models, timeSlots, days, selectedDay, loading, errors, refetch }`

Håller `ForecastView` tunn och testbar. Delad **dagremsa**-komponent med Läget.

---

## Implementation – faser

### Fas 1 – Data (≈ 1 dag)

| # | Uppgift | Filer |
|---|---------|-------|
| 1.1 | Lägg till `ForecastModel.ECMWF`, `.GFS`, `.ICON` | `types/WindData.ts` |
| 1.2 | Metadata i `FORECAST_MODELS` (namn, färg, attribution) | `constants.ts` |
| 1.3 | `openMeteoAdapter.ts` | `src/api/` |
| 1.4 | Registrera fetch i `useForecastModels` | `useForecastModels.ts` |
| 1.5 | `resampleTo3Hourly` (eller dokumentera avrundning till närmaste 3 h) | `utils/timeUtils.ts` |
| 1.6 | Manuell test: tre modeller returnerar data för Kallsjön | devtools / console |

**Acceptans:** `useForecastModels({ enabledModels: [ECMWF, GFS, ICON] })` ger tre ifyllda arrays, cache fungerar vid omladdning.

### Fas 2 – UI-grund (≈ 1–1,5 dag)

| # | Uppgift | Filer |
|---|---------|-------|
| 2.1 | `windScale.ts` + `windColors.ts` | `src/config/`, `src/utils/` |
| 2.2 | `DayStrip.tsx` – delad dagremsa (Läget + Prognos) | `src/components/kallsurf/` |
| 2.3 | `ForecastModelCell.tsx` | samma |
| 2.4 | `ModelComparisonGrid.tsx` – en dag, sticky modellkolumn | samma |
| 2.5 | `ForecastView.tsx` – dagremsa + grid + legend | samma |
| 2.6 | Ny flik i `KallsurfHome.tsx` | `pages/` |
| 2.7 | `useForecastMatrix.ts` | `src/hooks/` |

**Acceptans:** Flik Prognos visar en dag med 8×N-grid; dagremsa byter dag; färger från `windScale.ts`.

### Fas 3 – Polish (≈ 0,5 dag)

| # | Uppgift |
|---|---------|
| 3.1 | Loading skeleton |
| 3.2 | Per-modell felrad |
| 3.3 | "Senast uppdaterad" i sidfot |
| 3.4 | Ev. markering av nuvarande tid |
| 3.5 | Uppdatera `OVERSIKT.md` + skärmdump i `docs/images/` |

**Acceptans:** Prod-deploy utan layoutbrott; attribution synlig.

---

## Testplan

### Funktion

- [ ] ECMWF, GFS, ICON returnerar alla vindvärden (inte NaN) för kommande 7 dagar
- [ ] Dagremsa visar 7 dagar; grid visar vald dag
- [ ] 8 tidskolumner (3 h) alignar mellan modeller
- [ ] Cache: andra besök inom 15 min använder cache (nätverkstabb)
- [ ] En modell nere: övriga rader fungerar

### UI

- [ ] Vänsterkolumn (modellnamn) sticky vid behov
- [ ] Grid ryms på 375 px utan horisontell scroll (8 kolumner)
- [ ] Cellfärger och textkontrast läsbara i sol ljus / mörkt tema
- [ ] Fem flikar i bottennav – inget klippt på smal skärm (375 px)
- [ ] Passerade tidslots idag visas gråade; kommande med full färg
- [ ] `npm run build` grön

### Regression

- [ ] Läget, Detaljer, Stats, Media oförändrade i beteende
- [ ] Befintlig MET-prognos på Läget påverkas inte (separata hooks om möjligt)

---

## Risker och mitigering

| Risk | Mitigering |
|------|------------|
| Open-Meteo rate limit / nere | Cache 15 min; visa cached data + varning |
| Fem flikar trångt | Smalare nav-knappar; testa iPhone SE |
| Färgosämja mellan vyer | Centralisera `windColors.ts`; refaktorera grafer senare |
| Modeller divergerar kraftigt | v1 visar bara data; spread-markering i v1.1 |
| Licens | Internt bruk – Open-Meteo icke-kommersiell tier OK |

---

## Efter v1 (roadmap)

| Steg | Innehåll | Status |
|------|----------|--------|
| **D.3** | *Kommande 7 dagar* i Läget — bästa vind per dag ([BESLUT 01](../ux/BESLUT.md)) | ✅ UX-1 (2026-07-03) |
| **UX-2** | Läget tight — nivåmätare, Nästa surfchans, grafpolish | ✅ (2026-07-03) |
| **v1.1** | MET Norway-rad (befintlig adapter) | 📋 |
| **v1.2** | SMHI-rad när Fas B (proxy) är klar | 📋 |
| **v1.3** | Consensus-rad + visuell markering när spread > X m/s | 📋 |
| **Fas E** | Detaljer-dagvyn — dagsammanfattning, mediamarkörer | ✅ (2026-07-04) |
| **Senare** | 7-dagars översiktsmatris (om behov); refresh-knapp (Fas A) | 📋 |

---

## Beslut logg

| # | Beslut | Datum |
|---|--------|-------|
| 1 | Flik **Prognos** | juli 2026 |
| 2 | **En dag i taget** — dagremsa + 8×6 grid, inte 7-dagars sidscroll | 2026-07-03 |
| 3 | **7 dagar** prognosdata | juli 2026 |
| 4 | Passerade tidslots: **gråade** | juli 2026 |
| 5 | **Jämtlandspalett** + sjustegsskala (`windScale.ts`) | 2026-07-03 |
| 6 | Trösklar och färger **konfigurerbara** centralt | 2026-07-03 |
| 7 | *Kommande 7 dagar*: **bästa vind per dag** | 2026-07-03 |
| 8 | Open-Meteo icke-kommersiell tier | juli 2026 |

**Status:** ✅ **Implementerad (v1)** — deployad 2026-07-03 ([kallsjon.web.app](https://kallsjon.web.app)). Kvarstår: SMHI i prod (Fas B), MET/consensus-rader i prod, uppdaterade skärmdumpar.

---

*Senast uppdaterad: 2026-07-04 (Fas E Detaljer-dagvy implementerad)*
