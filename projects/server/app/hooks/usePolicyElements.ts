import { useState, useEffect } from 'react';
import { JsonResponseFetch } from '@/lib/jsonResponse';
import { PolicyElementData, PolicyElementType } from '@/lib/models/types/policyElement';

export function usePolicyElements(elementType?: PolicyElementType) {
  const [elements, setElements] = useState<PolicyElementData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchElements = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const url = elementType 
          ? `/api/v1/policyElements?elementType=${elementType}`
          : '/api/v1/policyElements';
          
        const response = await fetch(url);
        const json = await response.json();
        const result = new JsonResponseFetch<PolicyElementData[]>(json, 'policyElements');
        
        if (!result.isSuccess()) {
          throw new Error(result.message || 'Failed to fetch policy elements');
        }
        
        setElements(result.payload);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchElements();
  }, [elementType]);

  return { elements, loading, error };
}
