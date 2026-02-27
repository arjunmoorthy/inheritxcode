/**
 * Auth types and localStorage helpers for user details (login response).
 * User and UUID are used by chat, profile, and other features.
 */

const AUTH_USER_KEY = 'authUser';

/** User details from login response; stored in context and localStorage. */
export interface User {
  id: number;
  uuid: string;
  email: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  role?: string;
  patient_id?: number;
  staff_id?: number | null;
  is_active?: boolean;
  is_verified?: boolean;
  is_first_login?: boolean;
  auth_provider?: string;
  last_login_at?: string;
  created_at?: string;
  updated_at?: string;
}

export function getStoredUser(): User | null {
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as User;
    return parsed?.uuid && parsed?.email ? parsed : null;
  } catch {
    return null;
  }
}

export function setStoredUser(user: User | null): void {
  if (user) {
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(AUTH_USER_KEY);
  }
}
