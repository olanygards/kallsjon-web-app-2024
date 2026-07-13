# Brief · Skiss: Stats v2

**Till:** LLM/person som gör grafisk mall
**Underlag:** befintlig skiss "Stats — nytt förslag" + `BESLUT-05-STATS.md` (kanon — vid tvekan vinner beslutet)
**Leverans:** uppdaterad mockup i samma stil och format som nuvarande (mobil 375 px, A. Översikt / B. Topplista / filter-panel / komponentexempel)

Grundstrukturen i nuvarande skiss är godkänd: Översikt + Topplista, filter-pills + bottom sheet,
resultaträknare, aktiva filter-chips, listradens hierarki. Ändra följande — inget annat.

## Ändringar

1. **Kompassros: 16 → 8 sektorer.** Etiketter N · NO · O · SO · S · SV · V · NV. Flerval (visa
   två valda sektorer ifyllda i jämtgrön), summering "2 valda" i mitten. Sektorerna ska ritas
   stora nog för tumträff (~44 px). Ta bort mellanriktningarna (NNV, VNV osv.).

2. **Sorteringsraden: fyra chips → tre.** `Högsta medel · Högsta by · Längst fönster`.
   Ta bort "Snitt medel" och "Snitt by". Lägg till ett exempel på topplistan sorterad på
   Längst fönster där huvudvärdet är timmar: **"6,2 h"** stort, medel/by som sekundärvärden.

3. **År: flerval → single-select.** En rad: `Alla · 2026 · 2025 · 2024 · …` med ett valt.
   Ta bort "2 valda"-mönstret för år.

4. **Min medelvind: slider → tre presets.** Pills med skalans språk:
   `Surfbart ≥ 10 · Bra ≥ 12 · Riktigt bra ≥ 15`, en aktiv. Ingen fri siffra, ingen slider.

5. **Färgfix i listraderna.** Huvudvärdet i nivåfärg enligt sjustegsskalan (17,8 → nattblå,
   16,2 → riktigt bra/nattblå, 14,8 → bra/djupblå) — ta bort regeln "grönt om ≥ tröskel".
   Ersätt minigradientremsan per rad med **en** nivåmarkör (fylld prick eller kort segment i
   dagens nivåfärg) intill huvudvärdet.

6. **Copy-korrigeringar.**
   - Topbar i Stats-ramarna: "Kallsjön · 7 dygn" → **"Data sedan 2023"**.
   - Snittlinjens etikett: "Snitt 2016–2025" → **"Snitt 2023–2025"**.
   - Fotnot under staplarna: "Snitt = alla hela säsonger utom vald."

7. **Nytt: tomt tillstånd.** En liten ram/kort: *"Inga dagar matchar V, NV och ≥ 15 m/s.
   Prova en lägre nivå eller fler riktningar."* med knappen `Rensa filter`.

8. **Behåll oförändrat:** KPI-korten, månadsstaplarna, per månad-listan, bottom sheet-layouten,
   "Sortera = hur listan ordnas, inte vad som filtreras"-förklaringen, listradens anatomi-exempel.

## Kontroll innan leverans

- [ ] Ingen komponent använder grönt för något annat än nivåerna Håll koll/Intressant
- [ ] Alla nivåfärger stämmer med sjustegsskalan (Surfbart jämtblå · Bra djupblå · Riktigt bra nattblå · Sällsynt fluorpink)
- [ ] Kompassen har exakt 8 sektorer och flervalsindikering
- [ ] Sorteringsraden har exakt 3 val
- [ ] "Visar X av Y dagar" syns i både Översikt och Topplista
