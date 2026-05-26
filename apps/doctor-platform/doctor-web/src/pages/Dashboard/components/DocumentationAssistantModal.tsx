import React, { useState, useEffect, useMemo } from 'react';
import { Copy, Check } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { useThemeMode } from '@oncolife/ui-components';
import { usePatientEmDocumentation } from '../../../services/dashboard';

interface DocumentationAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientUuid: string;
  patientName: string;
}

export const DocumentationAssistantModal: React.FC<DocumentationAssistantModalProps> = ({
  isOpen,
  onClose,
  patientUuid,
  patientName,
}) => {
  const { isDark } = useThemeMode();
  const [copied, setCopied] = useState(false);

  // Fetch actual EM Documentation from the requested API endpoint
  const { data: rawEmDocumentation, isLoading } = usePatientEmDocumentation(patientUuid);

  // Local state to store the HTML note text
  const [noteText, setNoteText] = useState('');

  // Extract raw HTML from the API response
  const extractedApiNote = useMemo(() => {
    if (!rawEmDocumentation) return null;

    let rawText = '';
    // Extract raw text from different potential response fields
    if (typeof rawEmDocumentation === 'string') {
      rawText = rawEmDocumentation;
    } else if (typeof rawEmDocumentation === 'object') {
      const target = rawEmDocumentation as any;
      if (target['E&M'] && typeof target['E&M'] === 'string') {
        rawText = target['E&M'];
      } else if (target['e&m'] && typeof target['e&m'] === 'string') {
        rawText = target['e&m'];
      } else if (target.em_documentation && typeof target.em_documentation === 'string') {
        rawText = target.em_documentation;
      } else if (target.documentation && typeof target.documentation === 'string') {
        rawText = target.documentation;
      } else if (target.summary && typeof target.summary === 'string') {
        rawText = target.summary;
      } else if (target.data) {
        if (typeof target.data === 'string') {
          rawText = target.data;
        } else if (typeof target.data === 'object') {
          if (target.data['E&M'] && typeof target.data['E&M'] === 'string') {
            rawText = target.data['E&M'];
          } else if (target.data['e&m'] && typeof target.data['e&m'] === 'string') {
            rawText = target.data['e&m'];
          }
        }
      }
    }

    return rawText;
  }, [rawEmDocumentation]);

  // Set note text from API when data finishes loading
  useEffect(() => {
    if (!isLoading && extractedApiNote) {
      setNoteText(extractedApiNote);
    }
  }, [isLoading, extractedApiNote]);

  const handleCopy = async () => {
    try {
      // Clean convert HTML formatting to copyable plain text for EHR pasting
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = noteText;
      const plainText = tempDiv.innerText || tempDiv.textContent || '';

      await navigator.clipboard.writeText(plainText.trim());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Documentation Assistant"
      size="xl"
    >
      <div className="min-h-[380px] flex flex-col gap-8">
        {isLoading ? (
          /* Premium Custom Tailwind Skeleton Loader */
          <div className={`w-full p-6 md:p-8 rounded-2xl border animate-pulse space-y-6 ${
            isDark ? 'bg-[#1F1E1B] border-[#3E3C38]' : 'bg-slate-50 border-slate-200'
          }`}>
            {/* Top Bar Skeleton */}
            <div className={`flex justify-between items-center border-b pb-4 mb-2 ${
              isDark ? 'border-slate-700' : 'border-slate-200'
            }`}>
              <div className={`h-8 w-56 rounded-md ${isDark ? 'bg-[#2E2D2A]' : 'bg-slate-200'}`} />
              <div className={`h-10 w-44 rounded-lg ${isDark ? 'bg-[#2E2D2A]' : 'bg-slate-200'}`} />
            </div>

            {/* Section 1 Skeleton */}
            <div className="space-y-3">
              <div className={`h-7 w-72 rounded-md ${isDark ? 'bg-[#2E2D2A]' : 'bg-slate-200'}`} />
              <div className="pl-6 space-y-2">
                <div className={`h-5 w-11/12 rounded-md ${isDark ? 'bg-[#2E2D2A]' : 'bg-slate-200'}`} />
                <div className={`h-5 w-10/12 rounded-md ${isDark ? 'bg-[#2E2D2A]' : 'bg-slate-200'}`} />
              </div>
            </div>

            {/* Section 2 Skeleton */}
            <div className="space-y-3 pt-4">
              <div className={`h-7 w-80 rounded-md ${isDark ? 'bg-[#2E2D2A]' : 'bg-slate-200'}`} />
              <div className="pl-6 space-y-2">
                <div className={`h-5 w-11/12 rounded-md ${isDark ? 'bg-[#2E2D2A]' : 'bg-slate-200'}`} />
                <div className={`h-5 w-full rounded-md ${isDark ? 'bg-[#2E2D2A]' : 'bg-slate-200'}`} />
                <div className={`h-5 w-9/12 rounded-md ${isDark ? 'bg-[#2E2D2A]' : 'bg-slate-200'}`} />
              </div>
            </div>

            {/* Section 3 Skeleton */}
            <div className="space-y-3 pt-4">
              <div className={`h-7 w-60 rounded-md ${isDark ? 'bg-[#2E2D2A]' : 'bg-slate-200'}`} />
              <div className="pl-6 space-y-2">
                <div className={`h-5 w-11/12 rounded-md ${isDark ? 'bg-[#2E2D2A]' : 'bg-slate-200'}`} />
                <div className={`h-5 w-10/12 rounded-md ${isDark ? 'bg-[#2E2D2A]' : 'bg-slate-200'}`} />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {/* Header: Action button bar styled with Tailwind, hidden if API fails / noteText is empty */}
            {noteText && (
              <div className="flex justify-end items-center flex-wrap gap-4">
                <button
                  onClick={handleCopy}
                  className={`inline-flex items-center justify-end gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 shadow-sm border ${
                    copied
                      ? 'bg-emerald-600 border-emerald-600 text-white'
                      : isDark
                        ? 'bg-blue-600 border-blue-600 hover:bg-blue-500 text-[#F5F3EE]'
                        : 'bg-blue-600 border-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  <span>{copied ? 'Copied Documentation!' : 'Copy Documentation'}</span>
                </button>
              </div>
            )}

            {/* Note Content Area: Render HTML styled dynamically using Tailwind classes and arbitrary selectors */}
            <div
              style={{
                scrollbarWidth: 'thin',
                scrollbarColor: isDark ? '#475569 #1A1917' : '#cbd5e1 #f1f5f9',
              }}
              className={`w-full h-full  transition-all duration-200 overflow-y-auto text-[0.975rem] leading-relaxed ${
                isDark
                  ? 'text-slate-300'
                  : 'text-slate-700'
              }
              [&_h2]:text-[1.25rem] [&_h2]:font-extrabold [&_h2]:mt-8 [&_h2]:mb-4 [&_h2]:border-b [&_h2]:pb-2 [&_h2]:first-of-type:mt-0
              ${isDark ? '[&_h2]:text-sky-400 [&_h2]:border-[#3E3C38]' : '[&_h2]:text-blue-600 [&_h2]:border-slate-200'}

              [&_h3]:text-[1.05rem] [&_h3]:font-bold [&_h3]:mt-5 [&_h3]:mb-2
              ${isDark ? '[&_h3]:text-slate-100' : '[&_h3]:text-slate-900'}

              [&_ul]:list-disc [&_ul]:pl-8 [&_ul]:mb-5 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-2.5
              [&_ol]:list-decimal [&_ol]:pl-8 [&_ol]:mb-5 [&_ol]:flex [&_ol]:flex-col [&_ol]:gap-3.5

              [&_li]:mb-1
              ${isDark ? '[&_li::marker]:text-sky-400' : '[&_li::marker]:text-blue-600'}

              [&_strong]:font-bold
              ${isDark ? '[&_strong]:text-slate-50' : '[&_strong]:text-slate-900'}

              [&_table]:w-full [&_table]:border-collapse [&_table]:my-6 [&_table]:text-[0.9rem] [&_table]:rounded-lg [&_table]:overflow-hidden [&_table]:border
              ${isDark ? '[&_table]:border-[#3E3C38]' : '[&_table]:border-slate-200'}

              [&_th]:font-bold [&_th]:text-left [&_th]:p-3 [&_th]:border-b-2
              ${isDark ? '[&_th]:bg-[#2E2D2A] [&_th]:text-slate-100 [&_th]:border-[#4E4C48]' : '[&_th]:bg-slate-100 [&_th]:text-slate-900 [&_th]:border-slate-300'}

              [&_td]:p-3 [&_td]:border-b
              ${isDark ? '[&_td]:border-[#2E2D2A] [&_td]:text-slate-300' : '[&_td]:border-slate-100 [&_td]:text-slate-600'}

              [&_tr]:transition-colors
              ${isDark ? 'hover:[&_tr]:bg-[#262522]' : 'hover:[&_tr]:bg-slate-100'}
              `}
              dangerouslySetInnerHTML={{ __html: noteText || '<p class="h-[300px] w-full flex items-center justify-center text-center italic opacity-60">No documentation content available.</p>' }}
            />
          </div>
        )}
      </div>
    </Modal>
  );
};
