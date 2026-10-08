import type { Listing } from "../types";

// Cross-circle consent follows the author's current memberships, including
// circles joined after publication. Keep the saved selection intact for edits.
export function listingDisplayCircleIds(listing: Pick<Listing, "visibility" | "circleIds">, memberCircleIds: string[]): string[] {
  return listing.visibility === "cross-circle"
    ? [...new Set([...listing.circleIds, ...memberCircleIds])]
    : listing.circleIds;
}
