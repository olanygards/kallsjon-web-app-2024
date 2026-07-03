# Designbeslut – Kallifornien UX

Logg över produkt- och UX-beslut utifrån UX-skiss v1.4 och genomgång juli 2026.

Relaterat: UX-skiss (HTML, v1.4), [VINDSKALA.md](./VINDSKALA.md), [OVERSIKT.md](../OVERSIKT.md), [planer/PLAN-PROGNOS-MODELLER.md](../planer/PLAN-PROGNOS-MODELLER.md).

---

## Beslut 01 · Kommande 7 dagar visar bästa vind per dag

**Status:** Godkänt (2026-07-03)

**Beslut:** Sektionen **Kommande 7 dagar** i Läget ska visa **bästa vindtillfället per dag**, inte dagens max-medel eller dagsmedel.

### Definition: "bästa vind"

För varje kommande dag (7 st):

1. Titta på alla prognostidsluckor den dagen.
2. Välj luckan med **högst surfbarhetsnivå** (enligt sjustegsskalan).
3. Vid lika nivå: **högst medelvind**.
4. Vid lika: **högst byvind**.

### Chip

| Element | Innehåll |
|---------|----------|
| Veckodag | Fre, Lör, … |
| Färg/nivå | Nivå för **bästa luckan** |
| Siffra | Medelvind för bästa luckan |
| Vid behov | Markör om by ≥ 15 gör dagen surfbar trots medel &lt; 10 |

Fotnot: *Bästa vindtillfälle per dag · tryck för detaljer.*

Klick → **Detaljer** med dagen förvald.

---

## Beslut 02 · Sjustegsskala (inkl. fluorpink)

**Status:** Godkänt (2026-07-03)

**Beslut:** Appen använder **sju nivåer** (Lugnt → Sällsynt) enligt UX-skiss v1.4. Fluorpink för ≥ 18 m/s behålls.

**Konfiguration:** Trösklar och färger ska vara **inställbara centralt** — inte hårdkodade per komponent.

| Plats | Innehåll |
|-------|----------|
| `src/config/windScale.ts` | Trösklar (`minAvgMs`), färger, by-regel |
| `docs/ux/VINDSKALA.md` | Spec och tabell |
| `src/utils/windColors.ts` | *(vid implementation)* UI-hjälpare som läser config |

Nya färger eller brytpunkter = ändra `WIND_SCALE_LEVELS` (och ev. `GUST_SURFABLE_MS`), deploy — inget jakt i `HeroStats`, kalender, prognos m.m.

---

## Beslut 03 · Prognos: en dag i taget

**Status:** Godkänt (2026-07-03)

**Beslut:** Prognos-fliken visar **en dag åt gången** med modelljämförelse lodrätt — inte 7 dagars horisontell matris.

| Aspekt | Val |
|--------|-----|
| Dagval | Dagremsa (samma komponent som *Kommande 7 dagar* i Läget) |
| Grid | 8 tidskolumner (3 h) × 6 rader (consensus + 5 modeller) |
| Byta dag | Tryck i dagremsan; ev. svep på gridden |
| Data | Fortfarande 7 dagars prognos hämtas — bara en dag visas |
| Passerade luckor idag | Nedtonade, inte dolda |

**Motivering:** Lodrät modelljämförelse på 375 px kräver få kolumner. Överblick över veckan sker via dagremsan; detaljer via Detaljer.

Uppdaterad spec: [PLAN-PROGNOS-MODELLER.md](../planer/PLAN-PROGNOS-MODELLER.md).

---

## Beslut 04 · Jämtlandspalett ersätter emerald

**Status:** Godkänt (2026-07-03)

**Beslut:** Visuell omstart från emerald-tema till **Jämtlandspalett** (ur flaggan) för vindnivåer; neutral chrome i övrigt.

- Vindfärger: se [VINDSKALA.md](./VINDSKALA.md)
- Flaggrand: diskret accent under logotyp och i sidfot
- Modellnamn i prognos: neutral typografi, inga färgaccents per modell

Implementation sker stegvis vid tema-/skala-refaktorering; emerald tas bort när nya tokens används konsekvent.

---

## Öppna beslut

| # | Fråga |
|---|-------|
| 05 | Push-notiser kopplade till potential-banner (PWA) |
