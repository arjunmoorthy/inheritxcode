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
  FileText,
  User,
  ChevronDown
} from 'lucide-react';
import { useUser } from '../contexts/UserContext';
// import { useAuth } from '../contexts/AuthContext';
import { useThemeMode } from '@oncolife/ui-components';

// Sidebar width (commented out - kept for reference)
// const DRAWER_WIDTH = 260;
// const DRAWER_WIDTH_COLLAPSED = 72;

// Navigation items
const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { id: 'patients', label: 'Patients', icon: Users, path: '/patients' },
  { id: 'reports', label: 'Weekly Reports', icon: FileText, path: '/reports' },
];


const Layout: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useUser();
  // const { isAuthenticated, isLoading } = useAuth();
  const { isDark } = useThemeMode();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [profileMenuAnchor, setProfileMenuAnchor] = useState<null | HTMLElement>(null);
  const { toggleTheme } = useThemeMode();
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

  // Header colors based on dark mode (same as sidebar colors for consistency)
  const headerBg = isDark ? theme.palette.background.paper : theme.palette.primary.main;
  const headerText = isDark ? theme.palette.text.primary : 'white';
  const headerTextMuted = isDark ? theme.palette.text.secondary : 'rgba(255,255,255,0.7)';
  const headerDivider = isDark ? theme.palette.divider : 'rgba(255,255,255,0.1)';
  const headerHover = isDark ? theme.palette.action.hover : 'rgba(255,255,255,0.08)';
  const headerActive = isDark ? `${theme.palette.primary.main}20` : 'rgba(255,255,255,0.15)';

  // Sidebar colors based on dark mode (commented out - kept for reference, used in commented sidebar code below)
  const sidebarBg = isDark ? theme.palette.background.paper : theme.palette.primary.main;
  const sidebarText = isDark ? theme.palette.text.primary : 'white';
  const sidebarTextMuted = isDark ? theme.palette.text.secondary : 'rgba(255,255,255,0.7)';
  const sidebarDivider = isDark ? theme.palette.divider : 'rgba(255,255,255,0.1)';
  const sidebarHover = isDark ? theme.palette.action.hover : 'rgba(255,255,255,0.08)';
  const sidebarActive = isDark ? `${theme.palette.primary.main}20` : 'rgba(255,255,255,0.15)';

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
      return `Dr. ${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Doctor';
    }
    return 'Doctor';
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    setMobileDrawerOpen(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    sessionStorage.clear();
    navigate('/login');
  };

  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setProfileMenuAnchor(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setProfileMenuAnchor(null);
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
              bgcolor: isDark ? theme.palette.primary.main : 'rgba(255,255,255,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              boxShadow: isDark ? `0 4px 12px ${theme.palette.primary.main}40` : 'none',
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
                  sx={{
                    mx: 1,
                    borderRadius: 2,
                    bgcolor: isActive ? headerActive : 'transparent',
                    color: headerText,
                    transition: 'all 0.2s ease',
                    minHeight: 48,
                    '&:hover': {
                      bgcolor: isActive
                        ? (isDark ? `${theme.palette.primary.main}30` : 'rgba(255,255,255,0.2)')
                        : headerHover,
                    },
                  }}
                >
                  <ListItemIcon sx={{
                    minWidth: 40,
                    justifyContent: 'center',
                    color: isActive
                      ? (isDark ? theme.palette.primary.main : 'white')
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
              sx={{
                mx: 1,
                borderRadius: 2,
                bgcolor: isProfileActive ? headerActive : 'transparent',
                color: headerText,
                transition: 'all 0.2s ease',
                minHeight: 48,
                '&:hover': {
                  bgcolor: isProfileActive
                    ? (isDark ? `${theme.palette.primary.main}30` : 'rgba(255,255,255,0.2)')
                    : headerHover,
                },
              }}
            >
              <ListItemIcon sx={{
                minWidth: 40,
                justifyContent: 'center',
                color: isProfileActive
                  ? (isDark ? theme.palette.primary.main : 'white')
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
            color: isDark ? theme.palette.error.main : '#FCA5A5',
            transition: 'all 0.2s ease',
            '&:hover': {
              bgcolor: isDark ? `${theme.palette.error.main}15` : 'rgba(239, 68, 68, 0.15)',
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
        sx={{
          bgcolor: headerBg,
          borderBottom: isDark ? `1px solid ${headerDivider}` : 'none',
          transition: 'all 0.3s ease',
          zIndex: theme.zIndex.drawer + 1,
        }}
      >
        <Toolbar sx={{ 
          minHeight: { xs: 64, md: 70 },
          px: { xs: 2, md: 3 },
          justifyContent: 'space-between',
        }}>
          {/* Left: Logo */}
          <Box 
            sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 1.5,
              cursor: 'pointer',
              '&:hover': { opacity: 0.9 },
            }}
            onClick={() => handleNavigation('/dashboard')}
          >
            <Box
              sx={{
                width: { xs: 36, md: 40 },
                height: { xs: 36, md: 40 },
                borderRadius: 2,
                bgcolor: isDark ? theme.palette.primary.main : 'rgba(255,255,255,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                boxShadow: isDark ? `0 4px 12px ${theme.palette.primary.main}40` : 'none',
                flexShrink: 0,
              }}
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
                            ? (isDark ? `${theme.palette.primary.main}30` : 'rgba(255,255,255,0.2)')
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
                          bgcolor: isDark ? theme.palette.primary.main : 'rgba(255,255,255,0.2)',
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
                  <Divider sx={{ my: 0.5, borderColor: isDark ? '#334155' : '#e2e8f0' }} />
                  <MenuItem
                    onClick={() => {
                      handleLogout();
                      handleProfileMenuClose();
                    }}
                    sx={{
                      py: 1.5,
                      px: 2,
                      color: isDark ? theme.palette.error.main : '#dc2626',
                      '&:hover': {
                        bgcolor: isDark ? `${theme.palette.error.main}15` : 'rgba(239, 68, 68, 0.1)',
                      },
                    }}
                  >
                    <LogOut size={18} style={{ marginRight: 12 }} />
                    Logout
                  </MenuItem>
                </Menu>
              </>
            )}

            {/* Mobile Menu Button */}
            {isMobile && (
              <IconButton
                onClick={() => setMobileDrawerOpen(true)}
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

      {/* Main Content Area */}
      <Box
        component="main"
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          bgcolor: 'background.default',
          transition: 'background-color 0.3s ease',
          overflow: 'hidden',
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
            overflow: 'hidden',
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
