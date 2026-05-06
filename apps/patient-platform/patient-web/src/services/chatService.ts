import { getUserTimezone } from '@oncolife/shared-utils';
import { apiClient } from '../utils/apiClient';
import { API_CONFIG } from '../config/api';
import { getPatientUuid } from '../utils/patientUuid';

export const chatService = {
  getTodaySession: async () => {
    const patientUuid = getPatientUuid();
    const timezone = getUserTimezone();
    const params = new URLSearchParams({ timezone });
    if (patientUuid) {
      params.set('patient_uuid', patientUuid);
    }
    const response = await apiClient.get(
      `${API_CONFIG.ENDPOINTS.CHAT.SESSION_TODAY}?${params.toString()}`
    );
    return { success: true, status: response.status, data: response.data };
  },

  sendMessage: async (chatUuid: string, content: string) => {
    // Use WebSocket for sending messages - this is just a fallback REST endpoint
    const response = await apiClient.post(`/chat/${chatUuid}/message`, {
      chat_uuid: chatUuid,
      content,
    });
    return response.data;
  },

  startNewSession: async () => {
    const patientUuid = getPatientUuid();
    const timezone = getUserTimezone();
    const params = new URLSearchParams({ timezone });
    if (patientUuid) {
      params.set('patient_uuid', patientUuid);
    }
    const response = await apiClient.post(
      `${API_CONFIG.ENDPOINTS.CHAT.SESSION_NEW}?${params.toString()}`
    );
    return response.data;
  },

  logChemoDate: async (chemoDate: Date) => {
    const timezone = getUserTimezone();
    const response = await apiClient.post(API_CONFIG.ENDPOINTS.CHEMO.LOG, {
      chemo_date: chemoDate.toISOString().split('T')[0],
      timezone,
    });
    return response.data;
  },

  generateUploadUrl: async (fileName: string, contentType: string) => {
    const response = await apiClient.post(
      `/chat/generate-upload-url?file_name=${encodeURIComponent(fileName)}&content_type=${encodeURIComponent(contentType)}`,
      {}
    );
    return response.data;
  },

  uploadFile: async (url: string, file: File) => {
    const response = await fetch(url, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type,
      },
    });
    if (!response.ok) {
      throw new Error('Failed to upload file');
    }
    return true;
  },

  uploadImage: async (file: File, chatUuid: string) => {
    const patientUuid = getPatientUuid();
    const timezone = getUserTimezone();
    
    const params = new URLSearchParams({
      chat_uuid: chatUuid,
      timezone: timezone
    });
    
    if (patientUuid) {
      params.set('patient_uuid', patientUuid);
    }

    const formData = new FormData();
    formData.append('file', file);

    const response = await apiClient.post(
      `${API_CONFIG.ENDPOINTS.CHAT.UPLOAD_RASH_PHOTO}?${params.toString()}`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    // Assuming backend returns { file_url: "..." }
    return response.data.file_url;
  },
};
