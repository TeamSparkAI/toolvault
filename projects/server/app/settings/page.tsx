'use client';

import { useState, useEffect } from 'react';
import { HostData } from '@/lib/models/types/host';
import { AppSettingsData } from '@/lib/models/types/appSettings';
import EditHostModal from '@/app/components/EditHostModal';
import EditAppSettingsModal from '@/app/components/EditAppSettingsModal';
import { useModal } from '@/app/contexts/ModalContext';
import { useCompliance } from '@/app/contexts/ComplianceContext';

export default function SettingsPage() {
  const [hostSettings, setHostSettings] = useState<HostData | null>(null);
  const [appSettings, setAppSettings] = useState<AppSettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { setModalContent } = useModal();
  const { triggerRefresh } = useCompliance();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const [hostResponse, appResponse] = await Promise.all([
        fetch('/api/v1/host'),
        fetch('/api/v1/appSettings')
      ]);

      if (!hostResponse.ok || !appResponse.ok) {
        throw new Error('Failed to fetch settings');
      }

      const [hostData, appData] = await Promise.all([
        hostResponse.json(),
        appResponse.json()
      ]);

      setHostSettings(hostData);
      setAppSettings(appData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch settings');
    } finally {
      setLoading(false);
    }
  };

  const handleHostSave = async (host: HostData) => {
    try {
      const response = await fetch('/api/v1/host', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(host),
      });

      if (!response.ok) {
        throw new Error('Failed to save host settings');
      }

      setHostSettings(host);
      setModalContent(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save host settings');
    }
  };

  const handleAppSettingsSave = async (settings: AppSettingsData) => {
    try {
      const response = await fetch('/api/v1/appSettings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        throw new Error('Failed to save app settings');
      }

      setAppSettings(settings);
      setModalContent(null);
      
      // Trigger compliance refresh since app settings affect compliance
      triggerRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save app settings');
    }
  };

  const showHostModal = () => {
    setModalContent(
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <EditHostModal
          host={hostSettings}
          onSave={handleHostSave}
          onCancel={() => setModalContent(null)}
        />
      </div>
    );
  };

  const showAppModal = () => {
    setModalContent(
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <EditAppSettingsModal
          settings={appSettings}
          onSave={handleAppSettingsSave}
          onCancel={() => setModalContent(null)}
        />
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="h-full p-6 space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="text-red-800">Error: {error}</div>
        </div>
      )}

      <div className="flex flex-col gap-6 w-full">
        {/* Host Settings Section */}
        <div className="bg-white rounded-lg shadow p-6 w-full">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium text-gray-900">Gateway Host Settings</h2>
            <button
              onClick={showHostModal}
              className="px-4 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Edit
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-6 gap-y-2">

            <div>
              <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Host</span>
              <span className="text-base text-gray-900 font-mono px-2 py-1 bg-gray-100 rounded">{hostSettings?.host || 'Not set'}</span>
            </div>
            <div>
              <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Port</span>
              <span className="text-base text-gray-900 font-mono px-2 py-1 bg-gray-100 rounded">{hostSettings?.port || 'Not set'}</span>
            </div>
          </div>
        </div>

        {/* App Settings Section */}
        <div className="bg-white rounded-lg shadow p-6 w-full">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium text-gray-900">Application Settings</h2>
            <button
              onClick={showAppModal}
              className="px-4 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Edit
            </button>
          </div>
          <div className="overflow-x-auto">
            <div className="grid grid-cols-[max-content,max-content,minmax(1rem,8rem),max-content,max-content] gap-x-4 gap-y-2">
              {/* Header Row */}
              <div className="col-span-2 text-xs font-semibold text-gray-700 uppercase tracking-wide pb-2">Security Settings</div>
              <div></div>
              <div className="col-span-2 text-xs font-semibold text-gray-700 uppercase tracking-wide pb-2">Retention</div>
              {/* Row 1 */}
              <div className="text-sm text-gray-600 flex items-center whitespace-normal">Require Client Token</div>
              <div className="flex items-center">
                <span className={`inline-block px-2 py-1 rounded text-xs font-bold ${appSettings?.requireClientToken ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{appSettings?.requireClientToken ? 'Yes' : 'No'}</span>
              </div>
              <div></div>
              <div className="text-sm text-gray-600 flex items-center whitespace-normal">Message Retention (days)</div>
              <div className="flex items-center">
                <span className="text-base text-gray-900 font-mono px-2 py-1 bg-gray-100 rounded">{appSettings?.messageRetentionDays || 'Not set'}</span>
              </div>
              {/* Row 2 */}
              <div className="text-sm text-gray-600 flex items-center whitespace-normal">Strict Server Access</div>
              <div className="flex items-center">
                <span className={`inline-block px-2 py-1 rounded text-xs font-bold ${appSettings?.strictServerAccess ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{appSettings?.strictServerAccess ? 'Yes' : 'No'}</span>
              </div>
              <div></div>
              <div className="text-sm text-gray-600 flex items-center whitespace-normal">Alert Retention (days)</div>
              <div className="flex items-center">
                <span className="text-base text-gray-900 font-mono px-2 py-1 bg-gray-100 rounded">{appSettings?.alertRetentionDays || 'Not set'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 