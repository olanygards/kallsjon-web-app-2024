# Vindskala – sjustegssystem

Gemensamt språk för surfbarhet och färg i hela appen. Godkänt juli 2026 (UX-skiss v1.4).

Relaterat: [BESLUT.md](./BESLUT.md), `src/config/windScale.ts`.

---

## Principer

1. **En skala, två frågor** — under surftröskeln: *kommer det bli surf?* (grönt). Över: *hur bra?* (blått, djupare med vinden). **Sällsynt** (≥ 18 m/s) i fluorpink — medvetet arv från gamla appen.
2. **Färg = vindnivå** — Jämtlandspaletten används bara för vind/surfbarhet. Chrome (nav, brödtext, kort) förblir neutralt.
3. **Tal bredvid färg** — badgen och färgen förstärker; siffrorna (medel, by) ska alltid synas.
4. **Konfigurerbart** — trösklar och färger i `windScale.ts`, inte utspridda i komponenter.

---

## Nivåer (default)

| Nivå | Tröskel (medel m/s) | Färg | Betydelse |
|------|---------------------|------|-----------|
| Lugnt | &lt; 6 | Is `#F2F6F3` | Inget på gång |
| Håll koll | ≥ 6 | Fjällgrön `#D7EBDE` | Rör på sig |
| Intressant | ≥ 8 | Jämtgrön `#00813E` | Kan bli något |
| Surfbart | ≥ 10 **eller** by ≥ 15 | Jämtblå `#0F3D9E` | Rimlig chans |
| Bra | ≥ 12 | Djupblå `#0A2B72` | Klart bättre |
| Riktigt bra | ≥ 15 | Nattblå `#071B4A` | Fina vågor |
| Sällsynt | ≥ 18 | Fluorpink `#FF2FA0` | Bästa sorten |

**By-regel:** Medel &lt; 10 m/s men by ≥ 15 → minst **Surfbart** (nivå 4) vid bedömning av tidsluckor och chip i *Kommande 7 dagar*.

---

## Var skalan används

| Yta | Användning |
|-----|------------|
| Läget | Nivåmätare, badge, dagchips, graf-skuggning |
| Detaljer | Kalenderceller, dagsbadge, daggraf |
| Prognos | Cellfyllnad per modell |
| Stats | Staplar (surfbara dagar) |
| Media | Vind-chip på miniatyrer |

---

## Konfiguration

Allt justerbart i **`src/config/windScale.ts`**:

```ts
WIND_SCALE_LEVELS   // label, minAvgMs, colors per nivå
GUST_SURFABLE_MS    // default 15
AVG_SURFABLE_MS     // default 10
APP_THEME           // neutral chrome (ersätter emerald-tema)
```

### Ändra trösklar

Justera `minAvgMs` per nivå i `WIND_SCALE_LEVELS`. Ordningen ska vara stigande.

### Ändra färger

Uppdatera `colors.bg`, `colors.bgDeep`, `colors.text`, `colors.border` per nivå. Gradienter i UI kan byggas från `bg` + `bgDeep` i CSS.

### Hjälpfunktioner

| Funktion | Syfte |
|----------|--------|
| `getLevelFromAvg(avg)` | Färg/nivå enbart från medelvind |
| `getEffectiveLevel(avg, gust)` | Inkluderar by-regeln för Surfbart |
| `getEffectiveLevelIndex(avg, gust)` | Jämför tidsluckor (bästa per dag) |

Centralisering i **`src/utils/windColors.ts`** (vid implementation) ska läsa från `windScale.ts` — ingen duplicerad hex i komponenter.

---

## Jämtlandspalett vs emerald

**Beslut:** Jämtlandspalett ersätter nuvarande emerald-tema i hela appen.

| Del | Före | Efter |
|-----|------|-------|
| Vindfärger | Regnbåg/emerald/kalender-hex | `WIND_SCALE_LEVELS` |
| Sidbakgrund | `emerald-950` | Neutral mörk/ljus enligt `APP_THEME` |
| Accents | Emerald i rubriker | Neutral text; flaggrand diskret i logotyp/sidfot |

Hexvärden PMS-matchas i senare visuellt arbete.
