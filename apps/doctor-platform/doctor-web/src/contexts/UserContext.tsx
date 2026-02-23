import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
// import { useFetchProfile } from '../services/profile'; // TODO: Create profile service

export interface ProfileData {
  id?: string;
  staff_id?: number;
  staff_uuid?: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  role?: string;
  clinic_name?: string;
  clinic_department?: string;
  department?: string;
  clinic_address?: string;
  clinic_fax?: string;
  clinic_uuid?: string;
}

interface UserContextType {
  profile: ProfileData | null;
  isLoading: boolean;
  error: string | null;
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

  // Load profile from localStorage on mount
  useEffect(() => {
    const loadProfile = () => {
      try {
        const storedProfile = localStorage.getItem('userProfile');
        if (storedProfile) {
          const parsedProfile = JSON.parse(storedProfile);
          // Map the stored profile to ProfileData format
          const profileData: ProfileData = {
            id: parsedProfile.staff_uuid || parsedProfile.id,
            staff_id: parsedProfile.staff_id,
            staff_uuid: parsedProfile.staff_uuid,
            first_name: parsedProfile.first_name || '',
            last_name: parsedProfile.last_name || '',
            email: parsedProfile.email || '',
            phone: parsedProfile.phone,
            role: parsedProfile.role,
            clinic_name: parsedProfile.clinic_name,
            clinic_department: parsedProfile.department || parsedProfile.clinic_department,
            department: parsedProfile.department,
            clinic_address: parsedProfile.clinic_address,
            clinic_fax: parsedProfile.clinic_fax,
            clinic_uuid: parsedProfile.clinic_uuid,
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
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
};
