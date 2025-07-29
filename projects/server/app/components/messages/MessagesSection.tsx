import { useState, useEffect } from 'react';
import { MessageListItemData } from '@/lib/models/types/message';
import { MessageFilters } from './MessageFilters';
import { MessageList } from './MessageList';
import { useDimensions, Dimensions } from '@/app/hooks/useDimensions';
import { MessageFilter } from '@/lib/models/types/message';
import { log } from '@/lib/logging/console';

interface MessagesSectionProps {
  initialFilters?: Partial<MessageFilter>;
  dimensions?: Dimensions;
}

export function MessagesSection({
  initialFilters = {},
  dimensions: providedDimensions,
}: MessagesSectionProps) {
  const [filters, setFilters] = useState<MessageFilter>({
    serverName: '',
    payloadMethod: '',
    payloadToolName: '',
    clientId: undefined,
    sourceIP: '',
    sessionId: '',
    ...initialFilters
  });
  const [pendingFilters, setPendingFilters] = useState<MessageFilter>(filters);
  const [showFilters, setShowFilters] = useState(false);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const [messages, setMessages] = useState<MessageListItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<number | undefined>();
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [totalMessages, setTotalMessages] = useState<number>(0);

  const dimensions = providedDimensions ?? useDimensions({
    dimensions: ['serverName', 'payloadMethod', 'payloadToolName', 'clientId', 'sourceIP'],
    autoFetch: true,
    filters: {
      serverId: initialFilters.serverId,
      payloadMethod: initialFilters.payloadMethod,
      payloadToolName: initialFilters.payloadToolName,
      clientId: initialFilters.clientId, 
      sourceIP: initialFilters.sourceIP
    }
  }).dimensions;

  const loadMessages = async (currentCursor?: number, sort: 'asc' | 'desc' = sortDirection, filters = pendingFilters) => {
    try {
      log.debug('Loading messages with filters:', filters);
      log.debug('Current cursor:', currentCursor);
      log.debug('Sort direction:', sort);
      
      setLoading(true);
      const queryParams = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) {
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

  useEffect(() => {
    loadMessages();
  }, []);

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
        loadMessages(undefined, sortDirection, newPendingFilters);
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
    setHasPendingChanges(false);
    setCursor(undefined);
    loadMessages(undefined, sortDirection, pendingFilters);
  };

  const handleClear = () => {
    log.debug('Clearing filters');
    const emptyFilters: MessageFilter = {
      serverName: '',
      payloadMethod: '',
      payloadToolName: '',
      clientId: undefined,
      sourceIP: '',
      sessionId: '',
      ...initialFilters
    };
    setPendingFilters(emptyFilters);
    setFilters(emptyFilters);
    setHasPendingChanges(false);
    setCursor(undefined);
    loadMessages(undefined, sortDirection, emptyFilters);
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
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Messages</h2>
          <button
            onClick={toggleFilters}
            className="text-sm text-blue-500 hover:text-blue-700"
          >
            {showFilters ? 'Clear Filters' : 'Filter'}
          </button>
        </div>
        <div className="flex items-center space-x-4">
          <button
            onClick={handleSortDirectionChange}
            className="text-sm text-blue-500 hover:text-blue-700"
          >
            Sort {sortDirection === 'asc' ? '↑' : '↓'}
          </button>
          <span className="text-sm text-gray-500">
            {messages.length === 0 ? '0 messages' : `${messages.length} of ${totalMessages || 'N/A'} messages`}
          </span>
        </div>
      </div>

      <MessageFilters
        filters={filters}
        onFilterChange={handleFilterChange}
        onSearch={handleSearch}
        onClear={handleClear}
        hasPendingChanges={hasPendingChanges}
        showFilters={showFilters}
        dimensions={dimensions}
        initialFilters={initialFilters}
      />

      <MessageList
        messages={messages}
        isLoading={loading}
        hasMore={hasMore}
        onLoadMore={handleLoadMore}
        dimensions={dimensions}
        initialFilters={initialFilters}
      />
    </div>
  );
} 