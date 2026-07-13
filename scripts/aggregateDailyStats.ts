import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  initializeApp,
  cert,
  applicationDefault,
  getApps,
  type ServiceAccount,
} from "firebase-admin/app";
import { getFirestore, Timestamp, type Firestore } from "firebase-admin/firestore";
import { format, startOfMonth, endOfMonth } from "date-fns";
import * as dotenv from "dotenv";
import {
  aggregateWindIntervals,
  type WindInterval,
} from "../src/utils/dailyStatsAggregation.ts";

dotenv.config();

function initFirestore(): Firestore {
  if (getApps().length > 0) {
    return getFirestore();
  }

  const projectId = process.env.VITE_FIREBASE_PROJECT_ID;
  if (!projectId) {
    throw new Error("VITE_FIREBASE_PROJECT_ID saknas i .env");
  }

  const credentialsPath =
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    process.env.FIREBASE_SERVICE_ACCOUNT;

  if (credentialsPath) {
    const serviceAccount = JSON.parse(
      readFileSync(resolve(credentialsPath), "utf8")
    ) as ServiceAccount;
    initializeApp({
      credential: cert(serviceAccount),
      projectId,
    });
  } else {
    initializeApp({
      credential: applicationDefault(),
      projectId,
    });
  }

  return getFirestore();
}

const db = initFirestore();

interface WindDocument {
  force: number;
  forceMax: number;
  direction: number;
  time: Timestamp;
}

const migrationStats = {
  gustOnlySurfableDays: 0,
  oldestCompleteDate: null as string | null,
  gapExampleDays: [] as Array<{ date: string; surfableMinutes: number; spanMinutes: number }>,
};

function toWindIntervals(dayData: WindDocument[]): WindInterval[] {
  return dayData.map((doc) => ({
    force: doc.force || 0,
    forceMax: doc.forceMax,
    direction: doc.direction || 0,
    time: doc.time.toDate(),
  }));
}

