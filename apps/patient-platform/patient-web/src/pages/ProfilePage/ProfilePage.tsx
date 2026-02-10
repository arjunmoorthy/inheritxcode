import React, { useState, useEffect } from 'react';
import { CircularProgress } from '@mui/material';
import { Moon, Sun } from 'lucide-react';
import { useThemeMode } from '@oncolife/ui-components';
import {
  ProfileContainer,
  ProfileHeader as ProfileHeaderStyled,
  ProfileTitle,
  ProfileContent,
  ProfileCard,
  LoadingContainer,
  ErrorContainer,
} from './ProfilePage.styles';
import { ProfileHeader, PersonalInformation, ChemoTimeline } from './components';
import type { ProfileData, ProfileFormData } from './types';
import { useFetchProfile, useUpdateProfile } from '../../services/profile';

const ProfilePage: React.FC = () => {
  const { isDark, toggleTheme } = useThemeMode();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [formData, setFormData] = useState<ProfileFormData | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const { data: profileData, isLoading: isProfileLoading } = useFetchProfile();
  const updateProfileMutation = useUpdateProfile();

  useEffect(() => {
    if (profileData) {
      setProfile(profileData as ProfileData);
      setFormData(profileData as ProfileFormData);
    }
  }, [profileData]);

  const handleEditProfile = () => {
    setIsEditing(true);
    setSaveSuccess(false);
  };

  const handleEditImage = () => {
    // TODO: Implement image upload functionality
    console.log('Edit image clicked');
  };

  const handleFieldChange = (field: keyof ProfileFormData, value: string | number | null) => {
    if (formData) {
      setFormData({
        ...formData,
        [field]: value,
      });
    }
  };

  const handleSave = async () => {
    if (!formData) return;
    
    try {
      setError(null);
      
      // Call the update profile API
      const updatedProfile = await updateProfileMutation.mutateAsync({
        first_name: formData.first_name,
        last_name: formData.last_name,
        phone_number: formData.phone_number,
        date_of_birth: formData.date_of_birth,
        reminder_time: formData.reminder_time,
        diagnosis: formData.diagnosis,
        treatment_type: formData.treatment_type,
        last_chemo_date: formData.last_chemo_date,
        next_physician_visit: formData.next_physician_visit,
        emergency_contact_name: formData.emergency_contact_name,
        emergency_contact_phone: formData.emergency_contact_phone,
      });
      
      setProfile(updatedProfile as ProfileData);
      setFormData(updatedProfile as ProfileFormData);
      setIsEditing(false);
      setSaveSuccess(true);
      
      // Clear success message after 3 seconds
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to save profile:', err);
      setError('Failed to save profile data. Please try again.');
    }
  };

  const handleCancel = () => {
    if (profile) {
      setFormData({
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        email_address: profile.email_address || '',
        phone_number: profile.phone_number || null,
        date_of_birth: profile.date_of_birth || null,
        chemotherapy_day: profile.chemotherapy_day || '',
        reminder_time: profile.reminder_time || null,
        doctor_name: profile.doctor_name || null,
        clinic_name: profile.clinic_name || null,
        // Treatment Info
        diagnosis: profile.diagnosis || null,
        treatment_type: profile.treatment_type || null,
        chemo_plan_name: profile.chemo_plan_name || null,
        chemo_start_date: profile.chemo_start_date || null,
        chemo_end_date: profile.chemo_end_date || null,
        current_cycle: profile.current_cycle || null,
        total_cycles: profile.total_cycles || null,
        last_chemo_date: profile.last_chemo_date || null,
        next_physician_visit: profile.next_physician_visit || null,
        // Emergency contact
        emergency_contact_name: profile.emergency_contact_name || null,
        emergency_contact_phone: profile.emergency_contact_phone || null,
      });
    }
    setIsEditing(false);
    setError(null);
  };

  const DarkModeToggle = () => (
    <button
      onClick={toggleTheme}
      className={`fixed top-4 right-4 z-50 p-3 rounded-full transition-all duration-200 ${
        isDark 
          ? 'bg-[#2A2725] text-white hover:bg-[#3A3835] border border-slate-700 shadow-lg' 
          : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 shadow-lg'
      }`}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  );

  if (isProfileLoading) {
    return (
      <div className={`min-h-screen transition-colors duration-300 ${isDark ? 'bg-[#1A1917]' : 'bg-[#F8FAFC]'}`}>
        <DarkModeToggle />
        <ProfileContainer $isDark={isDark}>
          <ProfileHeaderStyled $isDark={isDark}>
            <ProfileTitle $isDark={isDark}>Profile</ProfileTitle>
          </ProfileHeaderStyled>
          <LoadingContainer $isDark={isDark}>
            <CircularProgress size={48} />
          </LoadingContainer>
        </ProfileContainer>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`min-h-screen transition-colors duration-300 ${isDark ? 'bg-[#1A1917]' : 'bg-[#F8FAFC]'}`}>
        <DarkModeToggle />
        <ProfileContainer $isDark={isDark}>
          <ProfileHeaderStyled $isDark={isDark}>
            <ProfileTitle $isDark={isDark}>Profile</ProfileTitle>
          </ProfileHeaderStyled>
          <ProfileContent>
            <ErrorContainer $isDark={isDark}>
              <strong>Error:</strong> {error}
            </ErrorContainer>
          </ProfileContent>
        </ProfileContainer>
      </div>
    );
  }

  if (!profile || !formData) {
    return (
      <div className={`min-h-screen transition-colors duration-300 ${isDark ? 'bg-[#1A1917]' : 'bg-[#F8FAFC]'}`}>
        <DarkModeToggle />
        <ProfileContainer $isDark={isDark}>
          <ProfileHeaderStyled $isDark={isDark}>
            <ProfileTitle $isDark={isDark}>Profile</ProfileTitle>
          </ProfileHeaderStyled>
          <ProfileContent>
            <ErrorContainer $isDark={isDark}>
              <strong>Error:</strong> No profile data available
            </ErrorContainer>
          </ProfileContent>
        </ProfileContainer>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDark ? 'bg-[#1A1917]' : 'bg-[#F8FAFC]'}`}>
      <DarkModeToggle />
      <ProfileContainer $isDark={isDark}>
        <ProfileHeaderStyled $isDark={isDark}>
          <ProfileTitle $isDark={isDark}>Profile</ProfileTitle>
        </ProfileHeaderStyled>
      
      <ProfileContent>
        {saveSuccess && (
          <div className={`rounded-lg p-3 mb-4 flex items-center gap-2 transition-colors duration-300 ${
            isDark 
              ? 'bg-green-500/20 border border-green-500/50 text-green-400' 
              : 'bg-gradient-to-r from-green-50 to-green-100 border border-green-300 text-green-700'
          }`}>
            ✅ Profile saved successfully!
          </div>
        )}
        
        <ProfileCard $isDark={isDark}>
          <ProfileHeader
            profile={profile}
            onEditProfile={handleEditProfile}
            onEditImage={handleEditImage}
          />
          
          <PersonalInformation
            formData={formData}
            isEditing={isEditing}
            onFieldChange={handleFieldChange}
            onSave={handleSave}
            onCancel={handleCancel}
            isSaving={updateProfileMutation.isPending}
          />
        </ProfileCard>
        
        {/* Chemo Timeline Section */}
        <ProfileCard $isDark={isDark} style={{ marginTop: '24px' }}>
          <ChemoTimeline />
        </ProfileCard>
      </ProfileContent>
    </ProfileContainer>
    </div>
  );
};

export default ProfilePage; 