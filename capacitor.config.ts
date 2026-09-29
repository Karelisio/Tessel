import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.karelisio.tessel',
  appName: 'Tessel',
  webDir: 'dist',
  android: { backgroundColor: '#FBF7F4' },
  plugins: {
    SplashScreen: { launchAutoHide: false, backgroundColor: '#FBF7F4', showSpinner: false },
  },
};

export default config;
