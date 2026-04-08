import React, { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

interface StaffManagementContextType {
  showAddStaffModal: boolean;
  showUpdateStaffModal: boolean;
  showClinicRegistrationModal: boolean;
  clinicRegistrationMode: 'list' | 'add';
  openAddStaffModal: () => void;
  openUpdateStaffModal: () => void;
  openClinicRegistrationModal: (mode?: 'list' | 'add') => void;
  closeModals: () => void;
}

const StaffManagementContext = createContext<StaffManagementContextType | undefined>(undefined);

export const useStaffManagement = () => {
  const context = useContext(StaffManagementContext);
  if (context === undefined) {
    throw new Error('useStaffManagement must be used within a StaffManagementProvider');
  }
  return context;
};

interface StaffManagementProviderProps {
  children: ReactNode;
}

export const StaffManagementProvider: React.FC<StaffManagementProviderProps> = ({ children }) => {
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [showUpdateStaffModal, setShowUpdateStaffModal] = useState(false);
  const [showClinicRegistrationModal, setShowClinicRegistrationModal] = useState(false);
  const [clinicRegistrationMode, setClinicRegistrationMode] = useState<'list' | 'add'>('list');

  const openAddStaffModal = () => {
    setShowAddStaffModal(true);
    setShowUpdateStaffModal(false);
    setShowClinicRegistrationModal(false);
  };

  const openUpdateStaffModal = () => {
    setShowUpdateStaffModal(true);
    setShowAddStaffModal(false);
    setShowClinicRegistrationModal(false);
  };

  const openClinicRegistrationModal = (mode: 'list' | 'add' = 'list') => {
    setClinicRegistrationMode(mode);
    setShowClinicRegistrationModal(true);
    setShowAddStaffModal(false);
    setShowUpdateStaffModal(false);
  };

  const closeModals = () => {
    setShowAddStaffModal(false);
    setShowUpdateStaffModal(false);
    setShowClinicRegistrationModal(false);
    setClinicRegistrationMode('list');
  };

  return (
    <StaffManagementContext.Provider
      value={{
        showAddStaffModal,
        showUpdateStaffModal,
        showClinicRegistrationModal,
        clinicRegistrationMode,
        openAddStaffModal,
        openUpdateStaffModal,
        openClinicRegistrationModal,
        closeModals,
      }}
    >
      {children}
    </StaffManagementContext.Provider>
  );
};
