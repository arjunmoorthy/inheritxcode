import { useEffect, useRef, useState, useCallback } from 'react';
import { API_CONFIG } from '../config/api';
import { tokenManager } from '../api/client';

// Optional dev-only fallback from env (e.g. VITE_WS_AUTH_TOKEN). Production uses only authToken from login.
const getWsToken = () =>
  localStorage.getItem('authToken') || (import.meta.env.DEV ? import.meta.env.VITE_WS_AUTH_TOKEN ?? null : null);

export const useWebSocket = (
  chatUuid: string | null,
  onMessage: (message: unknown) => void
) => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);
  const cancelledRef = useRef(false);
  const wasOpenRef = useRef(false);
  const maxRetries = 3;

  const onMessageRef = useRef(onMessage);
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const connectWebSocket = useCallback(async () => {
    if (!chatUuid) return;

    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const token = getWsToken();
    const isValid = tokenManager.isTokenValid();
    if (!token || !isValid) {
      setConnectionError("Authentication token is missing or invalid.");
      tokenManager.clearAllStorage();
      window.dispatchEvent(new CustomEvent('session:expired'));
      return;
    }

    // BASE_URL may include /api/v1; strip it here because apiVersion is appended later.
    const base = (API_CONFIG.WS_BASE || API_CONFIG.BASE_URL || '')
      .replace(/\/api\/v\d+\/?$/i, '')
      .replace(/\/$/, '');
    const apiVersion = API_CONFIG.API_VERSION || '/api/v1';
    let wsBase: string;
    if (/^wss?:\/\//i.test(base)) {
      wsBase = base.replace(/\/$/, '');
    } else if (/^https?:\/\//i.test(base)) {
      wsBase = base.replace(/^http:/i, 'ws:').replace(/^https:/i, 'wss:').replace(/\/$/, '');
    } else {
      const { protocol, host } = window.location;
      const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:';
      const prefix = base === '/' ? '' : base.replace(/\/$/, '');
      wsBase = `${wsProtocol}//${host}${prefix}`;
    }

    const wsUrl = `${wsBase}${apiVersion}/chat/ws/${chatUuid}?token=${encodeURIComponent(token)}`;

    // ngrok free tier shows a browser warning; WebSocket can't send custom headers.
    // Warm the origin with a fetch that sends ngrok-skip-browser-warning so subsequent WS may succeed.
    const isNgrok = /ngrok-free\.app|ngrok\.io|ngrok-free\.dev/i.test(wsBase);
    if (isNgrok && typeof fetch === 'function') {
      const httpsUrl = wsBase.replace(/^wss:\/\//i, 'https://').replace(/^ws:\/\//i, 'http://');
      try {
        await fetch(httpsUrl, { method: 'GET', headers: { 'ngrok-skip-browser-warning': 'true' } });
      } catch {
        // ignore
      }
    }

    if (cancelledRef.current) return;

    console.log('Connecting to WebSocket:', wsUrl);
    wsRef.current = new WebSocket(wsUrl);
    wasOpenRef.current = false; // Reset for new attempt

    wsRef.current.onopen = () => {
      console.log('WebSocket connection established.');
      setIsConnected(true);
      wasOpenRef.current = true;
      setConnectionError(null);
      retryCountRef.current = 0;
    };

    wsRef.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessageRef.current?.(data);
      } catch (e) {
        console.error('Failed to parse WS message', e);
      }
    };

    wsRef.current.onerror = () => {
      console.error('WebSocket encountered an error.');
    };

    wsRef.current.onclose = (event: CloseEvent) => {
      const wasOpen = wasOpenRef.current;
      setIsConnected(false);
      wasOpenRef.current = false;
      console.warn('WebSocket closed:', event.code, event.reason, 'wasOpen:', wasOpen);

      // Auth error if server says so (1008/4401) OR if it failed during handshake (1006 and never opened)
      const isAuthError = event.code === 1008 || event.code === 4401 || (event.code === 1006 && !wasOpen);

      if (isAuthError) {
        setConnectionError('Session expired or unauthorized. Please sign in again.');
        tokenManager.clearAllStorage();
        window.location.replace('/login');
        return;
      }

      if (event.code !== 1000 && event.reason) {
        setConnectionError(event.reason);
      } else if (event.code !== 1000) {
        setConnectionError('WebSocket connection closed unexpectedly.');
      }

      // Only retry for non-auth errors
      if (retryCountRef.current < maxRetries) {
        retryCountRef.current += 1;
        retryTimeoutRef.current = setTimeout(connectWebSocket, 1000 * retryCountRef.current);
      } else if (event.code !== 1000) {
        setConnectionError((prev) =>
          prev || (isNgrok
            ? 'Failed to connect. If using ngrok, open your API URL in a new tab, click "Visit Site", then retry.'
            : 'Failed to connect to chat. Check your connection and try again.')
        );
        // If we fail persistently, trigger the session modal as it's likely an auth issue.
        tokenManager.clearAllStorage();
        window.dispatchEvent(new CustomEvent('session:expired'));
      }
    };
  }, [chatUuid]);

  const sendMessage = useCallback((
    content: string,
    message_type: string,
    structured_data?: Record<string, unknown>
  ) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const payload: Record<string, unknown> = {
        type: 'user_message',
        message_type,
        content,
      };
      if (structured_data && Object.keys(structured_data).length > 0) {
        payload.structured_data = structured_data;
      }
      wsRef.current.send(JSON.stringify(payload));
    } else {
      console.error('Cannot send message, WebSocket is not open.');
    }
  }, []);

  useEffect(() => {
    cancelledRef.current = false;
    connectWebSocket();
    return () => {
      cancelledRef.current = true;
      if (wsRef.current) {
        wsRef.current.onopen = null;
        wsRef.current.onmessage = null;
        wsRef.current.onerror = null;
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [connectWebSocket]);

  return {
    isConnected,
    connectionError,
    sendMessage,
  };
};