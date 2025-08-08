import React, { useState } from 'react';
import { useDialog } from '@/app/hooks/useDialog';
import { Client } from '@/lib/models/types/client';

interface ClientDetailsTabProps {
  client: Client;
}

export function ClientDetailsTab({ client }: ClientDetailsTabProps) {
  const { alert } = useDialog();
  const [showToken, setShowToken] = useState(false);

  // Obfuscate token as XXXX-XXXX-XXXX
  const obfuscatedToken = client.token?.replace(/[A-Z0-9]/g, 'X') || '';

  if (client.type === 'ttv') {
    return (
      <div className="bg-white shadow rounded-lg p-8 text-center">
        <h2 className="text-xl font-semibold mb-4">ToolVault Internal Client</h2>
        <p className="text-gray-700 mb-2">
          This is the <strong>internal test client</strong> used to ping or test tools within <strong>ToolVault</strong>.
        </p>
        <p className="text-gray-700 mb-2">
          It <strong>cannot be edited, deleted, or disabled</strong>.
        </p>
        <p className="text-gray-700 mb-2">
          It does not have server relationships because it can be used with <strong>all servers</strong> (but only from within ToolVault).
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="border-t border-gray-200">
        <dl>
          {client.token && (
            <div className="bg-white even:bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-[120px_1fr] sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Token</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 flex items-center gap-4">
                <span className="font-mono select-all">{showToken ? client.token : obfuscatedToken}</span>
                <button
                  className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                  onClick={() => setShowToken((v) => !v)}
                >
                  {showToken ? 'Hide' : 'Reveal'}
                </button>
              </dd>
            </div>
          )}
          <div className="bg-white even:bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-[120px_1fr] sm:gap-4 sm:px-6">
            <dt className="text-sm font-medium text-gray-500">Type</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:mt-0">{client.type}</dd>
          </div>
          <div className="bg-white even:bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-[120px_1fr] sm:gap-4 sm:px-6">
            <dt className="text-sm font-medium text-gray-500">Config Path</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:mt-0">
              {client.configPath ? (
                client.configPath
              ) : (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                  Unlinked
                </span>
              )}
            </dd>
          </div>
          <div className="bg-white even:bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-[120px_1fr] sm:gap-4 sm:px-6">
            <dt className="text-sm font-medium text-gray-500">Auto Update</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:mt-0">{client.autoUpdate ? 'Yes' : 'No'}</dd>
          </div>
          {(client.configPath || client.lastScanned || client.lastUpdated) && (
            <>
              <div className="bg-white even:bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-[120px_1fr] sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Last Scanned</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0">
                  {client.lastScanned ? new Date(client.lastScanned).toLocaleString() : 'Never'}
                </dd>
              </div>
              <div className="bg-white even:bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-[120px_1fr] sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Last Updated</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0">
                  {client.lastUpdated ? new Date(client.lastUpdated).toLocaleString() : 'Never'}
                </dd>
              </div>
            </>
          )}
        </dl>
      </div>
    </div>
  );
} 