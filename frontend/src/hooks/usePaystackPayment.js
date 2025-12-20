import { useCallback } from 'react';

export const usePaystackPayment = () => {
    const loadPaystackScript = () => {
        return new Promise((resolve, reject) => {
            // Check if script is already loaded
            if (window.PaystackPop) {
                resolve(window.PaystackPop);
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://js.paystack.co/v1/inline.js';
            script.async = true;
            
            script.onload = () => {
                if (window.PaystackPop) {
                    resolve(window.PaystackPop);
                } else {
                    reject(new Error('Paystack script failed to load'));
                }
            };
            
            script.onerror = () => {
                reject(new Error('Failed to load Paystack script'));
            };
            
            document.head.appendChild(script);
        });
    };

    const initializePayment = useCallback(async (config) => {
        try {
            const PaystackPop = await loadPaystackScript();
            
            const handler = PaystackPop.setup({
                key: config.publicKey,
                email: config.email,
                amount: config.amount,
                ref: config.reference,
                callback: (response) => {
                    if (config.callback) {
                        config.callback(response);
                    }
                },
                onClose: () => {
                    if (config.onClose) {
                        config.onClose();
                    } else {
                        alert('Transaction was not completed, window closed.');
                    }
                },
                currency: config.currency || 'NGN',
                channels: config.channels || ['card', 'bank', 'ussd', 'qr', 'mobile_money', 'bank_transfer'],
                metadata: config.metadata || {},
                firstname: config.firstname || '',
                lastname: config.lastname || '',
                phone: config.phone || '',
                subaccount: config.subaccount || '',
                transaction_charge: config.transaction_charge || 0,
                bearer: config.bearer || '',
                label: config.label || '',
                plan: config.plan || '',
                quantity: config.quantity || 1,
                split_code: config.split_code || '',
                split: config.split || {},
                'data-custom-button': config.customButton || '',
            });

            handler.openIframe();
            
            return handler;
        } catch (error) {
            console.error('Paystack initialization error:', error);
            throw error;
        }
    }, []);

    return { initializePayment };
};