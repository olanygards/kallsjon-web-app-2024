import { initializeApp } from 'firebase/app';
import {
    getFirestore,
    collection,
    query,
    where,
    getDocs,
    writeBatch,
    Timestamp,
    orderBy
} from 'firebase/firestore';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, parseISO } from 'date-fns';
import * as dotenv from 'dotenv';
import SunCalc from 'suncalc';

// Load environment variables
dotenv.config();

// Firebase config from environment
const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Källsjön coordinates for daylight calculations
const KALLSJON_LAT = 63.637993;
const KALLSJON_LON = 13.033151;

/**
 * Check if a specific time is during daylight hours at Källsjön
 */
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
    hasDaylightWind10Plus: boolean;  // NEW: true if any measurement during daylight had force >= 10
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

/**
 * Aggregate wind data for a single day
 */
function aggregateDayData(dayData: WindDocument[], dateStr: string): DailyStats {
    let maxForce = 0;
    let maxForceTime: Timestamp = dayData[0].time;
    let maxForceDirection = 0;
    let maxGust = 0;
    let maxGustTime: Timestamp = dayData[0].time;
    let sumForce = 0;
    let minForce = Infinity;
    let hasDaylightWind10Plus = false;

    dayData.forEach(doc => {
        const force = doc.force || 0;
        const gust = doc.forceMax || force;
        const measurementTime = doc.time.toDate();

        // Track max force
        if (force > maxForce) {
            maxForce = force;
            maxForceTime = doc.time;
            maxForceDirection = doc.direction || 0;
        }

        // Track max gust
        if (gust > maxGust) {
            maxGust = gust;
            maxGustTime = doc.time;
        }

        // Check if there was wind >= 10 m/s during daylight
        if (force >= 10 && isDaylightAtKallsjon(measurementTime)) {
            hasDaylightWind10Plus = true;
        }

        // Track min and sum for average
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
        minForce: Math.round(minForce * 10) / 10,
        maxForceDirection,
        maxGust: Math.round(maxGust * 10) / 10,
        maxGustTime,
        dataPointsCount: dayData.length,
        hasStrongWind: maxForce >= 10,
        hasGaleForce: maxForce >= 15,
        hasDaylightWind10Plus,  // NEW: true if wind >= 10 m/s during daylight
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
    };
}

/**
 * Process one month of wind data and create daily stats
 */
async function processMonth(year: number, month: number): Promise<number> {
    const monthStart = startOfMonth(new Date(year, month - 1, 1));
    const monthEnd = endOfMonth(new Date(year, month - 1, 1));

    console.log(`Processing ${format(monthStart, 'yyyy-MM')}...`);

    // Fetch all wind data for this month
    const windRef = collection(db, 'wind');
    const q = query(
        windRef,
        where('time', '>=', Timestamp.fromDate(monthStart)),
        where('time', '<=', Timestamp.fromDate(monthEnd)),
        orderBy('time', 'asc')
    );

    const querySnapshot = await getDocs(q);
    console.log(`  Found ${querySnapshot.docs.length} wind documents`);

    if (querySnapshot.docs.length === 0) {
        console.log(`  Skipping (no data)`);
        return 0;
    }

    // Group by day
    const dayGroups = new Map<string, WindDocument[]>();

    querySnapshot.docs.forEach(doc => {
        const data = doc.data() as WindDocument;
        const dateStr = format(data.time.toDate(), 'yyyy-MM-dd');

        if (!dayGroups.has(dateStr)) {
            dayGroups.set(dateStr, []);
        }
        dayGroups.get(dateStr)!.push(data);
    });

    console.log(`  Grouped into ${dayGroups.size} days`);

    // Create daily stats
    const dailyStatsRef = collection(db, 'dailyStats');
    const batch = writeBatch(db);
    let writeCount = 0;

    dayGroups.forEach((dayData, dateStr) => {
        const stats = aggregateDayData(dayData, dateStr);
        const docRef = doc(dailyStatsRef, dateStr); // Use date as document ID
        batch.set(docRef, stats);
        writeCount++;
    });

    // Commit batch
    await batch.commit();
    console.log(`  ✓ Wrote ${writeCount} daily stats documents`);

    return writeCount;
}

/**
 * Main migration function
 */
async function migrateHistoricalData() {
    console.log('='.repeat(60));
    console.log('Daily Stats Migration Script');
    console.log('='.repeat(60));
    console.log('');

    const startYear = 2020;
    const endDate = new Date();
    const endYear = endDate.getFullYear();
    const endMonth = endDate.getMonth() + 1;

    let totalDays = 0;

    try {
        // Process each month from 2020-01 to now
        for (let year = startYear; year <= endYear; year++) {
            const startMonth = year === startYear ? 1 : 1;
            const lastMonth = year === endYear ? endMonth : 12;

            for (let month = startMonth; month <= lastMonth; month++) {
                const daysProcessed = await processMonth(year, month);
                totalDays += daysProcessed;

                // Small delay to avoid overwhelming Firebase
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        console.log('');
        console.log('='.repeat(60));
        console.log('✓ Migration Complete!');
        console.log(`  Total daily stats created: ${totalDays}`);
        console.log('='.repeat(60));
    } catch (error) {
        console.error('');
        console.error('✗ Migration failed:', error);
        process.exit(1);
    }

    process.exit(0);
}

// Fix missing import
import { doc } from 'firebase/firestore';

// Run migration
migrateHistoricalData();
