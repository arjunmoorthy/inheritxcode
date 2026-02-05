import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { UserProvider } from './contexts/UserContext';
import LoginPage from './pages/LoginPage/LoginPage';
import SignUpPage from './pages/SignUpPage/SignUpPage';
import ResetPasswordPage from './pages/ResetPasswordPage/ResetPasswordPage';
import DashboardPage from './pages/Dashboard/DashboardPage';
import PatientsPage from './pages/Patients/PatientsPage';
import ProfilePage from './pages/Profile/ProfilePage';
import { useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';

// Protected Route Component
interface ProtectedRouteProps {
    children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
    const { isAuthenticated, isLoading } = useAuth();

    // if (isLoading) {
    //     return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading...</div>;
    // }

    // if (!isAuthenticated) {
    //     return <Navigate to="/login" replace />;
    // }

    return <>{children}</>;
};

const App: React.FC = () => {
    return (
        <AuthProvider>
            <UserProvider>
                <BrowserRouter>
                    <Routes>
                        {/* Public Routes */}
                        <Route path="/login" element={<LoginPage />} />
                        <Route path="/signup" element={<SignUpPage />} />
                        <Route path="/reset-password" element={<ResetPasswordPage />} />

                        {/* Protected Routes with Layout */}
                        <Route
                            path="/"
                            element={
                                <ProtectedRoute>
                                    <Layout />
                                </ProtectedRoute>
                            }
                        >
                            <Route index element={<Navigate to="/dashboard" replace />} />
                            <Route path="dashboard" element={<DashboardPage />} />
                            <Route path="patients" element={<PatientsPage />} />
                            <Route path="profile" element={<ProfilePage />} />
                            <Route path="reports" element={<div style={{ padding: '20px' }}>Reports Page (Under Construction)</div>} />
                            <Route path="staff" element={<div style={{ padding: '20px' }}>Staff Page (Under Construction)</div>} />
                        </Route>

                        {/* Catch all */}
                        <Route path="*" element={<Navigate to="/login" replace />} />
                    </Routes>
                </BrowserRouter>
            </UserProvider>
        </AuthProvider>
    );
};

export default App;
