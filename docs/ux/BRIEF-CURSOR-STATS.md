# Brief · Kod: Stats v2 (Översikt + Topplista)

**Till:** LLM i Cursor, repo `kallsjon-web-app-2024`
**Kanon:** `docs/ux/BESLUT.md` Beslut 06 (klistra in `BESLUT-06-STATS.md` där först — 05 är upptaget av push-notiser)
**Skiss:** Stats-mockup v3 (låst) + `AVVIKELSER-SKISS-STATS.md` — avvikelselistan är obligatorisk
läsning: skissens pixlar är inte normativa, sektion B listar mockfel som inte får implementeras

Bygg i paketordning nedan. **Paket 1–2 före all UI** — annars byggs topplistan på ett dataset
som saknar gust-dagarna.

---

## Paket 1 · Datalager: nya fält + backfill

**Filer:** `scripts/aggregateDailyStats.ts`, functions-repots aggregering om den skriver dailyStats löpande.

Nya fält per dag enligt Beslut 06.3: `isSurfableDay`, `surfableMinutes`,
`surfableMinutesDaylight`, `peakLevelIndex`, `peakLevelIndexDaylight`, `windowFrom`, `windowTo`.

Regler:
- Surfbarhet per 5-min-intervall via `getEffectiveLevelIndex(avg, gust)` från `src/config/windScale.ts`. Ingen lokal tröskellogik.
- `surfableMinutes` = **antal** kvalificerande intervall × 5. Inte `windowTo − windowFrom`.
- Daylight-varianterna använder `sunTimes`/`daylightCalculations` för sol uppe vid intervallets tidpunkt.
- `hasStrongWind` behålls orört under migreringen.
- Backfill: kör om aggregeringen för hela historiken (2023 →). Logga antal dagar där `isSurfableDay == true` men `hasStrongWind == false` — det är gust-dagarna som varit osynliga; rapportera siffran.

**Klart när:** en känd gust-dag (medel < 10, by ≥ 15) har `isSurfableDay: true` i Firestore,
och en dag med lugn lucka mitt i fönstret har `surfableMinutes` < spannets längd.

## Paket 1b · Datastartår (ingår i backfillen)

Rapportera äldsta dag med komplett aggregat. Uppdatera "Data sedan YYYY"-copyn och
`useDailyStats`-startåret efter det (Beslut 06.8). Aggregera alla år som har rådata.

## Paket 2 · Query-byte

**Fil:** `src/hooks/useDailyStats.ts`

- Query: `where('isSurfableDay', '==', true)` i stället för `hasStrongWind`.
- Dagens live-post (rader ~150–180): beräkna samma nya fält klient-side med **samma** nivåfunktion; inkludera om `isSurfableDay`.
- Utöka `DailyStats`-interfacet med de nya fälten (optional under migrering, med fallback).
- Kontrollera att Firestore-index finns för `isSurfableDay + date`.

**Klart när:** Stats visar minst en dag som gamla queryn missade (verifiera mot Paket 1-loggen).

## Paket 3 · Filterlogik (ren funktion, före UI)

**Ny fil förslagsvis:** `src/utils/statsFilters.ts` + tester.

Signatur i stil med `applyStatsFilters(days, filters): { days, total }` där filters =
`{ excludeIce, daylightOnly, minLevelIndex, directions: Sector8[], year: number | 'all' }`.

- Is: befintlig `filterSurfableDays`/`isIcePeriod`.
- Dagsljus: dagen kvalar om `surfableMinutesDaylight > 0`; peak läses då från `peakLevelIndexDaylight`. Använd **inte** `hasDaylightWind10Plus`.
- Min-nivå: `peakLevelIndex >= minLevelIndex` (presets: index för Surfbart/Bra/Riktigt bra).
- Riktning: `maxForceDirection` → 8 sektorer (sektor = 45°, N centrerad på 0° ± 22,5°); match om sektorn ∈ valda.
- År: filtrera på datum, `'all'` = inget filter.
- Returnera även total (ofiltrerat antal) för räknaren "Visar X av Y dagar".

