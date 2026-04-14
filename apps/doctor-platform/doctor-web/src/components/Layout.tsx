/**
 * OncoLife Physician Portal - Layout
 * 
 * Responsive layout with:
 * - Desktop: Top header navigation (blue theme)
 * - Mobile: Hamburger drawer menu
 * - Dark mode toggle
 * - Page transition animations
 */

import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useTheme, useMediaQuery } from '@mui/material';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Tooltip from '@mui/material/Tooltip';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Divider from '@mui/material/Divider';
import {
  LayoutDashboard,
  Users,
  Menu as MenuIcon,
  LogOut,
  X,
  Activity,
  Moon,
  Sun,
  User,
  UserCog,
  UserPlus,
  Settings,
  Building,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { useUser } from '../contexts/UserContext';
import { useAuth } from '../contexts/AuthContext';
import { useThemeMode } from '@oncolife/ui-components';
import { useStaffManagement } from '../contexts/StaffManagementContext';
import StaffManagementModals from './StaffManagementModals';
// Sidebar width (commented out - kept for reference)
// const DRAWER_WIDTH = 260;
// const DRAWER_WIDTH_COLLAPSED = 72;

// Navigation items
const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { id: 'patients', label: 'Patients', icon: Users, path: '/patients' },
  // { id: 'reports', label: 'Weekly Reports', icon: FileText, path: '/reports' },
];

// Font stack used in header so it shows DM Sans on live (theme typography may be Roboto in prod)
const HEADER_FONT = "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

// Fallback colors so header always renders correctly (e.g. production/SSR when theme may not be ready)
const HEADER_FALLBACK = {
  light: {
    bg: '#1E3A5F',
    text: '#ffffff',
    textMuted: 'rgba(255,255,255,0.7)',
    divider: 'rgba(255,255,255,0.1)',
    hover: 'rgba(255,255,255,0.08)',
    active: 'rgba(255,255,255,0.15)',
  },
  dark: {
    bg: '#252320',
    text: '#F1F5F9',
    textMuted: '#94A3B8',
    divider: '#3D3A35',
    hover: 'rgba(255,255,255,0.08)',
    active: 'rgba(59,130,246,0.2)',
  },
} as const;


