# Beslut 06 · Stats = Översikt + Topplista

**Status:** Godkänt (2026-07-13)
**Klistras in i:** `docs/ux/BESLUT.md`
**Ersätter:** UX-skissens segment Dag / Månad / Säsong samt nuvarande StatsView-filter.

Kanon för både skiss och kod. Vid konflikt mellan skiss, kod och detta dokument gäller detta dokument.

---

## 06.1 Vystruktur

| Aspekt | Val |
|--------|-----|
| Vyväxlare | Segment **Översikt \| Topplista** överst i Stats |
| Översikt (makro) | Säsongs-KPI (surfbara dagar i år mot snitt, bästa dag, vanligaste riktning) · staplar per månad (i år mot snitt) · per månad-lista → kalendern i Detaljer |
| Topplista (mikro) | Rankad daglista, klick på rad → dagvyn i Detaljer |
| Filter | Gemensamma för båda vyerna, alltid synliga som pills + bottom sheet |

## 06.2 Definition: surfbar dag

En dag är surfbar om **minst ett mätintervall** når `getEffectiveLevelIndex(avg, gust) >= Surfbart`.
By-regeln ingår därmed (by ≥ 15 räcker även om medel < 10). Ingen egen definition i Stats —
`src/config/windScale.ts` är enda källan.

> Nuvarande `hasStrongWind` (`maxForce >= 10`) är fel mot denna definition: gust-drivna dagar
> saknas i datasetet. Det åtgärdas i datalagret, inte i klienten.

## 06.3 Datafält i `dailyStats` (nya)

| Fält | Innehåll |
|------|----------|
| `isSurfableDay` | bool — minst ett intervall ≥ Surfbart (def. 06.2) |
| `surfableMinutes` | antal surfbara 5-min-intervall × 5. **Antal, inte spann** — hål mitt på dagen räknas bort |
| `surfableMinutesDaylight` | samma, begränsat till sol uppe |
| `peakLevelIndex` | högsta nivå (0–6) under dagen enligt `getEffectiveLevelIndex` |
| `peakLevelIndexDaylight` | samma, inom dagsljus |
| `windowFrom` / `windowTo` | första/sista surfbara intervall (visning; sortering sker på minutes) |

Query byts från `hasStrongWind == true` till `isSurfableDay == true`. `hasStrongWind` behålls
tills backfill är verifierad. Dagens live-post (beräknas i klienten) ska använda exakt samma logik.

## 06.4 Filter

| Filter | Semantik |
|--------|----------|
| Exkl. isperiod | som idag (`surfableDays.ts`), default på |
| Endast dagsljus | dagen räknas om surfbarhet fanns **inom dagsljus** (via nivåfunktionen — inte `hasDaylightWind10Plus`-fältet). Tröskel/peak läses då från `*Daylight`-fälten |
| Miniminivå (pill) | presets kopplade till skalan: **Surfbart (10) · Bra (12) · Riktigt bra (15)** — filtrerar på `peakLevelIndex` (nivå, inte rå m/s), så by-drivna dagar fångas. Ingen fri siffra i v1 |
| Riktning | **kompassros, 8 sektorer** (N NO O SO S SV V NV), flerval, minst 44 px träffyta per sektor. Filtrerar på `maxForceDirection` (riktning vid max medel) |
| År | **single-select**: `2026 · 2025 · 2024 · Alla`. Inget flerval — jämförelse mellan år bor i Översiktens staplar |

Alltid synligt: resultaträknare ("Visar 23 av 187 dagar") + aktiva filter som borttagbara chips.
Filterval sparas i localStorage. "Rensa alla" i panelen.

## 06.5 Sortering (Topplista, v1)

En aktiv i taget: **Högsta medel** (`maxForce`) · **Högsta by** (`maxGust`) · **Längst fönster** (`surfableMinutes`).
Inte snitt medel/by (dygnssnitt dränks av nattvind; `avgGust` byggs inte).
20 rader + "Visa fler". Värdet som styr sorteringen är radens huvudvärde; vid Längst fönster visas det som timmar ("4,5 h").

## 06.6 Färg och radutformning

- Huvudvärdet i listraden sätts i **nivåfärg enligt skalan** (17,8 m/s → nattblå) eller neutralt bläck — aldrig "grönt om ≥ tröskel". Grönt betyder Intressant, inget annat.
- En nivåmarkör (prick/segment) per rad. **Ingen** gradientremsa per rad.
- Rad: rank · datum + riktningspil · huvudvärde (stort) · sekundärvärde · chevron → Detaljer.

## 06.7 Snittdefinition (Översiktens staplar)

Snitt = medel av **alla hela säsonger utom vald** (f.n. 2023–2025 när 2026 är vald).
Skrivs ut i UI: "Snitt 2023–2025". Inte rullande, ingen magi.

## 06.8 Datastartår

Copy följer datan, inte tvärtom. Backfillen (Paket 1) rapporterar **äldsta dag med komplett
dagsaggregat**; det året används i "Data sedan YYYY" och som första säsong i snittet.
Finns rådata 2020–2022 aggregeras även de — fler hela säsonger ger ett stabilares snitt.
`useDailyStats` startår sätts till det verifierade året (f.n. **2020**). En billig query mot
äldsta `wind`-dokumentet körs vid backfill: 2019-fragment loggas men inkluderas inte i snitt
(ofullständiga dagar).

## 06.9 Uppskjutet (medvetet)

Dominerande riktning under fönstret · flerval år · fri tröskelsiffra · `avgGust` · kompass med 16 sektorer.

## 06.10 Isperiod som uppdaterbar konfiguration

Isperioden ingår **aldrig** i `dailyStats`-aggregatet — den appliceras som filter i klienten,
så att konfigändringar slår igenom retroaktivt utan backfill.

| Aspekt | Val |
|--------|-----|
| Default | 15 feb – 15 apr |
| Avvikande år | `IceConfig` per år i `src/config/iceConfig.ts` |
| Januari | Dagar före isläggning räknas som surfbara — sjön är öppen |
| Framtid | Ev. läsa config från Firestore-dokument om deploy-tröskeln blir ett hinder — byggs inte i v1 |
