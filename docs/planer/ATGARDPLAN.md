# Åtgärdsplan

Prioriterad plan för vidare arbete i **Kallsurf Home** – appens enda vy.

**Historik:** Legacy-vyer och Chart.js-kod togs bort juli 2026. Checkpoint med gammal kod: git commit `35570f5`. Audit av legacy-kod: [arkiv/AUDIT-VERIFIERING.md](./arkiv/AUDIT-VERIFIERING.md).

---

## Statusöversikt

| Fas | Område | Status |
|-----|--------|--------|
| **0** | Build & reproducerbarhet | ✅ Klart |
| **A** | Pull-to-refresh & cache i huvudvyn | 📋 Nästa rekommenderade steg |
| **B** | SMHI / consensus i produktion | 📋 Öppen |
| **C** | Media-auth | 📋 Planerad (uppskjuten) |

---

## Fas 0 – Build & reproducerbarhet ✅

**Klart:** `npm run build` fungerar på ren klon. Endast Recharts för grafer; `suncalc` för soltider i Stats.

```bash
npm install && npm run build
```

---

## Fas A – Pull-to-refresh & cache (huvudvyn)

**Problem:** Huvudvyn har ingen pull-to-refresh. `useWindData` och `useForecastModels` cachar aggressivt.

### Steg

1. Lägg till pull-to-refresh i `KallsurfHome.tsx`.
2. Vid refresh: anropa `clearCache()` från `useWindData` och invalidera prognos-cache (`useForecastModels` / `useCacheManager`).
3. Överväg `IgnoreCacheProvider` från `useCacheManager` för en refresh-cykel.
4. Test: dra ner på Läget-fliken → verifiera nya nätverksanrop.

**Berörda filer:** `src/pages/KallsurfHome.tsx`, `src/hooks/useWindData.ts`, ev. `src/hooks/useForecastModels.ts`

**Uppskattad insats:** 1–2 h.

---

## Fas B – SMHI / consensus i produktion

**Problem:** I produktion blockeras SMHI av CORS. Appen faller tillbaka till enbart MET Norway.

### Alternativ

1. Firebase Hosting rewrite / Cloud Function-proxy för SMHI
2. Hämta SMHI i Cloud Function och exponera via Firestore eller HTTP
3. Behålla MET-only i prod (medvetet val – dokumentera)

**Berörda filer:** `vite.config.ts` (dev-proxy finns), ev. `2024-kallsjon-functions`, `useForecastModels.ts`

---

## Fas C – Media-auth (uppskjuten)

Full specifikation: [PLAN-MEDIA-AUTH.md](./PLAN-MEDIA-AUTH.md).

**Problem:** Hårdkodad uppladdningskod + anonym Auth i `MediaUpload.tsx` / `DailyGallery.tsx`.

**Uppskattad insats:** ~3–5 dagar (v1).

---

## Valfritt (låg prioritet)

- Is/säsong utöver Stats-filtret (`surfableDays.ts`)
- Code-splitting av stor `KallsurfHome`-chunk
- PWA-cache-strategi vid deploy

---

## Rekommenderad ordning

```
Fas 0 (klart) → Fas A → Fas B → Fas C
```

## Testplan

- [x] `npm run build` på ren `node_modules`
- [ ] Pull-to-refresh i `/` – cache bypass
- [ ] Alla flikar: Läget, Detaljer, Stats, Media
- [ ] Prognosvarning vid API-fel – observation ska fungera
- [ ] Media-uppladdning (tills Fas C)

---

*Senast uppdaterad: 2026-07-02*
