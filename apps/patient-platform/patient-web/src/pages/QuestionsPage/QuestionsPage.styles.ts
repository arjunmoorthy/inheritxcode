/**
 * Questions Page Styles
 * =====================
 * 
 * Styled components for the "Questions to Ask Doctor" page.
 */

import styled from 'styled-components';

// Theme colors (Patient - Healing Teal)
const colors = {
  primary: '#00897B',
  primaryLight: '#4DB6AC',
  primaryDark: '#00695C',
  secondary: '#B39DDB',
  background: '#F5F7FA',
  paper: '#FFFFFF',
  text: '#1E293B',
  textSecondary: '#64748B',
  border: '#E2E8F0',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
};

export const QuestionsPageContainer = styled.div<{ $isDark?: boolean }>`
  padding: 24px;
  max-width: 900px;
  margin: 0 auto;
  animation: fadeInUp 0.4s ease-out;
  transition: background-color 0.3s ease;

  @media (max-width: 768px) {
    padding: 16px;
  }
`;

export const PageHeader = styled.div<{ $isDark?: boolean }>`
  margin-bottom: 24px;

  h1 {
    font-size: 1.75rem;
    font-weight: 700;
    color: ${props => props.$isDark ? colors.primaryLight : colors.primary};
    margin: 0 0 8px 0;
    display: flex;
    align-items: center;
    gap: 12px;
    transition: color 0.3s ease;
  }

  p {
    font-size: 0.95rem;
    color: ${props => props.$isDark ? '#CBD5E1' : colors.textSecondary};
    margin: 0;
    transition: color 0.3s ease;
  }

  @media (max-width: 768px) {
    h1 {
      font-size: 1.5rem;
    }
  }
`;

export const QuestionForm = styled.form<{ $isDark?: boolean }>`
  background: ${props => props.$isDark ? '#2A2725' : colors.paper};
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 24px;
  border: 1px solid ${props => props.$isDark ? '#3A3835' : colors.border};
  box-shadow: ${props => props.$isDark ? '0 2px 8px rgba(0, 0, 0, 0.3)' : '0 2px 8px rgba(0, 0, 0, 0.04)'};
  transition: all 0.3s ease;

  .form-row {
    display: flex;
    gap: 12px;
    margin-bottom: 12px;

    @media (max-width: 600px) {
      flex-direction: column;
    }
  }

  .form-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    margin-top: 16px;

    @media (max-width: 600px) {
      flex-direction: column;
      align-items: stretch;
    }
  }
`;

export const QuestionInput = styled.textarea<{ $isDark?: boolean }>`
  width: 100%;
  min-height: 100px;
  padding: 14px;
  border: 2px solid ${props => props.$isDark ? '#3A3835' : colors.border};
  border-radius: 12px;
  font-size: 1rem;
  font-family: 'Source Sans Pro', sans-serif;
  resize: vertical;
  transition: all 0.2s ease;
  background: ${props => props.$isDark ? '#1A1917' : 'white'};
  color: ${props => props.$isDark ? '#F1F5F9' : colors.text};

  &:focus {
    outline: none;
    border-color: ${colors.primary};
  }

  &::placeholder {
    color: ${props => props.$isDark ? '#94A3B8' : colors.textSecondary};
  }
`;

export const CategorySelect = styled.select<{ $isDark?: boolean }>`
  padding: 12px 16px;
  border: 2px solid ${props => props.$isDark ? '#3A3835' : colors.border};
  border-radius: 12px;
  font-size: 0.95rem;
  font-family: 'Source Sans Pro', sans-serif;
  background: ${props => props.$isDark ? '#1A1917' : 'white'};
  color: ${props => props.$isDark ? '#F1F5F9' : colors.text};
  cursor: pointer;
  min-width: 150px;
  transition: all 0.2s ease;

  &:focus {
    outline: none;
    border-color: ${colors.primary};
  }

  option {
    background: ${props => props.$isDark ? '#2A2725' : 'white'};
    color: ${props => props.$isDark ? '#F1F5F9' : colors.text};
  }
`;

