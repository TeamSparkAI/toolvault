import React from 'react';

interface DialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  type?: 'alert' | 'confirm';
  onConfirm: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
}

export function Dialog({
  isOpen,
  title,
  message,
  type = 'alert',
  onConfirm,
  onCancel,
  confirmText = 'OK',
  cancelText = 'Cancel',
}: DialogProps) {
  if (!isOpen) return null;

  return (
    <>
      <h2 className="text-xl font-bold mb-4">{title}</h2>
      <p className="text-gray-600 mb-6">{message}</p>
      <div className="flex justify-end gap-3">
        {type === 'confirm' && onCancel && (
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            {cancelText}
          </button>
        )}
        <button
          onClick={onConfirm}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          {confirmText}
        </button>
      </div>
    </>
  );
} 