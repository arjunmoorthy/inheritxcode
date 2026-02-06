/**
 * OncoLife Physician Portal - Layout
 * 
 * Responsive layout with:
 * - Desktop: Sidebar navigation (dark theme)
 * - Mobile: Hamburger drawer
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
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Tooltip from '@mui/material/Tooltip';
import {
  LayoutDashboard,
  Users,
  UserCog,
  Menu as MenuIcon,
  LogOut,
  X,
  Activity,
  Moon,
  Sun,
  FileText,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useUser } from '../contexts/UserContext';
// import { useAuth } from '../contexts/AuthContext';
import { DarkModeToggle, useThemeMode } from '@oncolife/ui-components';

// Sidebar width
const DRAWER_WIDTH = 260;
const DRAWER_WIDTH_COLLAPSED = 72;

// Navigation items
const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { id: 'patients', label: 'Patients', icon: Users, path: '/patients' },
  { id: 'reports', label: 'Weekly Reports', icon: FileText, path: '/reports' },
  { id: 'staff', label: 'Staff', icon: UserCog, path: '/staff' },
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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

  // Sidebar colors based on dark mode
  const sidebarBg = isDark ? theme.palette.background.paper : theme.palette.primary.main;
  const sidebarText = isDark ? theme.palette.text.primary : 'white';
  const sidebarTextMuted = isDark ? theme.palette.text.secondary : 'rgba(255,255,255,0.7)';
  const sidebarDivider = isDark ? theme.palette.divider : 'rgba(255,255,255,0.1)';
  const sidebarHover = isDark ? theme.palette.action.hover : 'rgba(255,255,255,0.08)';
  const sidebarActive = isDark ? `${theme.palette.primary.main}20` : 'rgba(255,255,255,0.15)';

  // Get current nav item
  const currentNav = navItems.find(item => location.pathname.startsWith(item.path))?.id || 'dashboard';

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

  // Sidebar Content
  const SidebarContent = ({ collapsed = false }: { collapsed?: boolean }) => (
    <Box sx={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      bgcolor: sidebarBg,
      color: sidebarText,
      transition: 'background-color 0.3s ease, color 0.3s ease',
    }}>
      {/* Logo Header */}
      <Box sx={{
        p: collapsed ? 2 : 2.5,
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        borderBottom: `1px solid ${sidebarDivider}`,
        justifyContent: collapsed ? 'center' : 'flex-start',
      }}>
        <Box
          sx={{
            width: collapsed ? 36 : 40,
            height: collapsed ? 36 : 40,
            borderRadius: 2,
            bgcolor: isDark ? theme.palette.primary.main : 'rgba(255,255,255,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: isDark ? 'white' : 'white',
            boxShadow: isDark ? `0 4px 12px ${theme.palette.primary.main}40` : 'none',
            flexShrink: 0,
          }}
        >
          <Activity size={collapsed ? 20 : 24} />
        </Box>
        {!collapsed && (
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="h6"
              fontWeight={700}
              sx={{ lineHeight: 1.2, color: sidebarText }}
            >
              OncoLife
            </Typography>
            <Typography
              variant="caption"
              sx={{
                display: 'block',
                lineHeight: 1.2,
                color: sidebarTextMuted,
              }}
            >
              Physician Portal
            </Typography>
          </Box>
        )}
        {isMobile && !collapsed && (
          <IconButton
            onClick={() => setMobileDrawerOpen(false)}
            sx={{ color: sidebarText }}
          >
            <X size={20} />
          </IconButton>
        )}
      </Box>

      {/* User Profile Section - Clickable */}
      <Tooltip title={collapsed ? getUserName() : ''} placement="right" arrow>
        <Box
          onClick={() => handleNavigation('/profile')}
          sx={{
            p: collapsed ? 1.5 : 2,
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            borderBottom: `1px solid ${sidebarDivider}`,
            cursor: 'pointer',
            transition: 'background-color 0.2s ease',
            justifyContent: collapsed ? 'center' : 'flex-start',
            '&:hover': {
              bgcolor: sidebarHover,
            },
          }}
        >
          <Avatar
            sx={{
              bgcolor: theme.palette.secondary.main,
              width: collapsed ? 36 : 44,
              height: collapsed ? 36 : 44,
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            {getInitials()}
          </Avatar>
          {!collapsed && (
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                variant="body2"
                sx={{ color: sidebarTextMuted }}
              >
                Welcome
              </Typography>
              <Typography
                variant="body1"
                fontWeight={600}
                sx={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  color: sidebarText,
                }}
              >
                {getUserName()}
              </Typography>
            </Box>
          )}
        </Box>
      </Tooltip>

      {/* Navigation Links */}
      <Box sx={{ flex: 1, py: 2, overflow: 'auto' }}>
        {!collapsed && (
          <Typography
            variant="overline"
            sx={{
              px: 2,
              mb: 1,
              display: 'block',
              color: sidebarTextMuted,
              fontSize: '0.7rem',
              letterSpacing: '0.1em',
              opacity: 0.7,
            }}
          >
            Navigation
          </Typography>
        )}
        <List disablePadding>
          {navItems.map((item, index) => {
            const Icon = item.icon;
            const isActive = currentNav === item.id;
            return (
              <ListItem
                key={item.id}
                disablePadding
                sx={{
                  animation: collapsed ? 'none' : 'slideInLeft 0.3s ease-out forwards',
                  animationDelay: collapsed ? '0ms' : `${index * 50}ms`,
                  opacity: collapsed ? 1 : 0,
                  '@keyframes slideInLeft': {
                    '0%': { opacity: 0, transform: 'translateX(-20px)' },
                    '100%': { opacity: 1, transform: 'translateX(0)' },
                  },
                }}
              >
                <Tooltip title={collapsed ? item.label : ''} placement="right" arrow>
                  <ListItemButton
                    onClick={() => handleNavigation(item.path)}
                    sx={{
                      mx: collapsed ? 0.5 : 1,
                      borderRadius: 2,
                      bgcolor: isActive ? sidebarActive : 'transparent',
                      color: sidebarText,
                      transition: 'all 0.2s ease',
                      justifyContent: collapsed ? 'center' : 'flex-start',
                      minHeight: 48,
                      '&:hover': {
                        bgcolor: isActive
                          ? (isDark ? `${theme.palette.primary.main}30` : 'rgba(255,255,255,0.2)')
                          : sidebarHover,
                      },
                    }}
                  >
                    <ListItemIcon sx={{
                      minWidth: collapsed ? 0 : 40,
                      justifyContent: 'center',
                      color: isActive
                        ? (isDark ? theme.palette.primary.main : 'white')
                        : sidebarTextMuted,
                    }}>
                      <Icon size={22} />
                    </ListItemIcon>
                    {!collapsed && (
                      <ListItemText
                        primary={item.label}
                        primaryTypographyProps={{
                          fontWeight: isActive ? 600 : 500,
                          color: 'inherit',
                        }}
                      />
                    )}
                  </ListItemButton>
                </Tooltip>
              </ListItem>
            );
          })}
        </List>
      </Box>

      {/* Theme Toggle & Logout */}
      <Box sx={{ borderTop: `1px solid ${sidebarDivider}` }}>
        <Box sx={{ p: collapsed ? 1 : 1.5 }}>
          {/* Dark Mode Toggle */}
          {!collapsed ? (
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              px: 1.5,
              py: 1,
              mb: 1,
            }}>
              <Typography variant="body2" sx={{ color: sidebarTextMuted }}>
                {isDark ? 'Dark Mode' : 'Light Mode'}
              </Typography>
              <DarkModeToggle variant="pill" />
            </Box>
          ) : (
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1 }}>
              <Tooltip title={isDark ? 'Light Mode' : 'Dark Mode'} placement="right" arrow>
                <IconButton
                  onClick={() => {
                    const toggle = document.querySelector('[data-theme-toggle]') as HTMLElement;
                    toggle?.click();
                  }}
                  sx={{
                    color: sidebarTextMuted,
                    '&:hover': { bgcolor: sidebarHover },
                  }}
                >
                  {isDark ? <Sun size={20} /> : <Moon size={20} />}
                </IconButton>
              </Tooltip>
            </Box>
          )}

          {/* Logout */}
          <Tooltip title={collapsed ? 'Log out' : ''} placement="right" arrow>
            <ListItemButton
              onClick={handleLogout}
              sx={{
                borderRadius: 2,
                color: isDark ? theme.palette.error.main : '#FCA5A5',
                transition: 'all 0.2s ease',
                justifyContent: collapsed ? 'center' : 'flex-start',
                '&:hover': {
                  bgcolor: isDark ? `${theme.palette.error.main}15` : 'rgba(239, 68, 68, 0.15)',
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: collapsed ? 0 : 40, justifyContent: 'center', color: 'inherit' }}>
                <LogOut size={22} />
              </ListItemIcon>
              {!collapsed && <ListItemText primary="Log out" />}
            </ListItemButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Collapse Toggle Button - Desktop Only */}
      {!isMobile && (
        <Tooltip 
          title={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'} 
          placement="right"
          arrow
        >
          <IconButton
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            sx={{
              position: 'absolute',
              right: -20,
              top: '50%',
              transform: 'translateY(-50%)',
              bgcolor: isDark 
                ? '#1e293b' 
                : '#f8fafc',
              border: `2px solid ${isDark ? '#334155' : '#e2e8f0'}`,
              width: 40,
              height: 40,
              borderRadius: '50%',
              boxShadow: isDark 
                ? '0 2px 8px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
                : '0 2px 8px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
              zIndex: 10,
              color: isDark 
                ? '#cbd5e1' 
                : '#475569',
              '&:hover': {
                bgcolor: isDark 
                  ? '#1e293b' 
                  : '#f8fafc',
                transform: 'translateY(-50%) scale(1.1)',
                boxShadow: isDark
                  ? '0 4px 12px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
                  : '0 4px 12px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
              },
              transition: 'all 0.2s ease',
              '&:active': {
                transform: 'translateY(-50%) scale(1.05)',
              },
            }}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? (
              <ChevronRight 
                size={40} 
                strokeWidth={3}
                className='mr-2'
              />
            ) : (
              <ChevronLeft 
                size={40} 
                strokeWidth={3}
                className='mr-2'
              />
            )}
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* Desktop Sidebar */}
      {!isMobile && (
        <Drawer
          variant="permanent"
          sx={{
            width: sidebarCollapsed ? DRAWER_WIDTH_COLLAPSED : DRAWER_WIDTH,
            flexShrink: 0,
            transition: 'width 0.3s ease',
            '& .MuiDrawer-paper': {
              width: sidebarCollapsed ? DRAWER_WIDTH_COLLAPSED : DRAWER_WIDTH,
              boxSizing: 'border-box',
              border: 'none',
              transition: 'width 0.3s ease, background-color 0.3s ease',
              overflowX: 'hidden',
              position: 'relative',
            },
          }}
        >
          <SidebarContent collapsed={sidebarCollapsed} />
        </Drawer>
      )}

      {/* Mobile Drawer */}
      <Drawer
        variant="temporary"
        open={mobileDrawerOpen}
        onClose={() => setMobileDrawerOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': {
            width: 280,
            boxSizing: 'border-box',
          },
        }}
      >
        <SidebarContent collapsed={false} />
      </Drawer>

      {/* Main Content Area */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
          bgcolor: 'background.default',
          transition: 'background-color 0.3s ease',
        }}
      >
        {/* Mobile Header */}
        {isMobile && (
          <AppBar
            position="sticky"
            elevation={0}
            sx={{
              bgcolor: isDark ? 'background.paper' : theme.palette.primary.main,
              borderBottom: isDark ? `1px solid ${theme.palette.divider}` : 'none',
              transition: 'all 0.3s ease',
            }}
          >
            <Toolbar sx={{ minHeight: { xs: 56 } }}>
              <IconButton
                edge="start"
                onClick={() => setMobileDrawerOpen(true)}
                sx={{ mr: 1, color: isDark ? 'text.primary' : 'white' }}
              >
                <MenuIcon />
              </IconButton>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Activity size={24} color={isDark ? theme.palette.primary.main : 'white'} />
                <Typography
                  variant="h6"
                  fontWeight={700}
                  sx={{ color: isDark ? 'text.primary' : 'white' }}
                >
                  OncoLife
                </Typography>
              </Box>
              <Box sx={{ flexGrow: 1 }} />
              <DarkModeToggle variant="icon" size="small" />
              <Avatar
                sx={{
                  width: 36,
                  height: 36,
                  bgcolor: theme.palette.secondary.main,
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  ml: 0.5,
                }}
              >
                {getInitials()}
              </Avatar>
            </Toolbar>
          </AppBar>
        )}

        {/* Page Content with animation */}
        <Box
          sx={{
            flex: 1,
            overflow: 'auto',
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
