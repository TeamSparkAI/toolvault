declare module 'tailwindcss' {
  export interface Config {
    content: string[];
    theme: {
      extend?: {
        colors?: Record<string, any>;
        borderRadius?: Record<string, any>;
      };
    };
    plugins?: any[];
  }
} 