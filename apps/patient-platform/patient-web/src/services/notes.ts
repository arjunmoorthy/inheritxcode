import { apiClient } from "../utils/apiClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { API_CONFIG } from "../config/api";

export const fetchNotes = async (patientUuid?: string, timezone?: string) => {
  const params = new URLSearchParams();
  if (patientUuid) params.append('patient_uuid', patientUuid);
  if (timezone) params.append('timezone', timezone);
  
  const response = await apiClient.get(`${API_CONFIG.ENDPOINTS.DIARY.LIST}/?${params.toString()}`);
  return { data: response.data || [] };
};

export const useFetchNotes = (patientUuid?: string, timezone?: string) => {
  return useQuery({
    queryKey: ['notes', patientUuid],
    queryFn: () => fetchNotes(patientUuid, timezone),
    enabled: !!patientUuid,
  });
};

export const saveNewNotes = async (params: { content: string, title: string, marked_for_doctor?: boolean, patientUuid?: string }) => {
  const body = {
    diary_entry: params.content,
    title: params.title,
    marked_for_doctor: params.marked_for_doctor ?? false,
  };
  
  const url = params.patientUuid 
    ? `${API_CONFIG.ENDPOINTS.DIARY.CREATE}/?patient_uuid=${params.patientUuid}`
    : API_CONFIG.ENDPOINTS.DIARY.CREATE;

  const response = await apiClient.post(url, body);
  return response.data;
};

export const useSaveNewNotes = (patientUuid?: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { content: string, title: string, marked_for_doctor?: boolean }) => 
      saveNewNotes({ ...params, patientUuid }),
    onSuccess: () => {
      // Invalidate and refetch notes for the current patient
      queryClient.invalidateQueries({ queryKey: ['notes', patientUuid] });
    },
  });
};

export const updateNote = async (params: {noteId: string, diary_entry: string, title: string }) => {
  const body = {
    diary_entry: params.diary_entry,
    title: params.title,
  };
  const response = await apiClient.patch(API_CONFIG.ENDPOINTS.DIARY.UPDATE(params.noteId), body);
  return response.data;
};

export const useUpdateNote = (patientUuid?: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateNote,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes', patientUuid] });
    },
  });
};  

export const deleteNote = async (params: {noteId: string}) => {
  const response = await apiClient.patch(API_CONFIG.ENDPOINTS.DIARY.DELETE(params.noteId));
  return response.data;
};

export const useDeleteNote = (patientUuid?: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteNote,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes', patientUuid] });
    },
  });
};  