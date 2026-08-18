const STORAGE_KEY = 'aisupervision_test_state';

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('saveState failed:', e);
  }
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const data = JSON.parse(raw);

    // Must have a valid phase
    const VALID = ['subject-info', 'instructions', 'moduleA', 'moduleB', 'completion'];
    if (!data || !data.phase || !VALID.includes(data.phase)) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    // Must have subject object
    if (!data.subject || typeof data.subject.id !== 'string') {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return data;
  } catch (e) {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function clearState() {
  try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
}

export function createLogEntry(action, detail, metadata = {}) {
  return { timestamp: new Date().toISOString(), action, detail, ...metadata };
}
