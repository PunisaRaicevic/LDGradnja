import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ldgradnja.app',
  appName: 'LD Gradnja',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
