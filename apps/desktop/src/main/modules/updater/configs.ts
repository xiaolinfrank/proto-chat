import { isDev } from '@/const/env';

// Update channel (stable, beta, alpha, etc.)
export const UPDATE_CHANNEL = process.env.UPDATE_CHANNEL;

export const updaterConfig = {
  // App update configuration
  app: {
    // Whether to automatically check for updates
    autoCheckUpdate: true,
    // Whether to automatically download updates
    autoDownloadUpdate: true,
    // Interval for checking updates (milliseconds)
    checkUpdateInterval: 60 * 60 * 1000, // 1 hour
  },

  // Whether to enable app updates
  enableAppUpdate: !isDev,

  // Whether to enable renderer hot updates
  enableRenderHotUpdate: !isDev,
};
