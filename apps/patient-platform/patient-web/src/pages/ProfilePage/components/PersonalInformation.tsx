import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import styled from "styled-components";
import dayjs from "dayjs";
import { DatePicker } from "@oncolife/ui-components";
import {
  InputGroup,
  InputLabel,
  InputField,
  SectionTitle,
  SaveButton,
  CancelButton,
  ButtonGroup,
  TreatmentInputLabel,
  PasswordSection,
  PasswordTitle,
  PasswordInputContainer,
  IconButton,
  ChangePasswordButton,
  ErrorText,
} from "../ProfilePage.styles";
import type { ProfileFormData } from "../types";

interface PersonalInformationProps {
  formData: ProfileFormData;
  isEditing: boolean;
  onFieldChange: (
    field: keyof ProfileFormData,
    value: string | number | null,
  ) => void;
  onSave: () => void;
  onCancel: () => void;
  isSaving?: boolean;
  isDark?: boolean;
}

const GridContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2rem;
  padding: 10px;
  align-items: center;
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const SectionDivider = styled.div`
  grid-column: 1 / -1;
  border-top: 2px solid #e0e0e0;
  margin: 1.5rem 0;
`;

const TreatmentSection = styled.div`
  grid-column: 1 / -1;
  background: linear-gradient(135deg, #e8f5e9 0%, #f1f8e9 100%);
  border-radius: 12px 12px 0 0;
  padding: 1.5rem;
  margin-top: 1rem;
  border: 1px solid #c8e6c9;
`;

const TreatmentTitle = styled.h3`
  color: #2e7d32;
  font-size: 1.1rem;
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;

  &::before {
    content: "💉";
  }
`;

const TreatmentGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.5rem;
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const EmergencySection = styled.div`
  grid-column: 1 / -1;
  background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%);
  border-radius: 12px;
  padding: 1.5rem;
  margin-top: 1rem;
  border: 1px solid #ffcc80;
`;

const EmergencyTitle = styled.h3`
  color: #e65100;
  font-size: 1.1rem;
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;

  &::before {
    content: "🚨";
  }
`;

