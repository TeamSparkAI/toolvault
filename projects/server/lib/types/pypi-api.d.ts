declare module 'pypi-info' {
  export function getPackage(packageName: string): Promise<any>;
}
