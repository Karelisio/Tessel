import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.karelisio.tessel',
  appName: 'Tessel',
  webDir: 'dist',
  android: { backgroundColor: '#FBF7F4' },
  plugins: {
    SplashScreen: { launchAutoHide: false, backgroundColor: '#FBF7F4', showSpinner: false },
    LocalNotifications: { smallIcon: 'ic_stat_tessel', iconColor: '#D9709A' },
  },
};

export default config;
