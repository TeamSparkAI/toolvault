'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PolicyDetails } from '@/app/components/policy/PolicyDetails';
import { JsonResponseFetch } from '@/lib/jsonResponse';
import { useLayout } from '@/app/contexts/LayoutContext';
import { PolicyData } from '@/lib/models/types/policy';

const emptyPolicy: Omit<PolicyData, 'policyId' | 'createdAt' | 'updatedAt'> = {
  name: '',
  description: undefined,
  severity: 2,
  origin: 'either',
  methods: undefined,
  filters: [],
  action: 'none',
  actionText: undefined,
  enabled: true
};

export default function NewPolicyPage() {
  const router = useRouter();
  const { setHeaderTitle } = useLayout();
  const [error, setError] = useState<string | null>(null);

  // Set the header title
  useEffect(() => {
    setHeaderTitle('New Policy');
    return () => setHeaderTitle(undefined);
  }, [setHeaderTitle]);

  const handleSavePolicy = async (policyData: Omit<PolicyData, 'policyId' | 'createdAt' | 'updatedAt'>) => {
    try {
      const response = await fetch('/api/v1/policies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(policyData),
      });

      if (!response.ok) {
        throw new Error('Failed to create policy');
      }

      const json = await response.json();
      const result = new JsonResponseFetch<PolicyData>(json, 'policy');
      if (!result.isSuccess()) {
        throw new Error(result.message || 'Failed to create policy');
      }

      // Navigate to the new policy
      router.push(`/policies/${result.payload.policyId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const handleCancel = () => {
    router.push('/policies');
  };

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div className="space-y-6">
      <PolicyDetails 
        policy={emptyPolicy}
        onEdit={handleSavePolicy}
        onCancel={handleCancel}
        isNewPolicy={true}
      />
    </div>
  );
} 