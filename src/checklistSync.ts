// Account sync for the checklist. localStorage stays the source of truth (it works offline); this only reconciles with the server copy.
import { merge, sanitize, isBlank, type ChecklistData } from './checklistModel';

export type PutResult = { ok: true; rev: number } | { ok: false; rev: number; data: unknown };
export type Api = { get(): Promise<{ rev: number; data: unknown }>; put(baseRev: number, data: ChecklistData): Promise<PutResult> };

/** What actually matters when comparing two copies (ignores the revision and which trip happens to be open). */
const core = (d: ChecklistData) => JSON.stringify({ v: d.v, tpl: d.tpl, trips: d.trips, gone: d.gone });

/**
 * Bring this device and the server into agreement: pull, merge, push if the server is behind, and if another device got there
 * first (conflict) merge again and retry. Merging is symmetric and idempotent, so it converges.
 */
export async function syncOnce(local: ChecklistData, api: Api): Promise<ChecklistData> {
  const remote = await api.get();
  let rev = remote.rev;
  let remoteDoc = remote.data == null ? null : sanitize(remote.data);
  let merged = remoteDoc ? merge(local, remoteDoc) : local;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (remoteDoc && core(merged) === core(remoteDoc)) return { ...merged, rev };
    if (!remoteDoc && isBlank(merged)) return { ...merged, rev };
    const r = await api.put(rev, merged);
    if (r.ok) return { ...merged, rev: r.rev };
    rev = r.rev;
    remoteDoc = r.data == null ? null : sanitize(r.data);
    merged = remoteDoc ? merge(merged, remoteDoc) : merged;
  }
  throw new Error('Could not sync your checklist right now. It is safe on this device and will sync later.');
}

export function httpApi(apiFetch: (url: string, init?: RequestInit) => Promise<Response>): Api {
  const fail = async (r: Response) => { let m = ''; try { m = (await r.json()).error || ''; } catch { /* no body */ } return new Error(m || `Sync failed (${r.status})`); };
  return {
    async get() {
      const r = await apiFetch('/api/checklist');
      if (!r.ok) throw await fail(r);
      const j = await r.json();
      return { rev: Number(j.rev) || 0, data: j.data ?? null };
    },
    async put(baseRev, data) {
      const r = await apiFetch('/api/checklist', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ baseRev, data }) });
      if (r.status === 409) { const j = await r.json(); return { ok: false, rev: Number(j.rev) || 0, data: j.data ?? null }; }
      if (!r.ok) throw await fail(r);
      return { ok: true, rev: Number((await r.json()).rev) || 0 };
    },
  };
}
