'use client';

import { useEffect } from 'react';
import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';

interface SwaggerUIWrapperProps {
  spec: any;
}

export default function SwaggerUIWrapper({ spec }: SwaggerUIWrapperProps) {
  useEffect(() => {
    // Import styles only on client side
    import('swagger-ui-react/swagger-ui.css');
  }, []);

  return <SwaggerUI spec={spec} />;
} 