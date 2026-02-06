import React, { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Activity } from 'lucide-react';

const AuthCallback: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const hasProcessed = useRef(false);

    useEffect(() => {
        if (hasProcessed.current) return;

        const handleCallback = () => {
            const params = new URLSearchParams(location.search);
            const accessToken = params.get('access_token');
            const refreshToken = params.get('refresh_token');
            const isProfileCompleted = params.get('is_profile_completed');
            const staffId = params.get('staff_id');
            const firstName = params.get('first_name');
            const lastName = params.get('last_name');
            const email = params.get('email');

            if (accessToken) {
                // Store tokens in localStorage
                localStorage.setItem('authToken', accessToken);
                if (refreshToken) {
                    localStorage.setItem('refreshToken', refreshToken);
                }

                hasProcessed.current = true;

                // Determine if user is new based on 'created' parameter
                // created: 'true' = new user, created: 'false' = existing user
                const profileCompleted = isProfileCompleted === 'true';
                
                // Use window.location.href for full page navigation to ensure AuthContext picks up tokens
                if (!profileCompleted) {
                    // New user - redirect to complete profile
                    const queryParams = new URLSearchParams({
                        staff_id: staffId || '',
                        first_name: firstName || '',
                        last_name: lastName || '',
                        email: email || ''
                    }).toString();
                    window.location.href = `/complete-profile?${queryParams}`;
                } else {
                    // Existing user or profile already completed - redirect to dashboard
                    window.location.href = '/dashboard';
                }
            } else {
                // If we have an id_token in the URL (unlikely in redirect flow, but possible if FE handles it)
                const idToken = params.get('id_token');
                if (idToken) {
                    // This case is for the SSO flow if redirecting to callback
                    navigate(`/complete-profile?id_token=${idToken}`);
                } else {
                    navigate('/login?error=auth_failed');
                }
            }
        };

        handleCallback();
    }, [location, navigate]);

    return (
        <div className="min-h-screen bg-[#1A1917] flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-xl flex items-center justify-center mb-6 border border-white/20">
                <Activity size={32} className="text-white animate-spin-slow" />
            </div>
            <p className="text-white/70 font-medium animate-pulse">Processing authentication...</p>
        </div>
    );
};

export default AuthCallback;
