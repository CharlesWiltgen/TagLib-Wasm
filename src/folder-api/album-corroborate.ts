/**
 * Sibling corroboration for gated disc-folder names (taglib-ys7m split).
 *
 * Gated names (title-word markers, single-letter tokens, bonus, bare) are
 * discs only when a sibling under the same parent confirms them — an
 * unconditional disc sibling, or sibling numbering of their own (a folder
 * never confirms itself). Side-letter tokens corroborate each other
 * ("CD D" + "CD E").
 */

import { basename } from "../utils/path.ts";
import { parseDiscName } from "./folder-disc.ts";
import type { DiscConfidence, DiscParse } from "./album-types.ts";

export const CONFIDENCE_RANK: Record<DiscConfidence, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

type SiblingFacts = {
  hasExact: boolean;
  hasNumbered: boolean;
  numberedCount: number;
  hasSideLetter: boolean;
};

function summarizeSiblings(siblings: string[]): SiblingFacts {
  const facts: SiblingFacts = {
    hasExact: false,
    hasNumbered: false,
    numberedCount: 0,
    hasSideLetter: false,
  };
  for (const sibling of siblings) {
    const parsed = parseDiscName(basename(sibling));
    if (!parsed) continue;
    if (!parsed.gated && parsed.kind === "exact") facts.hasExact = true;
    if (parsed.number !== undefined) {
      facts.hasNumbered = true;
      facts.numberedCount++;
    }
    if (parsed.sideLetter) facts.hasSideLetter = true;
  }
  return facts;
}

export function corroborated(parse: DiscParse, siblings: string[]): boolean {
  if (!parse.gated && parse.kind === "exact") return true;
  if (siblings.length === 0) return false;

  const facts = summarizeSiblings(siblings);

  if (parse.number !== undefined && facts.hasNumbered) return true;
  if (!parse.gated && parse.kind === "embedded" && facts.hasExact) return true;
  if (!parse.gated && parse.kind === "volume" && facts.hasNumbered) {
    return true;
  }

  // Side-letter tokens corroborate each other ("CD D" + "CD E").
  if (parse.sideLetter) return facts.hasSideLetter;

  // Title-less set rules (low tier): bare numbers/letters or bonus names
  // accompanying at least two numbered siblings, or a numbered sibling of
  // their own kind.
  if (parse.kind === "bonus" || parse.kind === "bare") {
    if (facts.numberedCount >= 2) return true;
    if (parse.number !== undefined && facts.hasNumbered) return true;
  }

  return false;
}
