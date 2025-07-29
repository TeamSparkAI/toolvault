import { useState, useEffect } from 'react';
import { AppSettingsData } from '@/lib/models/types/appSettings';

interface EditAppSettingsModalProps {
  settings: AppSettingsData | null;
  onSave: (settings: AppSettingsData) => void;
  onCancel: () => void;
}

export default function EditAppSettingsModal({ settings, onSave, onCancel }: EditAppSettingsModalProps) {
  const [requireClientToken, setRequireClientToken] = useState(settings?.requireClientToken || false);
  const [strictServerAccess, setStrictServerAccess] = useState(settings?.strictServerAccess || false);
  const [messageRetentionDays, setMessageRetentionDays] = useState(settings?.messageRetentionDays || 30);
  const [alertRetentionDays, setAlertRetentionDays] = useState(settings?.alertRetentionDays || 30);

  useEffect(() => {
    if (settings) {
      setRequireClientToken(settings.requireClientToken);
      setStrictServerAccess(settings.strictServerAccess);
      setMessageRetentionDays(settings.messageRetentionDays);
      setAlertRetentionDays(settings.alertRetentionDays);
    }
  }, [settings]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      requireClientToken,
      strictServerAccess,
      messageRetentionDays,
      alertRetentionDays
    });
  };

  return (
    <>
      <h2 className="text-xl font-bold mb-4">Edit Application Settings</h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center">
          <input
            type="checkbox"
            id="requireClientToken"
            checked={requireClientToken}
            onChange={(e) => setRequireClientToken(e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="requireClientToken" className="ml-2 block text-sm text-gray-900">
            Require Client Token
          </label>
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            id="strictServerAccess"
            checked={strictServerAccess}
            onChange={(e) => setStrictServerAccess(e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="strictServerAccess" className="ml-2 block text-sm text-gray-900">
            Strict Server Access
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Message Retention (days)
          </label>
          <input
            type="number"
            value={messageRetentionDays}
            onChange={(e) => setMessageRetentionDays(parseInt(e.target.value))}
            min="1"
            className="w-full p-2 border rounded"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Alert Retention (days)
          </label>
          <input
            type="number"
            value={alertRetentionDays}
            onChange={(e) => setAlertRetentionDays(parseInt(e.target.value))}
            min="1"
            className="w-full p-2 border rounded"
          />
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