import React, { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
// import { useFetchProfile } from '../services/profile'; // TODO: Create profile service

export interface ProfileData {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  role?: string;
  clinic_name?: string;
  clinic_department?: string;
  clinic_address?: string;
  clinic_fax?: string;
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
  // Profile data - in production this would come from API
  // For local dev, use test doctor credentials
  const profile: ProfileData = {
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
  const isLoading = false;
  const error = null;

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
