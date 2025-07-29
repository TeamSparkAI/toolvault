'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PolicyDetails } from '@/app/components/policy/PolicyDetails';
import { PolicyDetailsTab } from '@/app/components/policy/PolicyDetailsTab';
import { PolicyHeader } from '@/app/components/policy/PolicyHeader';
import { JsonResponseFetch } from '@/lib/jsonResponse';
import { useLayout } from '@/app/contexts/LayoutContext';
import { useDialog } from '@/app/hooks/useDialog';
import { PolicyData } from '@/lib/models/types/policy';
import { PolicyTabs, TabType } from '@/app/components/policy/PolicyTabs';
import { AlertsSection } from '@/app/components/alerts/AlertsSection';

export default function PolicyPage({ params }: { params: { policyId: string } }) {
  const router = useRouter();
  const { setHeaderTitle } = useLayout();
  const { confirm } = useDialog();
  const [policy, setPolicy] = useState<PolicyData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('details');
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    fetchPolicy();
  }, [params.policyId]);

  useEffect(() => {
    if (policy) {
      setHeaderTitle(policy.name);
    }
    return () => setHeaderTitle(undefined);
  }, [policy, setHeaderTitle]);

  const fetchPolicy = async () => {
    try {
      const response = await fetch(`/api/v1/policies/${params.policyId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch policy');
      }
      const json = await response.json();
      const result = new JsonResponseFetch<PolicyData>(json, 'policy');
      if (!result.isSuccess()) {
        throw new Error(result.message || 'Failed to fetch policy');
      }
      setPolicy(result.payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSavePolicy = async (updatedPolicy: Omit<PolicyData, 'policyId' | 'createdAt' | 'updatedAt'>) => {
    try {
      const response = await fetch(`/api/v1/policies/${params.policyId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedPolicy),
      });

      if (!response.ok) {
        throw new Error('Failed to update policy');
      }

      const json = await response.json();
      const result = new JsonResponseFetch<PolicyData>(json, 'policy');
      if (!result.isSuccess()) {
        throw new Error(result.message || 'Failed to update policy');
      }
      setPolicy(result.payload);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const handleDeletePolicy = async () => {
    try {
      const response = await fetch(`/api/v1/policies/${params.policyId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete policy');
      }

      const json = await response.json();
      const result = new JsonResponseFetch<boolean>(json, 'success');
      if (!result.isSuccess()) {
        throw new Error(result.message || 'Failed to delete policy');
      }

      router.push('/policies');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const handleToggleEnabled = async () => {
    if (!policy) return;
    
    try {
      const response = await fetch(`/api/v1/policies/${params.policyId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...policy,
          enabled: !policy.enabled
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update policy');
      }

      const json = await response.json();
      const result = new JsonResponseFetch<PolicyData>(json, 'policy');
      if (!result.isSuccess()) {
        throw new Error(result.message || 'Failed to update policy');
      }
      setPolicy(result.payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  if (!policy) {
    return <div>Policy not found</div>;
  }

  // When editing, show the full PolicyDetails component without tabs
  if (isEditing) {
    return (
      <div className="space-y-6">
        <PolicyDetails 
          policy={policy} 
          onEdit={handleSavePolicy}
          onDelete={handleDeletePolicy}
          onToggleEnabled={handleToggleEnabled}
          onCancel={handleCancelEdit}
        />
      </div>
    );
  }

  // When not editing, show header, tabs, and content
  return (
    <div className="space-y-6">
      <PolicyHeader
        policy={policy}
        onEdit={handleEdit}
        onDelete={handleDeletePolicy}
        onToggleEnabled={handleToggleEnabled}
      />
      <PolicyTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        policyId={Number(params.policyId)}
      />
      {activeTab === 'details' && (
        <PolicyDetailsTab
          policy={policy}
        />
      )}
      {activeTab === 'alerts' && (
        <AlertsSection
          initialFilters={{
            policyId: Number(params.policyId)
          }}
        />
      )}
    </div>
  );
} 