import { create } from 'zustand';

interface SettingsStore {
  geminiApiKey: string;
  backendUrl: string;
  setGeminiApiKey: (key: string) => void;
  setBackendUrl: (url: string) => void;
  loadSettings: () => void;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  geminiApiKey: '',
  backendUrl: '',

  setGeminiApiKey: (key) => {
    localStorage.setItem('ldgradnja_gemini_key', key);
    set({ geminiApiKey: key });
  },

  setBackendUrl: (url) => {
    const cleaned = url.replace(/\/+$/, '');
    localStorage.setItem('ldgradnja_backend_url', cleaned);
    set({ backendUrl: cleaned });
  },

  loadSettings: () => {
    const key = localStorage.getItem('ldgradnja_gemini_key') || '';
    const backendUrl = localStorage.getItem('ldgradnja_backend_url') || '';
    set({ geminiApiKey: key, backendUrl });
  },
}));
