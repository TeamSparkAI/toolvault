import React, { useState } from 'react';
import { PolicyCondition, PolicyAction } from '@/lib/models/types/policy';
import { PolicyElementData } from '@/lib/models/types/policyElement';
import { usePolicyElements } from '@/app/hooks/usePolicyElements';
import { getDefaultParams } from './schemaUtils';
import { generateBase32Id } from '@/lib/utils/id';

interface AddConditionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (condition: PolicyCondition) => void;
  title: string;
}

interface AddActionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (action: PolicyAction) => void;
  title: string;
}

export function AddConditionDialog({ isOpen, onClose, onAdd, title }: AddConditionDialogProps) {
  const [selectedElement, setSelectedElement] = useState<PolicyElementData | null>(null);
  const { elements: availableElements, loading, error } = usePolicyElements('condition');
  
  const handleAdd = () => {
    if (!selectedElement) return;
    
    const newCondition: PolicyCondition = {
      elementClassName: selectedElement.className,
      elementConfigId: selectedElement.configId,
      instanceId: generateBase32Id(),
      name: '',
      notes: '',
      params: selectedElement.paramsSchema ? getDefaultParams(selectedElement.paramsSchema) : {}
    };
    
    onAdd(newCondition);
    onClose();
    setSelectedElement(null);
  };

  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Type</label>
            {loading ? (
              <div className="mt-1 text-sm text-gray-500">Loading...</div>
            ) : error ? (
              <div className="mt-1 text-sm text-red-500">Error: {error}</div>
            ) : (
              <select 
                value={selectedElement?.configId || ''} 
                onChange={(e) => {
                  const element = availableElements.find(el => el.configId === parseInt(e.target.value));
                  setSelectedElement(element || null);
                }}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm"
              >
                <option value="">Select a condition type...</option>
                {availableElements.map(element => (
                  <option key={element.configId} value={element.configId}>
                    {element.name} - {element.description}
                  </option>
                ))}
              </select>
            )}
          </div>
          
          <div className="h-20">
            {selectedElement && (
              <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                <p><strong>Description:</strong> {selectedElement.description}</p>
                {selectedElement.paramsSchema && (
                  <p><strong>Parameters:</strong> {Object.keys(selectedElement.paramsSchema.properties || {}).join(', ')}</p>
                )}
              </div>
            )}
          </div>
        </div>
        
        <div className="mt-6 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={!selectedElement}
            className="px-4 py-2 bg-blue-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

export function AddActionDialog({ isOpen, onClose, onAdd, title }: AddActionDialogProps) {
  const [selectedElement, setSelectedElement] = useState<PolicyElementData | null>(null);
  const { elements: availableElements, loading, error } = usePolicyElements('action');
  
  const handleAdd = () => {
    if (!selectedElement) return;
    
    const newAction: PolicyAction = {
      elementClassName: selectedElement.className,
      elementConfigId: selectedElement.configId,
      instanceId: generateBase32Id(),
      params: selectedElement.paramsSchema ? getDefaultParams(selectedElement.paramsSchema) : {}
    };
    
    onAdd(newAction);
    onClose();
    setSelectedElement(null);
  };

  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Type</label>
            {loading ? (
              <div className="mt-1 text-sm text-gray-500">Loading...</div>
            ) : error ? (
              <div className="mt-1 text-sm text-red-500">Error: {error}</div>
            ) : (
              <select 
                value={selectedElement?.configId || ''} 
                onChange={(e) => {
                  const element = availableElements.find(el => el.configId === parseInt(e.target.value));
                  setSelectedElement(element || null);
                }}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm"
              >
                <option value="">Select an action type...</option>
                {availableElements.map(element => (
                  <option key={element.configId} value={element.configId}>
                    {element.name} - {element.description}
                  </option>
                ))}
              </select>
            )}
          </div>
          
          <div className="h-20">
            {selectedElement && (
              <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                <p><strong>Description:</strong> {selectedElement.description}</p>
                {selectedElement.paramsSchema && (
                  <p><strong>Parameters:</strong> {Object.keys(selectedElement.paramsSchema.properties || {}).join(', ')}</p>
                )}
              </div>
            )}
          </div>
        </div>
        
        <div className="mt-6 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={!selectedElement}
            className="px-4 py-2 bg-blue-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
