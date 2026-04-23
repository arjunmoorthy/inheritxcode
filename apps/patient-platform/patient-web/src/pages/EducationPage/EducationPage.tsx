/**
 * OncoLife Ruby - Education Page
 * Lovable-inspired design with Current Symptoms sidebar
 */

import React, { useState, useMemo } from 'react';
import { useTheme, useMediaQuery, Drawer, IconButton, CircularProgress } from '@mui/material';
import styled, { css } from 'styled-components';
import { useThemeMode } from '@oncolife/ui-components';
import { useEducationPdfs, openEducationPdf } from '../../services/education';
import {
  BookOpen,
  FileText,
  Heart,
  Pill,
  Apple,
  Activity,
  ChevronRight,
  Download,
  Search,
  Filter,
  Clock,
  Zap,
  Star,
  X,
  Plus,
  Triangle,
  Moon,
  Sun,
  Brain,
  Utensils,
  CircleDot,
  Menu
} from 'lucide-react';

// Warm Lovable-style colors
const colors = {
  background: '#FAF8F5',
  paper: '#FFFFFF',
  primary: '#4F7CAC',
  primaryLight: '#7BA3C9',
  primaryDark: '#3B5F8A',
  foreground: '#3D3A35',
  muted: '#8A847A',
  border: '#E8E4DD',

  // Severity colors
  mild: '#22C55E',
  mildBg: '#DCFCE7',
  mildText: '#166534',
  moderate: '#F59E0B',
  moderateBg: '#FEF3C7',
  moderateText: '#92400E',
  severe: '#DC2626',
  severeBg: '#FEE2E2',

  // Category colors
  symptom: '#00897B',
  nutrition: '#10B981',
  mental: '#EC4899',
  activity: '#F59E0B',
  purple: '#8B5CF6',
};

// ============= Styled Components =============

const PageContainer = styled.div<{ $isDark?: boolean }>`
  display: flex;
  flex: 1;
  height: 100%;
  overflow: hidden;
  background: transparent;
  transition: background-color 0.3s ease;
`;

const MainContent = styled.div`
  flex: 1;
  padding: 1.5rem;
  overflow-y: scroll; /* Force scrollbar for visibility */
  
  @media (min-width: 600px) {
    padding: 2rem;
  }

  &::-webkit-scrollbar {
    width: 40px !important;
    height: 12px; 
  }
  &::-webkit-scrollbar-track {
    background: var(--app-bg) !important;
  }
  &::-webkit-scrollbar-thumb {
    background: var(--app-border) !important;
    border-radius: 25px !important;
    border: 10px solid var(--app-bg) !important;
  }
`;

const ContentWrapper = styled.div`
  max-width: 700px;
`;

const PageHeader = styled.div<{ $isDark?: boolean }>`
  margin-bottom: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const PageTitle = styled.h1<{ $isDark?: boolean }>`
  font-family: 'Fraunces', Georgia, serif;
  font-size: 1.5rem;
  font-weight: 600;
  color: ${props => props.$isDark ? '#F1F5F9' : colors.foreground};
  margin: 0 0 0.5rem 0;
  transition: color 0.3s ease;
  
  @media (min-width: 600px) {
    font-size: 1.75rem;
  }
`;

const PageSubtitle = styled.p<{ $isDark?: boolean }>`
  font-size: 0.875rem;
  color: ${props => props.$isDark ? '#94A3B8' : colors.muted};
  margin: 0;
  transition: color 0.3s ease;
  
  @media (min-width: 600px) {
    font-size: 1rem;
  }
`;

const MobileMenuButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: 1px solid ${colors.border};
  background: ${colors.paper};
  border-radius: 10px;
  cursor: pointer;
  color: ${colors.muted};
  
  @media (min-width: 1024px) {
    display: none;
  }
`;

// Search and Filters
const FiltersRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
  
  @media (min-width: 500px) {
    flex-direction: row;
    align-items: center;
  }
