# Plan – automatisk daglig aggregering av `dailyStats`

**Problem:** Stats-fliken bygger på Firestore-collectionen `dailyStats`, som hittills bara fylls på när någon manuellt kör `npm run aggregate:historical`. Därför saknades 2026 i statistiken (upptäckt 2026-07-05).

**Lösning:** En **schemalagd Cloud Function** i syskonrepot **`2024-kallsjon-functions`** (samma repo som `collectWindData`) som varje natt aggregerar gårdagens `wind`-data till `dailyStats`. Statistiken håller sig då uppdaterad utan handpåläggning.

---

## Design

| Aspekt | Val | Motivering |
|--------|-----|------------|
| Trigger | Schemalagd, **00:20 Europe/Stockholm** | Efter midnatt är gårdagens data komplett |
| Omfång per körning | **Senaste 3 dygnen** (t.o.m. igår) | Idempotent självläkning — 1–2 missade nätter hinns ikapp automatiskt |
| Dokument-ID | `yyyy-MM-dd` (samma som skriptet) | Omkörning skriver över — inga dubbletter |
| Fält | Identiska med `scripts/aggregateDailyStats.ts` | Frontend (`useDailyStats`) fungerar oförändrad |
| Region | `europe-west1` | Samma som `collectWindData` |
| Dagens datum | Hanteras inte här | Visas redan live i appen via `wind`-collectionen |

**Idag + historik:** appen slår ihop live-dagen klientside (`useDailyStats`), funktionen tar hand om alla passerade dagar. Det manuella skriptet behålls för engångs-backfill av längre luckor.

---

## Kod — klistra in i `2024-kallsjon-functions`

Ny fil, t.ex. `src/aggregateDailyStats.ts` (anpassa import/export efter repots struktur):

