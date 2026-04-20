import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
// import { useFetchProfile } from '../services/profile'; // TODO: Create profile service

export interface ProfileData {
  id?: string | number;
  staff_id?: number;
  staff_uuid?: string;
  first_name: string;
  last_name: string;
  full_name?: string;
  email: string;
  phone?: string;
  role?: string;
  clinic_id?: number;
  clinic_name?: string;
  clinic_department?: string;
  department?: string;
  clinic_address?: string;
  clinic_fax?: string;
  clinic_uuid?: string;
}

/** Shape of userProfile as stored in localStorage (from API/login); may include nested clinic */
export interface StoredUserProfile {
  id?: number;
  uuid?: string;
  staff_id?: number;
  patient_id?: number | null;
  email?: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  role?: string;
  phone?: string;
  clinic_id?: number;
  clinic_name?: string;
  clinic_department?: string;
  department?: string;
  clinic_address?: string;
  clinic_fax?: string;
  clinic_uuid?: string;
  clinic?: { id?: number; uuid?: string; name?: string; address?: string; phone?: string | null; department?: string };
  auth_provider?: string;
  is_active?: boolean;
  is_verified?: boolean;
  is_first_login?: boolean;
  last_login_at?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

interface UserContextType {
  profile: ProfileData | null;
  isLoading: boolean;
  error: string | null;
  updateProfile: (data: Partial<ProfileData>) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

interface UserProviderProps {
  children: ReactNode;
}

export const UserProvider: React.FC<UserProviderProps> = ({ children }) => {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Persist profile to localStorage and update state
  const updateProfile = (data: Partial<ProfileData>) => {
    const stored = localStorage.getItem('userProfile');
    const current: StoredUserProfile = stored ? JSON.parse(stored) : {};
    const merged: StoredUserProfile = {
      ...current,
      id: (data.id as number | undefined) ?? current.id,
      uuid: data.staff_uuid ?? current.uuid,
      staff_id: data.staff_id ?? current.staff_id,
      email: data.email ?? current.email,
      first_name: data.first_name ?? current.first_name,
      last_name: data.last_name ?? current.last_name,
      full_name: data.full_name ?? current.full_name ?? (data.first_name != null && data.last_name != null ? `${data.first_name} ${data.last_name}`.trim() : current.full_name),
      role: data.role ?? current.role,
      phone: data.phone ?? current.phone,
      clinic_id: data.clinic_id ?? current.clinic_id,
      clinic_name: data.clinic_name ?? current.clinic_name,
      clinic_department: data.clinic_department ?? data.department ?? current.clinic_department ?? current.department,
      department: data.clinic_department ?? data.department ?? current.department,
      clinic_address: data.clinic_address ?? current.clinic_address,
      clinic_fax: data.clinic_fax ?? current.clinic_fax,
    };
    localStorage.setItem('userProfile', JSON.stringify(merged));
    const nextProfile: ProfileData = {
      id: merged.id ?? merged.uuid,
      staff_id: merged.staff_id,
      staff_uuid: merged.uuid,
      first_name: merged.first_name || '',
      last_name: merged.last_name || '',
      full_name: merged.full_name,
      email: merged.email || '',
      phone: merged.phone,
      role: merged.role,
      clinic_id: merged.clinic_id,
      clinic_name: merged.clinic_name,
      clinic_department: merged.clinic_department ?? merged.department,
      department: merged.department ?? merged.clinic_department,
      clinic_address: merged.clinic_address,
      clinic_fax: merged.clinic_fax,
    };
    setProfile(nextProfile);
  };

  // Load profile from localStorage on mount
  useEffect(() => {
    const loadProfile = () => {
      try {
        const storedProfile = localStorage.getItem('userProfile');
        if (storedProfile) {
          const parsed: StoredUserProfile = JSON.parse(storedProfile);
          const c = parsed.clinic;
          const profileData: ProfileData = {
            id: parsed.id ?? parsed.uuid,
            staff_id: parsed.staff_id,
            staff_uuid: parsed.uuid,
            first_name: parsed.first_name || '',
            last_name: parsed.last_name || '',
            full_name: parsed.full_name,
            email: parsed.email || '',
            phone: parsed.phone,
            role: parsed.role,
            clinic_id: parsed.clinic_id ?? c?.id,
            clinic_name: parsed.clinic_name ?? c?.name ?? '',
            clinic_department: parsed.clinic_department ?? parsed.department ?? c?.department ?? '',
            department: parsed.department ?? parsed.clinic_department ?? c?.department ?? '',
            clinic_address: parsed.clinic_address ?? c?.address ?? '',
            clinic_fax: parsed.clinic_fax ?? c?.phone ?? '',
            clinic_uuid: parsed.clinic_uuid ?? c?.uuid,
          };
          setProfile(profileData);
        } else {
          // Fallback to test data for local dev
          const defaultProfile: ProfileData = {
            first_name: 'Test',
            last_name: 'Doctor',
            email: 'test.doctor@oncolife.local',
            id: '22222222-2222-2222-2222-222222222222',
            role: 'Oncology Patient Navigator',
            phone: '(555) 234-5678',
            clinic_name: 'Metro Cancer Treatment Center',
            clinic_department: 'Patient Navigation Services',
            clinic_address: '1234 Medical Plaza, Suite 500, Chicago, IL 60601',
            clinic_fax: '(555) 234-5679',
          };
          setProfile(defaultProfile);
        }
      } catch (err) {
        console.error('Failed to load profile:', err);
        setError('Failed to load profile data');
        // Fallback to test data
        const defaultProfile: ProfileData = {
          first_name: 'Test',
          last_name: 'Doctor',
          email: 'test.doctor@oncolife.local',
          id: '22222222-2222-2222-2222-222222222222',
          role: 'Oncology Patient Navigator',
          phone: '(555) 234-5678',
          clinic_name: 'Metro Cancer Treatment Center',
          clinic_department: 'Patient Navigation Services',
          clinic_address: '1234 Medical Plaza, Suite 500, Chicago, IL 60601',
          clinic_fax: '(555) 234-5679',
        };
        setProfile(defaultProfile);
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();

    // Listen for storage changes to update profile when it's updated elsewhere
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'userProfile') {
        loadProfile();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const value: UserContextType = {
    profile,
    isLoading,
    error,
    updateProfile,
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
};