export const ShareToggle = styled.label<{ $isDark?: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 0.95rem;
  color: ${props => props.$isDark ? '#CBD5E1' : colors.text};
  transition: color 0.3s ease;

  input {
    width: 20px;
    height: 20px;
    accent-color: ${colors.primary};
  }

  .share-label {
    display: flex;
    align-items: center;
    gap: 6px;
  }
`;

export const SubmitButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 24px;
  background: ${colors.primary};
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover:not(:disabled) {
    background: ${colors.primaryDark};
    transform: translateY(-1px);
  }

  &:disabled {
    background: ${colors.border};
    cursor: not-allowed;
  }
`;

export const QuestionsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

export const QuestionCard = styled.div<{ $isDark?: boolean; $shared?: boolean; $answered?: boolean }>`
  background: ${props => props.$isDark ? '#2A2725' : colors.paper};
  border-radius: 16px;
  padding: 20px;
  border: 2px solid ${props => props.$shared ? colors.primary : (props.$isDark ? '#3A3835' : colors.border)};
  box-shadow: ${props => props.$isDark ? '0 2px 8px rgba(0, 0, 0, 0.3)' : '0 2px 8px rgba(0, 0, 0, 0.04)'};
  transition: all 0.2s ease;
  opacity: ${props => props.$answered ? 0.7 : 1};

  &:hover {
    box-shadow: ${props => props.$isDark ? '0 4px 12px rgba(0, 0, 0, 0.5)' : '0 4px 12px rgba(0, 0, 0, 0.08)'};
  }

  .question-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 12px;
    gap: 12px;

    @media (max-width: 600px) {
      flex-direction: column;
    }
  }

  .question-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .question-text {
    font-size: 1rem;
    color: ${props => props.$isDark ? '#F1F5F9' : colors.text};
    line-height: 1.6;
    margin-bottom: 16px;
    text-decoration: ${props => props.$answered ? 'line-through' : 'none'};
    transition: color 0.3s ease;
  }

  .question-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;

    @media (max-width: 600px) {
      flex-direction: column;
      align-items: stretch;
    }
  }

  .question-date {
    font-size: 0.85rem;
    color: ${props => props.$isDark ? '#94A3B8' : colors.textSecondary};
    transition: color 0.3s ease;
  }

  .question-actions {
    display: flex;
    gap: 8px;
  }
`;

export const Badge = styled.span<{ $variant?: 'category' | 'shared' | 'answered' }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 600;

  ${props => {
    switch (props.$variant) {
      case 'shared':
        return `
          background: ${colors.primary}15;
          color: ${colors.primary};
        `;
      case 'answered':
        return `
          background: ${colors.success}15;
          color: ${colors.success};
        `;
      default:
        return `
          background: ${colors.secondary}20;
          color: #7E57C2;
        `;
    }
  }}
`;

export const ActionButton = styled.button<{ $variant?: 'share' | 'edit' | 'delete' | 'mark' }>`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 14px;
  border: none;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  ${props => {
    switch (props.$variant) {
      case 'share':
        return `
          background: ${colors.primary}15;
          color: ${colors.primary};
          &:hover { background: ${colors.primary}25; }
        `;
      case 'edit':
        return `
          background: ${colors.secondary}20;
          color: #7E57C2;
          &:hover { background: ${colors.secondary}30; }
        `;
      case 'delete':
        return `
          background: ${colors.error}10;
          color: ${colors.error};
          &:hover { background: ${colors.error}20; }
        `;
      case 'mark':
        return `
          background: ${colors.success}15;
          color: ${colors.success};
          &:hover { background: ${colors.success}25; }
        `;
      default:
        return `
          background: ${colors.border};
          color: ${colors.text};
          &:hover { background: ${colors.textSecondary}20; }
        `;
    }
  }}

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

export const EmptyState = styled.div<{ $isDark?: boolean }>`
  text-align: center;
  padding: 48px 24px;
  background: ${props => props.$isDark ? '#2A2725' : colors.paper};
  border-radius: 16px;
  border: 2px dashed ${props => props.$isDark ? '#3A3835' : colors.border};
  transition: all 0.3s ease;

  .icon {
    width: 64px;
    height: 64px;
    margin: 0 auto 16px;
    color: ${props => props.$isDark ? '#94A3B8' : colors.textSecondary};
    opacity: 0.5;
  }

  h3 {
    font-size: 1.25rem;
    color: ${props => props.$isDark ? '#F1F5F9' : colors.text};
    margin: 0 0 8px 0;
    transition: color 0.3s ease;
  }

  p {
    font-size: 0.95rem;
    color: ${props => props.$isDark ? '#94A3B8' : colors.textSecondary};
    margin: 0;
    transition: color 0.3s ease;
  }
`;

export const FilterTabs = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
  flex-wrap: wrap;
`;

export const FilterTab = styled.button<{ $isDark?: boolean; $active?: boolean }>`
  padding: 8px 16px;
  border: 2px solid ${props => props.$active ? colors.primary : (props.$isDark ? '#3A3835' : colors.border)};
  border-radius: 20px;
  background: ${props => props.$active ? colors.primary : (props.$isDark ? '#2A2725' : 'white')};
  color: ${props => props.$active ? 'white' : (props.$isDark ? '#F1F5F9' : colors.text)};
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: ${colors.primary};
  }
`;

export const LoadingSpinner = styled.div<{ $isDark?: boolean }>`
  display: flex;
  justify-content: center;
  padding: 48px;

  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid ${props => props.$isDark ? '#3A3835' : colors.border};
    border-top-color: ${colors.primary};
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`;

