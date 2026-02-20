import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ldgradnja.app',
  appName: 'LD Gradnja',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    LiveUpdates: {
      appId: 'c2558b32',
      channel: 'Production',
      autoUpdateMethod: 'background',
      maxVersions: 2,
    },
  },
};

export default config;
