import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSeverityOptions } from '@/lib/severity';
import { PolicyActionType, PolicyData } from '@/lib/models/types/policy';
import { useDialog } from '@/app/hooks/useDialog';
import { useNavigationGuard } from '@/app/hooks/useNavigationGuard';
import { MCP_METHODS_BY_CATEGORY, getMcpMethodCategories } from '@/lib/types/mcpMethod';

type Filter = PolicyData['filters'][0];

interface PolicyDetailsProps {
  policy: Omit<PolicyData, 'policyId' | 'createdAt' | 'updatedAt'>;
  onEdit: (updatedPolicy: Omit<PolicyData, 'policyId' | 'createdAt' | 'updatedAt'>) => void;
  onDelete?: () => void;
  onToggleEnabled?: () => void;
  onCancel?: () => void;
  isNewPolicy?: boolean;
}

export function PolicyDetails({ 
  policy,
  onEdit, 
  onDelete, 
  onToggleEnabled,
  onCancel,
  isNewPolicy = false 
}: PolicyDetailsProps) {
  const router = useRouter();
  const [editedPolicy, setEditedPolicy] = useState(policy);
  const [editingFilterIndex, setEditingFilterIndex] = useState<number | null>(null);
  const [showValidationAlert, setShowValidationAlert] = useState(false);
  const { confirm } = useDialog();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEditedPolicy(prev => ({
      ...prev,
      filters: prev.filters.map(f => ({
        ...f,
        keywords: f.keywords || [],
        validator: f.validator || 'none'
      }))
    }));
  }, []);

  useEffect(() => {
    setEditedPolicy(policy);
  }, [policy]);

  useNavigationGuard(
    true, // Always in editing mode
    async () => {
      const confirmed = await confirm('You have unsaved changes. Are you sure you want to leave?', 'Unsaved Changes');
      return confirmed;
    }
  );

  const handleSave = async () => {
    // Validate required fields
    if (!editedPolicy.name) {
      setShowValidationAlert(true);
      return;
    }

    try {
      await onEdit(editedPolicy);
      setEditingFilterIndex(null);
      setShowValidationAlert(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const handleCancel = () => {
    setEditedPolicy(policy);
    setEditingFilterIndex(null);
  };

  const handleAddFilter = () => {
    const newFilter: Filter = {
      name: '',
      regex: '',
      keywords: [],
      validator: 'none'
    };
    setEditedPolicy({
      ...editedPolicy,
      filters: [...editedPolicy.filters, newFilter]
    });
    setEditingFilterIndex(editedPolicy.filters.length);
  };

  const handleUpdateFilter = (index: number, updatedFilter: Partial<Filter>) => {
    const newFilters = [...editedPolicy.filters];
    newFilters[index] = {
      ...newFilters[index],
      ...updatedFilter,
      keywords: updatedFilter.keywords || newFilters[index].keywords || [],
      validator: updatedFilter.validator || newFilters[index].validator || 'none'
    };
    setEditedPolicy({
      ...editedPolicy,
      filters: newFilters
    });
  };

  const handleRemoveFilter = (index: number) => {
    const newFilters = editedPolicy.filters.filter((_, i) => i !== index);
    setEditedPolicy({
      ...editedPolicy,
      filters: newFilters
    });
  };

  const handleDelete = async () => {
    const confirmed = await confirm(`Are you sure you want to delete policy "${policy.name}"?`, 'Delete Policy');
    if (confirmed) {
      onDelete?.();
    }
  };

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-lg">
      {showValidationAlert && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-medium text-gray-900">Required Fields Missing</h3>
                <div className="mt-2 text-sm text-gray-500">
                  <p>Please fill in all required fields before saving:</p>
                  <ul className="list-disc pl-5 mt-2">
                    {!editedPolicy.name.trim() && (
                      <li>Policy name is required</li>
                    )}
                    {editedPolicy.filters.map((filter, index) => {
                      const missingFields = [];
                      if (!filter.name.trim()) missingFields.push('name');
                      if (!filter.regex.trim()) missingFields.push('regex pattern');
                      if (missingFields.length > 0) {
                        return (
                          <li key={index}>
                            Filter {index + 1}: Missing {missingFields.join(' and ')}
                          </li>
                        );
                      }
                      return null;
                    }).filter(Boolean)}
                  </ul>
                </div>
              </div>
            </div>
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setShowValidationAlert(false)}
                className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:text-sm"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="px-4 py-5 sm:px-6">
        <div className="flex justify-between items-start">
          <div className="flex-grow pr-4">
            <div className="flex items-baseline gap-2">
              <div className="flex-grow">
                <input
                  type="text"
                  value={editedPolicy.name}
                  onChange={(e) => setEditedPolicy({ ...editedPolicy, name: e.target.value })}
                  className={`text-lg font-medium text-gray-900 border rounded px-2 py-1 w-full ${
                    editedPolicy.name.trim() === '' ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Enter policy name"
                  required
                />
                {editedPolicy.name.trim() === '' && (
                  <p className="mt-1 text-sm text-red-600">Policy name is required</p>
                )}
              </div>
            </div>
            <textarea
              value={editedPolicy.description || ''}
              onChange={(e) => setEditedPolicy({ ...editedPolicy, description: e.target.value || undefined })}
              className="mt-1 text-sm text-gray-500 border rounded px-2 py-1 w-full"
              rows={3}
              placeholder="Describe what this policy does and what it protects against"
            />
          </div>
          <div className="flex-shrink-0 space-x-4">
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Save
            </button>
            <button
              onClick={onCancel || handleCancel}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
      <div className="border-t border-gray-200">
        <dl>
          <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-[120px_1fr] sm:gap-4 sm:px-6">
            <dt className="text-sm font-medium text-gray-500">Severity</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:mt-0">
              <select
                value={editedPolicy.severity}
                onChange={(e) => setEditedPolicy({ ...editedPolicy, severity: parseInt(e.target.value) })}
                className="mt-1 block rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm w-auto min-w-[150px]"
              >
                {getSeverityOptions().map(option => (
                  <option key={option.value} value={option.value}>
                    {option.value} - {option.label}
                  </option>
                ))}
              </select>
            </dd>
          </div>
          <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-[120px_1fr] sm:gap-4 sm:px-6">
            <dt className="text-sm font-medium text-gray-500">Origin</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:mt-0">
              <select
                value={editedPolicy.origin}
                onChange={(e) => setEditedPolicy({ ...editedPolicy, origin: e.target.value as 'client' | 'server' | 'either' })}
                className="mt-1 block rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm w-auto min-w-[150px]"
              >
                <option value="client">Client</option>
                <option value="server">Server</option>
                <option value="either">Either</option>
              </select>
            </dd>
          </div>
          <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-[120px_1fr] sm:gap-4 sm:px-6">
            <dt className="text-sm font-medium text-gray-500">Methods</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:mt-0">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Selected Methods</label>
                  <div className="mt-1 space-y-2">
                    {editedPolicy.methods?.map((method, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={method}
                          onChange={(e) => {
                            const newMethods = [...(editedPolicy.methods || [])];
                            newMethods[index] = e.target.value;
                            setEditedPolicy({ ...editedPolicy, methods: newMethods });
                          }}
                          className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                          placeholder="Enter method name"
                        />
                        <button
                          onClick={() => {
                            const newMethods = editedPolicy.methods?.filter((_, i) => i !== index) || [];
                            setEditedPolicy({ ...editedPolicy, methods: newMethods });
                          }}
                          className="p-1 text-red-600 hover:text-red-800"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <div className="relative">
                        <select
                          onChange={(e) => {
                            if (e.target.value) {
                              const newMethods = [...(editedPolicy.methods || []), e.target.value];
                              setEditedPolicy({ ...editedPolicy, methods: newMethods });
                              e.target.value = '';
                            }
                          }}
                          className="inline-flex items-center px-2 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          <option value="">Add MCP Method...</option>
                          {getMcpMethodCategories().map(category => (
                            <optgroup key={category} label={category}>
                              {MCP_METHODS_BY_CATEGORY[category].map(method => (
                                <option key={method.value} value={method.value}>
                                  {method.value}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      </div>
                      <button
                        onClick={() => {
                          const newMethods = [...(editedPolicy.methods || []), ''];
                          setEditedPolicy({ ...editedPolicy, methods: newMethods });
                        }}
                        className="inline-flex items-center px-2 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        <svg className="-ml-0.5 mr-1 h-3 w-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                        </svg>
                        Add Custom Method
                      </button>
                    </div>
                  </div>
                </div>
                <div className="text-xs text-gray-500">
                  Leave empty or remove all methods to apply to all methods. Use the dropdown to add common MCP methods.
                </div>
              </div>
            </dd>
          </div>
          <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-[120px_1fr] sm:gap-4 sm:px-6">
            <dt className="text-sm font-medium text-gray-500">Action</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:mt-0">
              <div className="space-y-2">
                <select
                  value={editedPolicy.action}
                  onChange={(e) => setEditedPolicy({ ...editedPolicy, action: e.target.value as PolicyActionType })}
                  className="mt-1 block rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm w-auto min-w-[200px]"
                >
                  <option value="remove">Remove</option>
                  <option value="redact">Redact</option>
                  <option value="redactPattern">Redact Pattern</option>
                  <option value="replace">Replace</option>
                  <option value="none">None</option>
                </select>
                <input
                  type="text"
                  value={editedPolicy.actionText || ''}
                  onChange={(e) => setEditedPolicy({ ...editedPolicy, actionText: e.target.value || undefined })}
                  placeholder="Action text (optional)"
                  className="mt-1 block rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm w-full"
                />
              </div>
            </dd>
          </div>
          <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-[120px_1fr] sm:gap-4 sm:px-6">
            <dt className="text-sm font-medium text-gray-500">Filters</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:mt-0">
              <div className="space-y-4">
                {editedPolicy.filters.map((filter, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-grow space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Name <span className="text-red-500">*</span></label>
                          <input
                            type="text"
                            value={filter.name}
                            onChange={(e) => handleUpdateFilter(index, { ...filter, name: e.target.value })}
                            className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${
                              filter.name.trim() === '' ? 'border-red-300' : ''
                            }`}
                            placeholder="Enter filter name"
                            required
                          />
                          {filter.name.trim() === '' && (
                            <p className="mt-1 text-sm text-red-600">Filter name is required</p>
                          )}
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Regex Pattern <span className="text-red-500">*</span></label>
                          <input
                            type="text"
                            value={filter.regex}
                            onChange={(e) => handleUpdateFilter(index, { ...filter, regex: e.target.value })}
                            className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${
                              filter.regex.trim() === '' ? 'border-red-300' : ''
                            }`}
                            placeholder="Enter regex pattern"
                            required
                          />
                          {filter.regex.trim() === '' && (
                            <p className="mt-1 text-sm text-red-600">Regex pattern is required</p>
                          )}
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Notes</label>
                          <textarea
                            value={filter.notes || ''}
                            onChange={(e) => handleUpdateFilter(index, { ...filter, notes: e.target.value || undefined })}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                            rows={2}
                            placeholder="Add notes about this filter"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Keywords</label>
                          <input
                            type="text"
                            value={filter.keywords?.join(', ') || ''}
                            onChange={(e) => handleUpdateFilter(index, { 
                              ...filter, 
                              keywords: e.target.value.split(',').map(k => k.trim()).filter(Boolean)
                            })}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                            placeholder="Enter keywords (comma-separated)"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Validator</label>
                          <select
                            value={filter.validator}
                            onChange={(e) => handleUpdateFilter(index, { ...filter, validator: e.target.value as 'none' | 'luhn' })}
                            className="mt-1 block rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm w-auto min-w-[150px]"
                          >
                            <option value="none">None</option>
                            <option value="luhn">Luhn</option>
                          </select>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveFilter(index)}
                        className="ml-4 p-2 text-red-600 hover:text-red-800"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  onClick={handleAddFilter}
                  className="mt-2 inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <svg className="-ml-0.5 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                  </svg>
                  Add Filter
                </button>
              </div>
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
} 