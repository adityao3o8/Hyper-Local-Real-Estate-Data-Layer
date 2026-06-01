export {};

declare global {
  interface Window {
    VANTA?: {
      TRUNK: (options: Record<string, unknown>) => {
        destroy: () => void;
        resize?: () => void;
      };
    };
  }
}
