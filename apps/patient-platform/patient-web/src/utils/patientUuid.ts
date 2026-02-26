/**
 * Patient UUID storage (set from login response, cleared on logout).
 * Used for profile and chat API calls instead of any static fallback.
 */

const PATIENT_UUID_KEY = 'patientUuid';

export function getPatientUuid(): string | null {
  return localStorage.getItem(PATIENT_UUID_KEY);
}

export function setPatientUuid(uuid: string): void {
  localStorage.setItem(PATIENT_UUID_KEY, uuid);
}

export function clearPatientUuid(): void {
  localStorage.removeItem(PATIENT_UUID_KEY);
}
