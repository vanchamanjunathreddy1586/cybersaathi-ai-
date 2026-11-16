import { apiClient } from './client';

export type AssistantLanguage = 'en' | 'hi' | 'te';
export type AssistantMode = 'chat' | 'scan' | 'learning' | 'incident';

export interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface AssistantConversation {
  id: string;
  title?: string;
  language: AssistantLanguage;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationDetails {
  conversation: AssistantConversation;
  messages: AssistantMessage[];
}

export async function listConversations(): Promise<AssistantConversation[]> {
  try {
    const res = await apiClient<{ success: boolean; conversations: AssistantConversation[] }>('/assistant/conversations');
    return res.conversations || [];
  } catch (err) {
    console.warn('[AssistantAPI] listConversations failed:', err);
    return [];
  }
}

export async function createConversation(language: AssistantLanguage = 'en'): Promise<AssistantConversation> {
  const res = await apiClient<{ success: boolean; conversation: AssistantConversation }>('/assistant/conversations', {
    method: 'POST',
    body: JSON.stringify({ language }),
  });
  return res.conversation;
}

export async function getConversation(id: string): Promise<ConversationDetails> {
  const res = await apiClient<any>(`/assistant/conversations/${id}`);
  return {
    conversation: res.conversation || { id, language: 'en', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    messages: res.messages || [],
  };
}

export async function sendChatMessage(params: {
  conversationId: string;
  content: string;
  language: AssistantLanguage;
  mode?: AssistantMode;
  context?: {
    scanId?: string;
    investigationId?: string;
    lessonId?: string;
  };
}): Promise<{ userMessage: AssistantMessage; assistantMessage: AssistantMessage }> {
  const { conversationId, content, language, mode = 'chat', context = {} } = params;

  const res = await apiClient<any>(`/assistant/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      content,
      language,
      mode,
      context,
    }),
  });

  const userMsg = res.userMessage || res.messages?.find((m: any) => m.role === 'user');
  const asstMsg = res.assistantMessage || res.messages?.find((m: any) => m.role === 'assistant');

  return {
    userMessage: {
      id: userMsg?.id || `user-${Date.now()}`,
      role: 'user',
      content: userMsg?.content || content,
      createdAt: userMsg?.created_at || userMsg?.createdAt || new Date().toISOString(),
    },
    assistantMessage: {
      id: asstMsg?.id || `asst-${Date.now()}`,
      role: 'assistant',
      content: asstMsg?.content || res.message || res.reply || 'I am here to guide your cybersecurity defense.',
      createdAt: asstMsg?.created_at || asstMsg?.createdAt || new Date().toISOString(),
    },
  };
}

export async function analyzeVoiceAudio(audioUri: string, languageHint: AssistantLanguage = 'en'): Promise<any> {
  const formData = new FormData();
  const filename = audioUri.split('/').pop() || 'recording.m4a';
  const match = /\.(\w+)$/.exec(filename);
  const ext = match ? match[1].toLowerCase() : 'm4a';
  const mimeType = ext === 'wav' ? 'audio/wav' : ext === 'mp3' ? 'audio/mp3' : 'audio/m4a';

  formData.append('audio', {
    uri: audioUri,
    name: filename,
    type: mimeType,
  } as any);
  formData.append('languageHint', languageHint);

  const res = await apiClient<{ success: boolean; data: any }>('/call-scanner/analyze-audio', {
    method: 'POST',
    body: formData,
    timeoutMs: 30000,
  });

  return res.data;
}

export async function deleteConversation(id: string): Promise<boolean> {
  try {
    await apiClient(`/assistant/conversations/${id}`, { method: 'DELETE' });
    return true;
  } catch (err) {
    console.warn('[AssistantAPI] deleteConversation failed:', err);
    return false;
  }
}

