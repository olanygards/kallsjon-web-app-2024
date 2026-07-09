# Åtgärdsplan

Prioriterad plan för vidare arbete i **Kallsurf Home** – appens enda vy.

**Historik:** Legacy-vyer och Chart.js-kod togs bort juli 2026. Checkpoint med gammal kod: git commit `35570f5`. Audit av legacy-kod: [arkiv/AUDIT-VERIFIERING.md](./arkiv/AUDIT-VERIFIERING.md).

---

## Statusöversikt

| Fas | Område | Status |
|-----|--------|--------|
| **0** | Build & reproducerbarhet | ✅ Klart |
| **UX-1** | Vindskala, Jämtlandspalett, Kommande 7 dagar, Prognos-flik (PR #1) | ✅ **Live** (2026-07-03) |
| **UX-2** | Läget enligt skiss v1.4 — nivåmätare, Nästa surfchans, grafpolish (PR #2) | ✅ **Live** (2026-07-03) |
| **D** | Prognos – modellmatris (Open-Meteo) | ✅ **Implementerad v1** (2026-07-03) – [PLAN-PROGNOS-MODELLER.md](./PLAN-PROGNOS-MODELLER.md) |
| **E** | Detaljer-dagvyn (dagsammanfattning, mediamarkörer i graf) | ✅ **Implementerad** (2026-07-04) |
| **UX-3** | NU-stapeldiagram i Läget (60 min obs + 30 min prog) | 📋 Planerad – [PLAN-NU-STAPELGRAF.md](./PLAN-NU-STAPELGRAF.md) |
| **A** | Manuell uppdatering (refresh-knappar) | 💤 Valfritt – vid behov per vy |
| **B** | SMHI / consensus i produktion | 📋 **Nästa** |
| **C** | Media-auth | 📋 Planerad (uppskjuten) |

**Deploy:** [kallsjon.web.app](https://kallsjon.web.app) — `main` synkad med prod efter PR #1–#2 och bugfix `goToOverview` (2026-07-03).

---

## Fas 0 – Build & reproducerbarhet ✅

**Klart:** `npm run build` fungerar på ren klon. Endast Recharts för grafer; `suncalc` för soltider i Stats.

```bash
npm install && npm run build
```

---

## Fas A – Refresh-knappar (valfritt, vid behov)

**Beslut (juli 2026):** Pull-to-refresh implementeras **inte**. Live-vind uppdateras redan automatiskt (ca var 30:e sekund); prognos cachar i 15 min vilket är rimligt.

**Framåt:** Lägg till **refresh-knappar** bara där det faktiskt behövs – t.ex. om användare rapporterar att data känns gammal, eller för att tvinga omhämtning av prognos utan sidladdning.

### Möjliga platser

| Vy | Knapp? | Motivering |
|----|--------|------------|
| **Läget** | Troligen nej | Auto-uppdatering räcker för live-vind |
| **Detaljer** | Ev. ja | Om vald dag/graf ska tvingas uppdateras |
| **Stats** | Ev. ja | `dailyStats` ändras sällan; knapp mest för felsökning |
| **Media** | Ev. ja | Efter uppladdning eller för att hämta nya bilder |

### Implementation (när/närs)

1. Liten ikon-knapp (t.ex. i flikens header) – **inte** pull-to-refresh-gest.
2. Vid klick: `clearCache()` från `useWindData` och/eller `refetch()` från `useForecastModels` för aktuell vy.
3. Ev. `IgnoreCacheProvider` från `useCacheManager` för en refresh-cykel.
4. Spinner/disabled state medan data laddas.

**Berörda filer:** Beror på vy – t.ex. `KallsurfHome.tsx`, `StatsView.tsx`, `MediaView.tsx`, `useWindData.ts`, `useForecastModels.ts`

**Uppskattad insats:** ~30 min per vy (när beslut tas att lägga till).

---

## Fas B – SMHI / consensus i produktion

**Problem:** I produktion blockeras SMHI av CORS. Appen faller tillbaka till enbart MET Norway.

### Alternativ

1. Firebase Hosting rewrite / Cloud Function-proxy för SMHI
2. Hämta SMHI i Cloud Function och exponera via Firestore eller HTTP
3. Behålla MET-only i prod (medvetet val – dokumentera)

**Berörda filer:** `vite.config.ts` (dev-proxy finns), ev. `2024-kallsjon-functions`, `useForecastModels.ts`

**Koppling till Fas D:** SMHI-proxy behövs fortfarande för SMHI-raden i modellmatrisen. Övriga modeller (Open-Meteo) fungerar direkt från webbläsaren.

---

## UX-1 & UX-2 – Design enligt skiss v1.4 ✅

**Klart och deployat** (PR #1 + PR #2, juli 2026). Se [docs/ux/BESLUT.md](../ux/BESLUT.md) och [docs/ux/VINDSKALA.md](../ux/VINDSKALA.md).

| Del | Innehåll |
|-----|----------|
| **UX-1** | `windScale.ts`, Jämtlandspalett, ljus chrome, *Kommande 7 dagar* (bästa vind/dag), ny flik **Prognos** |
| **UX-2** | `WindScaleMeter`, `NextSurfChance`, tight NU-kort, graf med fönsterväxlare (−3+6 / −6+12 / −12+24), fast avläsning, stationsstatus i header |
| **Bugfix** | `goToOverview()` — rensar dagval vid återgång till Läget (fixade 0,0 i NU-kort efter Nästa surfchans → Detaljer) |

**Kvar i Läget (ej blockerande):** tröskelskuggning i grafen (fylld zon över 10 m/s), PWA-splash-bilder (`public/apple-splash-*.jpg`) i gamla mörkgröna temat.

---

## Fas D – Prognos: modellmatris ✅

**Full specifikation:** [PLAN-PROGNOS-MODELLER.md](./PLAN-PROGNOS-MODELLER.md)

**Implementerat (juli 2026):**

1. **v1-data:** Open-Meteo – ECMWF, GFS, ICON
2. **v1-ui:** Flik **Prognos** — **en dag i taget** (dagremsa + 8×6 grid), Jämtlandspalett
3. **UX:** Passerade tidslots gråade; delad dagremsa med Läget; *Kommande 7 dagar* = bästa vind per dag
4. **Drift:** Internt bruk – Open-Meteo icke-kommersiell tier

**Kvarstår:** MET/SMHI-rader och full consensus-rad i prod (kräver Fas B för SMHI).

SMHI-proxy (Fas B) och MET-rad kan läggas till i v1.1 utan att ändra grundlayout.

---

## Fas E – Detaljer-dagvyn ✅

**Implementerat** juli 2026 enligt skiss v1.4 (branch `cursor/detaljer-dagvy-f864`).

| Del | Innehåll |
|-----|----------|
| `DayDetail` | Dagsammanfattning (nivåbadge, max medel/by, riktningsspann, tröskelfönster, dagsljus) |
| Dagsgraf | 00–24 med obs/prognos-split och mediamarkörer (klick scrollar till media) |
| Media | Dagens bilder/video + uppladdning via delad `useDailyMedia`-hook |
| Navigation | Dag-bläddring ‹ ›; *Jämför modeller ›* → Prognos med dagen förvald |
| `HistoryTabs` | Renodlad till periodgraf 24H/3D/7D (utan dagval) |

**Berörda filer:** `DayDetail.tsx`, `useDailyMedia.ts`, `HistoryTabs.tsx`, `DailyGallery.tsx`, `ForecastView.tsx`, `KallsurfHome.tsx`

---

## Fas C – Media-auth (uppskjuten)

Full specifikation: [PLAN-MEDIA-AUTH.md](./PLAN-MEDIA-AUTH.md).

**Problem:** Hårdkodad uppladdningskod + anonym Auth i `MediaUpload.tsx` / `DailyGallery.tsx`.

**Uppskattad insats:** ~3–5 dagar (v1).

---

## Valfritt (låg prioritet)

- `detaljer-kalender-media.png` saknas fortfarande (se `OVERSIKT.md`)
- PWA-splash och ikoner — byt `public/apple-splash-*.jpg` till ljus/neutral palett (manifest redan uppdaterat)
- Tröskelskuggning i Lägets trendgraf (zon över 10 m/s)
- Städning: `WIND_CALENDAR_COLORS` i `constants.ts` (oanvänd efter skala-refaktorering)
- Refresh-knappar per vy (Fas A) – när behov uppstår
- Is/säsong utöver Stats-filtret (`surfableDays.ts`)
- Code-splitting av stor `KallsurfHome`-chunk (~1,1 MB)
- PWA-cache-strategi vid deploy

---

## Rekommenderad ordning

```
Fas 0, UX-1, UX-2, Fas D, Fas E (klart) → Fas B (SMHI) → Fas C (media-auth)
Valfritt: splash-bilder, tröskelskuggning, code-splitting
Fas A (refresh-knappar) – endast vid behov, per vy
```

## Testplan

- [x] `npm run build` på ren `node_modules`
- [x] Alla flikar: Läget, Detaljer, Prognos, Stats, Media (manuellt verifierat juli 2026)
- [x] Prognos-flik – en dag, modellgrid 8×N, dagremsa (Fas D)
- [x] Läget – nivåmätare, Nästa surfchans, graf fönster + scrubb (UX-2)
- [x] Återgång Läget efter dagval — NU-kort visar observation, inte 0,0 (`goToOverview`)
- [x] Detaljer-dagvy — sammanfattning, dagsgraf, mediamarkörer, dag-bläddring, Jämför modeller (Fas E)
- [ ] Prognosvarning vid API-fel – observation ska fungera (känd, fungerar)
- [ ] Media-uppladdning (tills Fas C)
- [ ] Refresh-knapp (när implementerad) – verifiera cache bypass

---

*Senast uppdaterad: 2026-07-04 (Fas E implementerad, Fas B nästa)*
