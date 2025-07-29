import React from 'react';

interface SecretEditFieldProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}

export const SecretEditField: React.FC<SecretEditFieldProps> = ({ value, onChange, placeholder = 'Secret Value', className }) => {
  const [show, setShow] = React.useState(false);
  return (
    <div className={`relative flex-1 ${className ?? ''}`}>
      <input
        type={show ? 'text' : 'password'}
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className="flex-1 p-2 border rounded w-full pr-10"
      />
      <button
        type="button"
        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
        onClick={() => setShow(v => !v)}
        tabIndex={0}
        aria-label={show ? 'Hide value' : 'Show value'}
      >
        {show ? (
          // Eye-off SVG
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-5.523 0-10-4.03-10-7 0-1.13.47-2.21 1.325-3.175M6.62 6.62A9.956 9.956 0 0112 5c5.523 0 10 4.03 10 7 0 1.13-.47 2.21-1.325 3.175M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" /></svg>
        ) : (
          // Eye SVG
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
        )}
      </button>
    </div>
  );
}; 