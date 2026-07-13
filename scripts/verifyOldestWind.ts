/**
 * Billig verifiering: äldsta wind-dokument i Firestore.
 * Körs fristående — kräver .env + service account (samma som aggregate:historical).
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  initializeApp,
  cert,
  applicationDefault,
  getApps,
  type ServiceAccount,
} from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as dotenv from "dotenv";
import { STATS_DATA_START_YEAR } from "../src/config/constants.ts";

dotenv.config();

function fail(message: string, code = 1): never {
  console.log(message);
  process.exit(code);
}

function initFirestore() {
  const projectId = process.env.VITE_FIREBASE_PROJECT_ID;
  if (!projectId) {
    fail("Saknar VITE_FIREBASE_PROJECT_ID i .env — ingen query kördes.");
  }

  if (getApps().length > 0) {
    return getFirestore();
  }

  const credentialsPath =
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    process.env.FIREBASE_SERVICE_ACCOUNT;

  if (!credentialsPath) {
    fail(
      "Saknar GOOGLE_APPLICATION_CREDENTIALS / FIREBASE_SERVICE_ACCOUNT — ingen query kördes.\n" +
        "Tips: samma credentials som npm run aggregate:historical."
    );
  }

  const resolved = resolve(credentialsPath);
  if (!existsSync(resolved)) {
    fail(`Credentials-fil hittades inte: ${resolved}`);
  }

  const serviceAccount = JSON.parse(
    readFileSync(resolved, "utf8")
  ) as ServiceAccount;

  initializeApp({
    credential: cert(serviceAccount),
    projectId,
  });

  return getFirestore();
}

async function main() {
  try {
    const db = initFirestore();
    const snapshot = await db
      .collection("wind")
      .orderBy("time", "asc")
      .limit(1)
      .get();

    if (snapshot.empty) {
      console.log("Äldsta wind-dokument: inget hittat i collection wind.");
      process.exit(0);
    }

    const oldest = snapshot.docs[0].data().time.toDate() as Date;
    const year = oldest.getFullYear();
    console.log(`Äldsta wind-dokument: ${oldest.toISOString()} (år ${year})`);
    console.log(`Stats copy (låst): Data sedan ${STATS_DATA_START_YEAR}`);

    if (year < STATS_DATA_START_YEAR) {
      console.log(
        `Notering: ${year}-fragment före ${STATS_DATA_START_YEAR} — loggas vid backfill, ingår inte i snitt/copy.`
      );
    }

    process.exit(0);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    fail(`Kunde inte verifiera äldsta wind-dokument: ${message}`);
  }
}

main();
