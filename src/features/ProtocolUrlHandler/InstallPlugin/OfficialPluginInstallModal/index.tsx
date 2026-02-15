'use client';

import { Block, Modal, Text } from '@lobehub/ui';
import { App } from 'antd';
import { memo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import DetailLoading from '@/features/PluginStore/McpList/Detail/Loading';
import { useAgentStore } from '@/store/agent';
import { useDiscoverStore } from '@/store/discover';
import { useToolStore } from '@/store/tool';
import { pluginSelectors } from '@/store/tool/slices/plugin/selectors';

import { McpInstallRequest } from '../types';
import OfficialDetail from './Detail';

interface OfficialPluginInstallModalProps {
  installRequest: McpInstallRequest | null;
  onComplete: () => void;
}

const OfficialPluginInstallModal = memo<OfficialPluginInstallModalProps>(
  ({ installRequest, onComplete }) => {
    const { message } = App.useApp();
    const { t } = useTranslation(['plugin', 'common']);
    const [loading, setLoading] = useState(false);

    // Fetch MCP plugin details
    const useMcpDetail = useDiscoverStore((s) => s.useFetchMcpDetail);
    const identifier = installRequest?.pluginId || '';

    const [installed, installMCPPlugin] = useToolStore((s) => [
      pluginSelectors.isPluginInstalled(identifier!)(s),

      s.installMCPPlugin,
    ]);
    const togglePlugin = useAgentStore((s) => s.togglePlugin);

    const { data, isLoading } = useMcpDetail({ identifier });

    const handleConfirm = useCallback(async () => {
      if (!installRequest || !data) return;

      setLoading(true);
      try {
        setLoading(true);
        await installMCPPlugin(identifier);
        await togglePlugin(identifier);
        setLoading(false);

        message.success(t('protocolInstall.messages.installSuccess', { name: data.name }));
        onComplete();
      } catch (error) {
        console.error('Official plugin installation error:', error);
        message.error(t('protocolInstall.messages.installError'));
        setLoading(false);
      }
    }, [installRequest, data]);

    if (!installRequest) return null;

    // Render content
    const renderContent = () => {
      // Show loading skeleton if loading
      if (isLoading || !identifier) {
        return <DetailLoading />;
      }

      // Show error message if loading failed or no data
      if (!data) {
        return (
          <Block>
            <Text type="danger">{t('protocolInstall.messages.manifestError')}</Text>
          </Block>
        );
      }

      return <OfficialDetail data={data} identifier={identifier} />;
    };

    return (
      <Modal
        confirmLoading={loading}
        okButtonProps={{
          disabled: installed || isLoading,
          type: installed ? 'default' : 'primary',
        }}
        okText={
          installed ? t('protocolInstall.actions.installed') : t('protocolInstall.actions.install')
        }
        onCancel={onComplete}
        onOk={handleConfirm}
        open
        title={t('protocolInstall.official.title')}
        width={800}
      >
        {renderContent()}
      </Modal>
    );
  },
);

OfficialPluginInstallModal.displayName = 'OfficialPluginInstallModal';

export default OfficialPluginInstallModal;
