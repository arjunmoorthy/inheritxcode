import React, { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

interface StaffManagementContextType {
  showAddStaffModal: boolean;
  showUpdateStaffModal: boolean;
  openAddStaffModal: () => void;
  openUpdateStaffModal: () => void;
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

  const openAddStaffModal = () => {
    setShowAddStaffModal(true);
    setShowUpdateStaffModal(false);
  };

  const openUpdateStaffModal = () => {
    setShowUpdateStaffModal(true);
    setShowAddStaffModal(false);
  };

  const closeModals = () => {
    setShowAddStaffModal(false);
    setShowUpdateStaffModal(false);
  };

  return (
    <StaffManagementContext.Provider
      value={{
        showAddStaffModal,
        showUpdateStaffModal,
        openAddStaffModal,
        openUpdateStaffModal,
        closeModals,
      }}
    >
      {children}
    </StaffManagementContext.Provider>
  );
};
