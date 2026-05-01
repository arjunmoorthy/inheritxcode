/**
 * Edit Patient Modal - thin wrapper around PatientFormModal
 * Uses shared PatientFormModal with mode="edit" (PUT /api/v1/fax/patients/:id)
 */

import React from 'react';
import { PatientFormModal } from './PatientFormModal';
import type { Patient } from '../../../services/patients';

interface EditPatientModalProps {
  open: boolean;
  onClose: () => void;
  patient: Patient | null;
  onSuccess?: () => void;
}

const EditPatientModal: React.FC<EditPatientModalProps> = ({ open, onClose, patient, onSuccess }) => {
  if (!patient) return null;
  return <PatientFormModal open={open} onClose={onClose} mode="edit" patient={patient} onSuccess={onSuccess} />;
};

export default EditPatientModal;

/*
 * =============================================================================
 * OLD CODE (commented) - Previously MUI Dialog + styled-components
 * =============================================================================
 * import {
 *   Dialog, DialogTitle, DialogContent, DialogActions, Button,
 *   TextField, FormControl, InputLabel, Select, MenuItem, IconButton, Typography, Box
 * } from '@mui/material';
 * import { X, User, Mail, Calendar, Phone, Shield, Stethoscope, Building, Globe, Heart } from 'lucide-react';
 * import styled from 'styled-components';
 * import { theme } from '@oncolife/ui-components';
 * import { useUpdatePatient, type Patient } from '../../../services/patients';
 *
 * StyledDialog, DialogHeader, InputWithIcon, InputIcon, SelectWithIcon
 * Form state: firstName, lastName, email, mrn, dateOfBirth, sex, race,
 *   phoneNumber, physician, diseaseType, associateClinic, treatmentType
 * useUpdatePatient (was throw new Error 'Patient update not yet implemented')
 * Fields: First Name, Last Name, Email, Date of Birth, Sex, Race, MRN,
 *   Phone Number, Physician, Associate Clinic, Disease Type, Treatment Type
 *
 * Refactored to use shared PatientFormModal for add+edit consistency.
 */