`;

const SearchInputWrapper = styled.div<{ $isDark?: boolean }>`
  position: relative;
  flex: 1;
  
  input {
    width: 100%;
    padding: 0.75rem 1rem 0.75rem 2.5rem;
    background: ${props => props.$isDark ? '#1A1917' : colors.paper};
    border: 1px solid ${props => props.$isDark ? '#3A3835' : colors.border};
    border-radius: 12px;
    font-size: 0.875rem;
    color: ${props => props.$isDark ? '#F1F5F9' : colors.foreground};
    transition: all 0.2s ease;
    
    &::placeholder {
      color: ${props => props.$isDark ? '#94A3B8' : colors.muted};
    }
    
    &:focus {
      outline: none;
      border-color: ${colors.primary};
      box-shadow: 0 0 0 3px rgba(79, 124, 172, 0.1);
    }
  }
  
  svg {
    position: absolute;
    left: 0.875rem;
    top: 50%;
    transform: translateY(-50%);
    width: 16px;
    height: 16px;
    color: ${props => props.$isDark ? '#94A3B8' : colors.muted};
    pointer-events: none;
    transition: color 0.3s ease;
  }
`;

const FilterButton = styled.button<{ $isDark?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.75rem;
  background: ${props => props.$isDark ? '#1A1917' : colors.paper};
  border: 1px solid ${props => props.$isDark ? '#3A3835' : colors.border};
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  color: ${props => props.$isDark ? '#94A3B8' : colors.muted};
  
  &:hover {
    border-color: ${colors.primary};
    color: ${colors.primary};
  }
  
  svg {
    width: 18px;
    height: 18px;
  }
`;

const SelectWrapper = styled.div<{ $isDark?: boolean }>`
  position: relative;
  min-width: 160px;
  
  select {
    width: 100%;
    padding: 0.75rem 2.5rem 0.75rem 1rem;
    background: ${props => props.$isDark ? '#1A1917' : colors.paper};
    border: 1px solid ${props => props.$isDark ? '#3A3835' : colors.border};
    border-radius: 12px;
    font-size: 0.875rem;
    color: ${props => props.$isDark ? '#F1F5F9' : colors.foreground};
    cursor: pointer;
    appearance: none;
    transition: all 0.2s ease;
    
    &:focus {
      outline: none;
      border-color: ${colors.primary};
    }

    option {
      background: ${props => props.$isDark ? '#2A2725' : colors.paper};
      color: ${props => props.$isDark ? '#F1F5F9' : colors.foreground};
    }
  }
  
  &::after {
    content: '▼';
    position: absolute;
    right: 1rem;
    top: 50%;
    transform: translateY(-50%);
    font-size: 0.625rem;
    color: ${props => props.$isDark ? '#94A3B8' : colors.muted};
    pointer-events: none;
    transition: color 0.3s ease;
  }
`;

// Resource card - Lovable style with left border
const ResourceCard = styled.div<{ $isDark?: boolean; $accentColor?: string; $isNew?: boolean }>`
  background: ${props => props.$isDark ? '#2A2725' : colors.paper};
  border: 1px solid ${props => props.$isDark ? '#3A3835' : colors.border};
  border-left: 4px solid ${props => props.$accentColor || colors.primary};
  border-radius: 16px;
  padding: 1.25rem;
  margin-bottom: 1rem;
  box-shadow: ${props => props.$isDark ? '0 4px 24px -8px rgba(0, 0, 0, 0.3)' : '0 4px 24px -8px rgba(0, 0, 0, 0.08)'};
  transition: all 0.25s ease;
  cursor: pointer;
  
  &:hover {
    box-shadow: ${props => props.$isDark ? '0 8px 32px -8px rgba(0, 0, 0, 0.5)' : '0 8px 32px -8px rgba(0, 0, 0, 0.12)'};
    transform: translateY(-2px);
  }
  
  @media (min-width: 600px) {
    padding: 1.5rem;
  }
`;

const CardTitleRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
`;

const CardTitle = styled.h3<{ $isDark?: boolean }>`
  font-family: 'DM Sans', sans-serif;
  font-size: 1rem;
  font-weight: 600;
  color: ${props => props.$isDark ? '#F1F5F9' : colors.foreground};
  margin: 0;
  transition: color 0.3s ease;
`;

const NewBadge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 0.125rem 0.5rem;
  background: ${colors.primary};
  color: white;
  border-radius: 9999px;
  font-size: 0.6875rem;
  font-weight: 600;
`;

const CardDescription = styled.p<{ $isDark?: boolean }>`
  font-size: 0.875rem;
  color: ${props => props.$isDark ? '#94A3B8' : colors.muted};
  margin: 0 0 1rem 0;
  line-height: 1.6;
  transition: color 0.3s ease;
`;

const CardMeta = styled.div<{ $isDark?: boolean }>`
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
`;

const MetaBadge = styled.span<{ $isDark?: boolean }>`
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.75rem;
  background: ${props => props.$isDark ? '#1A1917' : colors.background};
  color: ${props => props.$isDark ? '#94A3B8' : colors.muted};
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
  transition: all 0.3s ease;
`;

const MetaItem = styled.span<{ $isDark?: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  color: ${props => props.$isDark ? '#94A3B8' : colors.muted};
  transition: color 0.3s ease;
  
  svg {
    width: 14px;
    height: 14px;
  }
`;

const CardActions = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const ReadButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1.25rem;
  background: ${colors.primary};
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: ${colors.primaryDark};
    transform: translateY(-1px);
  }
  
  svg {
    width: 16px;
    height: 16px;
  }
`;

const SaveButton = styled.button<{ $isDark?: boolean }>`
  display: flex;
  align-items: center;
  padding: 0.625rem 1rem;
  background: transparent;
  color: ${props => props.$isDark ? '#94A3B8' : colors.muted};
  border: none;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    color: ${props => props.$isDark ? '#F1F5F9' : colors.foreground};
  }
`;

// ============= Sidebar =============

const Sidebar = styled.aside<{ $isDark?: boolean }>`
  width: 300px;
  background: ${props => props.$isDark ? 'rgba(42, 39, 37, 0.5)' : 'rgba(255, 255, 255, 0.5)'};
  border-left: 1px solid ${props => props.$isDark ? '#3A3835' : colors.border};
  padding: 1.5rem;
  overflow-y: auto;
  display: none;
  transition: all 0.3s ease;
  
  @media (min-width: 1024px) {
    display: block;
  }

  &::-webkit-scrollbar {
    width: 40px !important;
    height: 100px !important;
  }
  &::-webkit-scrollbar-track {
    background: var(--app-bg) !important;
  }
  &::-webkit-scrollbar-thumb {
    background: var(--app-border) !important;
    border-radius: 25px !important;
    border: 10px solid var(--app-bg) !important;
  }
`;

const SidebarSection = styled.div`
  margin-bottom: 2rem;
`;

const SidebarTitle = styled.h3<{ $isDark?: boolean }>`
  font-family: 'DM Sans', sans-serif;
  font-size: 0.875rem;
  font-weight: 600;
  color: ${props => props.$isDark ? '#F1F5F9' : colors.foreground};
  margin: 0 0 1rem 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: color 0.3s ease;
  
  svg {
    width: 16px;
    height: 16px;
    color: ${colors.primary};
  }
`;

const SymptomRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
`;

const SymptomInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const SymptomIcon = styled.span<{ $isDark?: boolean }>`
  color: ${props => props.$isDark ? '#94A3B8' : colors.muted};
  transition: color 0.3s ease;
  
  svg {
    width: 16px;
    height: 16px;
  }
`;

const SymptomName = styled.span<{ $isDark?: boolean }>`
  font-size: 0.875rem;
  color: ${props => props.$isDark ? '#F1F5F9' : colors.foreground};
  transition: color 0.3s ease;
`;

const SeverityTag = styled.span<{ $severity?: 'mild' | 'moderate' | 'severe' | 'call care team' }>`
  display: inline-flex;
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.6875rem;
  font-weight: 600;
  
  ${props => {
    switch (props.$severity) {
      case 'severe':
        return css`
          background: ${colors.severeBg};
          color: ${colors.severe};
        `;
      case 'moderate':
      case 'call care team':
        return css`
          background: ${colors.moderateBg};
          color: ${colors.moderateText};
        `;
      default:
        return css`
          background: ${colors.mildBg};
          color: ${colors.mildText};
        `;
    }
  }}
`;

const RemoveButton = styled.button<{ $isDark?: boolean }>`
  font-size: 0.75rem;
  color: ${props => props.$isDark ? '#94A3B8' : colors.muted};
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.25rem;
  transition: color 0.3s ease;
  
  &:hover {
    color: ${colors.severe};
  }
`;

const AddSymptomRow = styled.div`
  margin-top: 1rem;
`;

const AddSymptomLabel = styled.p`
  font-size: 0.75rem;
  color: ${colors.muted};
  margin: 0 0 0.5rem 0;
`;

const AddSymptomButtons = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
`;

const AddSymptomButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.625rem;
  background: ${colors.paper};
  border: 1px solid ${colors.border};
  border-radius: 8px;
  font-size: 0.75rem;
  color: ${colors.muted};
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    border-color: ${colors.primary};
    color: ${colors.primary};
  }
  
  svg {
    width: 12px;
    height: 12px;
  }
