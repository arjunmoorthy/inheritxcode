/** Admin whose dashboard Demo Mode switch stays on and cannot be turned off. */
export const DEMO_MODE_DEFAULT_EMAIL = (
  import.meta.env.VITE_DEMO_MODE_DEFAULT_EMAIL || ''
).trim().toLowerCase();

export function isDemoModeDefaultUser(email?: string | null): boolean {
  if (!DEMO_MODE_DEFAULT_EMAIL) return false;
  return (email || '').trim().toLowerCase() === DEMO_MODE_DEFAULT_EMAIL;
}
