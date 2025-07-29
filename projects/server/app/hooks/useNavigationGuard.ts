import { useEffect } from 'react';

export function useNavigationGuard(
  isEnabled: boolean,
  onBeforeUnload: () => Promise<boolean>
) {
  useEffect(() => {
    if (!isEnabled) return;

    // Handle in-app navigation
    const handleClick = async (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest('a');
      if (link && link.href && !link.href.startsWith(window.location.origin + '/policies/')) {
        e.preventDefault();
        const confirmed = await onBeforeUnload();
        if (confirmed) {
          window.location.href = link.href;
        }
      }
    };

    window.addEventListener('click', handleClick, true);
    return () => {
      window.removeEventListener('click', handleClick, true);
    };
  }, [isEnabled, onBeforeUnload]);
} 