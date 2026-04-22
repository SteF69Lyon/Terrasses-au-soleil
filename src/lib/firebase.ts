import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { readFileSync } from 'node:fs';

let cachedDb: Firestore | null = null;

function loadCredentials(): object {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (raw) return JSON.parse(raw);

  const path =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH ??
    process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (path) return JSON.parse(readFileSync(path, 'utf-8'));

  throw new Error(
    'Firebase credentials missing. Set one of: ' +
      'FIREBASE_SERVICE_ACCOUNT (JSON content), ' +
      'FIREBASE_SERVICE_ACCOUNT_PATH (file path), ' +
      'or GOOGLE_APPLICATION_CREDENTIALS (standard var).',
  );
}

export function getDb(): Firestore {
  if (cachedDb) return cachedDb;
  if (!getApps().length) {
    initializeApp({ credential: cert(loadCredentials() as any) });
  }
  cachedDb = getFirestore();
  return cachedDb;
}