`;

// My Documents section
const DocumentCard = styled.div`
  background: ${colors.paper};
  border: 1px solid ${colors.border};
  border-radius: 12px;
  padding: 0.75rem;
  margin-bottom: 0.75rem;
`;

const DocumentTitle = styled.h4`
  font-size: 0.875rem;
  font-weight: 600;
  color: ${colors.foreground};
  margin: 0 0 0.25rem 0;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
`;

const DocumentDescription = styled.p`
  font-size: 0.75rem;
  color: ${colors.muted};
  margin: 0 0 0.5rem 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const DocumentMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const DocumentBadge = styled.span<{ $color?: string }>`
  display: inline-flex;
  padding: 0.125rem 0.5rem;
  background: ${props => props.$color ? `${props.$color}15` : `${colors.primary}15`};
  color: ${props => props.$color || colors.primary};
  border-radius: 8px;
  font-size: 0.625rem;
  font-weight: 600;
`;

const DocumentTime = styled.span`
  font-size: 0.6875rem;
  color: ${colors.muted};
`;

// ============= Data =============

interface Resource {
  id: string;
  title: string;
  description: string;
  category: string;
  readTime: number;
  priority: 'High' | 'Medium' | 'Low';
  isNew?: boolean;
  color: string;
  symptomName?: string;
  source?: string;
  pdfUrl?: string;
}

interface Symptom {
  name: string;
  severity: 'mild' | 'moderate' | 'severe';
  icon: React.ElementType;
}

const resources: Resource[] = [
  {
    id: '1',
    title: 'Nausea and Vomiting Prevention',
    description: 'Comprehensive guide on preventing and managing nausea, including dietary modifications and medication timing.',
    category: 'Symptom Management',
    readTime: 6,
    priority: 'High',
    color: colors.symptom,
  },
  {
    id: '2',
    title: 'Managing Treatment-Related Fatigue',
    description: 'Learn evidence-based strategies to combat fatigue during cancer treatment, including energy conservation techniques and activity pacing.',
    category: 'Symptom Management',
    readTime: 8,
    priority: 'High',
    isNew: true,
    color: colors.symptom,
  },
  {
    id: '3',
    title: 'Coping with Treatment Anxiety',
    description: 'Mindfulness techniques and cognitive strategies to help manage anxiety during your cancer journey.',
    category: 'Mental Health',
    readTime: 10,
    priority: 'Medium',
    color: colors.mental,
  },
  {
    id: '4',
    title: 'Nutrition During Treatment',
    description: 'Evidence-based nutritional recommendations to maintain strength and support recovery during treatment.',
    category: 'Nutrition',
    readTime: 12,
    priority: 'Medium',
    color: colors.nutrition,
  },
];

