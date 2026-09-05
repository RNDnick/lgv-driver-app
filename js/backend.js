import { supabase } from './supabase-client.js';

const BUCKET = 'checklist-photos';

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function onAuthChange(cb) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => cb(session));
  return () => data.subscription.unsubscribe();
}

export async function signIn(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signUp(email, password, fullName) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  await supabase.auth.signOut();
}

export async function getCurrentProfile() {
  const session = await getSession();
  if (!session) return null;
  const { data, error } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
  if (error) throw error;
  return data;
}

function toJobRow(job, driverId) {
  return {
    id: job.id,
    driver_id: driverId,
    status: job.status,
    created_at: job.createdAt,
    customer: job.customer,
    collection_site: job.collectionSite,
    delivery_site: job.deliverySite,
    trailer_reg: job.trailerReg,
    mileage_start: job.mileageStart ? parseInt(job.mileageStart, 10) : null,
    mileage_end: job.mileageEnd ? parseInt(job.mileageEnd, 10) : null,
    notes: job.notes,
    pod_photo_path: job.podPhotoPath || null,
    pod_photo_hash: job.podPhotoHash || null,
    completed_at: job.completedAt,
  };
}

function fromJobRow(row) {
  return {
    id: row.id,
    status: row.status,
    createdAt: row.created_at,
    customer: row.customer,
    collectionSite: row.collection_site,
    deliverySite: row.delivery_site,
    trailerReg: row.trailer_reg,
    mileageStart: row.mileage_start,
    mileageEnd: row.mileage_end,
    notes: row.notes,
    podPhotoPath: row.pod_photo_path,
    podPhotoHash: row.pod_photo_hash,
    completedAt: row.completed_at,
  };
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export async function getTodaysJobs() {
  const session = await getSession();
  if (!session) return [];
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('driver_id', session.user.id)
    .gte('created_at', startOfToday());
  if (error) throw error;
  return data.map(fromJobRow);
}

export async function getTodaysChecklists() {
  const session = await getSession();
  if (!session) return [];
  const { data, error } = await supabase
    .from('checklists')
    .select('*')
    .eq('driver_id', session.user.id)
    .gte('completed_at', startOfToday());
  if (error) throw error;
  return data.map(fromChecklistRow);
}

// Resolves driver_id -> full_name for a manager-only "all drivers" fetch -
// RLS lets a manager read every profile, so this is a bulk lookup rather
// than N+1 queries per row.
async function namesByDriverId(driverIds) {
  const unique = [...new Set(driverIds)];
  if (!unique.length) return {};
  const { data, error } = await supabase.from('profiles').select('id, full_name').in('id', unique);
  if (error) throw error;
  return Object.fromEntries(data.map(p => [p.id, p.full_name || 'Unnamed driver']));
}

// Own records only - RLS would actually let a manager account fetch every
// driver's rows here too, but Home/History/Job Log are meant to show "my own
// activity" for every account, manager included. The all-drivers equivalent
// (getAllJobsForManager) is a separate function so that distinction is
// explicit at the call site, not just an incidental side effect of RLS.
export async function getMyJobs() {
  const session = await getSession();
  if (!session) return [];
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('driver_id', session.user.id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data.map(fromJobRow);
}

// Manager-only (see js/manager-view.js) - gated by that screen only being
// reachable from a manager-only home tile, not by anything here.
export async function getAllJobsForManager() {
  const { data, error } = await supabase.from('jobs').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  const names = await namesByDriverId(data.map(row => row.driver_id));
  return data.map(row => ({ ...fromJobRow(row), driverName: names[row.driver_id] || 'Unknown driver' }));
}

export async function syncJob(job, photos = {}) {
  const session = await getSession();
  if (!session) throw new Error('Not signed in');
  const driverId = session.user.id;

  let podPhotoPath = job.podPhotoPath || null;
  if (photos.pod) {
    podPhotoPath = `${driverId}/jobs/${job.id}/pod.jpg`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(podPhotoPath, photos.pod, { upsert: true, contentType: 'image/jpeg' });
    if (error) throw new Error(`Photo upload failed: ${error.message}`);
  }

  const { error } = await supabase.from('jobs').upsert(toJobRow({ ...job, podPhotoPath }, driverId));
  if (error) throw new Error(`Saving job record failed: ${error.message}`);
}

export async function deleteJob(id) {
  const { error } = await supabase.from('jobs').delete().eq('id', id);
  if (error) throw error;
}

function fromChecklistRow(row) {
  return {
    id: row.id,
    type: row.type,
    trailerReg: row.trailer_reg,
    jobId: row.job_id,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    steps: row.steps,
  };
}

// Own records only - see the comment on getMyJobs above for why this isn't
// just left to RLS.
export async function getMyChecklists() {
  const session = await getSession();
  if (!session) return [];
  const { data, error } = await supabase
    .from('checklists')
    .select('*')
    .eq('driver_id', session.user.id)
    .order('completed_at', { ascending: false });
  if (error) throw error;
  return data.map(fromChecklistRow);
}

// Manager-only (see js/manager-view.js).
export async function getAllChecklistsForManager() {
  const { data, error } = await supabase.from('checklists').select('*').order('completed_at', { ascending: false });
  if (error) throw error;
  const names = await namesByDriverId(data.map(row => row.driver_id));
  return data.map(row => ({ ...fromChecklistRow(row), driverName: names[row.driver_id] || 'Unknown driver' }));
}

export async function syncChecklist(record, photos = {}) {
  const session = await getSession();
  if (!session) throw new Error('Not signed in');
  const driverId = session.user.id;

  const steps = [];
  for (const step of record.steps) {
    let photoPath = step.photoPath || null;
    const blob = photos[step.key];
    if (blob) {
      photoPath = `${driverId}/checklists/${record.id}/${step.key}.jpg`;
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(photoPath, blob, { upsert: true, contentType: 'image/jpeg' });
      if (error) throw new Error(`Photo upload failed (step ${step.key}): ${error.message}`);
    }
    steps.push({ key: step.key, title: step.title, completedAt: step.completedAt, photoPath, photoHash: step.photoHash || null });
  }

  const row = {
    id: record.id,
    driver_id: driverId,
    type: record.type,
    trailer_reg: record.trailerReg,
    job_id: record.jobId || null,
    started_at: record.startedAt,
    completed_at: record.completedAt,
    steps,
  };
  const { error } = await supabase.from('checklists').upsert(row);
  if (error) throw new Error(`Saving checklist record failed: ${error.message}`);
}

export async function syncFeedback(feedback) {
  const session = await getSession();
  if (!session) throw new Error('Not signed in');
  const { error } = await supabase.from('feedback').upsert({
    id: feedback.id,
    driver_id: session.user.id,
    message: feedback.message,
    created_at: feedback.createdAt,
  });
  if (error) throw new Error(`Sending feedback failed: ${error.message}`);
}

// Manager-only (see js/feedback-view.js) - RLS already restricts a driver's
// own select() to their own rows, so this only ever returns everything when
// called by a manager account in the first place.
export async function getAllFeedback() {
  const { data, error } = await supabase.from('feedback').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  const names = await namesByDriverId(data.map(row => row.driver_id));
  return data.map(row => ({
    id: row.id,
    driverName: names[row.driver_id] || 'Unknown driver',
    message: row.message,
    createdAt: row.created_at,
  }));
}

export async function getPhotoUrl(path, expiresIn = 3600) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}
