import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {
  initializeApp,
  cert,
  applicationDefault,
  getApps,
  type ServiceAccount,
} from "firebase-admin/app";
import {getFirestore, Timestamp, type Firestore} from "firebase-admin/firestore";
import {format, startOfMonth, endOfMonth, parseISO} from "date-fns";
import * as dotenv from "dotenv";
import SunCalc from "suncalc";

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

const KALLSJON_LAT = 63.637993;
const KALLSJON_LON = 13.033151;

function isDaylightAtKallsjon(date: Date): boolean {
  const times = SunCalc.getTimes(date, KALLSJON_LAT, KALLSJON_LON);
  return date >= times.sunrise && date <= times.sunset;
}

interface WindDocument {
  force: number;
  forceMax: number;
  direction: number;
  time: Timestamp;
}

interface DailyStats {
  date: string;
  year: number;
  month: number;
  maxForce: number;
  maxForceTime: Timestamp;
  avgForce: number;
  minForce: number;
  maxForceDirection: number;
  maxGust: number;
  maxGustTime: Timestamp;
  dataPointsCount: number;
  hasStrongWind: boolean;
  hasGaleForce: boolean;
  hasDaylightWind10Plus: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

function aggregateDayData(dayData: WindDocument[], dateStr: string): DailyStats {
  let maxForce = 0;
  let maxForceTime: Timestamp = dayData[0].time;
  let maxForceDirection = 0;
  let maxGust = 0;
  let maxGustTime: Timestamp = dayData[0].time;
  let sumForce = 0;
  let minForce = Infinity;
  let hasDaylightWind10Plus = false;

  dayData.forEach((doc) => {
    const force = doc.force || 0;
    const gust = doc.forceMax || force;
    const measurementTime = doc.time.toDate();

    if (force > maxForce) {
      maxForce = force;
      maxForceTime = doc.time;
      maxForceDirection = doc.direction || 0;
    }

    if (gust > maxGust) {
      maxGust = gust;
      maxGustTime = doc.time;
    }

    if (force >= 10 && isDaylightAtKallsjon(measurementTime)) {
      hasDaylightWind10Plus = true;
    }

    if (force < minForce) minForce = force;
    sumForce += force;
  });

  const avgForce = dayData.length > 0 ? sumForce / dayData.length : 0;
  const parsedDate = parseISO(dateStr);

  return {
    date: dateStr,
    year: parsedDate.getFullYear(),
    month: parsedDate.getMonth() + 1,
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

async function migrateHistoricalData() {
  console.log("=".repeat(60));
  console.log("Daily Stats Migration Script (Admin SDK)");
  console.log("=".repeat(60));
  console.log("");

  const startYear = Number(process.env.AGGREGATE_START_YEAR ?? 2020);
  const endDate = new Date();
  const endYear = endDate.getFullYear();
  const endMonth = endDate.getMonth() + 1;

  let totalDays = 0;

  try {
    for (let year = startYear; year <= endYear; year++) {
      const startMonth = 1;
      const lastMonth = year === endYear ? endMonth : 12;

      for (let month = startMonth; month <= lastMonth; month++) {
        const daysProcessed = await processMonth(year, month);
        totalDays += daysProcessed;

        await new Promise((resolveDelay) => setTimeout(resolveDelay, 500));
      }
    }

    console.log("");
    console.log("=".repeat(60));
    console.log("✓ Migration Complete!");
    console.log(`  Total daily stats created: ${totalDays}`);
    console.log("=".repeat(60));
  } catch (error) {
    console.error("");
    console.error("✗ Migration failed:", error);
    process.exit(1);
  }

  process.exit(0);
}

migrateHistoricalData();
