import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pawpilotpro.portal',
  appName: 'PawPilotPro',
  webDir: 'dist',
  ios: {
    // Let the web app paint edge-to-edge; safe areas are handled in CSS via env(safe-area-inset-*).
    contentInset: 'never',
    // Cream background shows briefly behind the WKWebView during load.
    backgroundColor: '#F4F3EF',
    // Keep web scrolling feeling native.
    scrollEnabled: true,
  },
  plugins: {
    SplashScreen: {
      // Hold the native splash until the React app calls SplashScreen.hide().
      // We do that from AppShell on first successful query — so the seam
      // between native launch, Capacitor splash, and React mount is one
      // continuous cream colour with no FOUC.
      launchShowDuration: 3000,
      launchAutoHide: false,
      backgroundColor: '#F4F3EF',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
};

export default config;
