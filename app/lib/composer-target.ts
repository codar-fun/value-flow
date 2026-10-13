export function composerTarget(
  draft: { otherId?: string; recordCircleId?: string },
  initialOtherId: string | undefined,
  circleId: string,
  circles: Array<{ id: string; memberIds: string[] }>,
) {
  const otherId = initialOtherId || draft.otherId || "";
  const compatible = circles.filter((circle) => !otherId || circle.memberIds.includes(otherId));
  const candidates = initialOtherId ? [circleId, draft.recordCircleId] : [draft.recordCircleId, circleId];
  const target = candidates.find((id) => compatible.some((circle) => circle.id === id)) ?? compatible[0]?.id ?? circles[0]?.id ?? "";
  return { otherId: circles.find((circle) => circle.id === target)?.memberIds.includes(otherId) ? otherId : "", circleId: target };
}
