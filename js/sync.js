import { dbPut, dbGetAll, dbDelete } from './db.js';
import * as backend from './backend.js';

const STORE = 'outbox';
const listeners = new Set();

function notify() {
  listeners.forEach(cb => cb());
}

export function onChange(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export async function enqueue(kind, payload, photos = {}) {
  const entry = { id: payload.id, kind, payload, photos, createdAt: Date.now(), attempts: 0, lastError: null };
  await dbPut(STORE, entry);
  notify();
  flushOutbox();
  return entry;
}

export async function cancelPending(id) {
  await dbDelete(STORE, id);
  notify();
}

export async function getPendingByKind(kind) {
  const all = await dbGetAll(STORE);
  return all.filter(entry => entry.kind === kind);
}

export async function getPendingCount() {
  return (await dbGetAll(STORE)).length;
}

let flushing = false;

export async function flushOutbox() {
  if (flushing) return;
  flushing = true;
  try {
    const entries = await dbGetAll(STORE);
    for (const entry of entries) {
      try {
        if (entry.kind === 'job') {
          await backend.syncJob(entry.payload, entry.photos);
        } else if (entry.kind === 'checklist') {
          await backend.syncChecklist(entry.payload, entry.photos);
        }
        await dbDelete(STORE, entry.id);
        notify();
      } catch (err) {
        entry.attempts += 1;
        entry.lastError = err.message;
        await dbPut(STORE, entry);
      }
    }
  } finally {
    flushing = false;
  }
}

async function mergeWithPending(kind, synced, sortKey) {
  const pending = await getPendingByKind(kind);
  const byId = new Map(synced.map(row => [row.id, { ...row, pending: false }]));
  for (const entry of pending) {
    byId.set(entry.payload.id, { ...entry.payload, pending: true, _photos: entry.photos });
  }
  return [...byId.values()].sort((a, b) => (b[sortKey] || 0) - (a[sortKey] || 0));
}

export async function getMergedJobs() {
  const synced = await backend.getAllJobs();
  return mergeWithPending('job', synced, 'createdAt');
}

export async function getMergedChecklists() {
  const synced = await backend.getAllChecklists();
  return mergeWithPending('checklist', synced, 'completedAt');
}

window.addEventListener('online', flushOutbox);
flushOutbox();