const initialSymptoms: Symptom[] = [
  { name: 'Fatigue', severity: 'moderate', icon: Zap },
  { name: 'Nausea', severity: 'mild', icon: Triangle },
  { name: 'Anxiety', severity: 'mild', icon: Heart },
];

const availableSymptoms = [
  { name: 'Pain', icon: Triangle },
  { name: 'Sleep Issues', icon: Moon },
  { name: 'Memory Issues', icon: Brain },
  { name: 'Appetite Loss', icon: Utensils },
];

const myDocuments = [
  {
    title: 'Managing Fatigue...',
    description: 'Comprehensive guide on managing fatigue symptoms...',
    category: 'Symptom Management',
    categoryColor: colors.symptom,
    time: '2h ago',
    readTime: '5 min',
    starred: true,
  },
  {
    title: 'Nutrition Guidelines for...',
    description: 'Evidence-based nutritional recommendations during...',
    category: 'Nutrition',
    categoryColor: colors.nutrition,
    time: '1d ago',
    readTime: '8 min',
    starred: false,
  },
];

const categories = ['Current Symptoms', 'All Categories', 'Symptom Management', 'Handbook', 'Mental Health', 'Nutrition', 'Exercise'];

// ============= Component =============

const EducationPage: React.FC = () => {
  const { isDark, toggleTheme } = useThemeMode();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'));
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [symptoms, setSymptoms] = useState<Symptom[]>(initialSymptoms);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Fetch real education data from API
  const { data: educationData, isLoading } = useEducationPdfs();

  // Transform API data into UI format
  const apiResources = useMemo<Resource[]>(() => {
    if (!educationData) return [];

    const symptomResources: Resource[] = (educationData.symptom_pdfs || []).map((pdf, index) => ({
      id: pdf.id,
      title: pdf.title,
      description: pdf.summary || `Learn about managing ${pdf.symptom_name.toLowerCase()} during treatment.`,
      category: 'Symptom Management',
      readTime: 5 + (index % 5), // Estimate based on index
      priority: index < 3 ? 'High' : 'Medium',
      isNew: index === 0,
      color: colors.symptom,
      pdfUrl: pdf.pdf_url,
      source: pdf.source,
      symptomName: pdf.symptom_name,
    }));

    const handbookResources: Resource[] = (educationData.handbooks || []).map((handbook, index) => ({
      id: handbook.id,
      title: handbook.title,
      description: handbook.description || 'Essential education handbook for treatment support.',
      category: 'Handbook',
      readTime: 12 + (index % 4),
      priority: 'High',
      color: colors.purple,
      isNew: false,
      pdfUrl: handbook.pdf_url,
      source: handbook.handbook_type ? `Handbook: ${handbook.handbook_type}` : 'Handbook',
      // symptomName: 'Care Guide',
    }));

    return [...symptomResources, ...handbookResources];
  }, [educationData]);

  // Use API data if available, otherwise fall back to static resources
  const displayResources = apiResources.length > 0 ? apiResources : resources;

  const filteredResources = displayResources.filter(resource => {
    const matchesSearch = resource.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      resource.description.toLowerCase().includes(searchQuery.toLowerCase());

    let matchesCategory = false;
    if (selectedCategory === 'All Categories') {
      matchesCategory = true;
    } else if (selectedCategory === 'Current Symptoms') {
      const symptomNames = symptoms.map(s => s.name.toLowerCase());
      matchesCategory = symptomNames.some(symptom =>
        resource.title.toLowerCase().includes(symptom) ||
        resource.description.toLowerCase().includes(symptom)
      );
    } else {
      matchesCategory = resource.category === selectedCategory;
    }

    return matchesSearch && matchesCategory;
  });

  const removeSymptom = (name: string) => {
    setSymptoms(symptoms.filter(s => s.name !== name));
  };

  const addSymptom = (symptom: { name: string; icon: React.ElementType }) => {
    if (!symptoms.find(s => s.name.toLowerCase() === symptom.name.toLowerCase())) {
      setSymptoms([...symptoms, { ...symptom, severity: 'mild' }]);
    }
  };

  const getPriorityIcon = (priority: string) => {
    if (priority === 'High') return <Zap size={12} style={{ color: colors.severe }} />;
    return null;
  };

  // Sidebar content (shared between desktop and mobile drawer)
  const SidebarContent = () => (
    <>
      {/* Current Symptoms */}
      <SidebarSection>
        <SidebarTitle $isDark={isDark}>
          <Zap />
          Current Symptoms
        </SidebarTitle>

        {symptoms.map(symptom => (
          <SymptomRow key={symptom.name}>
            <SymptomInfo>
              <SymptomIcon $isDark={isDark}><symptom.icon /></SymptomIcon>
              <SymptomName $isDark={isDark}>{symptom.name}</SymptomName>
              <SeverityTag $severity={symptom.severity}>
                {symptom.severity === 'moderate' ? 'Call Care Team' : symptom.severity}
              </SeverityTag>
            </SymptomInfo>
            <RemoveButton $isDark={isDark} onClick={() => removeSymptom(symptom.name)}>Remove</RemoveButton>
          </SymptomRow>
        ))}

        <AddSymptomRow>
          <AddSymptomLabel>Add Symptoms:</AddSymptomLabel>
          <AddSymptomButtons>
            {availableSymptoms
              .filter(s => !symptoms.find(cs => cs.name.toLowerCase() === s.name.toLowerCase()))
              .map(symptom => (
                <AddSymptomButton key={symptom.name} onClick={() => addSymptom(symptom)}>
                  <symptom.icon /> {symptom.name}
                </AddSymptomButton>
              ))}
            <AddSymptomButton>
              <Plus /> Other
            </AddSymptomButton>
          </AddSymptomButtons>
        </AddSymptomRow>
      </SidebarSection>

      {/* My Documents */}
      <SidebarSection>
        <SidebarTitle style={{ justifyContent: 'space-between' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <BookOpen size={16} />
            My Documents
          </span>
          <span style={{ fontSize: '0.75rem', fontWeight: 400, color: colors.muted }}>
            {myDocuments.length} viewed
          </span>
        </SidebarTitle>

        {myDocuments.map((doc, index) => (
          <DocumentCard key={index}>
            <DocumentTitle>
              {doc.title}
              {doc.starred && <Star size={14} fill={colors.moderate} color={colors.moderate} />}
            </DocumentTitle>
            <DocumentDescription>{doc.description}</DocumentDescription>
            <DocumentMeta>
              <DocumentBadge $color={doc.categoryColor}>{doc.category}</DocumentBadge>
              <DocumentTime>{doc.time}</DocumentTime>
              <DocumentTime>{doc.readTime} read</DocumentTime>
            </DocumentMeta>
          </DocumentCard>
        ))}
      </SidebarSection>
    </>
  );

  return (
    <div className={`h-screen flex flex-col overflow-hidden transition-colors duration-300 ${isDark ? 'bg-[#1A1917]' : 'bg-[#FAF8F5]'}`}>
      {/* Dark Mode Toggle */}
      <button
        onClick={toggleTheme}
        className={`fixed top-4 right-4 z-50 p-3 rounded-full transition-all duration-200 ${isDark
            ? 'bg-[#2A2725] text-white hover:bg-[#3A3835] border border-slate-700 shadow-lg'
            : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 shadow-lg'
          }`}
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {isDark ? <Sun size={20} /> : <Moon size={20} />}
      </button>

      <PageContainer $isDark={isDark}>
        <MainContent>
          <ContentWrapper>
            <PageHeader $isDark={isDark}>
              <div>
                <PageTitle $isDark={isDark}>Education Resources</PageTitle>
                <PageSubtitle $isDark={isDark}>
                  Personalized educational content based on your current symptoms and treatment journey.
                </PageSubtitle>
              </div>
              <MobileMenuButton onClick={() => setSidebarOpen(true)}>
                <Menu size={20} />
              </MobileMenuButton>
            </PageHeader>

            {/* Search and Filters */}
            <FiltersRow>
              <SearchInputWrapper $isDark={isDark}>
                <Search />
                <input
                  type="text"
                  placeholder="Search education resources..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </SearchInputWrapper>

              <FilterButton $isDark={isDark}>
                <Filter />
              </FilterButton>

              <SelectWrapper $isDark={isDark}>
                <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </SelectWrapper>
            </FiltersRow>

            {/* Resource Cards */}
            {isLoading ? (
              <div className={`text-center py-12 ${isDark ? 'text-slate-400' : ''}`}>
                <CircularProgress size={40} />
                <p className={`mt-4 ${isDark ? 'text-slate-400' : ''}`}>Loading education resources...</p>
              </div>
            ) : filteredResources.map(resource => (
              <ResourceCard key={resource.id} $isDark={isDark} $accentColor={resource.color}>
                <CardTitleRow>
                  <CardTitle $isDark={isDark}>{resource.title}</CardTitle>
                  {resource.isNew && <NewBadge>New</NewBadge>}
                </CardTitleRow>

                <CardDescription $isDark={isDark}>{resource.description}</CardDescription>

                <CardMeta $isDark={isDark}>
                  <MetaBadge $isDark={isDark}>{resource.symptomName || resource.category}</MetaBadge>
                  <MetaItem $isDark={isDark}>
                    <Clock /> {resource.readTime} min read
                  </MetaItem>
                  {resource.source && (
                    <MetaItem $isDark={isDark}>
                      <FileText /> {resource.source}
                    </MetaItem>
                  )}
                </CardMeta>

                <CardActions>
                  <ReadButton onClick={() => resource.pdfUrl && openEducationPdf(resource.pdfUrl)}>
                    <BookOpen /> {resource.pdfUrl ? 'Read PDF' : 'Read Now'}
                  </ReadButton>
                  <SaveButton $isDark={isDark}>Save for Later</SaveButton>
                </CardActions>
              </ResourceCard>
            ))}

            {filteredResources.length === 0 && (
              <div className={`text-center py-12 ${isDark ? 'text-slate-400' : ''}`}>
                No resources found matching your search.
              </div>
            )}
          </ContentWrapper>
        </MainContent>

        {/* Desktop Sidebar */}
        <Sidebar $isDark={isDark}>
          <SidebarContent />
        </Sidebar>

        {/* Mobile Drawer */}
        <Drawer
          anchor="right"
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          PaperProps={{
            sx: {
              width: 300,
              backgroundColor: isDark ? '#2A2725' : 'rgba(250, 248, 245, 0.98)',
              p: 2,
              '&::-webkit-scrollbar': {
                width: '40px !important',
                height: '100px !important',
              },
              '&::-webkit-scrollbar-track': {
                background: 'var(--app-bg)',
              },
              '&::-webkit-scrollbar-thumb': {
                background: 'var(--app-border)',
                borderRadius: '25px',
                border: '10px solid var(--app-bg)',
              },
            }
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
            <IconButton onClick={() => setSidebarOpen(false)}>
              <X size={20} />
            </IconButton>
          </div>
          <SidebarContent />
        </Drawer>
      </PageContainer>
    </div>
  );
};

export default EducationPage;