**Klart när:** enhetstester täcker: gust-dag passerar Surfbart-preset · nattblåsdag faller på
dagsljusfiltret · riktning 350° matchar sektor N · år + Alla.

## Paket 4 · Översikt (UI)

**Fil:** `src/components/kallsurf/StatsView.tsx` (dela gärna upp i `StatsOverview.tsx` / `StatsTopList.tsx`).

- Segment Översikt | Topplista överst; filterpills-rad under (Exkl. is ✓ · Dagsljus ✓ · nivå-preset ▾ · Filter (n)).
- KPI-kort: surfbara dagar i år mot snitt · bästa dag (klickbar → DayDetail) · vanligaste riktning.
- Månadsstaplar: gruppering client-side av filtrerade dagar per år/månad; stapel = valt år, streckad markering = snitt av alla hela säsonger utom valt (etikett "Snitt 2023–2025"). Recharts som övriga grafer, nivåfärger från `windColors.ts`.
- Per månad-lista → kalendern i Detaljer med månaden vald (samma navigering som befintliga dagklick).

## Paket 5 · Topplista (UI)

- Sorteringschips: Högsta medel (`maxForce`) · Högsta by (`maxGust`) · Längst fönster (`surfableMinutes`, visas "X,X h").
- Rad enligt skiss: rank · datum + riktningspil (`maxForceDirection`) · huvudvärde stort i **nivåfärg via `getEffectiveLevel`** · sekundärvärde · chevron → DayDetail.
- Ingen "grön om ≥ tröskel"-logik. En nivåmarkör per rad, ingen gradientremsa.
- 20 rader + "Visa fler" (+20 per klick).
- Räknare "Visar X av Y dagar" ovanför listan.

## Paket 5b · DayDetail: samma fönstersiffra som topplistan

**Fil:** `src/components/kallsurf/DayDetail.tsx`

Dagvyn visar idag spannet ("över tröskeln 11:20–19:40") som kan överdriva vid hål mitt i fönstret.
Komplettera med effektiv tid: **"över tröskeln 11:20–19:40 · 6,2 h effektivt"** där timtalet är
`surfableMinutes` (samma fält som topplistans sortering). Spannet behålls — det svarar på "när",
minuterna på "hur länge". Enda tillåtna ändringen i Detaljer.

## Paket 6 · Filter-sheet + persistens

- Bottom sheet: is (Exkludera/Inkludera) · dagsljus (Endast/Alla) · nivå-presets · kompassros 8 sektorer (flerval, ≥ 44 px per sektor, SVG med wedge-paths) · år single-select · "N dagar matchar" live · Rensa alla · Visa resultat.
- Aktiva filter som borttagbara chips under pills-raden.
- Persistens: filterstate i localStorage (`kallifornia.stats.filters.v1`), återställs vid "Rensa alla".
- Tomt tillstånd enligt skiss: förklaring + `Rensa filter`.

## Utanför scope (rör inte)

`avgGust` · flerval år · fri tröskelsiffra · dominerande riktning under fönstret ·
16-sektorskompass · ändringar i Läget/Prognos/Media · andra ändringar i Detaljer än Paket 5b.

## Definition of done (hela leveransen)

- [ ] Gust-dag (medel < 10, by ≥ 15) syns i både Översikt och Topplista
- [ ] Dagsljusfiltret utesluter dag vars enda surffönster låg efter solnedgång
- [ ] `surfableMinutes` räknar bort hål i fönstret; DayDetail (Paket 5b) och topplistan visar samma timtal
- [ ] Alla nivåfärger kommer från `windScale.ts`/`windColors.ts` — ingen lokal färglogik
- [ ] Filter överlever sidladdning; "Rensa alla" nollställer även localStorage
- [ ] `npm run build` grönt; inga ändringar utanför Stats-flödet + datalagret
