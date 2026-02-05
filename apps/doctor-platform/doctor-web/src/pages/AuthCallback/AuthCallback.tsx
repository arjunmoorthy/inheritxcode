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
            const isNewUser = params.get('created') === 'true' || params.get('is_new_user') === 'true';
            const staffId = params.get('staff_id');
            const firstName = params.get('first_name');
            const lastName = params.get('last_name');

            if (accessToken) {
                localStorage.setItem('authToken', accessToken);
                if (refreshToken) {
                    localStorage.setItem('refreshToken', refreshToken);
                }

                hasProcessed.current = true;

                if (isNewUser) {
                    // Redirect to complete profile if it's a new social signup
                    const queryParams = new URLSearchParams({
                        staff_id: staffId || '',
                        first_name: firstName || '',
                        last_name: lastName || ''
                    }).toString();
                    navigate(`/complete-profile?${queryParams}`);
                } else {
                    navigate('/dashboard');
                }

                // Force a slight delay or just use navigate. 
                // Using window.location.reload() can sometimes break the react-router navigation.
                // But for AuthContext to pick up the token from localStorage, a reload or a context update is needed.
                window.location.reload();
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
