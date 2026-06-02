/**
 * Patient Data Table Component
 * Displays patient data with pagination
 */

import React from 'react';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import TablePagination from '@mui/material/TablePagination';
import Skeleton from '@mui/material/Skeleton';

interface TableRow {
  date: string;
  symptom: string;
  severity: string;
  medicationName: string;
  medicationFrequency: string;
  temperature: string;
}

interface PatientDataTableProps {
  data: TableRow[];
  isDark: boolean;
  page: number;
  rowsPerPage: number;
  onPageChange: (page: number) => void;
  onRowsPerPageChange: (rowsPerPage: number) => void;
  formatDate: (date: string) => string;
  isLoading?: boolean;
}

const PatientDataTable: React.FC<PatientDataTableProps> = ({
  data,
  isDark,
  page,
  rowsPerPage,
  onPageChange,
  onRowsPerPageChange,
  formatDate,
  isLoading = false,
}) => {
  return (
    <div className={`${isDark ? 'bg-[#252320] border-slate-700/50' : 'bg-white border-slate-200'} rounded-lg border p-3 md:p-4`}>
      <h3 className={`text-sm md:text-base font-semibold mb-2 md:mb-3 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
        Medications
      </h3>
      
      {data.length > 0 ? (
        <>
          <div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0">
            <table className="w-full min-w-[780px]">
              <thead>
                <tr className={`border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                  <th className={`text-left py-2 px-2 sm:px-3 text-xs sm:text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'} whitespace-nowrap`}>
                    Date
                  </th>
                  <th className={`text-left py-2 px-2 sm:px-3 text-xs sm:text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'} whitespace-nowrap`}>
                    Symptom
                  </th>
                  <th className={`text-left py-2 px-2 sm:px-3 text-xs sm:text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'} whitespace-nowrap`}>
                    Severity
                  </th>
                  <th className={`text-left py-2 px-2 sm:px-3 text-xs sm:text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'} whitespace-nowrap`}>
                    Medication Name and Frequency
                  </th>
                  <th className={`text-left py-2 px-2 sm:px-3 text-xs sm:text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'} whitespace-nowrap`}>
                    Temperature
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  // Skeleton rows
                  Array.from(new Array(rowsPerPage)).map((_, idx) => (
                    <tr key={`skeleton-${idx}`} className={`border-b ${isDark ? 'border-slate-800/50' : 'border-slate-100'}`}>
                      <td className="py-3 px-3"><Skeleton variant="text" width="80%" sx={{ bgcolor: isDark ? 'rgba(255,255,255,0.05)' : undefined }} /></td>
                      <td className="py-3 px-3"><Skeleton variant="text" width="70%" sx={{ bgcolor: isDark ? 'rgba(255,255,255,0.05)' : undefined }} /></td>
                      <td className="py-3 px-3"><Skeleton variant="rounded" width={60} height={20} sx={{ bgcolor: isDark ? 'rgba(255,255,255,0.05)' : undefined }} /></td>
                      <td className="py-3 px-3"><Skeleton variant="text" width="90%" sx={{ bgcolor: isDark ? 'rgba(255,255,255,0.05)' : undefined }} /></td>
                      <td className="py-3 px-3"><Skeleton variant="text" width="60%" sx={{ bgcolor: isDark ? 'rgba(255,255,255,0.05)' : undefined }} /></td>
                    </tr>
                  ))
                ) : data.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((row, idx) => (
                  <tr
                    key={idx}
                    className={`border-b ${isDark ? 'border-slate-800/50 hover:bg-slate-800/30' : 'border-slate-100 hover:bg-slate-50'} transition-colors`}
                  >
                    <td className={`py-2 px-2 sm:px-3 text-xs sm:text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'} whitespace-nowrap`}>
                      {formatDate(row.date)}
                    </td>
                    <td className={`py-2 px-2 sm:px-3 text-xs sm:text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'} whitespace-nowrap`}>
                      {row.symptom}
                    </td>
                    <td className={`py-2 px-2 sm:px-3 text-xs sm:text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      <Chip
                        label={row.severity === 'Call Care Team' ? 'Moderate' : row.severity}
                        size="small"
                        sx={{
                          fontSize: '0.7rem',
                          height: '22px',
                          backgroundColor: row.severity === 'Severe' 
                            ? isDark ? 'rgba(234, 88, 12, 0.2)' : 'rgba(234, 88, 12, 0.1)'
                            : (row.severity === 'Call Care Team' || row.severity === 'Moderate')
                            ? isDark ? 'rgba(245, 158, 11, 0.2)' : 'rgba(245, 158, 11, 0.1)'
                            : row.severity === '--'
                            ? isDark ? 'rgba(100, 116, 139, 0.2)' : 'rgba(148, 163, 184, 0.2)'
                            : isDark ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.1)',
                          color: row.severity === 'Severe'
                            ? isDark ? '#ea580c' : '#c2410c'
                            : (row.severity === 'Call Care Team' || row.severity === 'Moderate')
                            ? isDark ? '#f59e0b' : '#d97706'
                            : row.severity === '--'
                            ? isDark ? '#94a3b8' : '#64748b'
                            : isDark ? '#10b981' : '#059669',
                          fontWeight: 500,
                        }}
                      />
                    </td>
                    <td className={`py-2 px-2 sm:px-3 text-xs sm:text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      {row.medicationName} {row.medicationFrequency && row.medicationFrequency !== '--' ? `(${row.medicationFrequency})` : ''}
                    </td>
                    <td className={`py-2 px-2 sm:px-3 text-xs sm:text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'} whitespace-nowrap`}>
                      {row.temperature}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          <TablePagination
            component="div"
            count={data.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={(_, newPage) => onPageChange(newPage)}
            onRowsPerPageChange={(e) => {
              onRowsPerPageChange(parseInt(e.target.value, 10));
            }}
            rowsPerPageOptions={[5, 10, 25]}
            labelRowsPerPage="Rows per page:"
            labelDisplayedRows={({ from, to, count }) => `${from}-${to} of ${count !== -1 ? count : `more than ${to}`}`}
            sx={{
              borderTop: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
              color: isDark ? '#cbd5e1' : '#475569',
              width: '100%',
              '& .MuiTablePagination-toolbar': {
                paddingLeft: '8px',
                paddingRight: '8px',
                flexWrap: 'wrap',
                gap: '8px',
              },
              '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
                color: isDark ? '#cbd5e1' : '#475569',
                fontSize: '0.875rem',
                margin: 0,
              },
              '& .MuiTablePagination-select': {
                color: isDark ? '#cbd5e1' : '#475569',
                fontSize: '0.875rem',
              },
              '& .MuiTablePagination-actions': {
                marginLeft: 'auto',
              },
              '& .MuiIconButton-root': {
                color: isDark ? '#cbd5e1' : '#475569',
                padding: '4px',
                '&:hover': {
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                },
                '&.Mui-disabled': {
                  color: isDark ? '#475569' : '#cbd5e1',
                  opacity: 0.5,
                },
              },
            }}
          />
        </>
      ) : (
        <div className={`text-center py-12 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          <Typography>No table data</Typography>
        </div>
      )}
    </div>
  );
};

export default PatientDataTable;
