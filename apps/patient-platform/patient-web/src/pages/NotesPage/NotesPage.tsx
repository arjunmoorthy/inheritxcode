/**
 * NotesPage (Your Diary) - Figma Aligned
 * Card-based diary entries with modal for new entry
 */
import React, { useState } from 'react';
import styled from 'styled-components';
import { Plus, Calendar, Stethoscope, X, Moon, Sun, CheckCircle } from 'lucide-react';
import dayjs, { Dayjs } from 'dayjs';
import { Container, Header, Title } from '@oncolife/ui-components';
import { useThemeMode } from '@oncolife/ui-components';
import { useFetchNotes, useSaveNewNotes, useDeleteNote } from '../../services/notes';
import { getPatientUuid } from '../../utils/patientUuid';
import type { Note, NoteResponse } from './types';

// =============================================================================
// STYLED COMPONENTS
// =============================================================================

const colors = {
  background: '#FAF8F5',
  paper: '#FFFFFF',
  primary: '#4F7CAC',
  primaryLight: '#7BA3C9',
  primaryDark: '#3B5F8A',
  foreground: '#3D3A35',
  muted: '#8A847A',
  border: '#E8E4DD',
  forDoctor: '#4F7CAC',
  forDoctorBg: '#E8F0F8',
};

const PageContainer = styled.div<{ $isDark?: boolean }>`
  flex: 1;
  padding: 2rem;
  overflow: auto;
  background: ${props => props.$isDark ? '#1A1917' : colors.background};
  transition: background-color 0.3s ease;
`;

const ContentWrapper = styled.div`
  max-width: 900px;
  margin: 0 auto;
`;

const PageHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2rem;
`;

const HeaderText = styled.div``;

const PageTitle = styled.h1<{ $isDark?: boolean }>`
  font-family: 'Fraunces', Georgia, serif;
  font-size: 1.75rem;
  font-weight: 600;
  color: ${props => props.$isDark ? '#F1F5F9' : colors.foreground};
  margin: 0 0 0.5rem 0;
  transition: color 0.3s ease;
`;

const PageSubtitle = styled.p<{ $isDark?: boolean }>`
  font-size: 1rem;
  color: ${props => props.$isDark ? '#94A3B8' : colors.muted};
  margin: 0;
  transition: color 0.3s ease;
`;

const NewEntryButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  background: ${colors.primary};
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 0.9375rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: ${colors.primaryDark};
    transform: translateY(-1px);
  }
  
  svg {
    width: 18px;
    height: 18px;
  }
`;

const EntriesList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const DiaryCard = styled.div<{ $isDark?: boolean }>`
  background: ${props => props.$isDark ? '#2A2725' : colors.paper};
  border: 1px solid ${props => props.$isDark ? '#3A3835' : colors.border};
  border-left: 4px solid ${colors.primary};
  border-radius: 16px;
  padding: 1.25rem 1.5rem;
  cursor: pointer;
  transition: all 0.25s ease;
  box-shadow: ${props => props.$isDark ? '0 2px 8px rgba(0, 0, 0, 0.3)' : '0 2px 8px rgba(0, 0, 0, 0.04)'};
  
  &:hover {
    box-shadow: ${props => props.$isDark ? '0 4px 16px rgba(0, 0, 0, 0.5)' : '0 4px 16px rgba(0, 0, 0, 0.08)'};
    transform: translateY(-2px);
  }
`;

const CardHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
`;

const CardDate = styled.span<{ $isDark?: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: ${props => props.$isDark ? '#94A3B8' : colors.muted};
  transition: color 0.3s ease;
  
  svg {
    width: 16px;
    height: 16px;
  }
`;

const ForDoctorBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.75rem;
  background: ${colors.forDoctorBg};
  color: ${colors.forDoctor};
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
  
  svg {
    width: 14px;
    height: 14px;
  }
`;

const CardTitle = styled.h3<{ $isDark?: boolean }>`
  font-size: 1.125rem;
  font-weight: 600;
  color: ${props => props.$isDark ? '#F1F5F9' : colors.foreground};
  margin: 0.25rem 0 0.5rem 0;
  transition: color 0.3s ease;
