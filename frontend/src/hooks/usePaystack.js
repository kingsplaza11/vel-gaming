import { useState } from 'react';
import axios from 'axios';

export const usePaystack = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const initializePayment = async (email, amount) => {
        setLoading(true);
        setError(null);

        try {
            const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8001/api/';
            
            // Get CSRF token from cookies
            const getCSRFToken = () => {
                const cookieValue = document.cookie
                    .split('; ')
                    .find(row => row.startsWith('csrftoken='))
                    ?.split('=')[1];
                return cookieValue;
            };

            const csrfToken = getCSRFToken();
            
            const response = await axios.post(
                `${API_BASE_URL}wallet/fund/`,
                { 
                    email, 
                    amount,
                    metadata: {
                        source: 'web_app',
                        platform: 'react_app'
                    }
                },
                {
                    withCredentials: true, // Important for session cookies
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': csrfToken,
                        'X-Requested-With': 'XMLHttpRequest',
                    }
                }
            );

            if (response.data.status) {
                return response.data.data;
            } else {
                throw new Error(response.data.message || 'Failed to initialize payment');
            }
        } catch (err) {
            const errorMessage = err.response?.data?.message || 
                               err.response?.data?.error || 
                               err.message;
            setError(errorMessage);
            
            if (err.response?.status === 403) {
                console.error('Session expired or user not authenticated');
                window.location.href = '/login';
            }
            
            throw new Error(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return {
        initializePayment,
        loading,
        error,
        clearError: () => setError(null)
    };
};