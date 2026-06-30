/**
 * Read-only probe — inspect what's already in the real Firebase project
 * (swancrm-1fa61) BEFORE any seed/mutate action.
 *
 * Run with: npx tsx scripts/probe-firebase.ts
 */
import './_load-env';
import { getAdminDb, getAdminAuth, isAdminConfigured } from '../src/lib/firebase/admin';

const COLLECTIONS_TO_PROBE = [
  'users',
  'customers',
  'cases',
  'caseServices',
  'payments',
  'staffAssignments',
  'tasks',
  'appointments',
  'hospitalCoordinations',
  'followups',
  'attachments',
  'consents',
  'notifications',
  'auditLogs',
  'services',
  'treatmentLocations',
];

async function main() {
  if (!isAdminConfigured()) {
    console.error('❌ Firebase Admin SDK chưa được cấu hình.');
    process.exit(1);
  }

  const db = getAdminDb();
  const auth = getAdminAuth();

  console.log('──────────────────────────────────────────');
  console.log('  REAL FIREBASE PROJECT PROBE (read-only)');
  console.log('──────────────────────────────────────────');
  console.log(`Project ID  : swancrm-1fa61`);
  console.log(`Timestamp   : ${new Date().toISOString()}\n`);

  // 1. List all collections with count
  console.log('📦 Firestore collections:\n');
  const collectionCounts: Record<string, number> = {};
  const sampleIds: Record<string, string[]> = {};
  for (const col of COLLECTIONS_TO_PROBE) {
    try {
      const snap = await db.collection(col).limit(5).get();
      const total = (await db.collection(col).count().get()).data().count;
      collectionCounts[col] = total;
      sampleIds[col] = snap.docs.map((d) => d.id);
      console.log(
        `  ${col.padEnd(24)} total=${String(total).padStart(4)}  sample=[${snap.docs
          .map((d) => d.id)
          .join(', ')}]`,
      );
    } catch (err) {
      console.log(`  ${col.padEnd(24)} ERROR: ${(err as Error).message}`);
    }
  }

  // 2. List existing auth users
  console.log('\n🔐 Firebase Auth users (existing real accounts):\n');
  let authCount = 0;
  const authSample: { uid: string; email?: string }[] = [];
  try {
    let nextPageToken: string | undefined;
    do {
      const list = await auth.listUsers(1000, nextPageToken);
      authCount += list.users.length;
      for (const u of list.users) {
        if (authSample.length < 10) authSample.push({ uid: u.uid, email: u.email });
      }
      nextPageToken = list.pageToken;
    } while (nextPageToken);
    console.log(`  Total Auth users: ${authCount}`);
    for (const u of authSample) console.log(`    uid=${u.uid}  email=${u.email ?? '(none)'}`);
  } catch (err) {
    console.log(`  ERROR listing auth users: ${(err as Error).message}`);
  }

  // 3. Sample 3 customer docs to confirm schema
  console.log('\n👤 Sample customers (schema check):\n');
  const sample = await db.collection('customers').limit(3).get();
  if (sample.empty) {
    console.log('  (collection is empty)');
  } else {
    for (const d of sample.docs) {
      console.log(`  -- ${d.id} --`);
      console.log(JSON.stringify(d.data(), null, 2).split('\n').map((l) => '    ' + l).join('\n'));
      console.log('');
    }
  }

  // 4. Phone-uniqueness check (the constraint we'll have to respect)
  console.log('📞 Existing phone numbers (for dedup):\n');
  const allCustomers = await db.collection('customers').get();
  const phones = allCustomers.docs.map((d) => d.data().phone).filter(Boolean);
  console.log(`  Total phones indexed: ${phones.length}`);
  console.log(`  First 10: ${phones.slice(0, 10).join(', ')}`);

  console.log('\n✅ Probe complete.');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});