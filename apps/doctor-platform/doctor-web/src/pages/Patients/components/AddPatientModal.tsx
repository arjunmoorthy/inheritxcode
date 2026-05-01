/**
 * Add Patient Modal - thin wrapper around PatientFormModal
 * Uses shared PatientFormModal with mode="add" (POST /api/v1/fax/patients)
 */

import React from 'react';
import { PatientFormModal } from './PatientFormModal';

interface AddPatientModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const AddPatientModal: React.FC<AddPatientModalProps> = ({ open, onClose, onSuccess }) => (
  <PatientFormModal open={open} onClose={onClose} mode="add" onSuccess={onSuccess} />
);

export default AddPatientModal;

/*
 * =============================================================================
 * OLD CODE (commented) - Previously a full standalone form
 * =============================================================================
 * The old AddPatientModal had the complete form inline:
 * - useForm with patientSchema (firstName, lastName, email, phone, mrn, dateOfBirth,
 *   gender, location, diagnosis, patientStatus, regimenName, dayOfChemo,
 *   treatmentStartDate, nextChemoDate, endDate, oncologist, pastMedicalHistory,
 *   pastSurgicalHistory)
 * - useAddManualPatient() for POST /api/v1/fax/patients
 * - Modal, Input, Select from ui components
 * - Personal Information + Medical Information sections
 * - computeAge, toAddManualPatientPayload helpers
 *
 * Refactored to use shared PatientFormModal for add+edit consistency.
 */
