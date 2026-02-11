import { create } from 'zustand';

interface SettingsStore {
  openaiApiKey: string;
  backendUrl: string;
  setOpenaiApiKey: (key: string) => void;
  setBackendUrl: (url: string) => void;
  loadSettings: () => void;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  openaiApiKey: '',
  backendUrl: '',

  setOpenaiApiKey: (key) => {
    localStorage.setItem('ldgradnja_openai_key', key);
    set({ openaiApiKey: key });
  },

  setBackendUrl: (url) => {
    const cleaned = url.replace(/\/+$/, '');
    localStorage.setItem('ldgradnja_backend_url', cleaned);
    set({ backendUrl: cleaned });
  },

  loadSettings: () => {
    const key = localStorage.getItem('ldgradnja_openai_key') || '';
    const backendUrl = localStorage.getItem('ldgradnja_backend_url') || '';
    set({ openaiApiKey: key, backendUrl });
  },
}));