const Layout: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useUser();
  const { logout } = useAuth();
  const { isDark, toggleTheme } = useThemeMode();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [profileMenuAnchor, setProfileMenuAnchor] = useState<null | HTMLElement>(null);
  const [staffMenuAnchor, setStaffMenuAnchor] = useState<null | HTMLElement>(null);
  const [clinicMenuAnchor, setClinicMenuAnchor] = useState<null | HTMLElement>(null);
  const isStaffMenuOpen = Boolean(staffMenuAnchor);
  const isClinicMenuOpen = Boolean(clinicMenuAnchor);
  const { openAddStaffModal, openUpdateStaffModal, openClinicRegistrationModal } = useStaffManagement();
  // const [sidebarCollapsed, setSidebarCollapsed] = useState(false); // Commented out - sidebar removed

  // Check authentication
  // useEffect(() => {
  //   if (!isLoading && !isAuthenticated) {
  //     navigate('/login', { replace: true });
  //   }
  // }, [isAuthenticated, isLoading, navigate]);

  // Show nothing while checking auth
  // if (isLoading) {
  //   return null;
  // }

  // // Don't render if not authenticated
  // if (!isAuthenticated) {
  //   return null;
  // }

  // Header colors: use fallback only for now so live server shows correct colours (theme not applied on server).
  // TODO: Re-enable theme-based colours when theme/palette is reliable in production.
  const fallback = isDark ? HEADER_FALLBACK.dark : HEADER_FALLBACK.light;
  const headerBg = fallback.bg;
  const headerText = fallback.text;
  const headerTextMuted = fallback.textMuted;
  const headerDivider = fallback.divider;
  const headerHover = fallback.hover;
  const headerActive = fallback.active;
  // Fallbacks so sx styles work on live when theme.palette is not applied
  const primaryMain = isDark ? '#3B82F6' : '#1E3A5F';
  const errorMain = isDark ? '#ef4444' : '#dc2626';

  // (Commented out: theme-based header colours – not showing on live)
  // const headerBg = isDark
  //   ? (theme.palette?.background?.paper ?? fallback.bg)
  //   : (theme.palette?.primary?.main ?? fallback.bg);
  // const headerText = isDark
  //   ? (theme.palette?.text?.primary ?? fallback.text)
  //   : (theme.palette?.primary?.contrastText ?? fallback.text);
  // const headerTextMuted = isDark
  //   ? (theme.palette?.text?.secondary ?? fallback.textMuted)
  //   : fallback.textMuted;
  // const headerDivider = isDark
  //   ? (theme.palette?.divider ?? fallback.divider)
  //   : fallback.divider;
  // const headerHover = isDark
  //   ? (theme.palette?.action?.hover ?? fallback.hover)
  //   : fallback.hover;
  // const primaryMain = theme.palette?.primary?.main ?? (isDark ? '#3B82F6' : '#1E3A5F');
  // const headerActive = isDark ? `${primaryMain}20` : fallback.active;

  // Get current nav item
  const currentNav = navItems.find(item => location.pathname.startsWith(item.path))?.id || 'dashboard';
  const isProfileActive = location.pathname.startsWith('/profile');

  // Get user initials
  const getInitials = () => {
    if (profile) {
      const first = profile.first_name?.[0] || '';
      const last = profile.last_name?.[0] || '';
      return (first + last).toUpperCase() || 'DR';
    }
    return 'DR';
  };

  const getUserName = () => {
    if (profile) {
      const fullName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
      const r = profile.role?.toLowerCase();
      const isDoctor = r === 'doctor' || r === 'physician';
      return fullName ? (isDoctor ? `Dr. ${fullName}` : fullName) : isDoctor ? 'Doctor' : 'User';
    }
    return 'User';
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    setMobileDrawerOpen(false);
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setProfileMenuAnchor(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setProfileMenuAnchor(null);
    setStaffMenuAnchor(null);
    setClinicMenuAnchor(null);
  };

  const handleStaffMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setStaffMenuAnchor(event.currentTarget);
  };

  const handleStaffMenuClose = () => {
    setStaffMenuAnchor(null);
  };

  const handleClinicMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setClinicMenuAnchor(event.currentTarget);
  };

  const handleClinicMenuClose = () => {
    setClinicMenuAnchor(null);
  };

  const handleProfileClick = () => {
    handleNavigation('/profile');
    handleProfileMenuClose();
  };

  // ============================================================================
  // SIDEBAR CODE (COMMENTED OUT - KEPT FOR REFERENCE)
  // The original sidebar navigation code has been replaced with a top header.
  // The full sidebar implementation code was here but has been removed to avoid
  // parsing issues with commented JSX. The sidebar included:
  // - Logo header with OncoLife branding
  // - User profile section with avatar
  // - Navigation links (Dashboard, Patients, Reports, Staff)
  // - Theme toggle and logout button
  // - Collapsible sidebar functionality
  // To restore the sidebar, you would need to implement it based on the header
  // structure below, but using a Drawer component instead of AppBar.
  // ============================================================================

  /* 
  // Original SidebarContent component - removed to avoid parsing issues
  // The full implementation can be found in git history if needed
  const SidebarContent = ({ collapsed = false }: { collapsed?: boolean }) => {
    return null; // Placeholder - original code removed to avoid parsing issues
  };
  */

  // ============================================================================
  // END OF COMMENTED SIDEBAR CODE
  // ============================================================================

  // Mobile Drawer Content (for mobile menu)
  const MobileDrawerContent = () => (
    <Box sx={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      bgcolor: headerBg,
      color: headerText,
      transition: 'background-color 0.3s ease, color 0.3s ease',
      width: 280,
    }}>
      {/* Logo Header */}
      <Box sx={{
        p: 2.5,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: `1px solid ${headerDivider}`,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 2,
              bgcolor: isDark ? primaryMain : 'rgba(255,255,255,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              boxShadow: isDark ? `0 4px 12px ${primaryMain}40` : 'none',
            }}
          >
            <Activity size={24} />
          </Box>
          <Box>
            <Typography variant="h6" fontWeight={700} sx={{ lineHeight: 1.2, color: headerText }}>
              OncoLife AI
            </Typography>
          </Box>
        </Box>
        <IconButton
          onClick={() => setMobileDrawerOpen(false)}
          sx={{
            color: isDark ? '#f1f5f9' : '#0f172a',
            minWidth: 44,
            minHeight: 44,
            borderRadius: 1.5,
            bgcolor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.08)',
            border: `1.5px solid ${isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.15)'}`,
            flexShrink: 0,
            '&:hover': {
              bgcolor: isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.12)',
              transform: 'scale(1.05)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.25)',
            },
            transition: 'all 0.2s ease',
          }}
          aria-label="Close menu"
        >
          <X size={22} strokeWidth={2.5} />
        </IconButton>
      </Box>

      {/* Navigation Links */}
      <Box sx={{ flex: 1, py: 2, overflow: 'auto' }}>
        <List disablePadding>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentNav === item.id;
            return (
              <ListItem key={item.id} disablePadding>
                <ListItemButton
                  onClick={() => handleNavigation(item.path)}
                  aria-current={isActive ? 'page' : undefined}
                  sx={{
                    mx: 1,
                    borderRadius: 2,
                    bgcolor: isActive ? headerActive : 'transparent',
                    color: headerText,
                    transition: 'all 0.2s ease',
                    minHeight: 48,
                    '&:hover': {
                      bgcolor: isActive
                        ? (isDark ? `${primaryMain}30` : 'rgba(255,255,255,0.2)')
                        : headerHover,
                    },
                  }}
                >
                  <ListItemIcon sx={{
                    minWidth: 40,
                    justifyContent: 'center',
                    color: isActive
                      ? (isDark ? primaryMain : 'white')
                      : headerTextMuted,
                  }}>
                    <Icon size={22} />
                  </ListItemIcon>
                  <ListItemText
                    primary={item.label}
                    primaryTypographyProps={{
                      fontWeight: isActive ? 600 : 500,
                      color: 'inherit',
                    }}
                  />
                </ListItemButton>
              </ListItem>
            );
          })}
          {/* Profile Link */}
          <ListItem disablePadding>
            <ListItemButton
              onClick={() => handleNavigation('/profile')}
              aria-current={isProfileActive ? 'page' : undefined}
              sx={{
                mx: 1,
                borderRadius: 2,
                bgcolor: isProfileActive ? headerActive : 'transparent',
                color: headerText,
                transition: 'all 0.2s ease',
                minHeight: 48,
                '&:hover': {
                  bgcolor: isProfileActive
                    ? (isDark ? `${primaryMain}30` : 'rgba(255,255,255,0.2)')
                    : headerHover,
                },
              }}
            >
              <ListItemIcon sx={{
                minWidth: 40,
                justifyContent: 'center',
                color: isProfileActive
                  ? (isDark ? primaryMain : 'white')
                  : headerTextMuted,
              }}>
                <User size={22} />
              </ListItemIcon>
              <ListItemText
                primary="Profile"
                primaryTypographyProps={{
                  fontWeight: isProfileActive ? 600 : 500,
                  color: 'inherit',
                }}
              />
            </ListItemButton>
          </ListItem>
          {profile?.role === 'admin' && (
            <>
              <Divider sx={{ mx: 2, my: 1.5, borderColor: headerDivider }} />
              <ListItem disablePadding>
                <ListItemButton
                  onClick={() => {
                    openAddStaffModal();
                    setMobileDrawerOpen(false);
                  }}
                  sx={{
                    mx: 1,
                    borderRadius: 2,
                    color: headerText,
                    transition: 'all 0.2s ease',
                    minHeight: 48,
                    '&:hover': {
                      bgcolor: headerHover,
                    },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 40, justifyContent: 'center', color: headerTextMuted }}>
                    <UserPlus size={22} />
                  </ListItemIcon>
                  <ListItemText
                    primary="Add New Staff"
                    primaryTypographyProps={{ fontWeight: 500, color: 'inherit' }}
                  />
                </ListItemButton>
              </ListItem>
              <ListItem disablePadding>
                <ListItemButton
                  onClick={() => {
                    openUpdateStaffModal();
                    setMobileDrawerOpen(false);
                  }}
                  sx={{
                    mx: 1,
                    borderRadius: 2,
                    color: headerText,
                    transition: 'all 0.2s ease',
                    minHeight: 48,
                    '&:hover': {
                      bgcolor: headerHover,
                    },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 40, justifyContent: 'center', color: headerTextMuted }}>
                    <UserCog size={22} />
                  </ListItemIcon>
                  <ListItemText
                    primary="Update Staff"
                    primaryTypographyProps={{ fontWeight: 500, color: 'inherit' }}
                  />
                </ListItemButton>
              </ListItem>
              <ListItem disablePadding>
                <ListItemButton
                  onClick={() => {
                    openClinicRegistrationModal('add');
                    setMobileDrawerOpen(false);
                  }}
                  sx={{
                    mx: 1,
                    borderRadius: 2,
                    color: headerText,
                    transition: 'all 0.2s ease',
                    minHeight: 48,
                    '&:hover': {
                      bgcolor: headerHover,
                    },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 40, justifyContent: 'center', color: headerTextMuted }}>
                    <Building size={22} />
                  </ListItemIcon>
                  <ListItemText
                    primary="Add New Clinic"
                    primaryTypographyProps={{ fontWeight: 500, color: 'inherit' }}
                  />
                </ListItemButton>
              </ListItem>
              <ListItem disablePadding>
                <ListItemButton
                  onClick={() => {
                    openClinicRegistrationModal('list');
                    setMobileDrawerOpen(false);
                  }}
                  sx={{
                    mx: 1,
                    borderRadius: 2,
                    color: headerText,
                    transition: 'all 0.2s ease',
                    minHeight: 48,
                    '&:hover': {
                      bgcolor: headerHover,
                    },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 40, justifyContent: 'center', color: headerTextMuted }}>
                    <Settings size={22} />
                  </ListItemIcon>
                  <ListItemText
                    primary="Update Clinics"
                    primaryTypographyProps={{ fontWeight: 500, color: 'inherit' }}
                  />
                </ListItemButton>
              </ListItem>
            </>
          )}
        </List>
      </Box>

      {/* Dark Mode Toggle */}
      <Box sx={{ borderTop: `1px solid ${headerDivider}`, p: 1.5 }}>
        <ListItemButton
          onClick={toggleTheme}
          sx={{
            borderRadius: 2,
            color: headerText,
            transition: 'all 0.2s ease',
            '&:hover': {
              bgcolor: headerHover,
            },
          }}
        >
          <ListItemIcon sx={{ minWidth: 40, justifyContent: 'center', color: 'inherit' }}>
            {isDark ? <Sun size={22} /> : <Moon size={22} />}
          </ListItemIcon>
          <ListItemText primary={isDark ? 'Light Mode' : 'Dark Mode'} />
        </ListItemButton>
      </Box>

      {/* Logout */}
      <Box sx={{ borderTop: `1px solid ${headerDivider}`, p: 1.5 }}>
        <ListItemButton
          onClick={handleLogout}
          sx={{
            borderRadius: 2,
            color: isDark ? errorMain : '#FCA5A5',
            transition: 'all 0.2s ease',
            '&:hover': {
              bgcolor: isDark ? `${errorMain}15` : 'rgba(239, 68, 68, 0.15)',
            },
          }}
        >
          <ListItemIcon sx={{ minWidth: 40, justifyContent: 'center', color: 'inherit' }}>
            <LogOut size={22} />
          </ListItemIcon>
          <ListItemText primary="Log out" />
        </ListItemButton>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Top Header Navigation */}
      <AppBar
        position="sticky"
        elevation={0}
        className="doctor-app-header"
        style={{
          backgroundColor: headerBg,
          color: headerText,
          fontFamily: HEADER_FONT,
          borderBottom: isDark ? `1px solid ${headerDivider}` : 'none',
          zIndex: theme.zIndex?.drawer != null ? theme.zIndex.drawer + 1 : 1200,
        }}
        sx={{ transition: 'all 0.3s ease' }}
      >
        <Toolbar sx={{
          minHeight: { xs: 64, md: 70 },
          px: { xs: 2, md: 3 },
          justifyContent: 'space-between',
        }}>
          {/* Left: Logo */}
          <Box
            component="button"
            type="button"
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              cursor: 'pointer',
              border: 0,
              p: 0,
              m: 0,
              background: 'transparent',
              '&:hover': { opacity: 0.9 },
            }}
            onClick={() => handleNavigation('/dashboard')}
            aria-label="Go to dashboard"
          >
            <Box
              className="doctor-header-logo"
              sx={{
                width: { xs: 36, md: 40 },
                height: { xs: 36, md: 40 },
                borderRadius: 2,
                bgcolor: isDark ? primaryMain : 'rgba(255,255,255,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                boxShadow: isDark ? `0 4px 12px ${primaryMain}40` : 'none',
                flexShrink: 0,
              }}
              style={{ fontFamily: HEADER_FONT }}
            >
              <Activity size={isMobile ? 20 : 24} />
            </Box>
            <Typography
              variant="h6"
              fontWeight={700}
              sx={{
                color: headerText,
                fontSize: { xs: '1.1rem', md: '1.25rem' },
                display: { xs: 'none', sm: 'block' },
              }}
              style={{ fontFamily: HEADER_FONT }}
            >
              OncoLife AI
            </Typography>
          </Box>

          {/* Right: Navigation Links */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, md: 1 } }}>
            {/* Desktop Navigation */}
            {!isMobile && (
              <>
                {navItems.map((item) => {
                  const isActive = currentNav === item.id;
                  return (
                    <Button
                      key={item.id}
                      onClick={() => handleNavigation(item.path)}
                      sx={{
                        color: isActive ? 'white' : headerTextMuted,
                        fontWeight: isActive ? 600 : 500,
                        px: 2,
                        py: 1,
                        borderRadius: 2,
                        textTransform: 'none',
                        fontSize: '0.95rem',
                        bgcolor: isActive ? headerActive : 'transparent',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          bgcolor: isActive
                            ? (isDark ? `${primaryMain}30` : 'rgba(255,255,255,0.2)')
                            : headerHover,
                          color: 'white',
                        },
                      }}
                    >
                      {item.label}
                    </Button>
                  );
                })}

                {/* Dark Mode Toggle */}
                <Tooltip title={isDark ? 'Light Mode' : 'Dark Mode'}>
                  <IconButton
                    onClick={toggleTheme}
                    sx={{
                      color: headerText,
                      '&:hover': {
                        bgcolor: headerHover,
                      },
                    }}
                  >
                    {isDark ? <Sun size={20} /> : <Moon size={20} />}
                  </IconButton>
                </Tooltip>

                {/* Profile Dropdown */}
                <Tooltip title="Profile Menu">
                  <IconButton
                    onClick={handleProfileMenuOpen}
                    aria-label="Open profile menu"
                    sx={{
                      p: 0.5,
                      '&:hover': {
                        opacity: 0.9,
                      },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Avatar
                        sx={{
                          width: 36,
                          height: 36,
                          bgcolor: isDark ? primaryMain : 'rgba(255,255,255,0.2)',
                          color: 'white',
                          fontSize: '0.875rem',
                          fontWeight: 600,
                        }}
                      >
                        {getInitials()}
                      </Avatar>
                      <ChevronDown size={16} style={{ color: headerText }} />
                    </Box>
                  </IconButton>
                </Tooltip>

                {/* Profile Menu Dropdown */}
                <Menu
                  anchorEl={profileMenuAnchor}
                  open={Boolean(profileMenuAnchor)}
                  onClose={handleProfileMenuClose}
                  anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'right',
                  }}
                  transformOrigin={{
                    vertical: 'top',
                    horizontal: 'right',
                  }}
                  PaperProps={{
                    sx: {
                      mt: 1.5,
                      minWidth: 200,
                      bgcolor: isDark ? '#1A1917' : 'white',
                      border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                      borderRadius: 2,
                      boxShadow: isDark
                        ? '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)'
                        : '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                    },
                  }}
                >
                  <Box sx={{ px: 2, py: 1.5, borderBottom: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}>
                    <Typography
                      variant="subtitle2"
                      sx={{
                        fontWeight: 600,
                        color: isDark ? '#f1f5f9' : '#0f172a',
                        fontSize: '0.875rem',
                      }}
                    >
                      {getUserName()}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        color: isDark ? '#94a3b8' : '#64748b',
                        fontSize: '0.75rem',
                      }}
                    >
                      {profile?.email || 'doctor@oncolife.ai'}
                    </Typography>
                  </Box>
                  <MenuItem
                    onClick={handleProfileClick}
                    sx={{
                      py: 1.5,
                      px: 2,
                      color: isDark ? '#f1f5f9' : '#0f172a',
                      '&:hover': {
                        bgcolor: isDark ? '#2A2725' : '#f1f5f9',
                      },
                    }}
                  >
                    <User size={18} style={{ marginRight: 12 }} />
                    Profile
                  </MenuItem>
                  {profile?.role === 'admin' && (
                    <>
                      <MenuItem
                        onClick={handleStaffMenuOpen}
                        sx={{
                          py: 1.5,
                          px: 2,
                          color: isDark ? '#f1f5f9' : '#0f172a',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          '&:hover': {
                            bgcolor: isDark ? '#2A2725' : '#f1f5f9',
                          },
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <UserCog size={18} style={{ marginRight: 12 }} />
                          Manage Staff
                        </div>
                        <ChevronRight size={16} />
                      </MenuItem>
                      <MenuItem
                        onClick={handleClinicMenuOpen}
                        sx={{
                          py: 1.5,
                          px: 2,
                          color: isDark ? '#f1f5f9' : '#0f172a',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          '&:hover': {
                            bgcolor: isDark ? '#2A2725' : '#f1f5f9',
                          },
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                        <UserCog size={18} style={{ marginRight: 12 }} />
                          Clinic Registration
                        </div>
                        <ChevronRight size={16} />
                      </MenuItem>
                    </>
                  )}
                  <Divider sx={{ my: 0.5, borderColor: isDark ? '#334155' : '#e2e8f0' }} />
                  <MenuItem
                    onClick={() => {
                      handleLogout();
                      handleProfileMenuClose();
                    }}
                    sx={{
                      py: 1.5,
                      px: 2,
                      color: isDark ? errorMain : '#dc2626',
                      '&:hover': {
                        bgcolor: isDark ? `${errorMain}15` : 'rgba(239, 68, 68, 0.1)',
                      },
                    }}
                  >
                    <LogOut size={18} style={{ marginRight: 12 }} />
                    Logout
                  </MenuItem>
                </Menu>

                {/* Manage Staff Sub-menu */}
                <Menu
                  anchorEl={staffMenuAnchor}
                  open={isStaffMenuOpen}
                  onClose={handleStaffMenuClose}
                  anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
                  transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                  PaperProps={{
                    sx: {
                      width: 210,
                      mt: 0,
                      ml: -1,
                      bgcolor: isDark ? '#1A1917' : '#ffffff',
                      border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                    },
                  }}
                >
                  <MenuItem
                    onClick={() => {
                      openAddStaffModal();
                      handleProfileMenuClose();
                    }}
                    sx={{
                      py: 1.5,
                      px: 2,
                      color: isDark ? '#f1f5f9' : '#0f172a',
                      '&:hover': {
                        bgcolor: isDark ? '#2A2725' : '#f1f5f9',
                      },
                    }}
                  >
                    <UserPlus size={18} style={{ marginRight: 12 }} />
                    Add New Staff
                  </MenuItem>
                  <MenuItem
                    onClick={() => {
                      openUpdateStaffModal();
                      handleProfileMenuClose();
                    }}
                    sx={{
                      py: 1.5,
                      px: 2,
                      color: isDark ? '#f1f5f9' : '#0f172a',
                      '&:hover': {
                        bgcolor: isDark ? '#2A2725' : '#f1f5f9',
                      },
                    }}
                  >
                    <Settings size={18} style={{ marginRight: 12 }} />
                    Update Existing Staff
                  </MenuItem>
                </Menu>
                {/* Clinic Registration Sub-menu */}
                <Menu
                  anchorEl={clinicMenuAnchor}
                  open={isClinicMenuOpen}
                  onClose={handleClinicMenuClose}
                  anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
                  transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                  PaperProps={{
                    sx: {
                      width: 210,
                      mt: 0,
                      ml: -1,
                      bgcolor: isDark ? '#1A1917' : '#ffffff',
                      border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                    },
                  }}
                >
                  <MenuItem
                    onClick={() => {
                      openClinicRegistrationModal('add');
                      handleProfileMenuClose();
                    }}
                    sx={{
                      py: 1.5,
                      px: 2,
                      color: isDark ? '#f1f5f9' : '#0f172a',
                      '&:hover': {
                        bgcolor: isDark ? '#2A2725' : '#f1f5f9',
                      },
                    }}
                  >
                    <Building size={18} style={{ marginRight: 12 }} />
                    Add New Clinic
                  </MenuItem>
                  <MenuItem
                    onClick={() => {
                      openClinicRegistrationModal('list');
                      handleProfileMenuClose();
                    }}
                    sx={{
                      py: 1.5,
                      px: 2,
                      color: isDark ? '#f1f5f9' : '#0f172a',
                      '&:hover': {
                        bgcolor: isDark ? '#2A2725' : '#f1f5f9',
                      },
                    }}
                  >
                    <Settings size={18} style={{ marginRight: 5 }} />
                    Update Existing Clinic
                  </MenuItem>
                </Menu>
                <StaffManagementModals />
              </>
            )}

            {/* Mobile Menu Button */}
            {isMobile && (
              <IconButton
                onClick={() => setMobileDrawerOpen(true)}
                aria-label="Open navigation menu"
                sx={{ color: headerText }}
              >
                <MenuIcon size={24} />
              </IconButton>
            )}
          </Box>
        </Toolbar>
      </AppBar>

      {/* Mobile Drawer - Opens from left like sidebar */}
      <Drawer
        anchor="left"
        open={mobileDrawerOpen}
        onClose={() => setMobileDrawerOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          zIndex: theme.zIndex.modal,
          '& .MuiDrawer-paper': {
            width: 280,
            boxSizing: 'border-box',
            zIndex: theme.zIndex.modal,
          },
          '& .MuiBackdrop-root': {
            zIndex: theme.zIndex.modal - 1,
          },
        }}
      >
        <MobileDrawerContent />
      </Drawer>

      {/* Main Content Area - scrollable */}
      <Box
        component="main"
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          bgcolor: 'background.default',
          transition: 'background-color 0.3s ease',
          overflow: 'auto',
          position: 'relative',
        }}
      >
        {/* Page Content with animation */}
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'visible',
            animation: 'fadeIn 0.3s ease-out',
            '@keyframes fadeIn': {
              '0%': { opacity: 0 },
              '100%': { opacity: 1 },
            },
          }}
        >
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
};

export default Layout;