`;

const CardContent = styled.p<{ $isDark?: boolean }>`
  font-size: 1rem;
  color: ${props => props.$isDark ? '#94A3B8' : colors.muted};
  transition: color 0.3s ease;
  line-height: 1.6;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const EmptyState = styled.div<{ $isDark?: boolean }>`
  text-align: center;
  padding: 4rem 2rem;
  color: ${props => props.$isDark ? '#94A3B8' : colors.muted};
  transition: color 0.3s ease;
  
  .icon {
    font-size: 3rem;
    margin-bottom: 1rem;
  }
  
  h3 {
    color: ${props => props.$isDark ? '#F1F5F9' : colors.foreground};
    margin-bottom: 0.5rem;
    transition: color 0.3s ease;
  }
`;

const SuccessMessage = styled.div`
  position: fixed;
  top: 1.5rem;
  left: 50%;
  transform: translateX(-50%);
  background: #2E7D32;
  color: white;
  padding: 0.75rem 1.5rem;
  border-radius: 12px;
  font-weight: 600;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  z-index: 2000;
  animation: slideDownFade 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  
  @keyframes slideDownFade {
    from { 
      transform: translate(-50%, -20px); 
      opacity: 0; 
    }
    to { 
      transform: translate(-50%, 0); 
      opacity: 1; 
    }
  }
`;

// Modal Styles
const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
`;

const ModalContainer = styled.div<{ $isDark?: boolean }>`
  background: ${props => props.$isDark ? '#2A2725' : colors.paper};
  border-radius: 20px;
  width: 100%;
  max-width: 600px;
  max-height: 90vh;
  overflow: hidden;
  box-shadow: ${props => props.$isDark ? '0 20px 60px rgba(0, 0, 0, 0.5)' : '0 20px 60px rgba(0, 0, 0, 0.2)'};
  animation: slideUp 0.3s ease;
  transition: background-color 0.3s ease;
  
  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

const ModalHeader = styled.div`
  padding: 1.5rem 1.5rem 1rem;
  position: relative;
`;

