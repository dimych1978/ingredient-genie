// hooks/useTeletmetronAuth.ts
"use client";

import { useState, useCallback, useRef, useEffect } from 'react';

interface AuthCredentials {
  username: string;
  password: string;
}

interface AuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
}

interface AuthState {
  token: string | null;
  tokenExpiry: number | null;
  refreshToken: string | null;
  loading: boolean;
  error: string | null;
}

const AUTH_CONFIG = {
  clientId: '95d753e0-39d1-4dfb-9886-8cda193d4aa9',
  clientSecret: 'sh1LBRJRqWjeoojiTzxl3XdKOfjyoqCMcuiZQNkU',
  baseUrl: 'https://my.telemetron.net'
} as const;

let authState: AuthState = {
  token: null,
  tokenExpiry: null,
  refreshToken: null,
  loading: false,
  error: null,
};

const listeners = new Set<(state: AuthState) => void>();

const setState = (newState: Partial<AuthState>) => {
  authState = { ...authState, ...newState };
  listeners.forEach((listener) => listener(authState));
};

export const useTeletmetronAuth = () => {
  const [state, setLocalState] = useState(authState);
  const isRequestInFlight = useRef(false);


  useEffect(() => {
    const listener = (newState: AuthState) => {
      setLocalState(newState);
    };
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, []);


  const authenticate = useCallback(async (credentials: AuthCredentials): Promise<AuthResponse> => {
    setState({ loading: true, error: null });

    try {
      const payload = {
        grant_type: 'password',
        client_id: AUTH_CONFIG.clientId,
        client_secret: AUTH_CONFIG.clientSecret,
        username: credentials.username,
        password: credentials.password,
        scope: '',
        lang: 'ru'
      };

      const response = await fetch(`${AUTH_CONFIG.baseUrl}/api/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Token-Applicant': 'site'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Authentication failed: ${response.status} ${response.statusText}`);
      }

      const authData: AuthResponse = await response.json();
      
      const newState = {
        token: authData.access_token,
        tokenExpiry: Date.now() + (authData.expires_in * 1000),
        refreshToken: authData.refresh_token || null,
        loading: false,
        error: null
      };

      setState(newState);

      return authData;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
      setState({ loading: false, error: errorMessage });
      throw error;
    }
  }, []);

  const refreshAccessToken = useCallback(async (): Promise<AuthResponse> => {
    const currentRefreshToken = authState.refreshToken;
    
    if (!currentRefreshToken) {
      throw new Error('No refresh token available');
    }

    setState({ loading: true, error: null });

    try {
      const payload = {
        grant_type: 'refresh_token',
        client_id: AUTH_CONFIG.clientId,
        client_secret: AUTH_CONFIG.clientSecret,
        refresh_token: currentRefreshToken,
        scope: '',
        lang: 'ru'
      };

      const response = await fetch(`${AUTH_CONFIG.baseUrl}/api/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Token-Applicant': 'site'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.status}`);
      }

      const authData: AuthResponse = await response.json();
      
      setState({
        token: authData.access_token,
        tokenExpiry: Date.now() + (authData.expires_in * 1000),
        refreshToken: authData.refresh_token || currentRefreshToken,
        loading: false,
        error: null
      });

      return authData;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Token refresh failed';
      setState({ loading: false, error: errorMessage });
      throw error;
    }
  }, []);

  const getToken = useCallback(async (): Promise<string> => {
    if (isRequestInFlight.current) {
        // Simple busy-wait loop
        await new Promise(resolve => setTimeout(resolve, 100));
        return getToken(); // Retry
    }

    const { token, tokenExpiry, refreshToken } = authState;

    if (token && tokenExpiry && Date.now() < tokenExpiry - 60000) { // 1 minute buffer
      return token;
    }

    isRequestInFlight.current = true;

    try {
        if (refreshToken) {
            try {
                await refreshAccessToken();
                return authState.token!;
            } catch (error) {
                // Refresh token failed, re-authenticating...
            }
        }

        const credentials: AuthCredentials = {
            username: process.env.NEXT_PUBLIC_TELEMETRON_USERNAME!,
            password: process.env.NEXT_PUBLIC_TELEMETRON_PASSWORD!
        };

        if (!credentials.username || !credentials.password) {
            throw new Error('TELEMETRON credentials not set');
        }
        
        await authenticate(credentials);
        return authState.token!;
    } finally {
        isRequestInFlight.current = false;
    }
  }, [authenticate, refreshAccessToken]);

  const getTokenInfo = useCallback(() => {
    const { token, tokenExpiry } = authState;
    
    if (!token || !tokenExpiry) {
      return {
        token: null,
        isValid: false,
        expiry: null,
        timeUntilExpiry: null
      };
    }

    const now = Date.now();
    const isValid = now < tokenExpiry;
    const expiryDate = new Date(tokenExpiry);
    const timeUntilExpiry = tokenExpiry - now;

    return {
      token,
      isValid,
      expiry: expiryDate,
      timeUntilExpiry: timeUntilExpiry > 0 ? `${Math.round(timeUntilExpiry / 1000 / 60)} minutes` : 'Expired'
    };
  }, []);

  return { ...state, getToken, getTokenInfo };
};