function aggregateDayData(dayData: WindDocument[], dateStr: string) {
  const stats = aggregateWindIntervals(toWindIntervals(dayData), dateStr);

  if (stats.isSurfableDay && !stats.hasStrongWind) {
    migrationStats.gustOnlySurfableDays++;
  }

  if (
    !migrationStats.oldestCompleteDate ||
    dateStr < migrationStats.oldestCompleteDate
  ) {
    migrationStats.oldestCompleteDate = dateStr;
  }

    if (stats.isSurfableDay && stats.windowFrom && stats.windowTo) {
    const spanMinutes = Math.round(
      (stats.windowTo.getTime() - stats.windowFrom.getTime()) / (1000 * 60) + 5
    );
    if (stats.surfableMinutes < spanMinutes && migrationStats.gapExampleDays.length < 3) {
      migrationStats.gapExampleDays.push({
        date: dateStr,
        surfableMinutes: stats.surfableMinutes,
        spanMinutes,
      });
    }
  }

  return {
    ...stats,
    maxForceTime: Timestamp.fromDate(stats.maxForceTime),
    maxGustTime: Timestamp.fromDate(stats.maxGustTime),
    windowFrom: stats.windowFrom ? Timestamp.fromDate(stats.windowFrom) : null,
    windowTo: stats.windowTo ? Timestamp.fromDate(stats.windowTo) : null,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
}

async function processMonth(year: number, month: number): Promise<number> {
  const monthStart = startOfMonth(new Date(year, month - 1, 1));
  const monthEnd = endOfMonth(new Date(year, month - 1, 1));

  console.log(`Processing ${format(monthStart, "yyyy-MM")}...`);

  const snapshot = await db
    .collection("wind")
    .where("time", ">=", Timestamp.fromDate(monthStart))
    .where("time", "<=", Timestamp.fromDate(monthEnd))
    .orderBy("time", "asc")
    .get();

  console.log(`  Found ${snapshot.docs.length} wind documents`);

  if (snapshot.docs.length === 0) {
    console.log("  Skipping (no data)");
    return 0;
  }

  const dayGroups = new Map<string, WindDocument[]>();

  snapshot.docs.forEach((doc) => {
    const data = doc.data() as WindDocument;
    const dateStr = format(data.time.toDate(), "yyyy-MM-dd");

    if (!dayGroups.has(dateStr)) {
      dayGroups.set(dateStr, []);
    }
    dayGroups.get(dateStr)?.push(data);
  });

  console.log(`  Grouped into ${dayGroups.size} days`);

  const batch = db.batch();
  let writeCount = 0;

  dayGroups.forEach((dayData, dateStr) => {
    const stats = aggregateDayData(dayData, dateStr);
    batch.set(db.collection("dailyStats").doc(dateStr), stats);
    writeCount++;
  });

  await batch.commit();
  console.log(`  ✓ Wrote ${writeCount} daily stats documents`);

  return writeCount;
}

async function verifyOldestWindDocument() {
  try {
    const snapshot = await db.collection("wind").orderBy("time", "asc").limit(1).get();
    if (snapshot.empty) {
      console.log("  Äldsta wind-dokument: inget hittat");
      return;
    }
    const oldest = snapshot.docs[0].data().time.toDate() as Date;
    const year = oldest.getFullYear();
    console.log(`  Äldsta wind-dokument: ${oldest.toISOString()} (år ${year})`);
    if (year < 2020) {
      console.log(
        `  ⚠ ${year}-fragment finns före 2020 — aggregeras inte in i snitt/copy ("Data sedan 2020")`
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`  ⚠ Kunde inte verifiera äldsta wind-dokument: ${message}`);
    console.log("  (Fortsätter backfill — kör npm run verify:wind-start separat vid behov.)");
  }
}

async function migrateHistoricalData() {
  console.log("=".repeat(60));
  console.log("Daily Stats Migration Script (Admin SDK)");
  console.log("=".repeat(60));
  console.log("");

  console.log("Verifierar äldsta wind-dokument...");
  await verifyOldestWindDocument();
  console.log("");

  const startYear = Number(process.env.AGGREGATE_START_YEAR ?? 2020);
  const endDate = new Date();
  const endYear = endDate.getFullYear();
  const endMonth = endDate.getMonth() + 1;

  let totalDays = 0;

  try {
    for (let year = startYear; year <= endYear; year++) {
      const lastMonth = year === endYear ? endMonth : 12;

      for (let month = 1; month <= lastMonth; month++) {
        const daysProcessed = await processMonth(year, month);
        totalDays += daysProcessed;

        await new Promise((resolveDelay) => setTimeout(resolveDelay, 500));
      }
    }

    const oldestYear = migrationStats.oldestCompleteDate
      ? migrationStats.oldestCompleteDate.slice(0, 4)
      : "—";

    console.log("");
    console.log("=".repeat(60));
    console.log("✓ Migration Complete!");
    console.log(`  Total daily stats written: ${totalDays}`);
    console.log("");
    console.log("── Backfill-kvitto (Paket 1 / 1b) ──");
    console.log(
      `  Gust-drivna surfardagar (isSurfableDay && !hasStrongWind): ${migrationStats.gustOnlySurfableDays}`
    );
    console.log(
      `  Äldsta dag med komplett aggregat: ${migrationStats.oldestCompleteDate ?? "—"} (år ${oldestYear})`
    );
    if (migrationStats.gapExampleDays.length > 0) {
      console.log("  Exempel: surfableMinutes < spann (hål i fönstret):");
      migrationStats.gapExampleDays.forEach((example) => {
        console.log(
          `    ${example.date}: ${example.surfableMinutes} min effektivt, ${example.spanMinutes} min spann`
        );
      });
    } else {
      console.log("  (Inga hål-exempel hittades i urvalet — OK om datan är sammanhängande)");
    }
    console.log("=".repeat(60));
  } catch (error) {
    console.error("");
    console.error("✗ Migration failed:", error);
    process.exit(1);
  }

  process.exit(0);
}

migrateHistoricalData();