```ts
import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';
import SunCalc from 'suncalc';

// Samma koordinater som scripts/aggregateDailyStats.ts i webb-repot
const KALLSJON_LAT = 63.637993;
const KALLSJON_LON = 13.033151;

const DAYS_TO_AGGREGATE = 3; // igår + två dagar bakåt (självläkning)

interface WindDoc {
  force: number;
  forceMax: number;
  direction: number;
  time: admin.firestore.Timestamp;
}

function isDaylightAtKallsjon(date: Date): boolean {
  const times = SunCalc.getTimes(date, KALLSJON_LAT, KALLSJON_LON);
  return date >= times.sunrise && date <= times.sunset;
}

function formatDateStr(d: Date): string {
  // Lokal Stockholmsdag, inte UTC
  return d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' });
}

function aggregateDay(dayData: WindDoc[], dateStr: string) {
  let maxForce = 0;
  let maxForceTime = dayData[0].time;
  let maxForceDirection = 0;
  let maxGust = 0;
  let maxGustTime = dayData[0].time;
  let sumForce = 0;
  let minForce = Infinity;
  let hasDaylightWind10Plus = false;

  for (const doc of dayData) {
    const force = doc.force || 0;
    const gust = doc.forceMax || force;

    if (force > maxForce) {
      maxForce = force;
      maxForceTime = doc.time;
      maxForceDirection = doc.direction || 0;
    }
    if (gust > maxGust) {
      maxGust = gust;
      maxGustTime = doc.time;
    }
    if (force >= 10 && isDaylightAtKallsjon(doc.time.toDate())) {
      hasDaylightWind10Plus = true;
    }
    if (force < minForce) minForce = force;
    sumForce += force;
  }

  const avgForce = dayData.length > 0 ? sumForce / dayData.length : 0;
  const [year, month] = dateStr.split('-').map(Number);

  return {
    date: dateStr,
    year,
    month,
    maxForce: Math.round(maxForce * 10) / 10,
    maxForceTime,
    avgForce: Math.round(avgForce * 10) / 10,
    minForce: Math.round((minForce === Infinity ? 0 : minForce) * 10) / 10,
    maxForceDirection,
    maxGust: Math.round(maxGust * 10) / 10,
    maxGustTime,
    dataPointsCount: dayData.length,
    hasStrongWind: maxForce >= 10,
    hasGaleForce: maxForce >= 15,
    hasDaylightWind10Plus,
    createdAt: admin.firestore.Timestamp.now(),
    updatedAt: admin.firestore.Timestamp.now(),
  };
}

/**
 * Aggregerar wind → dailyStats för de senaste dagarna (t.o.m. igår).
 * Körs varje natt 00:20 svensk tid. Idempotent: dokument-ID = datum.
 */
export const aggregateDailyStatsScheduled = onSchedule(
  {
    schedule: '20 0 * * *',
    timeZone: 'Europe/Stockholm',
    region: 'europe-west1',
  },
  async () => {
    const db = admin.firestore();

    // Fönster: [för DAYS_TO_AGGREGATE dagar sedan 00:00, idag 00:00) i Stockholm-tid
    const now = new Date();
    const end = new Date(now);
    end.setHours(0, 0, 0, 0);
    const start = new Date(end);
    start.setDate(start.getDate() - DAYS_TO_AGGREGATE);

    const snapshot = await db
      .collection('wind')
      .where('time', '>=', admin.firestore.Timestamp.fromDate(start))
      .where('time', '<', admin.firestore.Timestamp.fromDate(end))
      .orderBy('time', 'asc')
      .get();

    if (snapshot.empty) {
      logger.warn('aggregateDailyStats: inga wind-dokument i fönstret', { start, end });
      return;
    }

    // Gruppera per Stockholmsdag
    const byDay = new Map<string, WindDoc[]>();
    snapshot.docs.forEach((doc) => {
      const data = doc.data() as WindDoc;
      const dateStr = formatDateStr(data.time.toDate());
      if (!byDay.has(dateStr)) byDay.set(dateStr, []);
      byDay.get(dateStr)!.push(data);
    });

    const batch = db.batch();
    byDay.forEach((dayData, dateStr) => {
      const stats = aggregateDay(dayData, dateStr);
      batch.set(db.collection('dailyStats').doc(dateStr), stats);
    });

    await batch.commit();
    logger.info(`aggregateDailyStats: skrev ${byDay.size} dagar`, {
      dates: Array.from(byDay.keys()),
    });
  }
);
```

Registrera exporten i repots `index.ts` (bredvid `collectWindData`), och lägg till beroendet:

```bash
cd 2024-kallsjon-functions/functions   # eller motsvarande
npm install suncalc && npm install -D @types/suncalc
```

## Deploy och verifiering

```bash
# Från kallsjon-web-app/ (föräldermappen med firebase.json)
firebase deploy --only functions

# Verifiera efter första natten:
# 1. Firebase Console → Firestore → dailyStats → gårdagens datum finns
# 2. Console → Functions → aggregateDailyStatsScheduled → loggar utan fel
# 3. Appen → Stats → 2026 i "Statistik per år"
```

**Engångsåtgärd innan:** kör `npm run aggregate:historical` i webb-repot en gång för att fylla luckan jan–juli 2026. Funktionen håller den sedan stängd.

## Kostnad

En körning/natt: ~900 läsningar (3 dygn × ~290 mätningar) + ≤3 skrivningar — försumbart inom gratis-tiern.

---

## Anteckningar

- `hasGaleForce`-tröskeln följer skriptet (≥ 15 m/s). `useDailyStats` live-beräkning i webbappen använder ≥ 14 — harmlös avvikelse som kan enhetligas vid tillfälle.
- Om Trafikverket/insamlingen legat nere längre än 3 dygn: kör det manuella skriptet för perioden.
- Framtida förbättring: flytta tröskelvärden till delad konfig om functions-repot börjar dela kod med webben.

*Skapad: 2026-07-05 · uppföljning på test-feedback punkt 3b*
