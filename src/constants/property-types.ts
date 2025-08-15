/**
 * TypeScript type definitions for property system.
 */

/**
 * Property metadata interface inferred from PROPERTIES structure
 */
export type PropertyMetadata = {
  key: string;
  description: string;
  type: "string" | "number" | "boolean" | "array";
  supportedFormats: readonly string[];
  mappings: Record<
    string,
    string | { frame?: string; atom?: string; description?: string }
  >;
};
