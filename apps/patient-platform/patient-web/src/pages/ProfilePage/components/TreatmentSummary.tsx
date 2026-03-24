import React from 'react';
import styled from 'styled-components';
import { Calendar, User, Activity, Clock } from 'lucide-react';
import type { ProfileScreenData } from '../types';

const SummaryContainer = styled.div`
  padding: 24px;
`;

const SummaryGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
  
  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`;

const SummaryItem = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  background: rgba(0, 137, 123, 0.04);
  border-radius: 12px;
  border: 1px solid rgba(0, 137, 123, 0.1);
  transition: all 0.2s ease;
  
  &:hover {
    background: rgba(0, 137, 123, 0.08);
    transform: translateY(-1px);
  }
`;

const IconWrapper = styled.div<{ $color: string }>`
  background: ${props => props.$color}15;
  color: ${props => props.$color};
  padding: 10px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  
  svg {
    width: 20px;
    height: 20px;
  }
`;

const ItemContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const ItemLabel = styled.span`
  font-size: 0.75rem;
  font-weight: 600;
  color: #64748B;
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

const ItemValue = styled.span`
  font-size: 1rem;
  font-weight: 600;
  color: #1E293B;
`;

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 20px;
  
  h3 {
    font-size: 1.125rem;
    font-weight: 700;
    color: #00897B;
    margin: 0;
  }
`;

interface TreatmentSummaryProps {
  data: ProfileScreenData;
}

const TreatmentSummary: React.FC<TreatmentSummaryProps> = ({ data }) => {
  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'Not set';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <SummaryContainer>
      <SectionHeader>
        <Activity size={20} color="#00897B" />
        <h3>Treatment Overview</h3>
      </SectionHeader>
      
      <SummaryGrid>
        <SummaryItem>
          <IconWrapper $color="#00897B">
            <User />
          </IconWrapper>
          <ItemContent>
            <ItemLabel>Assigned Oncologist</ItemLabel>
            <ItemValue>{data.assigned_oncologist || 'Not assigned'}</ItemValue>
          </ItemContent>
        </SummaryItem>
        
        <SummaryItem>
          <IconWrapper $color="#7E57C2">
            <Activity />
          </IconWrapper>
          <ItemContent>
            <ItemLabel>Regimen Name</ItemLabel>
            <ItemValue>{data.regimen_name || 'Generic'}</ItemValue>
          </ItemContent>
        </SummaryItem>
        
        <SummaryItem>
          <IconWrapper $color="#F59E0B">
            <Calendar />
          </IconWrapper>
          <ItemContent>
            <ItemLabel>Treatment Period</ItemLabel>
            <ItemValue>
              {formatDate(data.treatment_start_date)} - {formatDate(data.treatment_end_date)}
            </ItemValue>
          </ItemContent>
        </SummaryItem>
        
        <SummaryItem>
          <IconWrapper $color="#EF4444">
            <Clock />
          </IconWrapper>
          <ItemContent>
            <ItemLabel>Next Chemotherapy</ItemLabel>
            <ItemValue>
              {formatDate(data.next_chemotherapy_treatment)}
              <div style={{ fontSize: '0.8rem', fontWeight: 400, color: '#64748B', marginTop: '2px' }}>
                {data.day_of_chemo_treatment}
              </div>
            </ItemValue>
          </ItemContent>
        </SummaryItem>
      </SummaryGrid>
    </SummaryContainer>
  );
};

export default TreatmentSummary;
