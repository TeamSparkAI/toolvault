import { ServerSecurity } from '@/lib/types/server';

interface SecurityBadgeProps {
  securityType: ServerSecurity | null;
}

export function SecurityBadge({ securityType }: SecurityBadgeProps) {
  const getBadgeStyles = (type: ServerSecurity) => {
    switch (type) {
      case 'unmanaged':
        return 'bg-gray-100 text-gray-800';
      case 'network':
      case 'container':
      case 'wrapped':
        return 'bg-blue-100 text-blue-800';
      case null:
        return 'bg-red-100 text-red-800';
    }
  };

  const getDisplayText = (type: ServerSecurity) => {
    switch (type) {
      case 'network':
        return 'Network';
      case 'container':
        return 'Container';
      case 'wrapped':
        return 'Run in Container';
      case 'unmanaged':
        return 'Unmanaged';
      case null:
        return 'Unknown';
    }
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getBadgeStyles(securityType)}`}>
      {getDisplayText(securityType)}
    </span>
  );
}