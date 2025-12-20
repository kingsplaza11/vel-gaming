declare global {
    interface Window {
        PaystackPop: {
            setup: (options: PaystackOptions) => PaystackHandler;
        };
    }
}

export interface PaystackOptions {
    key: string;
    email: string;
    amount: number;
    ref: string;
    callback: (response: PaystackResponse) => void;
    onClose?: () => void;
    currency?: string;
    channels?: string[];
    metadata?: Record<string, any>;
    firstname?: string;
    lastname?: string;
    phone?: string;
    subaccount?: string;
    transaction_charge?: number;
    bearer?: string;
    label?: string;
    plan?: string;
    quantity?: number;
    split_code?: string;
    split?: Record<string, any>;
    'data-custom-button'?: string;
}

export interface PaystackResponse {
    message: string;
    reference: string;
    status: string;
    trans: string;
    transaction: string;
    trxref: string;
}

export interface PaystackHandler {
    openIframe: () => void;
    closeIframe: () => void;
}