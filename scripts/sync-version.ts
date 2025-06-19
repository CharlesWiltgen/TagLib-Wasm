#!/usr/bin/env -S deno run --allow-read --allow-write

/**
 * @fileoverview Synchronize version numbers between deno.json and package.json
 * 
 * Usage:
 *   deno run --allow-read --allow-write scripts/sync-version.ts patch
 *   deno run --allow-read --allow-write scripts/sync-version.ts minor
 *   deno run --allow-read --allow-write scripts/sync-version.ts major
 *   deno run --allow-read --allow-write scripts/sync-version.ts set 1.2.3
 *   deno run --allow-read --allow-write scripts/sync-version.ts check
 */

interface PackageJson {
  version: string;
  [key: string]: unknown;
}

interface DenoJson {
  version: string;
  [key: string]: unknown;
}

const PACKAGE_JSON_PATH = "./package.json";
const DENO_JSON_PATH = "./deno.json";

/**
 * Read and parse JSON file
 */
async function readJsonFile<T>(path: string): Promise<T> {
  const content = await Deno.readTextFile(path);
  return JSON.parse(content);
}

/**
 * Write JSON file with proper formatting
 */
async function writeJsonFile(path: string, data: unknown): Promise<void> {
  const content = JSON.stringify(data, null, 2) + "\n";
  await Deno.writeTextFile(path, content);
}

/**
 * Parse semantic version string
 */
function parseVersion(version: string): { major: number; minor: number; patch: number } {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    throw new Error(`Invalid version format: ${version}. Expected: major.minor.patch`);
  }
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
  };
}

/**
 * Increment version based on type
 */
function incrementVersion(version: string, type: "major" | "minor" | "patch"): string {
  const { major, minor, patch } = parseVersion(version);
  
  switch (type) {
    case "major":
      return `${major + 1}.0.0`;
    case "minor":
      return `${major}.${minor + 1}.0`;
    case "patch":
      return `${major}.${minor}.${patch + 1}`;
    default:
      throw new Error(`Invalid version type: ${type}`);
  }
}

/**
 * Check if versions match
 */
async function checkVersions(): Promise<boolean> {
  const packageJson = await readJsonFile<PackageJson>(PACKAGE_JSON_PATH);
  const denoJson = await readJsonFile<DenoJson>(DENO_JSON_PATH);
  
  const match = packageJson.version === denoJson.version;
  
  console.log(`package.json version: ${packageJson.version}`);
  console.log(`deno.json version:    ${denoJson.version}`);
  console.log(`Status: ${match ? "✅ Versions match" : "❌ Versions differ"}`);
  
  return match;
}

/**
 * Update version in both files
 */
async function updateVersion(newVersion: string): Promise<void> {
  // Validate version format
  parseVersion(newVersion);
  
  // Read both files
  const packageJson = await readJsonFile<PackageJson>(PACKAGE_JSON_PATH);
  const denoJson = await readJsonFile<DenoJson>(DENO_JSON_PATH);
  
  const oldVersion = packageJson.version;
  
  // Update versions
  packageJson.version = newVersion;
  denoJson.version = newVersion;
  
  // Write both files
  await writeJsonFile(PACKAGE_JSON_PATH, packageJson);
  await writeJsonFile(DENO_JSON_PATH, denoJson);
  
  console.log(`✅ Updated version: ${oldVersion} → ${newVersion}`);
  console.log(`   Updated: package.json`);
  console.log(`   Updated: deno.json`);
}

/**
 * Main function
 */
async function main() {
  const [command, arg] = Deno.args;
  
  if (!command) {
    console.error("Usage: sync-version.ts <command> [argument]");
    console.error("Commands:");
    console.error("  patch     - Increment patch version (0.0.x)");
    console.error("  minor     - Increment minor version (0.x.0)");
    console.error("  major     - Increment major version (x.0.0)");
    console.error("  set <ver> - Set specific version");
    console.error("  check     - Check if versions match");
    Deno.exit(1);
  }
  
  try {
    switch (command) {
      case "check": {
        const match = await checkVersions();
        Deno.exit(match ? 0 : 1);
        break;
      }
      
      case "patch":
      case "minor":
      case "major": {
        const packageJson = await readJsonFile<PackageJson>(PACKAGE_JSON_PATH);
        const newVersion = incrementVersion(packageJson.version, command);
        await updateVersion(newVersion);
        break;
      }
      
      case "set": {
        if (!arg) {
          console.error("Error: Version number required for 'set' command");
          console.error("Usage: sync-version.ts set <version>");
          Deno.exit(1);
        }
        await updateVersion(arg);
        break;
      }
      
      default:
        console.error(`Unknown command: ${command}`);
        Deno.exit(1);
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  await main();
}