import React, { useState, useEffect } from 'react';
import { useAlerts } from '@/app/contexts/AlertsContext';
import { AlertCountBubble } from '@/app/components/alerts/AlertCountBubble';

export type TabType = 'details' | 'tools' | 'logs' | 'messages' | 'alerts' | 'clients';

interface ServerTabsProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  isUnmanaged?: boolean;
  serverId?: number;
  serverType?: string;
}

export function ServerTabs({ activeTab, onTabChange, isUnmanaged = false, serverId, serverType }: ServerTabsProps) {
  const { getUnseenAlertsCount, refreshCounter } = useAlerts();
  const [alertsCount, setAlertsCount] = useState<number>(0);

  useEffect(() => {
    if (serverId) {
      const fetchAlertsCount = async () => {
        const count = await getUnseenAlertsCount({ serverId });
        setAlertsCount(count);
      };
      fetchAlertsCount();
    }
  }, [serverId, getUnseenAlertsCount, refreshCounter]);

  const baseTabs: { id: TabType; label: string; count?: number }[] = [
    { id: 'details', label: 'Details' },
    { id: 'tools', label: 'Tools' },
    ...(serverType === 'stdio' || !serverType ? [{ id: 'logs' as TabType, label: 'Logs' }] : []),
  ];
  
  const managedTabs: { id: TabType; label: string; count?: number }[] = [
    { id: 'clients', label: 'Clients' },
    { id: 'messages', label: 'Messages' },
    { id: 'alerts', label: 'Alerts', count: alertsCount }
  ];
  
  const tabs = isUnmanaged ? baseTabs : [...baseTabs, ...managedTabs];

  return (
    <div className="border-b border-gray-200 mb-4">
      <nav className="-mb-px flex space-x-8">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`${
              activeTab === tab.id
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
          >
            {tab.label}
            {tab.count !== undefined && <AlertCountBubble count={tab.count} />}
          </button>
        ))}
      </nav>
    </div>
  );
} 