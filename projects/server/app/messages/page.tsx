'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { MessagesDashboard } from '@/app/components/messages/MessagesDashboard';
import { MessageList } from '@/app/components/messages/MessageList';
import { MessageListItemData } from '@/lib/models/types/message';
import { useDimensions } from '@/app/hooks/useDimensions';
import { MessageFilter } from '@/lib/models/types/message';
import { log } from '@/lib/logging/console';

function MessagesPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // Initialize filters from URL parameters synchronously
  const getInitialFilters = (): MessageFilter => {
    return {
      serverName: searchParams.get('serverName') || '',
      payloadMethod: searchParams.get('payloadMethod') || '',
      payloadToolName: searchParams.get('payloadToolName') || '',
      clientId: searchParams.get('clientId') ? parseInt(searchParams.get('clientId')!) : undefined,
      sourceIP: searchParams.get('sourceIP') || '',
      sessionId: searchParams.get('sessionId') || ''
    };
  };

  const initialFilters = getInitialFilters();
  const [filters, setFilters] = useState<MessageFilter>(initialFilters);
  const [pendingFilters, setPendingFilters] = useState<MessageFilter>(initialFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const [messages, setMessages] = useState<MessageListItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<number | undefined>();
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [totalMessages, setTotalMessages] = useState<number>(0);
  const [filtersInitialized, setFiltersInitialized] = useState(Object.keys(initialFilters).some(key => initialFilters[key as keyof MessageFilter] !== '' && initialFilters[key as keyof MessageFilter] !== undefined));
  const { dimensions, isLoading: dimensionsLoading, error: dimensionsError } = useDimensions({
    dimensions: ['serverName', 'payloadMethod', 'payloadToolName', 'clientId', 'sourceIP']
  });

  // Update filters when searchParams change
  useEffect(() => {
    const urlFilters = getInitialFilters();
    setFilters(urlFilters);
    setPendingFilters(urlFilters);
    setFiltersInitialized(true);
  }, [searchParams]);

  const updateURL = (newFilters: MessageFilter) => {
    const params = new URLSearchParams();
    
    if (newFilters.serverName) params.set('serverName', newFilters.serverName);
    if (newFilters.payloadMethod) params.set('payloadMethod', newFilters.payloadMethod);
    if (newFilters.payloadToolName) params.set('payloadToolName', newFilters.payloadToolName);
    if (newFilters.clientId !== undefined) params.set('clientId', newFilters.clientId.toString());
    if (newFilters.sourceIP) params.set('sourceIP', newFilters.sourceIP);
    if (newFilters.sessionId) params.set('sessionId', newFilters.sessionId);
    
    const newURL = params.toString() ? `?${params.toString()}` : '';
    router.replace(`/messages${newURL}`, { scroll: false });
  };

  const loadMessages = async (currentCursor?: number, sort: 'asc' | 'desc' = sortDirection, filters = pendingFilters) => {
    try {
      log.debug('Loading messages with filters:', filters);
      log.debug('Current cursor:', currentCursor);
      log.debug('Sort direction:', sort);
      
      setLoading(true);
      const queryParams = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          log.debug(`Adding filter: ${key}=${value}`);
          queryParams.append(key, value.toString());
        }
      });
      if (currentCursor) {
        log.debug('Adding cursor:', currentCursor);
        queryParams.append('cursor', currentCursor.toString());
      }
      queryParams.append('sort', sort);

      const url = `/api/v1/messages?${queryParams.toString()}`;
      log.debug('Fetching messages from:', url);

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to load messages');
      }
      const data = await response.json();
      log.debug('Received messages:', {
        count: data.messages.length,
        total: data.pagination.total,
        hasMore: data.pagination.hasMore,
        nextCursor: data.pagination.nextCursor
      });
      
      if (currentCursor) {
        // Append messages when loading more
        setMessages(prev => [...prev, ...data.messages]);
      } else {
        // Replace messages when filters change
        setMessages(data.messages);
      }
      setHasMore(data.pagination.hasMore);
      setCursor(data.pagination.nextCursor);
      setTotalMessages(data.pagination.total);
    } catch (err) {
      log.error('Error loading messages:', err);
      setError(err instanceof Error ? err.message : 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  // Reload messages when filters change
  useEffect(() => {
    log.debug('Filters changed:', filters);
    setCursor(undefined);  // Reset cursor when filters change
    loadMessages();
  }, [filters]);

  const handleFilterChange = (field: keyof MessageFilter, value: string | number | undefined) => {
    log.debug('Filter change:', { field, value });
    
    // Check if this is a dropdown change (serverName, payloadMethod, toolName, clientId, sourceIP)
    const isDropdownChange = ['serverName', 'payloadMethod', 'payloadToolName', 'clientId', 'sourceIP'].includes(field);
    
    // Create new pending filters with the change
    const newPendingFilters = { ...pendingFilters, [field]: value };
    
    // If this is a dropdown change, check if there are any other pending changes
    if (isDropdownChange) {
      // Check if any other filters have pending changes
      const hasOtherPendingChanges = Object.entries(newPendingFilters).some(([k, v]) => 
        k !== field && v !== filters[k as keyof MessageFilter]
      );
      
      // If no other pending changes, apply the filter immediately
      if (!hasOtherPendingChanges) {
        setPendingFilters(newPendingFilters);
        setFilters(newPendingFilters);
        updateURL(newPendingFilters);
        setCursor(undefined);
        loadMessages();
        return;
      }
    }
    
    // Otherwise, just update pending filters
    setPendingFilters(newPendingFilters);
    setHasPendingChanges(true);
  };

  const handleSearch = () => {
    log.debug('Search triggered with filters:', pendingFilters);
    setFilters(pendingFilters);
    updateURL(pendingFilters);
    setHasPendingChanges(false);
    setCursor(undefined);
    loadMessages();
  };

  const handleClear = () => {
    log.debug('Clearing filters');
    const emptyFilters: MessageFilter = {
      serverName: '',
      payloadMethod: '',
      payloadToolName: '',
      clientId: undefined,
      sourceIP: '',
      sessionId: ''
    };
    setPendingFilters(emptyFilters);
    setFilters(emptyFilters);
    updateURL(emptyFilters);
    setHasPendingChanges(false);
    setCursor(undefined);
    loadMessages();
    setShowFilters(false);
  };

  const handleLoadMore = () => {
    log.debug('Loading more messages');
    loadMessages(cursor);
  };

  const handleSortDirectionChange = () => {
    const newDirection = sortDirection === 'desc' ? 'asc' : 'desc';
    setSortDirection(newDirection);
    setCursor(undefined);
    loadMessages(undefined, newDirection);
  };

  const toggleFilters = () => {
    if (showFilters) {
      handleClear();
    } else {
      setShowFilters(true);
    }
  };

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="text-red-800">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <MessagesDashboard
        filters={pendingFilters}
        onFilterChange={handleFilterChange}
        onSearch={handleSearch}
        onClear={handleClear}
        hasPendingChanges={hasPendingChanges}
        showFilters={showFilters}
        onToggleFilters={toggleFilters}
        activeFilters={filters}
        dimensions={dimensions}
        filtersInitialized={filtersInitialized}
      />

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Messages</h2>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={handleSortDirectionChange}
              className="text-sm text-blue-500 hover:text-blue-700"
            >
              Sort {sortDirection === 'desc' ? '↓' : '↑'}
            </button>
            <span className="text-sm text-gray-500">
              {messages.length === 0 ? '0 messages' : `${messages.length} of ${totalMessages || 'N/A'} messages`}
            </span>
          </div>
        </div>

        <MessageList
          messages={messages}
          isLoading={loading}
          hasMore={hasMore}
          onLoadMore={handleLoadMore}
          dimensions={dimensions}
        />
      </div>
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="space-y-3">
              <div className="h-4 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            </div>
          </div>
        </div>
      </div>
    }>
      <MessagesPageContent />
    </Suspense>
  );
}