const ModalDate = styled.div<{ $isDark?: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: ${props => props.$isDark ? '#94A3B8' : colors.muted};
  margin-bottom: 0.5rem;
  transition: color 0.3s ease;
  
  svg {
    width: 16px;
    height: 16px;
  }
`;

const ModalTitle = styled.h2<{ $isDark?: boolean }>`
  font-family: 'Fraunces', Georgia, serif;
  font-size: 1.5rem;
  font-weight: 600;
  color: ${props => props.$isDark ? '#F1F5F9' : colors.foreground};
  margin: 0;
  transition: color 0.3s ease;
`;

const CloseButton = styled.button`
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.5rem;
  color: ${colors.muted};
  border-radius: 8px;
  transition: all 0.2s ease;
  
  &:hover {
    background: ${colors.background};
    color: ${colors.foreground};
  }
  
  svg {
    width: 20px;
    height: 20px;
  }
`;

const ModalBody = styled.div`
  padding: 0 1.5rem;
`;

const DiaryTitleInput = styled.input<{ $isDark?: boolean }>`
  width: 100%;
  padding: 0.875rem 1rem;
  margin-bottom: 1rem;
  border: 2px solid ${props => props.$isDark ? '#3A3835' : colors.border};
  border-radius: 12px;
  font-size: 1.125rem;
  font-weight: 600;
  color: ${props => props.$isDark ? '#F1F5F9' : colors.foreground};
  background: ${props => props.$isDark ? '#1A1917' : '#FFFEF8'};
  transition: all 0.2s ease;
  
  &::placeholder {
    color: ${props => props.$isDark ? '#94A3B8' : colors.muted};
  }
  
  &:focus {
    outline: none;
    border-color: ${colors.primary};
  }
`;

const DiaryTextarea = styled.textarea<{ $isDark?: boolean }>`
  width: 100%;
  min-height: 200px;
  padding: 1rem;
  border: 2px solid ${props => props.$isDark ? '#3A3835' : colors.border};
  border-radius: 12px;
  font-size: 1rem;
  font-family: inherit;
  color: ${props => props.$isDark ? '#F1F5F9' : colors.foreground};
  background: ${props => props.$isDark ? '#1A1917' : '#FFFEF8'};
  resize: vertical;
  transition: all 0.2s ease;
  
  &::placeholder {
    color: ${props => props.$isDark ? '#94A3B8' : colors.muted};
  }
  
  &:focus {
    outline: none;
    border-color: ${colors.primary};
  }
`;

const ModalFooter = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  border-top: 1px solid ${colors.border};
  margin-top: 1rem;
`;

const MarkForDoctorCheckbox = styled.label<{ $isDark?: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-size: 0.9375rem;
  color: ${props => props.$isDark ? '#F1F5F9' : colors.foreground};
  transition: color 0.3s ease;
  
  input {
    width: 18px;
    height: 18px;
    accent-color: ${colors.primary};
    cursor: pointer;
  }
  
  svg {
    width: 18px;
    height: 18px;
    color: ${colors.primary};
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 0.75rem;
`;

const CancelButton = styled.button`
  padding: 0.75rem 1.25rem;
  background: ${colors.paper};
  color: ${colors.foreground};
  border: 1px solid ${colors.border};
  border-radius: 10px;
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: ${colors.background};
  }
`;

const SaveButton = styled.button`
  padding: 0.75rem 1.5rem;
  background: ${colors.primaryLight};
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 0.9375rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: ${colors.primary};
  }
  
  &:disabled {
    background: ${colors.border};
    cursor: not-allowed;
  }
`;

// =============================================================================
// COMPONENT
// =============================================================================

const NotesPage: React.FC = () => {
  const { isDark, toggleTheme } = useThemeMode();
  const [selectedDate] = useState<Dayjs>(dayjs());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newEntryTitle, setNewEntryTitle] = useState('');
  const [newEntryText, setNewEntryText] = useState('');
  const [markForDoctor, setMarkForDoctor] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const patientUuid = getPatientUuid() || '';
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  // Fetch notes from API
  const { data: notesResponse, isLoading } = useFetchNotes(patientUuid, timezone);
  const notes: Note[] = ((notesResponse as NoteResponse)?.data ?? []).sort((a, b) => 
    dayjs(b.created_at).valueOf() - dayjs(a.created_at).valueOf()
  );
  
  // Mutation hooks
  const saveNewNotesMutation = useSaveNewNotes(patientUuid);
  const deleteNoteMutation = useDeleteNote(patientUuid);
  
  // Format date for display (e.g., "Monday, January 5, 2026")
  const formatDate = (dateString: string) => {
    try {
      return dayjs(dateString).format('dddd, MMMM D, YYYY');
    } catch {
      return dateString;
    }
  };
  
  // Open modal for new entry
  const handleNewEntry = () => {
    setNewEntryTitle('');
    setNewEntryText('');
    setMarkForDoctor(false);
    setIsModalOpen(true);
  };
  
  // Save new entry
  const handleSaveEntry = async () => {
    if (!newEntryText.trim()) return;
    
    try {
      await saveNewNotesMutation.mutateAsync({
        content: newEntryText.trim(),
        title: newEntryTitle.trim() || dayjs().format('MMMM D, YYYY'),
        marked_for_doctor: markForDoctor,
      });
      setIsModalOpen(false);
      setNewEntryTitle('');
      setNewEntryText('');
      setMarkForDoctor(false);
      
      // Show success message
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to save entry:', error);
    }
  };
  
  // Close modal
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setNewEntryTitle('');
    setNewEntryText('');
    setMarkForDoctor(false);
  };
  
  // Handle card click (could open edit modal in future)
  const handleCardClick = (note: Note) => {
    // TODO: Open edit modal
    console.log('Card clicked:', note);
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      isDark ? 'bg-[#1A1917]' : 'bg-[#FAF8F5]'
    }`}>
      {/* Dark Mode Toggle */}
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

      {showSuccess && (
        <SuccessMessage>
          <CheckCircle size={18} />
          Diary entry saved successfully!
        </SuccessMessage>
      )}

      <Container>
        <Header>
          <Title>Notes</Title>
        </Header>
        
        <PageContainer $isDark={isDark}>
          <ContentWrapper>
            <PageHeader>
              <HeaderText>
                <PageTitle $isDark={isDark}>Your Diary</PageTitle>
                <PageSubtitle $isDark={isDark}>A private space to reflect on your journey.</PageSubtitle>
              </HeaderText>
              <NewEntryButton onClick={handleNewEntry}>
                <Plus />
                New Entry
              </NewEntryButton>
            </PageHeader>
          
          {isLoading ? (
            <EmptyState $isDark={isDark}>
              <div className="icon">⏳</div>
              <p>Loading your diary...</p>
            </EmptyState>
          ) : notes.length === 0 ? (
            <EmptyState $isDark={isDark}>
              <div className="icon">📔</div>
              <h3>No Entries Yet</h3>
              <p>Start writing about your journey. Click "New Entry" to create your first diary entry.</p>
            </EmptyState>
          ) : (
            <EntriesList>
              {notes.map((note) => (
                <DiaryCard 
                  key={note.id || note.entry_uuid}
                  $isDark={isDark}
                  onClick={() => handleCardClick(note)}
                >
                  <CardHeader>
                    <CardDate $isDark={isDark}>
                      <Calendar />
                      {formatDate(note.created_at)}
                    </CardDate>
                    {note.marked_for_doctor && (
                      <ForDoctorBadge>
                        <Stethoscope />
                        For Doctor
                      </ForDoctorBadge>
                    )}
                  </CardHeader>
                  {note.title && (
                    <CardTitle $isDark={isDark}>
                      {note.title}
                    </CardTitle>
                  )}
                  <CardContent $isDark={isDark}>
                    {note.diary_entry}
                  </CardContent>
                </DiaryCard>
              ))}
            </EntriesList>
          )}
        </ContentWrapper>
      </PageContainer>
      
        {/* New Entry Modal */}
        {isModalOpen && (
          <ModalOverlay onClick={handleCloseModal}>
            <ModalContainer $isDark={isDark} onClick={(e) => e.stopPropagation()}>
              <ModalHeader>
                <ModalDate $isDark={isDark}>
                  <Calendar />
                  {dayjs().format('dddd, MMMM D, YYYY')}
                </ModalDate>
                <ModalTitle $isDark={isDark}>New Diary Entry</ModalTitle>
                <CloseButton onClick={handleCloseModal}>
                  <X />
                </CloseButton>
              </ModalHeader>
              
              <ModalBody>
                <DiaryTitleInput
                  $isDark={isDark}
                  placeholder="Entry Title (Optional)"
                  value={newEntryTitle}
                  onChange={(e) => setNewEntryTitle(e.target.value)}
                />
                <DiaryTextarea
                  $isDark={isDark}
                  placeholder="How are you feeling today? Write your thoughts..."
                  value={newEntryText}
                  onChange={(e) => setNewEntryText(e.target.value)}
                  autoFocus
                />
              </ModalBody>
            
              <ModalFooter>
                <MarkForDoctorCheckbox $isDark={isDark}>
                  <input
                    type="checkbox"
                    checked={markForDoctor}
                    onChange={(e) => setMarkForDoctor(e.target.checked)}
                  />
                  <Stethoscope />
                  Mark for Doctor
                </MarkForDoctorCheckbox>
              
              <ButtonGroup>
                <CancelButton onClick={handleCloseModal}>
                  Cancel
                </CancelButton>
                <SaveButton 
                  onClick={handleSaveEntry}
                  disabled={!newEntryText.trim() || saveNewNotesMutation.isPending}
                >
                  {saveNewNotesMutation.isPending ? 'Saving...' : 'Save Entry'}
                </SaveButton>
                </ButtonGroup>
              </ModalFooter>
            </ModalContainer>
          </ModalOverlay>
        )}
      </Container>
    </div>
  );
};

export default NotesPage;
