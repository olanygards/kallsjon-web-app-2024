# Implementationsplan – Prognosmodeller (modellmatris)

Plan för **Fas D** i [ATGARDPLAN.md](./ATGARDPLAN.md): fler öppna prognoskällor och en ny vy med **modelljämförelse** – horisontell scroll per dag, i Kallifornias grafiska stil.

Relaterat: [OVERSIKT.md – Prognoser](../OVERSIKT.md#2-prognoser-externa-apier)

**Beslut (juli 2026):**

- Börja med **öppna modeller som är enkla** (Open-Meteo).
- **Matcha appens grafik och färger** – emerald-tema, samma vindfärgskala som grafer/kalender.
- **En ruta som scrollar i sidled** – 7 dagar prognos.
- Förbättring av *Kommande dagar* på Läget kommer **efter** modellvyn.

### UX- och produktbeslut (fastställda)

| Beslut | Val |
|--------|-----|
| **Fliknamn** | Prognos |
| **Modellnamn (vänsterkolumn)** | Enbart emerald – inga färgaccents per modell |
| **Antal dagar** | 7 (`forecast_days=7`) |
| **Passerade tidslots (idag)** | Visas **gråade** – få celler, behåller kontext |
| **Open-Meteo / drift** | Appen är **internt bruk** – icke-kommersiell Open-Meteo-licens OK; attribution kvar i UI |

---

## Mål

| Mål | Beskrivning |
|-----|-------------|
| **Transparens** | Surfaren ser flera modeller sida vid sida – inte bara ett sammanslaget värde |
| **Jämförbarhet** | Samma tidsaxel, samma cellformat (riktning, medel, by) för varje modell |
| **Mobil först** | Horisontell scroll i en avgränsad ruta; modellnamn syns medan man scrollar |
| **Visuell enhet** | Samma emerald-tema, typografi och vindfärger som övriga vyer |
| **Utbyggbart** | Arkitektur som senare kan ta in MET Norway, SMHI och consensus utan omskrivning av UI |

**I scope (v1):** Open-Meteo-modeller ECMWF, GFS, ICON + modellmatris-vy + data-adapter.

**Utanför scope (v1):** MET Norway/SMHI-rader, consensus-rad, klick till Detaljer, observerad rad, växlare 1 h / 3 h, förbättrad *Kommande dagar*.

---

## Nuläge

| Del | Status |
|-----|--------|
| Prognos i Läget | En modell i prod (MET Norway); `DailyForecast` visar förenklad daglista |
| Data-hook | `useForecastModels` – parallell fetch, `WindPoint[]` per modell, cache |
| Adapters | `smhiAdapter.ts`, `metNorwayAdapter.ts` |
| Modellmatris | Finns inte |
| Vindfärger | `getWindColor()` duplicerad i flera komponenter; `WIND_CALENDAR_COLORS` i `constants.ts` |

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

## v1 – Vy: modellmatris med sidledes scroll

### Placering

**Ny flik: Prognos** i bottennavigeringen (`KallsurfHome.tsx`).

| Flik | Ikon (förslag) | Label |
|------|----------------|-------|
| Prognos | `Layers` eller `Cloud` (lucide) | Prognos |

**Navigationsanpassning:** Fem flikar på `max-w-md` kräver smalare knappar (`w-16` eller liknande) eller kortare etikett. Testa i implementation – alternativ: ikon + label endast på aktiv flik.

Läget och övriga flikar **orörda** i v1.

### Layout (wireframe)

```
┌─────────────────────────────────────────────────────────┐
│  PROGNOSMODELLER                    [↻] (senare)        │  ← sektionsrubrik (som DailyForecast)
│  Jämför ECMWF, GFS och ICON · 7 dagar                   │  ← underrad, text-emerald-500
├─────────────────────────────────────────────────────────┤
│ ┌ fixed ───┐ ┌──────── scroll-x ───────────────────────►│
│ │ ECMWF    │ │ fre 3    │ lör 4    │ sön 5    │ ...     │  ← dag-header (sticky top i scroll)
│ │ GFS      │ │02 05 08..│02 05 08..│02 05 08..│         │  ← tim-header per dag
│ │ ICON     │ │ celler   │ celler   │ celler   │         │
│ └──────────┘ └─────────────────────────────────────────│
├─────────────────────────────────────────────────────────┤
│  Förklaring färger · Open-Meteo attribution             │
└─────────────────────────────────────────────────────────┘
```

### Scrollbeteende

| Zon | Scroll | Innehåll |
|-----|--------|----------|
| **Vänsterkolumn** | Fast (sticky) | Modellnamn – ca 72–88 px bred |
| **Höger yta** | `overflow-x: auto` | Alla dagar + tidskolumner |
| **Hela kortet** | Ingen vertikal scroll i matrisen | Vertikal scroll = hela sidan (som övriga flikar) |

**Dagar:** **7 dagar** (`forecast_days=7`). Sista dagen kan ha färre tidskolumner – visa bara tillgängliga slots, inga tomma placeholders.

**Tidsgrid:** **3 timmar** – 02, 05, 08, 11, 14, 17, 20, 23.

**Passerade tider (idag):** Tidslots **före nu** visas kvar men **gråade** – reducerad opacitet på cellbakgrund och text (`opacity-40` / `bg-emerald-950/60`), så de skiljer sig från kommande slots utan att döljas.

**"Nu"-markör:** Vertikal linje eller markerad kolumn vid närmaste tidslot ≥ nu (rekommenderas i v1 om enkel).

### Cellinnehåll

Varje cell (`ForecastModelCell`):

| Element | Stil |
|---------|------|
| Vindpil | `WindDirectionArrow` – `text-emerald-400`, storlek ~12–14 px |
| Medelvind | Fet, t.ex. `text-sm font-bold` – färg från vindskala |
| Byvind | `(12.4)` – `text-[10px] text-emerald-500/80` |
| Bakgrund | Heatmap enligt vindstyrka (se design) |
| Natt | Ev. tunn `border` eller `☽` – samma logik som `isDaylight` i timeline |
| **Passerad** | `opacity-40`, dämpad bakgrund – vindvärden kvar synliga |

Tom cell (saknad data): `bg-emerald-950/20`, `–` som text.

### Laddning

- Skeleton-rader per modell (tre rader × shimmer) medan data hämtas
- Per-modell-fel: raden visas med "Kunde inte hämtas" i vänsterkolumn; celler tomma
- Global spinner endast vid första laddning utan cache

---

## Design – matcha Kallifornien

### Yttre skal (container)

Återanvänd mönster från `DailyForecast`, `HeroStats`, `StatsView`:

| Token | Värde |
|-------|-------|
| Sektionskort | `bg-emerald-900/40 border border-emerald-800/50 rounded-2xl p-4` |
| Rubrik | `text-emerald-400 text-xs font-bold uppercase tracking-wider` |
| Brödtext | `text-emerald-200` / `text-emerald-500` för sekundär |
| Sidbakgrund | Oförändrad `bg-emerald-950` (via `KallsurfHome`) |

Matrisen bor **inuti ett sådant kort** – inte fullbredds vit tabell som Windfinder.

### Vindfärger – en gemensam skala

Idag finns **tre** varianter av färgtänk:

1. `WIND_CALENDAR_COLORS` – grönt fokus 10–16+ m/s (kalender/Stats)
2. `getWindColor()` – regnbågsskala från 11 m/s (graf, DailyForecast, CalendarGrid)
3. Surfbarhetsbadges – emerald/amber i `HeroStats`

**Rekommendation för modellmatrisen:**

1. Skapa **`src/utils/windColors.ts`** – en export `getWindStrengthColor(speed: number): { bg: string; text: string }`
2. v1-implementering: **portera befintlig `getWindColor`-skala** (samma som `WindOverviewChart` / kalender) så matrisen matchar det surfare redan ser i grafer
3. Textkontrast: återanvänd `getTextColor`-logik från `CalendarGrid` (mörk text på ljusa celler, vit på stark vind)

Detta ger visuell kontinuitet direkt. **Refaktorering** av duplicerad `getWindColor` i andra filer kan göras i samma PR eller direkt efter – notera i PR att det minskar drift.

**Alternativ (diskutera innan kod):** Enbart `WIND_CALENDAR_COLORS` under 10 m/s = neutral `#e5e7eb` / `emerald-950/30`, gröna steg däröver – enklare legend men avviker från trendgrafen. **Standard i planen: chart/kalender-skala.**

### Legend (under matrisen)

Kompakt rad:

```
■ <10  ■ 10–12  ■ 12–14  ■ 14–16  ■ 16+   (m/s medel)
```

Små färgprover + `text-[10px] text-emerald-500`. Surfnivåer kan markeras med vertikala streck vid 10 och 15 m/s i legendtexten.

### Modellnamn (vänsterkolumn)

| Modell | Visningsnamn | Stil |
|--------|--------------|------|
| ECMWF | ECMWF | `text-emerald-300 text-xs font-bold` |
| GFS | GFS | samma |
| ICON | ICON | samma |

Inga färgaccents per modell i v1 – enhetlig emerald-typografi.

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
- Returnerar `{ models, timeSlots, days, loading, errors, refetch }`

Håller `ForecastView` tunn och testbar.

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
| 2.1 | `windColors.ts` – centraliserad skala | `src/utils/` |
| 2.2 | `ForecastModelCell.tsx` | `src/components/kallsurf/` |
| 2.3 | `ModelComparisonGrid.tsx` – sticky label + scroll | samma |
| 2.4 | `ForecastView.tsx` – sektion + legend + attribution | samma |
| 2.5 | Ny flik i `KallsurfHome.tsx` | `pages/` |
| 2.6 | `useForecastMatrix.ts` | `src/hooks/` |

**Acceptans:** Flik Prognos visar matris med riktig data; horisontell scroll fungerar på mobil (iOS Safari + Chrome); färger matchar trendgraf.

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
- [ ] Antal dagkolumner = faktisk prognoslängd (sista dagen kan vara kortare)
- [ ] 3 h-intervall alignar mellan modeller (samma kolumn = samma tid)
- [ ] Cache: andra besök inom 15 min använder cache (nätverkstabb)
- [ ] En modell nere: övriga rader fungerar

### UI

- [ ] Vänsterkolumn (modellnamn) stannar kvar vid horisontell scroll
- [ ] Scroll känns naturlig på telefon (ingen accidental vertikal scroll i grid)
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

| Steg | Innehåll |
|------|----------|
| **v1.1** | MET Norway-rad (befintlig adapter) |
| **v1.2** | SMHI-rad när Fas B (proxy) är klar |
| **v1.3** | Consensus-rad + visuell markering när spread > X m/s |
| **D.3** | Förbättra *Kommande dagar* baserat på modellöverens |
| **Senare** | Klick cell → Detaljer-flik; refresh-knapp (Fas A) |

---

## Beslut logg

Alla öppna frågor är besvarade (juli 2026):

| # | Beslut |
|---|--------|
| 1 | Flik **Prognos** |
| 2 | Vänsterkolumn: **enbart emerald**, inga modell-accents |
| 3 | **7 dagar** prognos |
| 4 | Passerade tidslots: **gråade**, inte dolda |
| 5 | **Internt bruk** – Open-Meteo gratis-tier |
| 6 | `getWindColor` centraliseras i `windColors.ts` om tid finns i samma PR |

**Status:** Plan klar för implementation (Fas 1 – data).

---

*Senast uppdaterad: 2026-07-03 (UX-beslut fastställda)*
