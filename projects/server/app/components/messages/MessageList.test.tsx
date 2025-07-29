import { render, screen, fireEvent } from '@/test-utils';
import { MessageList } from './MessageList';
import { MessageListItemData } from '@/lib/models/types/message';
import { Dimension, Dimensions } from '@/app/hooks/useDimensions';

// Mock data
const mockMessages: MessageListItemData[] = [
  {
    messageId: 123,
    timestamp: '2024-02-20T12:00:00Z',
    userId: 'user1',
    clientId: 456,
    clientType: 'generic',
    sourceIP: '127.0.0.1',
    serverId: 1,
    serverName: 'test-server',
    sessionId: 'session1',
    origin: 'client',
    payloadMessageId: 'msg-789',
    payloadMethod: 'test.method',
    payloadToolName: 'test-tool',
    hasError: false,
    createdAt: '2024-02-20T12:00:00Z',
    alerts: false
  }
];

describe('MessageList', () => {
  // Mock dimensions - it expects a Dimensions object as generated from the useDimensions hook
  const dimensions: Dimensions = {
    getLabel: (dimension: Dimension, value: string) => {
      return value;
    },
    getValue: (dimension: Dimension, label: string) => {
      return label;
    },
    getOptions: (dimension: Dimension) => {
      return [];
    },
    getValues: (dimension: Dimension) => {
      return [];
    },
    getLabels: (dimension: Dimension) => {
      return [];
    },
    getMap: (dimension: Dimension) => {
      return new Map();
    },
    getReverseMap: (dimension: Dimension) => {
      return new Map();
    },
    getLabelsForValues: (dimension: Dimension, values: string[]) => {
      return [];
    },
    getValuesForLabels: (dimension: Dimension, labels: string[]) => {
      return [];
    },
    isValidValue: (dimension: Dimension, value: string) => {
      return true;
    },
    isValidLabel: (dimension: Dimension, label: string) => {
      return true;
    }
  };

  it('shows loading state when loading and no messages', () => {
    render(
      <MessageList
        messages={[]}
        isLoading={true}
        hasMore={false}
        onLoadMore={() => {}}
        dimensions={dimensions}
      />
    );

    expect(screen.getByText('Loading messages...')).toBeInTheDocument();
  });

  it('shows empty state when no messages', () => {
    render(
      <MessageList
        messages={[]}
        isLoading={false}
        hasMore={false}
        onLoadMore={() => {}}
        dimensions={dimensions}
      />
    );

    expect(screen.getByText('No messages found')).toBeInTheDocument();
  });

  it('renders messages correctly', () => {
    render(
      <MessageList
        messages={mockMessages}
        isLoading={false}
        hasMore={false}
        onLoadMore={() => {}}
        dimensions={dimensions}
      />
    );

    // Check if message details are rendered
    expect(screen.getByText('test.method')).toBeInTheDocument();
    expect(screen.getByText('test-tool')).toBeInTheDocument();
    expect(screen.getByText('456')).toBeInTheDocument();
    expect(screen.getByText(/2\/20\/2024/)).toBeInTheDocument();
    expect(screen.getByText('test-server')).toBeInTheDocument();
  });

  it('shows server name in all servers mode', () => {
    render(
      <MessageList
        messages={mockMessages}
        isLoading={false}
        hasMore={false}
        onLoadMore={() => {}}
        dimensions={dimensions}
      />
    );

    expect(screen.getByText('test-server')).toBeInTheDocument();
  });

  it('hides server name in single server mode', () => {
    render(
      <MessageList
        messages={mockMessages}
        isLoading={false}
        hasMore={false}
        onLoadMore={() => {}}
        dimensions={dimensions}
        initialFilters={{ serverId: 1 }}
      />
    );

    expect(screen.queryByText('test-server')).not.toBeInTheDocument();
  });

  it('shows load more button when hasMore is true', () => {
    render(
      <MessageList
        messages={mockMessages}
        isLoading={false}
        hasMore={true}
        onLoadMore={() => {}}
        dimensions={dimensions}
      />
    );

    expect(screen.getByText('Load More')).toBeInTheDocument();
  });

  it('calls onLoadMore when load more button is clicked', () => {
    const handleLoadMore = jest.fn();
    render(
      <MessageList
        messages={mockMessages}
        isLoading={false}
        hasMore={true}
        onLoadMore={handleLoadMore}
        dimensions={dimensions}
      />
    );

    fireEvent.click(screen.getByText('Load More'));
    expect(handleLoadMore).toHaveBeenCalledTimes(1);
  });

  it('disables load more button while loading', () => {
    render(
      <MessageList
        messages={mockMessages}
        isLoading={true}
        hasMore={true}
        onLoadMore={() => {}}
        dimensions={dimensions}
      />
    );

    const loadMoreButton = screen.getByText('Loading...');
    expect(loadMoreButton).toBeDisabled();
  });

  it('shows loading more message when loading with existing messages', () => {
    render(
      <MessageList
        messages={mockMessages}
        isLoading={true}
        hasMore={true}
        onLoadMore={() => {}}
        dimensions={dimensions}
      />
    );

    expect(screen.getByText('Loading more messages...')).toBeInTheDocument();
  });
}); 