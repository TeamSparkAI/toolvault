import React, { useState, useEffect } from 'react';
import { useAlerts } from '@/app/contexts/AlertsContext';
import { AlertCountBubble } from '@/app/components/alerts/AlertCountBubble';

export type TabType = 'details' | 'messages' | 'alerts' | 'servers';

interface ClientTabsProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  hideServersTab?: boolean;
  clientId?: number;
}

export function ClientTabs({ activeTab, onTabChange, hideServersTab = false, clientId }: ClientTabsProps) {
  const { getUnseenAlertsCount, refreshCounter } = useAlerts();
  const [alertsCount, setAlertsCount] = useState<number>(0);

  useEffect(() => {
    if (clientId) {
      const fetchAlertsCount = async () => {
        const count = await getUnseenAlertsCount({ clientId });
        setAlertsCount(count);
      };
      fetchAlertsCount();
    }
  }, [clientId, getUnseenAlertsCount, refreshCounter]);

  const tabs: { id: TabType; label: string; count?: number }[] = [
    { id: 'details', label: 'Details' },
    ...(!hideServersTab ? ([{ id: 'servers' as TabType, label: 'Servers' }] as { id: TabType; label: string; count?: number }[]) : []),
    { id: 'messages', label: 'Messages' },
    { id: 'alerts', label: 'Alerts', count: alertsCount }
  ];

  return (
    <div className="border-b border-gray-200">
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