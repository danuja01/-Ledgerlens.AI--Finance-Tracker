/// <reference types="vite/client" />

declare module "*.json" {
  const value: unknown;
  export default value;
}

declare module "*?raw" {
  const content: string;
  export default content;
}

interface ImportMetaEnv {
  readonly VITE_OPENAI_API_KEY?: string;
  readonly VITE_OPEN_AI_API_KEY?: string;
}
