'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { JsonResponseFetch } from '@/lib/jsonResponse';
import { useLayout } from '@/app/contexts/LayoutContext';
import { useModal } from '@/app/contexts/ModalContext';
import { getSeverityLevel } from '@/lib/severity';
import React from 'react';
import { StatusBadge } from '@/app/components/common/StatusBadge';
import { PolicyData } from '@/lib/models/types/policy';

export default function PoliciesPage() {
  const router = useRouter();
  const { setHeaderAction } = useLayout();
  const { setModalContent } = useModal();
  const [policies, setPolicies] = useState<PolicyData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<'name' | 'severity' | 'status' | 'updatedAt'>('severity');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    setHeaderAction(
      <button
        onClick={() => router.push('/policies/new')}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Add Policy
      </button>
    );

    return () => setHeaderAction(null);
  }, [setHeaderAction, router]);

  useEffect(() => {
    fetchPolicies();
  }, []);

  const fetchPolicies = async () => {
    try {
      const response = await fetch('/api/v1/policies');
      if (!response.ok) {
        throw new Error('Failed to fetch policies');
      }

      const json = await response.json();
      const result = new JsonResponseFetch<PolicyData[]>(json, 'policies');
      if (!result.isSuccess()) {
        throw new Error(result.message || 'Failed to fetch policies');
      }
      setPolicies(result.payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeletePolicy = async (policyId: number) => {
    if (!confirm('Are you sure you want to delete this policy?')) {
      return;
    }

    try {
      const response = await fetch(`/api/v1/policies/${policyId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete policy');
      }

      setPolicies(policies.filter((p) => p.policyId !== policyId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  // Sorting logic
  const sortedPolicies = [...policies].sort((a, b) => {
    let aValue, bValue;
    switch (sortColumn) {
      case 'name':
        aValue = a.name.toLowerCase();
        bValue = b.name.toLowerCase();
        break;
      case 'severity':
        aValue = a.severity;
        bValue = b.severity;
        break;
      case 'status':
        aValue = a.enabled ? 1 : 0;
        bValue = b.enabled ? 1 : 0;
        break;
      case 'updatedAt':
        aValue = new Date(a.updatedAt).getTime();
        bValue = new Date(b.updatedAt).getTime();
        break;
      default:
        aValue = '';
        bValue = '';
    }
    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    // Secondary sort by name (ascending, case-insensitive)
    if (sortColumn !== 'name') {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();
      if (aName < bName) return -1;
      if (aName > bName) return 1;
    }
    return 0;
  });

  const handleSort = (column: 'name' | 'severity' | 'status' | 'updatedAt') => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const SortIcon = ({ column }: { column: 'name' | 'severity' | 'status' | 'updatedAt' }) => {
    if (sortColumn !== column) return null;
    return (
      <span className="ml-1">
        {sortDirection === 'asc' ? '↑' : '↓'}
      </span>
    );
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th 
                scope="col" 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center">
                  Name
                  <SortIcon column="name" />
                </div>
              </th>
              <th 
                scope="col" 
                className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSort('severity')}
              >
                <div className="flex items-center">
                  Severity
                  <SortIcon column="severity" />
                </div>
              </th>
              <th 
                scope="col" 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSort('status')}
              >
                <div className="flex items-center">
                  Status
                  <SortIcon column="status" />
                </div>
              </th>
              <th 
                scope="col" 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSort('updatedAt')}
              >
                <div className="flex items-center">
                  Last Updated
                  <SortIcon column="updatedAt" />
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedPolicies.map((policy) => (
              <tr
                key={policy.policyId}
                onClick={() => router.push(`/policies/${policy.policyId}`)}
                className="hover:bg-gray-50 cursor-pointer"
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center">
                      {React.cloneElement(getSeverityLevel(policy.severity).icon as React.ReactElement, { size: 'lg' })}
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">{policy.name}</div>
                      <div className="text-sm text-gray-500">{policy.description || 'No description'}</div>
                    </div>
                  </div>
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                  <div className="flex items-center">
                    <span className="font-medium">{policy.severity} - {getSeverityLevel(policy.severity).name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <StatusBadge enabled={policy.enabled} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(policy.updatedAt).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
} 