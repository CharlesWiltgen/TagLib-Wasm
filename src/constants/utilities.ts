import { PROPERTIES, type PropertyKey } from "./properties.ts";
import type { PropertyMetadata } from "./property-types.ts";

/**
 * Type guard to check if a string is a valid property key
 */
export function isValidProperty(key: string): key is PropertyKey {
  return key in PROPERTIES;
}

/**
 * Get property metadata for a given property key
 */
export function getPropertyMetadata<K extends PropertyKey>(
  key: K,
): PropertyMetadata | undefined {
  return PROPERTIES[key] as PropertyMetadata | undefined;
}

/**
 * Get all available property keys as an array
 */
export function getAllPropertyKeys(): readonly PropertyKey[] {
  return Object.keys(PROPERTIES) as PropertyKey[];
}

/**
 * Get all available property definitions as an array of [key, metadata] pairs
 */
export function getAllProperties(): readonly [
  PropertyKey,
  typeof PROPERTIES[PropertyKey],
][] {
  return Object.entries(PROPERTIES) as [
    PropertyKey,
    typeof PROPERTIES[PropertyKey],
  ][];
}

/**
 * Filter properties by supported format
 */
export function getPropertiesByFormat(format: string): PropertyKey[] {
  return getAllPropertyKeys().filter((key) =>
    PROPERTIES[key].supportedFormats.includes(format as any)
  );
}
