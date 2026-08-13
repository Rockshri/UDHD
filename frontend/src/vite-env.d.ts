/// <reference types="vite/client" />

/** Not in Vite's built-in asset type list — imported for the Task 3
 *  Download Template button, resolves to a URL string like any other
 *  Vite-handled static asset. */
declare module '*.xlsx' {
  const url: string;
  export default url;
}
