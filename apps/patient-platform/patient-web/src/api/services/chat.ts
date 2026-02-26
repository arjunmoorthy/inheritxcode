/**
 * Chat API Service
 * =================
 * 
 * Type-safe chat/symptom checker API calls and WebSocket management.
 */

import { api, tokenManager } from '../client';
import { API_CONFIG, buildWsUrl } from '../../config/api';
import type {
  ChatSession,
  ChatMessage,
  ChatStateResponse,
  WebSocketMessage,
  OverallFeeling,
} from '../types';

const { ENDPOINTS } = API_CONFIG;

function requirePatientUuid(patientUuid: string | null | undefined): string {
  if (!patientUuid || typeof patientUuid !== 'string' || !patientUuid.trim()) {
    throw new Error('Patient UUID is required. Please sign in.');
  }
  return patientUuid.trim();
}

// =============================================================================
// WebSocket Types
// =============================================================================

type WebSocketEventHandler = (message: ChatMessage) => void;
type WebSocketErrorHandler = (error: Event) => void;
type WebSocketCloseHandler = (event: CloseEvent) => void;

interface WebSocketConnection {
  socket: WebSocket;
  onMessage: WebSocketEventHandler;
  onError?: WebSocketErrorHandler;
  onClose?: WebSocketCloseHandler;
}

// =============================================================================
// REST API
// =============================================================================

export const chatApi = {
  /**
   * Get or create today's chat session
   */
  getOrCreateSession: async (
    patientUuid: string,
    timezone: string = 'America/Los_Angeles'
  ): Promise<ChatSession> => {
    const uuid = requirePatientUuid(patientUuid);
    return api.get<ChatSession>(
      `${ENDPOINTS.CHAT.SESSION_TODAY}?patient_uuid=${encodeURIComponent(uuid)}&timezone=${encodeURIComponent(timezone)}`
    );
  },

  /**
   * Force create a new session (delete existing today's session)
   */
  createNewSession: async (
    patientUuid: string,
    timezone: string = 'America/Los_Angeles'
  ): Promise<ChatSession> => {
    const uuid = requirePatientUuid(patientUuid);
    return api.post<ChatSession>(
      `${ENDPOINTS.CHAT.SESSION_NEW}?patient_uuid=${encodeURIComponent(uuid)}&timezone=${encodeURIComponent(timezone)}`
    );
  },

  /**
   * Get full chat history
   */
  getFullChat: async (
    chatUuid: string,
    patientUuid: string
  ): Promise<ChatSession> => {
    const uuid = requirePatientUuid(patientUuid);
    return api.get<ChatSession>(
      `${ENDPOINTS.CHAT.FULL(chatUuid)}?patient_uuid=${encodeURIComponent(uuid)}`
    );
  },

  /**
   * Get chat state (without full message history)
   */
  getChatState: async (
    chatUuid: string,
    patientUuid: string
  ): Promise<ChatStateResponse> => {
    const uuid = requirePatientUuid(patientUuid);
    return api.get<ChatStateResponse>(
      `${ENDPOINTS.CHAT.STATE(chatUuid)}?patient_uuid=${encodeURIComponent(uuid)}`
    );
  },

  /**
   * Update overall feeling for a chat
   */
  updateOverallFeeling: async (
    chatUuid: string,
    patientUuid: string,
    feeling: OverallFeeling
  ): Promise<void> => {
    const uuid = requirePatientUuid(patientUuid);
    return api.post(
      `${ENDPOINTS.CHAT.FEELING(chatUuid)}?patient_uuid=${encodeURIComponent(uuid)}`,
      { feeling }
    );
  },

  /**
   * Delete a chat session
   */
  deleteChat: async (chatUuid: string, patientUuid: string): Promise<void> => {
    const uuid = requirePatientUuid(patientUuid);
    return api.delete(
      `${ENDPOINTS.CHAT.DELETE(chatUuid)}?patient_uuid=${encodeURIComponent(uuid)}`
    );
  },
};

// =============================================================================
// WebSocket Management
// =============================================================================

let activeConnection: WebSocketConnection | null = null;

export const chatWebSocket = {
  /**
   * Connect to a chat WebSocket
   */
  connect: (
    chatUuid: string,
    handlers: {
      onMessage: WebSocketEventHandler;
      onError?: WebSocketErrorHandler;
      onClose?: WebSocketCloseHandler;
      onOpen?: () => void;
    }
  ): WebSocket => {
    // Close existing connection if any
    if (activeConnection?.socket) {
      activeConnection.socket.close();
    }

    const token = tokenManager.getToken();
    if (!token) {
      throw new Error('No authentication token available');
    }

    const wsUrl = buildWsUrl(ENDPOINTS.CHAT.WS(chatUuid), token);
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log('[WS] Connected to chat:', chatUuid);
      handlers.onOpen?.();
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as ChatMessage;
        handlers.onMessage(message);
      } catch (error) {
        console.error('[WS] Failed to parse message:', error);
      }
    };

    socket.onerror = (error) => {
      console.error('[WS] WebSocket error:', error);
      handlers.onError?.(error);
    };

    socket.onclose = (event) => {
      console.log('[WS] Connection closed:', event.code, event.reason);
      activeConnection = null;
      handlers.onClose?.(event);
    };

    activeConnection = {
      socket,
      onMessage: handlers.onMessage,
      onError: handlers.onError,
      onClose: handlers.onClose,
    };

    return socket;
  },

  /**
   * Send a message through the WebSocket
   */
  send: (message: WebSocketMessage): boolean => {
    if (!activeConnection?.socket || activeConnection.socket.readyState !== WebSocket.OPEN) {
      console.error('[WS] Cannot send message: socket not connected');
      return false;
    }

    try {
      activeConnection.socket.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error('[WS] Failed to send message:', error);
      return false;
    }
  },

  /**
   * Disconnect from the WebSocket
   */
  disconnect: (): void => {
    if (activeConnection?.socket) {
      activeConnection.socket.close(1000, 'Client disconnect');
      activeConnection = null;
    }
  },

  /**
   * Check if connected
   */
  isConnected: (): boolean => {
    return activeConnection?.socket?.readyState === WebSocket.OPEN;
  },
};

export default chatApi;





