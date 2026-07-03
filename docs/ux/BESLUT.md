# Designbeslut – Kallifornien UX

Logg över produkt- och UX-beslut utifrån UX-skiss v1.4 och genomgång juli 2026.

Relaterat: UX-skiss (HTML, v1.4), [OVERSIKT.md](../OVERSIKT.md), [planer/PLAN-PROGNOS-MODELLER.md](../planer/PLAN-PROGNOS-MODELLER.md).

---

## Beslut 01 · Kommande 7 dagar visar bästa vind per dag

**Status:** Godkänt (2026-07-03)

**Kontext:** I UX-skissen v1.4 stod det *"Max medelvind per dag (consensus)"* under dagchipsen i Läget. Det ger en missvisande bild — en dag med kort men stark vind kan se medioker ut om man bara tittar på dagens medel.

**Beslut:** Sektionen **Kommande 7 dagar** i Läget ska visa **bästa vindtillfället per dag**, inte dagens max-medel eller dagsmedel.

### Definition: "bästa vind"

För varje kommande dag (7 st):

1. Titta på alla prognostidsluckor den dagen (timvis eller timbuckets).
2. Välj luckan med **högst surfbarhetsnivå** (enligt appskalan).
3. Vid lika nivå: välj luckan med **högst medelvind**.
4. Vid fortsatt lika: välj **högst byvind**.

Det innebär att en dag med kort surffönster (t.ex. 2 h på 11 m/s och by 17) lyfts fram även om resten av dagen är svag — så att användaren **inte missar en chans**.

### Vad som visas i chipet

| Element | Innehåll |
|---------|----------|
| Veckodag | Fre, Lör, … |
| Färg/nivå | Surfbarhetsnivå för **bästa luckan** |
| Siffra | Medelvind för bästa luckan (primärt) |
| Vid behov | Liten markör om byvinden är det som gör dagen surfbar (medel &lt; 10, by ≥ 15) |

**Visa inte** dagens max-medel, dagsmedel eller enbart consensus-max utan tidskontext.

### Detaljer vid klick

Tryck på en dag → **Detaljer** med den dagen förvald (dagvy: kurva, nivå, media, ev. länk till Prognos).

Chipet är en **signal**, inte hela svaret. Fördjupning sker alltid i Detaljer (eller Prognos om man vill jämföra modeller).

### UX-skiss v1.4 – ändring

Ersätt fotnoten under dagchips:

- ~~Max medelvind per dag (consensus) · tryck på en dag för detaljer~~
- **Bästa vindtillfälle per dag · tryck för detaljer**

Valfritt tillägg i chip-layout (v1.1): visa klockslag för bästa luckan (t.ex. *Ons · 14* ) om plats finns — idag gör `DailyForecast` detta som listkort med *kl HH:mm*.

### Implementation (referens)

Nuvarande `DailyForecast` väljer redan bästa timme per dag, men enbart på **max medelvind** och visar upp till **5 dagar**. Vid implementation:

- Uppdatera urval till surfbarhetsnivå + medel + by (enligt ovan).
- Visa **7 dagar**.
- Behåll klick → Detaljer.

---

## Öppna beslut (ej klara)

| # | Fråga |
|---|-------|
| 02 | Sjustegsskala vs fyra surfbarhetsnivåer (UX-skiss v1.4) |
| 03 | Prognos: en dag i taget vs 7 dagars sidscroll |
| 04 | Jämtlandspalett vs nuvarande emerald-tema |
| 05 | Push-notiser kopplade till potential-banner |
