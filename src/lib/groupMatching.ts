import { ComponentGroup } from "@/types/schematic";

interface PlanTileForMatching {
  id: string;
  componentId: string;
  gridX: number;
  gridY: number;
}

export interface GroupMatchResult {
  group: ComponentGroup;
  matchedTileIds: string[];
}

/**
 * Identifies which known groups are present in a set of plan tiles.
 * Connection blocks (connection-*) are IGNORED during matching —
 * only functional components must be at the correct relative positions.
 * Connection blocks at group positions are automatically protected.
 */
export function identifyGroupsInPlan(
  planTiles: PlanTileForMatching[],
  groups: ComponentGroup[]
): { matches: GroupMatchResult[]; protectedTileIds: Set<string> } {
  const protectedTileIds = new Set<string>();
  const matches: GroupMatchResult[] = [];
  const usedTileIds = new Set<string>();

  for (const group of groups) {
    if (!group.layoutData?.tiles || group.layoutData.tiles.length === 0) continue;

    // Filter: only functional (non-connection) tiles from the group definition
    const functionalGroupTiles = group.layoutData.tiles.filter(
      t => !t.componentId.startsWith('connection-')
    );

    console.log(`[GroupMatch] Checking group "${group.name}": ${group.layoutData.tiles.length} total tiles, ${functionalGroupTiles.length} functional`);
    console.log(`[GroupMatch] Functional tiles:`, functionalGroupTiles.map(t => `${t.componentId} @(${t.relativeX},${t.relativeY})`));
    console.log(`[GroupMatch] Plan tiles:`, planTiles.map(t => `${t.componentId} @(${t.gridX},${t.gridY})`));

    // If no functional tiles, skip this group
    if (functionalGroupTiles.length === 0) continue;

    // All group tiles (including connections) for position protection
    const allGroupTiles = group.layoutData.tiles;

    // Use the first functional tile as anchor
    const anchorGroupTile = functionalGroupTiles[0];

    // Find candidate anchors in the plan
    const candidateAnchors = planTiles.filter(
      t => t.componentId === anchorGroupTile.componentId && !usedTileIds.has(t.id)
    );

    for (const anchor of candidateAnchors) {
      const offsetX = anchor.gridX - anchorGroupTile.relativeX;
      const offsetY = anchor.gridY - anchorGroupTile.relativeY;

      // Check all other functional tiles
      let allFound = true;
      const matchedFunctionalIds: string[] = [anchor.id];

      for (let i = 1; i < functionalGroupTiles.length; i++) {
        const gt = functionalGroupTiles[i];
        const expectedX = gt.relativeX + offsetX;
        const expectedY = gt.relativeY + offsetY;

        const match = planTiles.find(
          t =>
            t.componentId === gt.componentId &&
            t.gridX === expectedX &&
            t.gridY === expectedY &&
            !matchedFunctionalIds.includes(t.id) &&
            !usedTileIds.has(t.id)
        );

        if (match) {
          matchedFunctionalIds.push(match.id);
        } else {
          allFound = false;
          break;
        }
      }

      if (allFound) {
        // All functional tiles matched! Now also protect connection tiles at group positions
        const allMatchedIds = [...matchedFunctionalIds];

        for (const gt of allGroupTiles) {
          if (!gt.componentId.startsWith('connection-')) continue;
          const expectedX = gt.relativeX + offsetX;
          const expectedY = gt.relativeY + offsetY;

          // Find any connection block at this position
          const connTile = planTiles.find(
            t =>
              t.componentId.startsWith('connection-') &&
              t.gridX === expectedX &&
              t.gridY === expectedY &&
              !allMatchedIds.includes(t.id)
          );

          if (connTile) {
            allMatchedIds.push(connTile.id);
          }
        }

        allMatchedIds.forEach(id => {
          protectedTileIds.add(id);
          usedTileIds.add(id);
        });

        matches.push({ group, matchedTileIds: allMatchedIds });
        break; // One match per group per anchor search
      }
    }
  }

  return { matches, protectedTileIds };
}
