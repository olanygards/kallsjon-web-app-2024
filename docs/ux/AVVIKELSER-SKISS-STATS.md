# Avvikelser · Stats-skiss v3 (låst 2026-07-13)

Skissen är slutgiltig — inga fler skissvarv. Detta dokument listar var skissen avviker från
`docs/ux/BESLUT.md` Beslut 06 eller innehåller mockfel. **Regel vid implementation: Beslut 06
vinner över skissens pixlar. Skissen visar layout och hierarki; semantik och data kommer ur
beslutet och nivåfunktionen.**

Läggs i repot bredvid skissen. Refereras från BRIEF-CURSOR-STATS.md.

---

## A. Godkända förbättringar i skissen (uppdaterar beslutet)

1. **Filterrubriken "Miniminivå"** (tidigare "Min medelvind"). Bättre än briefens formulering —
   filtret verkar på `peakLevelIndex` inklusive by-regeln, inte på rå medelvind, och rubriken
   ska säga det. Beslut 06.4 uppdateras till "Miniminivå".
2. **Rad 5 i topplistan** (2 mar 2024 · medel 9,6 / by 16,2 · jämtblå prick) är det normerande
   exemplet på gust-dag. Detta beteende är ett acceptanskriterium, inte en illustration.

## B. Mockfel i skissen — ska INTE härmas i implementation

1. **Årsraden i filterpanelen visar "2026" två gånger** (Alla · 2026 · **2026** · 2024 · 2023).
   Andra chippen ska vara 2025. Implementeras som genererad lista av faktiska år i datan.
2. **Riktningsetiketten "VNV 290°" på rad 6** använder 16-sektorsnamn. Beslutet är 8 sektorer;
   290° ligger i sektor **V** (V = 247,5–292,5°, NV = 292,5–337,5°). Alla riktningsetiketter i
   UI genereras ur 8-sektorsindelningen — aldrig fritext från mock.
3. **Månadsstaplarna motsäger isfiltret.** "Exkl. is ✓" är aktivt men mars är årets högsta
   stapel — isperioden (15 feb–15 apr) skulle kapa feb–apr kraftigt. Staplarna är illustrativa;
   verklig rendering utgår från filtrerad data, och det är förväntat att feb–apr blir låga/tomma
   när isfiltret är på.
4. **Filtertillstånden är inte synkade mellan ramarna.** Panelen visar "Bra ≥ 12" valt medan
   båda telefonramarna visar "Surfbart ≥ 10"; räknaren säger "23 av 187" oavsett filter.
   Ramarna är separata exempel. I implementation finns **ett** filterstate (delat mellan
   Översikt, Topplista och sheet) och räknaren beräknas ur det.
5. **Nivåprickarnas exakta kulör i listan är inte normativ.** Jämtblå/djupblå/nattblå är svåra
   att skilja i skisstorlek (rad 6, medel 15,1, ska t.ex. vara nattblå). Prickfärg härleds
   alltid programmatiskt ur `getEffectiveLevel` — kopiera aldrig hex ur skissbilden.
6. **KPI-donuten "Vanligaste riktning"** har en blå/grön dekorbåge. Färgprincipen (färg = nivå)
   gäller: rendera ringen neutral (bläck/grå) eller utan båge. Riktningsbokstaven + procenttalet
   bär informationen.
7. **Tomtillståndets exempeltext** ("V, NV och ≥ 15 m/s") matchar inte ramarnas aktiva filter —
   den är fristående. Verklig text genereras ur aktuella filter.

## C. Bekräftat korrekt i skissen (bygg exakt så här)

- Segment Översikt | Topplista; filterpills alltid synliga; Filter (n)-pill öppnar sheet.
- Sorteringsrad med exakt tre val; aktiv sortering styr radens huvudvärde ("6,2 h" vid Längst fönster).
- Radanatomi: rank · datum + riktning · huvudvärde i nivåfärg · nivåprick · medel/by sekundärt · chevron → Detaljer.
- Rad 7 som Sällsynt-exempel: fluorpink på både huvudvärde och prick.
- Valmarkeringar i bläck (segment, år, kompass, sortering); nivå-presets bär nivåfärg som enda undantag.
- Kompass 8 sektorer, flerval, "2 valda"-summering; sammanfattning "V, NV" i panelraden.
- "Visar X av Y dagar" i båda vyerna; aktiva filter som borttagbara chips; Rensa alla; Visa resultat.
- Copy: "Data sedan 2023" · "Snitt 2023–2025" · "Snitt = alla hela säsonger utom vald" · semantikrad → BESLUT.md.

## D. Öppen verifiering (kvarstår från planen)

Backfill-loggen från Paket 1: antal dagar med `isSurfableDay == true` men `hasStrongWind == false`.
Siffran rapporteras innan Paket 4–6 påbörjas. Noll = misstänk bugg i aggregeringen.
