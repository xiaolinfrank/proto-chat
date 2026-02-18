/**
 * Constants related to application settings storage
 */
import { NetworkProxySettings } from '@lobechat/electron-client-ipc';

import { appStorageDir } from '@/const/dir';
import { DEFAULT_SHORTCUTS_CONFIG } from '@/shortcuts';
import { ElectronMainStore } from '@/types/store';

/**
 * Store name
 */
export const STORE_NAME = 'lobehub-settings';

export const defaultProxySettings: NetworkProxySettings = {
  enableProxy: false,
  proxyBypass: 'localhost, 127.0.0.1, ::1',
  proxyPort: '',
  proxyRequireAuth: false,
  proxyServer: '',
  proxyType: 'http',
};

/**
 * Default store values
 */
export const STORE_DEFAULTS: ElectronMainStore = {
  dataSyncConfig: { storageMode: 'local' },
  encryptedTokens: {},
  locale: 'auto',
  networkProxy: defaultProxySettings,
  shortcuts: DEFAULT_SHORTCUTS_CONFIG,
  storagePath: appStorageDir,
  themeMode: 'auto',
};
