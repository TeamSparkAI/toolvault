export function isSecretEnvVar(name: string): boolean {
  return /(token|secret|key)/i.test(name);
} 