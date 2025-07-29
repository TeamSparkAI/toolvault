import { useCallback } from 'react';
import { Dialog } from '../components/Dialog';
import { useModal } from '../contexts/ModalContext';

interface DialogState {
  isOpen: boolean;
  title: string;
  message: string;
  type: 'alert' | 'confirm';
  onConfirm: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
}

export function useDialog() {
  const { setModalContent } = useModal();

  const alert = useCallback((message: string, title = 'Alert') => {
    return new Promise<void>((resolve) => {
      setModalContent(
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
          <Dialog
            isOpen={true}
            title={title}
            message={message}
            type="alert"
            onConfirm={() => {
              setModalContent(null);
              resolve();
            }}
          />
        </div>
      );
    });
  }, [setModalContent]);

  const confirm = useCallback((message: string, title = 'Confirm') => {
    return new Promise<boolean>((resolve) => {
      setModalContent(
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
          <Dialog
            isOpen={true}
            title={title}
            message={message}
            type="confirm"
            onConfirm={() => {
              setModalContent(null);
              resolve(true);
            }}
            onCancel={() => {
              setModalContent(null);
              resolve(false);
            }}
          />
        </div>
      );
    });
  }, [setModalContent]);

  return { alert, confirm };
} 