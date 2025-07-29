import React, { useState } from 'react';

interface HideRevealProps {
  value: string;
  obfuscate?: (value: string) => string;
  className?: string;
}

const defaultObfuscate = (value: string) => value.replace(/./g, '•');

export const HideReveal: React.FC<HideRevealProps> = ({ value, obfuscate = defaultObfuscate, className }) => {
  const [show, setShow] = useState(false);
  return (
    <span className={className} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <span className="font-mono select-all">{show ? value : obfuscate(value)}</span>
      <button
        type="button"
        className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
        style={{ marginLeft: 6 }}
        onClick={() => setShow((v) => !v)}
        tabIndex={0}
      >
        {show ? 'Hide' : 'Reveal'}
      </button>
    </span>
  );
}; 