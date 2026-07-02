# Åtgärdsplan

Prioriterad plan för vidare arbete i **Kallsurf Home** – appens enda vy sedan legacy-städning (juli 2026).

**Historik:** [AUDIT-VERIFIERING.md](./AUDIT-VERIFIERING.md) och Fas 0–8 nedan byggde på legacy-vyer (`/home`, `/classic`, m.fl.). De sidorna och tillhörande Chart.js-kod är borttagna. Checkpoint före borttagning: commit `35570f5` på branchen `new-kall`.

---

## Statusöversikt

| Fas | Område | Status |
|-----|--------|--------|
| **0** | Build & reproducerbarhet | ✅ Klart |
| **1–8** | Legacy-buggar (WindMap, Home, ChartView …) | ⏭ Obsolete – kod borttagen |
| **A** | Pull-to-refresh & cache i huvudvyn | 📋 Nästa rekommenderade steg |
| **B** | SMHI / consensus i produktion | 📋 Öppen |
| **C** | Media-auth | 📋 Planerad (uppskjuten) |

---

## Fas 0 – Build & reproducerbarhet ✅

**Klart:** `npm run build` fungerar på ren klon. Legacy Chart.js-stack och oanvända dependencies borttagna. Prognos och stats använder `suncalc` där det behövs.

**Verifiering:**

```bash
npm install && npm run build
```

---

## Fas 1–8 (legacy) – obsolete

Följande åtgärder gällde borttagna filer och behöver **inte** implementeras i nuvarande app:

| Gammal fas | Berörde | Varför obsolete |
|------------|---------|-----------------|
| 1 | `WindMap.tsx` | Vindkarta borttagen |
| 2 | Datumväljare i `Home.tsx` | Sidan borttagen |
| 3–4 | Pull-to-refresh, `WindChart` resize | Legacy-sidor borttagna |
| 5–7 | Chart.js tooltip, `useNextWindyDay`, `useForecast` | Komponenter/hooks borttagna |
| 8 | Kosmetiska legacy-fixar | Ej relevant |

Behöver ni legacy-kod finns den kvar i git: `35570f5` (checkpoint) eller `35570f5^` på `new-kall`.

---

## Fas A – Pull-to-refresh & cache (huvudvyn)

**Problem:** Huvudvyn har ingen pull-to-refresh. `useWindData` och `useForecastModels` cachar aggressivt; användare kan inte enkelt tvinga färsk data.

### Steg

1. Lägg till pull-to-refresh i `KallsurfHome.tsx` (eller återanvänd mönster från borttagna `PullToRefresh.tsx` via git-historik).
2. Vid refresh: anropa `clearCache()` från `useWindData` och invalidera prognos-cache (`useForecastModels` / `useCacheManager`).
3. Överväg `IgnoreCacheProvider` från `useCacheManager` för en refresh-cykel.
4. Test: dra ner på Läget-fliken → verifiera nya nätverksanrop, inte bara L1/L2 inom TTL.

**Acceptanskriterier:** Efter refresh hämtas färsk data från Firestore/API.

**Berörda filer:** `src/pages/KallsurfHome.tsx`, `src/hooks/useWindData.ts`, ev. `src/hooks/useForecastModels.ts`

**Uppskattad insats:** 1–2 h.

---

## Fas B – SMHI / consensus i produktion

**Problem:** I produktion blockeras SMHI av CORS. Appen faller tillbaka till enbart MET Norway – ingen consensus.

### Alternativ

1. **Firebase Hosting rewrite / Cloud Function-proxy** för SMHI-anrop
2. **Hämta SMHI i Cloud Function** (`2024-kallsjon-functions`) och exponera via Firestore eller HTTP-endpoint
3. Behålla MET-only i prod (medvetet val – dokumentera)

**Acceptanskriterier:** Beslut dokumenterat; om consensus önskas i prod ska båda modellerna vara tillgängliga utan CORS-fel.

**Berörda filer:** `vite.config.ts` (dev-proxy redan finns), ev. functions-repot, `useForecastModels.ts`

**Uppskattad insats:** 0,5–2 dagar beroende på lösning.

---

## Fas C – Media-auth (uppskjuten)

**Status:** Planerad – **inte påbörjad**. Full specifikation i [PLAN-MEDIA-AUTH.md](./PLAN-MEDIA-AUTH.md).

**Problem:** Uppladdning styrs av hårdkodad delad kod + anonym Auth (`MediaUpload.tsx`, `DailyGallery.tsx`).

**Mål:** Firebase-konton med inbjudan/verifiering, custom claim `uploader`, behörighet via Storage/Firestore Rules.

| Del | Innehåll |
|-----|----------|
| C.0 | Inventera Firebase Rules; Auth-providers; App Check |
| C.1 | Backend: `users/`, `invites/`, Cloud Functions, Rules med claims |
| C.2 | Frontend: login/registrering, ta bort delad klientkod |
| C.3 | Admin: inbjudningsscript / manuellt godkännande |
| C.4 | Spam-skydd (rate limit, reCAPTCHA) |
| C.5 | Migration från `guest_with_code`; stäng anonym Auth |

**Uppskattad insats:** ~3–5 dagar (v1).

**Relaterat:** [OVERSIKT.md – Autentisering media](../OVERSIKT.md#autentisering-idag)

---

## Valfritt (låg prioritet)

- **Is/säsong** – tydligare modellering utöver Stats-filtret (`surfableDays.ts`)
- **Code-splitting** – `KallsurfHome`-chunk är stor (>500 kB); lazy load flikar eller Recharts
- **PWA-cache** – tydlig strategi vid deploy (användare med gammal hemskärms-app)

---

## Rekommenderad ordning

```
Fas 0 (klart) → Fas A → Fas B → Fas C
                  UX       data      auth
```

## Testplan (aktuell app)

- [x] `npm run build` på ren `node_modules`
- [ ] Pull-to-refresh i `/` – cache bypass och färsk data
- [ ] Alla flikar: Läget, Detaljer, Stats, Media
- [ ] Prognosvarning (gul ruta) vid API-fel – observation ska fortfarande fungera
- [ ] Media-uppladdning med delad kod (tills Fas C)
- [ ] PWA / hemskärmsikon efter deploy

---

*Senast uppdaterad: 2026-07-02 (legacy Fas 1–8 arkiverade; ny plan för enbart Kallsurf Home)*
