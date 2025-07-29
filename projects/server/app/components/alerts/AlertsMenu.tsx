import React, { useState, useRef, useEffect } from 'react';
import { AlertFilter } from '@/lib/models/types/alert';
import { useAlerts } from '@/app/contexts/AlertsContext';
import { log } from '@/lib/logging/console';

interface AlertsMenuProps {
  onRefresh: () => void;
  currentFilters?: AlertFilter;
  initialFilters?: AlertFilter;
  showFilteredText?: boolean;
  menuPosition?: 'left' | 'right';
}

export function AlertsMenu({ onRefresh, currentFilters, initialFilters, showFilteredText = true, menuPosition = 'right' }: AlertsMenuProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [isMarkingAlerts, setIsMarkingAlerts] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { refreshUnseenAlerts } = useAlerts();

  // Check if there are user-applied filters (filters beyond the initial context filters)
  const hasUserAppliedFilters = () => {
    if (!currentFilters || !initialFilters) return false;
    
    // Check if any filter is set that wasn't in the initial filters
    const userFilters = Object.entries(currentFilters).some(([key, value]) => {
      if (value === undefined || value === null) return false;
      const initialValue = initialFilters[key as keyof AlertFilter];
      return initialValue !== value;
    });
    
    return userFilters;
  };

  // Handle click outside to close menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMenu]);

  const handleMarkAllAlerts = async (seen: boolean) => {
    if (isMarkingAlerts) return;
    
    setIsMarkingAlerts(true);
    try {
      // Remove seen from currentFilters to avoid conflict with the seen parameter
      const { seen: _, ...filtersWithoutSeen } = currentFilters || {};
      const requestBody = { seen, ...filtersWithoutSeen };
      log.debug('Sending mark-all request:', requestBody);
      log.debug('Current filters:', currentFilters);
      log.debug('Initial filters:', initialFilters);
      
      const response = await fetch('/api/v1/alerts/mark-all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        // Refresh the alerts list
        onRefresh();
        // Refresh the unseen alerts context
        await refreshUnseenAlerts();
      } else {
        const errorText = await response.text();
        log.error('Failed to mark alerts:', response.status, errorText);
        log.error('Request body was:', requestBody);
      }
    } catch (error) {
      log.error('Error marking alerts:', error);
    } finally {
      setIsMarkingAlerts(false);
      setShowMenu(false);
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        disabled={isMarkingAlerts}
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
        </svg>
      </button>
      
      {showMenu && (
        <div className={`absolute ${menuPosition === 'left' ? 'left-0' : 'right-0'} mt-2 min-w-max bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50`}>
          <button
            onClick={() => handleMarkAllAlerts(true)}
            disabled={isMarkingAlerts}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
          >
            {/* Open envelope icon for Seen */}
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            {isMarkingAlerts ? 'Marking...' : (hasUserAppliedFilters() && showFilteredText) ? 'Mark filtered as Seen' : 'Mark all as Seen'}
          </button>
          <button
            onClick={() => handleMarkAllAlerts(false)}
            disabled={isMarkingAlerts}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
          >
            {/* Closed envelope icon for New */}
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            {isMarkingAlerts ? 'Marking...' : (hasUserAppliedFilters() && showFilteredText) ? 'Mark filtered as New' : 'Mark all as New'}
          </button>
        </div>
      )}
    </div>
  );
} 