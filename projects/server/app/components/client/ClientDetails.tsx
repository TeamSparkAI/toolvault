import React, { useState, useEffect } from 'react';
import { useDialog } from '@/app/hooks/useDialog';
import { useNavigationGuard } from '@/app/hooks/useNavigationGuard';
import { Client } from '@/lib/models/types/client';

type NewClient = Omit<Client, 'clientId'>;

type ClientDetailsProps =
  | { clientName?: string; client: Client; onEdit: (updatedClient: Omit<Client, 'clientId' | 'lastUpdated' | 'token'>) => void; onDelete?: () => void; onToggleEnabled?: () => void; onCancel?: () => void; isNewClient?: false }
  | { clientName?: string; client: NewClient; onEdit: (updatedClient: Omit<Client, 'clientId' | 'lastUpdated' | 'token'>) => void; onDelete?: () => void; onToggleEnabled?: () => void; onCancel?: () => void; isNewClient: true };

export function ClientDetails({
  clientName,
  client,
  onEdit,
  onDelete,
  onToggleEnabled,
  onCancel,
  isNewClient = false
}: ClientDetailsProps) {
  const [editedClient, setEditedClient] = useState<Omit<Client, 'clientId' | 'lastUpdated' | 'token'>>({
    type: client.type,
    scope: client.scope,
    name: client.name,
    description: client.description,
    configPath: client.configPath,
    autoUpdate: client.autoUpdate,
    enabled: client.enabled,
  });
  const [showValidationAlert, setShowValidationAlert] = useState(false);
  const { confirm, alert } = useDialog();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEditedClient({
      type: client.type,
      scope: client.scope,
      name: client.name,
      description: client.description,
      configPath: client.configPath,
      autoUpdate: client.autoUpdate,
      enabled: client.enabled,
    });
  }, [client]);

  useNavigationGuard(
    true, // Always in editing mode
    async () => {
      const confirmed = await confirm('You have unsaved changes. Are you sure you want to leave?', 'Unsaved Changes');
      return confirmed;
    }
  );

  const handleSave = async () => {
    // Validate required fields
    if (!editedClient.name.trim() || !editedClient.type) {
      setShowValidationAlert(true);
      return;
    }

    try {
      await onEdit(editedClient);
      setShowValidationAlert(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const handleCancel = () => {
    setEditedClient({
      type: client.type,
      scope: client.scope,
      name: client.name,
      description: client.description,
      configPath: client.configPath,
      autoUpdate: client.autoUpdate,
      enabled: client.enabled,
    });
  };

  return (
    <div className="bg-white shadow rounded-lg">
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
                    {!editedClient.name.trim() && (
                      <li>Client name is required</li>
                    )}
                    {!editedClient.type && (
                      <li>Client type is required</li>
                    )}
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
                  value={editedClient.name}
                  onChange={(e) => setEditedClient({ ...editedClient, name: e.target.value })}
                  className={`text-lg font-medium text-gray-900 border rounded px-2 py-1 w-full ${
                    editedClient.name.trim() === '' ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Enter client name"
                  required
                />
                {editedClient.name.trim() === '' && (
                  <p className="mt-1 text-sm text-red-600">Client name is required</p>
                )}
              </div>
            </div>
            <textarea
              value={editedClient.description || ''}
              onChange={(e) => setEditedClient({ ...editedClient, description: e.target.value || null })}
              className="mt-1 text-sm text-gray-500 border rounded px-2 py-1 w-full"
              rows={3}
              placeholder="Describe this client"
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
            <dt className="text-sm font-medium text-gray-500">Type</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:mt-0">
              <select
                value={editedClient.type}
                onChange={(e) => setEditedClient({ ...editedClient, type: e.target.value as Client['type'] })}
                className="mt-1 block rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm w-auto min-w-[150px]"
                required
              >
                <option value="">Select a type</option>
                <option value="cursor">Cursor</option>
                <option value="windsurf">Windsurf</option>
                <option value="claudecode">Claude Code</option>
                <option value="roocode">Roo Code</option>
                <option value="vscode">VSCode</option>
                <option value="generic">Generic</option>
              </select>
            </dd>
          </div>
          <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-[120px_1fr] sm:gap-4 sm:px-6">
            <dt className="text-sm font-medium text-gray-500">Config Path</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:mt-0">
              <input
                type="text"
                value={editedClient.configPath || ''}
                onChange={(e) => setEditedClient({ ...editedClient, configPath: e.target.value || null })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                placeholder="Enter config path"
              />
            </dd>
          </div>
          <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-[120px_1fr] sm:gap-4 sm:px-6">
            <dt className="text-sm font-medium text-gray-500">Auto Update</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:mt-0">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={editedClient.autoUpdate}
                  onChange={(e) => setEditedClient({ ...editedClient, autoUpdate: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label className="ml-2 block text-sm text-gray-900">
                  Enable auto update
                </label>
              </div>
            </dd>
          </div>
          <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-[120px_1fr] sm:gap-4 sm:px-6">
            <dt className="text-sm font-medium text-gray-500">Enabled</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:mt-0">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={editedClient.enabled}
                  onChange={(e) => setEditedClient({ ...editedClient, enabled: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label className="ml-2 block text-sm text-gray-900">
                  Enable this client
                </label>
              </div>
            </dd>
          </div>

        </dl>
      </div>
    </div>
  );
} 