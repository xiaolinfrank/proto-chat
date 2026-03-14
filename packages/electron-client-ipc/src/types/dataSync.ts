export type StorageMode = 'local' | 'cloud' | 'selfHost';
export enum StorageModeEnum {
  Cloud = 'cloud',
  Local = 'local',
  SelfHost = 'selfHost',
}

/**
 * Remote server configuration related events
 */
export interface DataSyncConfig {
  active?: boolean;
  remoteServerUrl?: string;
  storageMode: StorageMode;
}
