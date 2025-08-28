import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSeverityOptions } from '@/lib/severity';
import { PolicyActionType, PolicyData, PolicyCondition, PolicyAction } from '@/lib/models/types/policy';
import { useDialog } from '@/app/hooks/useDialog';
import { useNavigationGuard } from '@/app/hooks/useNavigationGuard';
import { MCP_METHODS_BY_CATEGORY, getMcpMethodCategories } from '@/lib/types/mcpMethod';
import { ConditionEditor } from './ConditionEditor';
import { ActionEditor } from './ActionEditor';
import { AddConditionDialog, AddActionDialog } from './AddElementDialog';
import { validatePolicyElementParams } from '@/app/lib/validation';

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
  const [showAddConditionDialog, setShowAddConditionDialog] = useState(false);
  const [showAddActionDialog, setShowAddActionDialog] = useState(false);
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

    // Validate conditions
    const conditionErrors: string[] = [];
    for (let i = 0; i < editedPolicy.conditions.length; i++) {
      const condition = editedPolicy.conditions[i];
      if (!condition.name.trim()) {
        conditionErrors.push(`Condition ${i + 1}: Name is required`);
      }
      
      // Validate parameters via API
      const validation = await validatePolicyElementParams(condition.elementConfigId, condition.params);
      if (!validation.isValid) {
        conditionErrors.push(`Condition ${i + 1}: ${validation.errors[0]}`);
      }
    }

    // Validate actions
    const actionErrors: string[] = [];
    for (let i = 0; i < editedPolicy.actions.length; i++) {
      const action = editedPolicy.actions[i];
      
      // Validate parameters via API
      const validation = await validatePolicyElementParams(action.elementConfigId, action.params);
      if (!validation.isValid) {
        actionErrors.push(`Action ${i + 1}: ${validation.errors[0]}`);
      }
    }

    if (conditionErrors.length > 0 || actionErrors.length > 0) {
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

  const handleAddCondition = (condition: PolicyCondition) => {
    setEditedPolicy({
      ...editedPolicy,
      conditions: [...editedPolicy.conditions, condition]
    });
  };

  const handleUpdateCondition = (index: number, condition: PolicyCondition) => {
    const newConditions = [...editedPolicy.conditions];
    newConditions[index] = condition;
    setEditedPolicy({
      ...editedPolicy,
      conditions: newConditions
    });
  };

  const handleRemoveCondition = (index: number) => {
    setEditedPolicy({
      ...editedPolicy,
      conditions: editedPolicy.conditions.filter((_, i) => i !== index)
    });
  };

  const handleAddAction = (action: PolicyAction) => {
    setEditedPolicy({
      ...editedPolicy,
      actions: [...editedPolicy.actions, action]
    });
  };

  const handleUpdateAction = (index: number, action: PolicyAction) => {
    const newActions = [...editedPolicy.actions];
    newActions[index] = action;
    setEditedPolicy({
      ...editedPolicy,
      actions: newActions
    });
  };

  const handleRemoveAction = (index: number) => {
    setEditedPolicy({
      ...editedPolicy,
      actions: editedPolicy.actions.filter((_, i) => i !== index)
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
                    {editedPolicy.conditions.map((condition, index) => {
                      const errors = [];
                      if (!condition.name.trim()) errors.push('name is required');
                      
                      // Note: Parameter validation is handled in handleSave via API
                      // This is just for display purposes
                      
                      if (errors.length > 0) {
                        return (
                          <li key={`condition-${index}`}>
                            Condition {index + 1}: {errors.join(', ')}
                          </li>
                        );
                      }
                      return null;
                    }).filter(Boolean)}
                    {editedPolicy.actions.map((action, index) => {
                      // Note: Parameter validation is handled in handleSave via API
                      // This is just for display purposes
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
          <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-[120px_1fr] sm:gap-4 sm:px-6">
            <dt className="text-sm font-medium text-gray-500">Conditions</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:mt-0">
              <div className="space-y-4">
                {editedPolicy.conditions.map((condition, index) => (
                  <ConditionEditor
                    key={condition.instanceId}
                    condition={condition}
                    onUpdate={(updatedCondition) => handleUpdateCondition(index, updatedCondition)}
                    onRemove={() => handleRemoveCondition(index)}
                  />
                ))}
                <button
                  onClick={() => setShowAddConditionDialog(true)}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <svg className="-ml-0.5 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                  </svg>
                  Add Condition
                </button>
              </div>
            </dd>
          </div>
          <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-[120px_1fr] sm:gap-4 sm:px-6">
            <dt className="text-sm font-medium text-gray-500">Actions</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:mt-0">
              <div className="space-y-4">
                {editedPolicy.actions.map((action, index) => (
                  <ActionEditor
                    key={action.instanceId}
                    action={action}
                    onUpdate={(updatedAction) => handleUpdateAction(index, updatedAction)}
                    onRemove={() => handleRemoveAction(index)}
                  />
                ))}
                <button
                  onClick={() => setShowAddActionDialog(true)}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <svg className="-ml-0.5 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                  </svg>
                  Add Action
                </button>
              </div>
            </dd>
          </div>
        </dl>
      </div>
      
      {/* Dialogs */}
      <AddConditionDialog
        isOpen={showAddConditionDialog}
        onClose={() => setShowAddConditionDialog(false)}
        onAdd={handleAddCondition}
        title="Add Condition"
      />
      
      <AddActionDialog
        isOpen={showAddActionDialog}
        onClose={() => setShowAddActionDialog(false)}
        onAdd={handleAddAction}
        title="Add Action"
      />
    </div>
  );
} 