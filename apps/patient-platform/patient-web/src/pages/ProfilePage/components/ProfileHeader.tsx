import React from 'react';
import { Mail, Edit } from 'lucide-react';
import {
  ProfileInfoHeader,
  ProfileImageContainer,
  ProfileImage,
  EditImageButton,
  ProfileInfo,
  ProfileName,
  ProfileEmail,
  EditProfileButton,
} from '../ProfilePage.styles';
import type { ProfileData } from '../types';

interface ProfileHeaderProps {
  profile: ProfileData;
  isEditing?: boolean;
  isDark?: boolean;
  onEditProfile: () => void;
  onEditImage: () => void;
}

const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  isDark,
  profile,
  isEditing = false,
  onEditProfile,
  onEditImage,
}) => {
  const getInitials = (first_name: string, last_name: string) => {
    return `${(first_name?.charAt(0) || '')}${(last_name?.charAt(0) || '')}`.toUpperCase();
  };

  return (
    <ProfileInfoHeader>
      <ProfileImageContainer>
        <ProfileImage imageUrl={undefined} $isDark={isDark}>
          {getInitials(profile.first_name, profile.last_name)}
        </ProfileImage>
        <EditImageButton onClick={onEditImage}>
          <Edit />
        </EditImageButton>
      </ProfileImageContainer>
      
      <ProfileInfo>
        <ProfileName $isDark={isDark}>{`${profile.first_name || ''} ${profile.last_name || ''}`}</ProfileName>
        <ProfileEmail $isDark={isDark}>
          <Mail />
          {profile.email_address || ''}
        </ProfileEmail>
      </ProfileInfo>
      
      {!isEditing && (
        <EditProfileButton onClick={onEditProfile}>
          Edit Profile
        </EditProfileButton>
      )}
    </ProfileInfoHeader>
  );
};

export default ProfileHeader; 