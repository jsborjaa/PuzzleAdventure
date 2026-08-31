import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.puzzleadventure.app',
  appName: 'Puzzle Adventure',
  webDir: 'dist',
  android: {
    allowMixedContent: true,
  },
  plugins: {
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#2f3542',
    },
  },
};

export default config;
