// Browser persistence for the checklist. localStorage is the source of truth so the list works offline (at the airport).
import { type ChecklistData, emptyData, sanitize } from './checklistModel';

const KEY = 'flightdeck-checklist';
const OWNER = 'flightdeck-checklist-owner';

export function loadLocal(): ChecklistData {
  try {
    return sanitize(JSON.parse(localStorage.getItem(KEY) || 'null'));
  } catch {
    return emptyData();
  }
}
export function saveLocal(d: ChecklistData): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
    return true;
  } catch {
    return false;
  }
}
export function clearLocal() {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(OWNER);
  } catch {
    /* ignore */
  }
}
export const getOwner = () => {
  try {
    return localStorage.getItem(OWNER);
  } catch {
    return null;
  }
};
export const setOwner = (id: string) => {
  try {
    localStorage.setItem(OWNER, id);
  } catch {
    /* ignore */
  }
};