const PersonalInformation: React.FC<PersonalInformationProps> = ({
  formData,
  isEditing,
  onFieldChange,
  onSave,
  onCancel,
  isSaving = false,
  isDark = false,
}) => {
  const handleInputChange =
    (field: keyof ProfileFormData) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onFieldChange(field, e.target.value || null);
    };

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    password: "",
    confirmPassword: "",
  });
  const [passwordErrors, setPasswordErrors] = useState({
    currentPassword: "",
    password: "",
    confirmPassword: "",
  });

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordForm({ ...passwordForm, [name]: value });
    if (passwordErrors[name as keyof typeof passwordErrors]) {
      setPasswordErrors({ ...passwordErrors, [name]: "" });
    }
  };

  const handlePasswordSubmit = () => {
    let isValid = true;
    const errors = {
      currentPassword: "",
      password: "",
      confirmPassword: "",
    };

    if (!passwordForm.currentPassword) {
      errors.currentPassword = "Current password is required";
      isValid = false;
    }

    if (!passwordForm.password) {
      errors.password = "New password is required";
      isValid = false;
    } else if (passwordForm.password.length < 8) {
      errors.password = "Password must be at least 8 characters";
      isValid = false;
    }

    if (!passwordForm.confirmPassword) {
      errors.confirmPassword = "Confirm password is required";
      isValid = false;
    } else if (passwordForm.password !== passwordForm.confirmPassword) {
      errors.confirmPassword =
        "New password and confirm password do not match.";
      isValid = false;
    }

    setPasswordErrors(errors);

    if (isValid) {
      // Handle password change submission logic here
      console.log("Password submitted", passwordForm);
      // Optional: Clear form on success
      setPasswordForm({
        currentPassword: "",
        password: "",
        confirmPassword: "",
      });
    }
  };

  const formatDateForInput = (dateString: string | null | undefined) => {
    if (!dateString) return "";
    // If it's already YYYY-MM-DD, return it
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return dateString;
    // Otherwise, try to parse it and return YYYY-MM-DD
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "";
      return date.toISOString().split("T")[0];
    } catch {
      return "";
    }
  };

  const formatDateForDisplay = (dateString: string | null | undefined) => {
    const normalized = formatDateForInput(dateString);
    if (!normalized) return "";
    return dayjs(normalized, "YYYY-MM-DD", true).format("MM/DD/YYYY");
  };

  return (
    <div>
      <SectionTitle $isDark={isDark}>Personal Information</SectionTitle>
      <GridContainer>
        <InputGroup>
          <InputLabel $isDark={isDark}>First Name</InputLabel>
          <InputField
            type="text"
            value={formData.first_name || ""}
            onChange={handleInputChange("first_name")}
            disabled={true}
            isEditing={isEditing}
          />
        </InputGroup>
        <InputGroup>
          <InputLabel $isDark={isDark}>Last Name</InputLabel>
          <InputField
            type="text"
            value={formData.last_name || ""}
            onChange={handleInputChange("last_name")}
            disabled={true}
            isEditing={isEditing}
          />
        </InputGroup>
        <InputGroup>
          <InputLabel $isDark={isDark}>Email</InputLabel>
          <InputField
            type="email"
            value={formData.email_address || ""}
            onChange={handleInputChange("email_address")}
            disabled={true}
            isEditing={isEditing}
          />
        </InputGroup>

        {/* <InputGroup>
          <InputLabel>Phone Number</InputLabel>
          <InputField
            type="tel"
            value={formData.phone_number || ''}
            onChange={handleInputChange('phone_number')}
            disabled={!isEditing}
            isEditing={isEditing}
          />
        </InputGroup>
        <InputGroup>
          <InputLabel>Date of Birth</InputLabel>
          <InputField
            type="date"
            value={formatDateForInput(formData.date_of_birth)}
            onChange={handleInputChange('date_of_birth')}
            disabled={!isEditing}
            isEditing={isEditing}
          />
        </InputGroup>
        <InputGroup>
          <InputLabel>Reminder Time</InputLabel>
          <InputField
            type="time"
            value={formData.reminder_time || ''}
            onChange={handleInputChange('reminder_time')}
            disabled={!isEditing}
            isEditing={isEditing}
          />
        </InputGroup> */}
      </GridContainer>

      {/* Treatment Information Section */}
      <TreatmentSection>
        <TreatmentTitle>Treatment Information</TreatmentTitle>
        <TreatmentGrid>
          <InputGroup>
            <TreatmentInputLabel $isDark={isDark}>
              Assigned Oncologist
            </TreatmentInputLabel>
            <InputField
              type="text"
              value={formData.doctor_name || ""}
              onChange={handleInputChange("doctor_name")}
              disabled={true}
              isEditing={isEditing}
            />
          </InputGroup>

          <InputGroup>
            <TreatmentInputLabel $isDark={isDark}>
              Regimen Name
            </TreatmentInputLabel>
            <InputField
              type="text"
              value={formData.chemo_plan_name || ""}
              onChange={handleInputChange("chemo_plan_name")}
              disabled={true}
              isEditing={isEditing}
            />
          </InputGroup>

          <InputGroup>
            <TreatmentInputLabel $isDark={isDark}>MRN</TreatmentInputLabel>
            <InputField
              type="text"
              value={formData.mrn || ""}
              disabled={true}
              isEditing={isEditing}
            />
          </InputGroup>

          <InputGroup>
            <TreatmentInputLabel $isDark={isDark}>
              Day of Chemo Treatment
            </TreatmentInputLabel>
            <InputField
              type="text"
              value={formData.chemotherapy_day || ""}
              onChange={handleInputChange("chemotherapy_day")}
              disabled={!isEditing}
              isEditing={isEditing}
            />
          </InputGroup>

          <InputGroup>
            <TreatmentInputLabel $isDark={isDark}>
              Treatment Start Date
            </TreatmentInputLabel>
            {isEditing ? (
              <DatePicker
                value={
                  formData.chemo_start_date
                    ? dayjs(
                        formatDateForInput(formData.chemo_start_date),
                        "YYYY-MM-DD",
                        true,
                      )
                    : null
                }
                onChange={(newValue) =>
                  onFieldChange(
                    "chemo_start_date",
                    newValue.format("YYYY-MM-DD"),
                  )
                }
                label="Treatment Start Date"
                placeholder="Treatment Start Date"
                views={["day", "month", "year"]}
                fullWidth
              />
            ) : (
              <InputField
                type="text"
                value={formatDateForDisplay(formData.chemo_start_date)}
                disabled={true}
                isEditing={isEditing}
              />
            )}
          </InputGroup>

          <InputGroup>
            <TreatmentInputLabel $isDark={isDark}>
              Treatment End Date
            </TreatmentInputLabel>
            {isEditing ? (
              <DatePicker
                value={
                  formData.chemo_end_date
                    ? dayjs(
                        formatDateForInput(formData.chemo_end_date),
                        "YYYY-MM-DD",
                        true,
                      )
                    : null
                }
                onChange={(newValue) =>
                  onFieldChange("chemo_end_date", newValue.format("YYYY-MM-DD"))
                }
                label="Treatment End Date"
                placeholder="Treatment End Date"
                views={["day", "month", "year"]}
                fullWidth
              />
            ) : (
              <InputField
                type="text"
                value={formatDateForDisplay(formData.chemo_end_date)}
                disabled={true}
                isEditing={isEditing}
              />
            )}
          </InputGroup>

          <InputGroup>
            <TreatmentInputLabel $isDark={isDark}>
              Next Chemo Therapy Treatment
            </TreatmentInputLabel>
            {isEditing ? (
              <DatePicker
                value={
                  formData.next_physician_visit
                    ? dayjs(
                        formatDateForInput(formData.next_physician_visit),
                        "YYYY-MM-DD",
                        true,
                      )
                    : null
                }
                onChange={(newValue) =>
                  onFieldChange(
                    "next_physician_visit",
                    newValue.format("YYYY-MM-DD"),
                  )
                }
                label="Next Chemo Therapy Treatment"
                placeholder="Next Chemo Therapy Treatment"
                views={["day", "month", "year"]}
                fullWidth
              />
            ) : (
              <InputField
                type="text"
                value={formatDateForDisplay(formData.next_physician_visit)}
                disabled={true}
                isEditing={isEditing}
              />
            )}
          </InputGroup>
        </TreatmentGrid>
      </TreatmentSection>

      {/* Change Password Section */}
      <PasswordSection $isDark={isDark}>
        <PasswordTitle $isDark={isDark}>Change Password</PasswordTitle>
        <TreatmentGrid>
          <InputGroup>
            <InputLabel $isDark={isDark}>Current Password</InputLabel>
            <PasswordInputContainer>
              <InputField
                type={showCurrentPassword ? "text" : "password"}
                name="currentPassword"
                value={passwordForm.currentPassword}
                onChange={handlePasswordChange}
                placeholder="Enter current password"
                isEditing={true}
              />
              <IconButton
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                $isDark={isDark}
              >
                {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </IconButton>
            </PasswordInputContainer>
            {passwordErrors.currentPassword && (
              <ErrorText $isDark={isDark}>
                {passwordErrors.currentPassword}
              </ErrorText>
            )}
          </InputGroup>

          <InputGroup>
            <InputLabel $isDark={isDark}>New Password</InputLabel>
            <PasswordInputContainer>
              <InputField
                type={showPassword ? "text" : "password"}
                name="password"
                value={passwordForm.password}
                onChange={handlePasswordChange}
                placeholder="Enter new password"
                isEditing={true}
              />
              <IconButton
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                $isDark={isDark}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </IconButton>
            </PasswordInputContainer>
            {passwordErrors.password && (
              <ErrorText $isDark={isDark}>{passwordErrors.password}</ErrorText>
            )}
          </InputGroup>

          <InputGroup>
            <InputLabel $isDark={isDark}>Confirm Password</InputLabel>
            <PasswordInputContainer>
              <InputField
                type={showConfirmPassword ? "text" : "password"}
                name="confirmPassword"
                value={passwordForm.confirmPassword}
                onChange={handlePasswordChange}
                placeholder="Confirm new password"
                isEditing={true}
              />
              <IconButton
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                $isDark={isDark}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </IconButton>
            </PasswordInputContainer>
            {passwordErrors.confirmPassword && (
              <ErrorText $isDark={isDark}>
                {passwordErrors.confirmPassword}
              </ErrorText>
            )}
          </InputGroup>
        </TreatmentGrid>
        <div style={{ display: "flex", justifyContent: "flex-start" }}>
          <ChangePasswordButton onClick={handlePasswordSubmit}>
            Update Password
          </ChangePasswordButton>
        </div>
      </PasswordSection>

      {/* <GridContainer> */}
      {/* Keeping existing code commented out as requested */}

      {/* Treatment Information Section */}
      {/* <TreatmentSection>
          <TreatmentTitle>Treatment Information</TreatmentTitle>
          <TreatmentGrid>
            <InputGroup>
              <InputLabel>Last Chemotherapy Date</InputLabel>
              <InputField
                type="date"
                value={formData.last_chemo_date || ''}
                onChange={handleInputChange('last_chemo_date')}
                disabled={!isEditing}
                isEditing={isEditing}
                placeholder="Select date"
              />
            </InputGroup>
            <InputGroup>
              <InputLabel>Next Physician Visit</InputLabel>
              <InputField
                type="date"
                value={formData.next_physician_visit || ''}
                onChange={handleInputChange('next_physician_visit')}
                disabled={!isEditing}
                isEditing={isEditing}
                placeholder="Select date"
              />
            </InputGroup>
            <InputGroup>
              <InputLabel>Diagnosis</InputLabel>
              <InputField
                type="text"
                value={formData.diagnosis || ''}
                onChange={handleInputChange('diagnosis')}
                disabled={!isEditing}
                isEditing={isEditing}
                placeholder="e.g., Breast Cancer Stage II"
              />
            </InputGroup>
            <InputGroup>
              <InputLabel>Treatment Type</InputLabel>
              <InputField
                type="text"
                value={formData.treatment_type || ''}
                onChange={handleInputChange('treatment_type')}
                disabled={!isEditing}
                isEditing={isEditing}
                placeholder="e.g., Chemotherapy, Radiation"
              />
            </InputGroup>
            <InputGroup>
              <InputLabel>Doctor Name</InputLabel>
              <InputField
                type="text"
                value={formData.doctor_name || ''}
                onChange={handleInputChange('doctor_name')}
                disabled={!isEditing}
                isEditing={isEditing}
              />
            </InputGroup>
            <InputGroup>
              <InputLabel>Clinic Name</InputLabel>
              <InputField
                type="text"
                value={formData.clinic_name || ''}
                onChange={handleInputChange('clinic_name')}
                disabled={!isEditing}
                isEditing={isEditing}
              />
            </InputGroup>
          </TreatmentGrid>
        </TreatmentSection> */}

      {/* Emergency Contact Section */}
      {/* <EmergencySection>
          <EmergencyTitle>Emergency Contact</EmergencyTitle>
          <TreatmentGrid>
            <InputGroup>
              <InputLabel>Contact Name</InputLabel>
              <InputField
                type="text"
                value={formData.emergency_contact_name || ''}
                onChange={handleInputChange('emergency_contact_name')}
                disabled={!isEditing}
                isEditing={isEditing}
                placeholder="Full name"
              />
            </InputGroup>
            <InputGroup>
              <InputLabel>Contact Phone</InputLabel>
              <InputField
                type="tel"
                value={formData.emergency_contact_phone || ''}
                onChange={handleInputChange('emergency_contact_phone')}
                disabled={!isEditing}
                isEditing={isEditing}
                placeholder="Phone number"
              />
            </InputGroup>
          </TreatmentGrid>
        </EmergencySection> */}
      {/* </GridContainer> */}

      {isEditing && (
        <ButtonGroup>
          <SaveButton onClick={onSave} disabled={isSaving}>
            {isSaving ? "⏳ Saving..." : "💾 Save Changes"}
          </SaveButton>
          <CancelButton onClick={onCancel} disabled={isSaving}>
            Cancel
          </CancelButton>
        </ButtonGroup>
      )}
    </div>
  );
};

export default PersonalInformation;
