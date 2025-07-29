import { useState, useEffect } from 'react';
import { HostData } from '@/lib/models/types/host';

interface EditHostModalProps {
  host: HostData | null;
  onSave: (host: HostData) => void;
  onCancel: () => void;
}

export default function EditHostModal({ host, onSave, onCancel }: EditHostModalProps) {
  const [hostValue, setHostValue] = useState(host?.host || '');
  const [port, setPort] = useState(host?.port || 3000);

  useEffect(() => {
    if (host) {
      setHostValue(host.host || '');
      setPort(host.port);
    }
  }, [host]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      type: 'sse',
      host: hostValue || undefined,
      port
    });
  };

  return (
    <>
      <h2 className="text-xl font-bold mb-4">Edit Gateway Host Settings</h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">


        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Host
          </label>
          <input
            type="text"
            value={hostValue}
            onChange={(e) => setHostValue(e.target.value)}
            placeholder="localhost"
            className="w-full p-2 border rounded"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Port
          </label>
          <input
            type="number"
            value={port}
            onChange={(e) => setPort(parseInt(e.target.value))}
            min="0"
            max="65535"
            className="w-full p-2 border rounded"
          />
          <p className="text-xs text-gray-500 mt-1">
            Use 0 to auto-select an available port
          </p>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Save
          </button>
        </div>
      </form>
    </>
  );
} 