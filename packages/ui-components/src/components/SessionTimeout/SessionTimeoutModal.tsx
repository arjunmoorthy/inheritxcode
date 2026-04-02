import React, { useEffect } from 'react';
import { useThemeMode } from '../../contexts/ThemeContext';

interface SessionTimeoutModalProps {
  show: boolean;
  onLoginAgain: () => void;
}

const backdropStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(0,0,0,0.65)', // Slightly darker backdrop for focus
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 9999, // Ensure it's above everything
  userSelect: 'none',
  pointerEvents: 'auto', // Explicitly catch all click events
};

const modalStyleBase: React.CSSProperties = {
  borderRadius: 12,
  padding: '2.5rem',
  minWidth: 350,
  maxWidth: '90vw',
  boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
  textAlign: 'center',
  position: 'relative',
  zIndex: 10000,
  pointerEvents: 'auto',
};

const buttonStyleBase: React.CSSProperties = {
  marginTop: '2rem',
  padding: '0.75rem 2rem',
  border: 'none',
  borderRadius: 6,
  fontSize: 16,
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'transform 0.1s ease',
};

const SessionTimeoutModal: React.FC<SessionTimeoutModalProps> = ({ show, onLoginAgain }) => {
  const { isDark } = useThemeMode();

  // Prevent background scrolling when modal is visible
  useEffect(() => {
    if (show) {
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalStyle;
      };
    }
  }, [show]);

  if (!show) return null;

  const modalStyle: React.CSSProperties = {
    ...modalStyleBase,
    background: isDark ? '#1E1E1E' : '#ffffff',
    color: isDark ? '#E5E7EB' : '#111827',
    boxShadow: isDark ? '0 20px 40px rgba(0,0,0,0.8)' : modalStyleBase.boxShadow,
    border: isDark ? '1px solid #333333' : '1px solid #e5e7eb',
  };

  const buttonStyle: React.CSSProperties = {
    ...buttonStyleBase,
    background: isDark ? '#10B981' : '#2563EB',
    color: '#ffffff',
  };

  return (
    <div 
      style={backdropStyle} 
      onClick={(e) => e.stopPropagation()} // Prevent any background click through
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div style={modalStyle} role="alertdialog" aria-modal="true" aria-labelledby="session-expired-title">
        <h2 id="session-expired-title" style={{ marginBottom: 16, fontWeight: 700 }}>Session Expired</h2>
        <div style={{ marginBottom: 24, fontSize: '1.1rem', opacity: 0.9 }}>
          Your session has expired. Please login again to continue.
        </div>
        <button 
          style={buttonStyle} 
          onClick={onLoginAgain}
          onMouseOver={(e) => { e.currentTarget.style.filter = 'brightness(1.1)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
          onMouseOut={(e) => { e.currentTarget.style.filter = 'none'; e.currentTarget.style.transform = 'none'; }}
        >
          Login Again
        </button>
      </div>
    </div>
  );
};

export default SessionTimeoutModal;