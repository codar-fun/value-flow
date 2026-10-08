import assert from "node:assert/strict";
import test from "node:test";
import { listingDisplayCircleIds } from "../app/lib/listing-scope.ts";

test("cross-circle listings follow new memberships without rewriting the saved selection", () => {
  const listing = { visibility: "cross-circle", circleIds: ["old"] };
  assert.deepEqual(listingDisplayCircleIds(listing, ["old", "new"]), ["old", "new"]);
  assert.deepEqual(listing.circleIds, ["old"]);
});
test("circle-only listings stay in their selected circles after joining", () => {
  assert.deepEqual(listingDisplayCircleIds({ visibility: "circle", circleIds: ["old"] }, ["old", "new"]), ["old"]);
});
