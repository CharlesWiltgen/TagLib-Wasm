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

export function corroborated(parse: DiscParse, siblings: string[]): boolean {
  if (!parse.gated && parse.kind === "exact") return true;
  if (siblings.length === 0) return false;

  const siblingParses = siblings
    .map((s) => parseDiscName(basename(s)))
    .filter((p): p is DiscParse => p !== undefined);
  const hasExactSibling = siblingParses.some(
    (p) => !p.gated && p.kind === "exact",
  );
  const hasNumberedSibling = siblingParses.some(
    (p) => p.number !== undefined,
  );

  if (parse.number !== undefined && hasNumberedSibling) return true;
  if (!parse.gated && parse.kind === "embedded" && hasExactSibling) return true;
  if (!parse.gated && parse.kind === "volume" && hasNumberedSibling) {
    return true;
  }

  // Side-letter tokens corroborate each other ("CD D" + "CD E").
  if (parse.sideLetter) {
    return siblingParses.some((p) => p.sideLetter);
  }

  // Title-less set rules (low tier): bare numbers/letters or bonus names
  // accompanying at least two numbered siblings, or a numbered sibling of
  // their own kind.
  if (parse.kind === "bonus" || parse.kind === "bare") {
    const numberedCount = siblingParses.filter((p) => p.number !== undefined)
      .length;
    if (numberedCount >= 2) return true;
    if (parse.number !== undefined && hasNumberedSibling) return true;
  }

  return false;
}
