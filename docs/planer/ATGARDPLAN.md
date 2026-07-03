# Åtgärdsplan

Prioriterad plan för vidare arbete i **Kallsurf Home** – appens enda vy.

**Historik:** Legacy-vyer och Chart.js-kod togs bort juli 2026. Checkpoint med gammal kod: git commit `35570f5`. Audit av legacy-kod: [arkiv/AUDIT-VERIFIERING.md](./arkiv/AUDIT-VERIFIERING.md).

---

## Statusöversikt

| Fas | Område | Status |
|-----|--------|--------|
| **0** | Build & reproducerbarhet | ✅ Klart |
| **A** | Manuell uppdatering (refresh-knappar) | 💤 Valfritt – vid behov per vy |
| **B** | SMHI / consensus i produktion | 📋 Öppen |
| **C** | Media-auth | 📋 Planerad (uppskjuten) |

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

---

## Fas C – Media-auth (uppskjuten)

Full specifikation: [PLAN-MEDIA-AUTH.md](./PLAN-MEDIA-AUTH.md).

**Problem:** Hårdkodad uppladdningskod + anonym Auth i `MediaUpload.tsx` / `DailyGallery.tsx`.

**Uppskattad insats:** ~3–5 dagar (v1).

---

## Valfritt (låg prioritet)

- Refresh-knappar per vy (Fas A) – när behov uppstår
- Is/säsong utöver Stats-filtret (`surfableDays.ts`)
- Code-splitting av stor `KallsurfHome`-chunk
- PWA-cache-strategi vid deploy

---

## Rekommenderad ordning

```
Fas 0 (klart) → Fas B → Fas C
Fas A (refresh-knappar) – endast vid behov, per vy
```

## Testplan

- [x] `npm run build` på ren `node_modules`
- [ ] Alla flikar: Läget, Detaljer, Stats, Media
- [ ] Prognosvarning vid API-fel – observation ska fungera
- [ ] Media-uppladdning (tills Fas C)
- [ ] Refresh-knapp (när implementerad) – verifiera cache bypass

---

*Senast uppdaterad: 2026-07-03*
