'use client';

import { memo } from 'react';

import CustomPluginInstallModal from './CustomPluginInstallModal';
import OfficialPluginInstallModal from './OfficialPluginInstallModal';
import { McpInstallRequest, PluginSource } from './types';

interface PluginInstallConfirmModalProps {
  installRequest: McpInstallRequest | null;
  onComplete: () => void;
}

/**
 * 根据安装请求的来源确定插件类型
 */
const getPluginSource = (request: McpInstallRequest): PluginSource => {
  const { marketId } = request;

  // Official LobeHub plugin
  if (marketId === 'lobehub') {
    return PluginSource.OFFICIAL;
  }

  // Third-party marketplace plugins (both trusted and untrusted)
  if (marketId && marketId !== 'lobehub') {
    return PluginSource.MARKETPLACE;
  }

  // Custom plugin (no marketId)
  return PluginSource.CUSTOM;
};

const PluginInstallConfirmModal = memo<PluginInstallConfirmModalProps>(
  ({ installRequest, onComplete }) => {
    if (!installRequest) return null;

    const pluginSource = getPluginSource(installRequest);

    if (pluginSource === PluginSource.OFFICIAL)
      return <OfficialPluginInstallModal installRequest={installRequest} onComplete={onComplete} />;

    return (
      <CustomPluginInstallModal
        installRequest={installRequest}
        isMarketplace={pluginSource === PluginSource.MARKETPLACE}
        onComplete={onComplete}
      />
    );
  },
);

PluginInstallConfirmModal.displayName = 'PluginInstallConfirmModal';

export default PluginInstallConfirmModal;
