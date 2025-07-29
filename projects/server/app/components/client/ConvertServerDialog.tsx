import React, { useState } from 'react';

interface ConvertServerDialogProps {
  isOpen: boolean;
  onConfirm: (convertWrapping: boolean) => void;
  onCancel: () => void;
  serverName?: string;
  count?: number;
}

export function ConvertServerDialog({
  isOpen,
  onConfirm,
  onCancel,
  serverName,
  count,
}: ConvertServerDialogProps) {
  const [convertWrapping, setConvertWrapping] = useState(false);

  if (!isOpen) return null;

  const isBulk = typeof count === 'number' && count > 1;
  const title = isBulk
    ? `Convert All Unmanaged Servers`
    : `Convert Server`;
  const message = isBulk
    ? `Are you sure you want to convert all ${count} unmanaged servers to managed?`
    : `Are you sure you want to convert server "${serverName}" to managed?`;

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h2 className="text-xl font-bold mb-4">{title}</h2>
        <p className="text-gray-700 mb-4">{message}</p>
        <div>
          <label className="flex items-center">
            <input
              type="checkbox"
              id="convertWrapping"
              checked={convertWrapping}
              onChange={e => setConvertWrapping(e.target.checked)}
              className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span className="text-sm font-medium text-gray-700">
              {isBulk ? 'Run converted servers in container' : 'Run converted server in container'}
            </span>
          </label>
          <p className="text-sm ml-6 mt-1 text-gray-500">
            {isBulk ? 'Run converted managed servers in containers when possible.' : 'Run converted managed server in container when possible.'}
          </p>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(convertWrapping)}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Convert
          </button>
        </div>
      </div>
    </div>
  );
} 