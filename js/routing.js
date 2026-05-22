/**
 * routing.js — Core Routing Engine
 * Smart Campus Navigator — DRBRA Polytechnic Gwalior
 *
 * Shared between path-builder.html and index.html.
 * Depends on the following globals being set before use:
 *   - buildingPolygons        : Array of polygon rings [{lat, lng}[]]
 *   - state_entrancePolygons  : Array of polygon rings [{lat, lng}[]]
 */

// ── Constants ──────────────────────────────────────────────────────────────
const JUNCTION_THRESHOLD_M = 5;   // metres — merge nodes closer than this
const PIN_SNAP_THRESHOLD_M = 60;  // max distance to snap a pin to a path
const WALK_SPEED = 80;            // metres per minute

// ── Haversine distance (metres) ────────────────────────────────────────────
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // in metres
}

// ── Building utilities ─────────────────────────────────────────────────────
// Ray-casting point-in-polygon: returns true if (lat, lng) is inside
// ANY of the loaded building polygons (union of all map.geojson shapes).
// Relies on the global `buildingPolygons` array.
function isInsideBuilding(lat, lng) {
  for (const ring of buildingPolygons) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i].lng, yi = ring[i].lat;
      const xj = ring[j].lng, yj = ring[j].lat;
      if (((yi > lat) !== (yj > lat)) &&
          (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    if (inside) return true;
  }
  return false;
}

// ── Entrance polygon utilities ─────────────────────────────────────────────
// Check if a point falls within ANY entrance polygon.
// Relies on the global `state_entrancePolygons` array.
function isInsideEntrancePolygon(lat, lng) {
  for (const ring of state_entrancePolygons) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i].lng, yi = ring[i].lat;
      const xj = ring[j].lng, yj = ring[j].lat;
      if (((yi > lat) !== (yj > lat)) &&
          (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    if (inside) return true;
  }
  return false;
}

// ── Path length (metres) ───────────────────────────────────────────────────
function calculatePathLength(points) {
  let d = 0;
  for (let i = 0; i < points.length - 1; i++) {
    d += haversine(points[i].lat, points[i].lng, points[i + 1].lat, points[i + 1].lng);
  }
  return d;
}

// ── Routing Graph Builder ──────────────────────────────────────────────────
function buildRoutingGraph(paths, pins, entranceNodes) {
  const nodes = new Map();
  const edges = [];

  // Helper: unique node id from coordinates (rounded to 6 decimal places)
  // This auto-merges vertices that are at same/very close coordinates
  function coordId(lat, lng) {
    return lat.toFixed(6) + ',' + lng.toFixed(6);
  }

  function addNode(id, lat, lng) {
    if (!nodes.has(id)) nodes.set(id, { lat, lng });
  }

  // Inner haversine (avoids any outer-scope shadowing issues)
  function hav(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const p = Math.PI / 180;
    const a = Math.sin((lat2 - lat1) * p / 2) ** 2 +
              Math.cos(lat1 * p) * Math.cos(lat2 * p) *
              Math.sin((lng2 - lng1) * p / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  // STEP 1: Add all path vertices as nodes, connect consecutive vertices
  paths.forEach((path) => {
    for (let i = 0; i < path.points.length; i++) {
      const pt = path.points[i];
      const id = coordId(pt.lat, pt.lng);
      addNode(id, pt.lat, pt.lng);

      if (i > 0) {
        const prev = path.points[i - 1];
        const prevId = coordId(prev.lat, prev.lng);
        const dist = hav(prev.lat, prev.lng, pt.lat, pt.lng);
        edges.push({
          from: prevId,
          to: id,
          dist,
          coordFrom: { lat: prev.lat, lng: prev.lng },
          coordTo:   { lat: pt.lat,   lng: pt.lng   }
        });
        edges.push({
          from: id,
          to: prevId,
          dist,
          coordFrom: { lat: pt.lat,   lng: pt.lng   },
          coordTo:   { lat: prev.lat, lng: prev.lng }
        });
      }
    }
  });

  // STEP 2: Junction merging — merge nodes within JUNCTION_THRESHOLD_M
  // Build a mapping: originalId -> canonicalId
  const canonical = new Map();
  const nodeList = Array.from(nodes.entries());

  nodeList.forEach(([id]) => canonical.set(id, id));

  for (let i = 0; i < nodeList.length; i++) {
    for (let j = i + 1; j < nodeList.length; j++) {
      const [idA, a] = nodeList[i];
      const [idB, b] = nodeList[j];
      const canonA = canonical.get(idA);
      const canonB = canonical.get(idB);
      if (canonA === canonB) continue;
      if (hav(a.lat, a.lng, b.lat, b.lng) < JUNCTION_THRESHOLD_M) {
        // Merge B into A — update all B references to A
        canonical.forEach((val, key) => {
          if (val === canonB) canonical.set(key, canonA);
        });
      }
    }
  }

  // Apply canonical mapping to edges
  const mergedEdges = edges
    .map(e => ({
      from: canonical.get(e.from) || e.from,
      to:   canonical.get(e.to)   || e.to,
      dist: e.dist,
      coordFrom: e.coordFrom,
      coordTo:   e.coordTo
    }))
    .filter(e => e.from !== e.to);

  // Rebuild nodes map with only canonical nodes
  const mergedNodes = new Map();
  nodes.forEach((val, id) => {
    const cid = canonical.get(id) || id;
    if (!mergedNodes.has(cid)) mergedNodes.set(cid, val);
  });

  // STEP 2b: Classify nodes as indoor/outdoor using point-in-polygon
  const indoorNodes = new Set();
  if (buildingPolygons.length > 0) {
    mergedNodes.forEach((node, id) => {
      if (isInsideBuilding(node.lat, node.lng)) indoorNodes.add(id);
    });
  }

  // STEP 2c: Find entrance nodes — indoor/outdoor boundary junctions
  const boundaryEntranceNodes = new Set();
  mergedEdges.forEach(e => {
    const fromIndoor = indoorNodes.has(e.from);
    const toIndoor   = indoorNodes.has(e.to);
    if (fromIndoor !== toIndoor) {
      boundaryEntranceNodes.add(e.from);
      boundaryEntranceNodes.add(e.to);
    }
  });

  // STEP 2d: Gateway Rule — enforce boundary crossing ONLY through entrance zones
  const entranceZoneNodes = new Set();
  mergedNodes.forEach((node, id) => {
    if (isInsideEntrancePolygon(node.lat, node.lng)) {
      entranceZoneNodes.add(id);
    }
  });

  let wallCrossingAttempted = 0;
  let wallCrossingAllowed   = 0;
  let wallCrossingBlocked   = 0;

  const gatewayFilteredEdges = mergedEdges.filter(e => {
    const inA = indoorNodes.has(e.from);
    const inB = indoorNodes.has(e.to);

    if (inA === inB) return true; // same zone — always OK

    wallCrossingAttempted++;
    const inEntranceZoneA = entranceZoneNodes.has(e.from);
    const inEntranceZoneB = entranceZoneNodes.has(e.to);
    const isAllowed = inEntranceZoneA || inEntranceZoneB;

    if (isAllowed) { wallCrossingAllowed++; } else { wallCrossingBlocked++; }
    return isAllowed;
  });

  console.log('[Gateway Rule] Wall-Crossing Edge Statistics:');
  console.log(`  Total boundary-crossing edges attempted: ${wallCrossingAttempted}`);
  console.log(`  Allowed (via entrance zones): ${wallCrossingAllowed}`);
  console.log(`  Blocked (no entrance zone): ${wallCrossingBlocked}`);

  // Replace mergedEdges with the gateway-filtered version for all downstream steps
  mergedEdges.length = 0;
  gatewayFilteredEdges.forEach(e => mergedEdges.push(e));

  // STEP 3: Smart pin snapping — context-aware based on indoor/outdoor status
  const hasBuildingData = buildingPolygons.length > 0;

  pins.forEach(pin => {
    const pinIndoor = hasBuildingData && isInsideBuilding(pin.lat, pin.lng);

    if (pinIndoor) {
      // Indoor pin: snap to nearest INDOOR path node
      let nearestId = null, nearestDist = Infinity;
      mergedNodes.forEach((node, id) => {
        if (!indoorNodes.has(id)) return;
        const d = hav(pin.lat, pin.lng, node.lat, node.lng);
        if (d < nearestDist) { nearestDist = d; nearestId = id; }
      });
      if (nearestId && nearestDist < PIN_SNAP_THRESHOLD_M) {
        const pinNodeId = pin.id;
        mergedNodes.set(pinNodeId, { lat: pin.lat, lng: pin.lng });
        const cPin     = { lat: pin.lat, lng: pin.lng };
        const cNearest = { lat: mergedNodes.get(nearestId).lat, lng: mergedNodes.get(nearestId).lng };
        mergedEdges.push({ from: pinNodeId, to: nearestId, dist: nearestDist, coordFrom: cPin,     coordTo: cNearest });
        mergedEdges.push({ from: nearestId, to: pinNodeId, dist: nearestDist, coordFrom: cNearest, coordTo: cPin     });
        indoorNodes.add(pinNodeId);
      }
    } else {
      // Outdoor pin: perpendicular projection onto nearest path segment
      let bestDist = Infinity;
      let bestProjection = null;
      let bestSegment = null;

      paths.forEach(path => {
        for (let i = 0; i < path.points.length - 1; i++) {
          const A = path.points[i];
          const B = path.points[i + 1];

          const ax = A.lng, ay = A.lat;
          const bx = B.lng, by = B.lat;
          const px = pin.lng, py = pin.lat;

          const dx = bx - ax, dy = by - ay;
          const lenSq = dx * dx + dy * dy;
          let t = lenSq > 0 ? ((px - ax) * dx + (py - ay) * dy) / lenSq : 0;
          t = Math.max(0, Math.min(1, t));

          const projLat = ay + t * dy;
          const projLng = ax + t * dx;
          const dist = hav(pin.lat, pin.lng, projLat, projLng);

          if (dist < bestDist) {
            bestDist = dist;
            bestProjection = { lat: projLat, lng: projLng };
            const fromId = canonical.get(coordId(A.lat, A.lng)) || coordId(A.lat, A.lng);
            const toId   = canonical.get(coordId(B.lat, B.lng)) || coordId(B.lat, B.lng);
            bestSegment  = { fromId, toId };
          }
        }
      });

      if (!bestProjection || bestDist > PIN_SNAP_THRESHOLD_M) return;

      const projId = 'proj_' + pin.id;
      mergedNodes.set(projId, bestProjection);

      const distToFrom = hav(bestProjection.lat, bestProjection.lng,
        mergedNodes.get(bestSegment.fromId).lat, mergedNodes.get(bestSegment.fromId).lng);
      const distToTo = hav(bestProjection.lat, bestProjection.lng,
        mergedNodes.get(bestSegment.toId).lat, mergedNodes.get(bestSegment.toId).lng);

      const cProj = { lat: bestProjection.lat, lng: bestProjection.lng };
      const cFrom = { lat: mergedNodes.get(bestSegment.fromId).lat, lng: mergedNodes.get(bestSegment.fromId).lng };
      const cTo   = { lat: mergedNodes.get(bestSegment.toId).lat,   lng: mergedNodes.get(bestSegment.toId).lng   };

      mergedEdges.push({ from: projId, to: bestSegment.fromId, dist: distToFrom, coordFrom: cProj, coordTo: cFrom });
      mergedEdges.push({ from: bestSegment.fromId, to: projId, dist: distToFrom, coordFrom: cFrom, coordTo: cProj });
      mergedEdges.push({ from: projId, to: bestSegment.toId, dist: distToTo,   coordFrom: cProj, coordTo: cTo   });
      mergedEdges.push({ from: bestSegment.toId, to: projId, dist: distToTo,   coordFrom: cTo,   coordTo: cProj });

      const pinNodeId = pin.id;
      mergedNodes.set(pinNodeId, { lat: pin.lat, lng: pin.lng });
      const cPin = { lat: pin.lat, lng: pin.lng };
      mergedEdges.push({ from: pinNodeId, to: projId, dist: bestDist, coordFrom: cPin,  coordTo: cProj });
      mergedEdges.push({ from: projId, to: pinNodeId, dist: bestDist, coordFrom: cProj, coordTo: cPin  });
    }
  });

  // STEP 4: Explicit entrance points from GeoJSON (routing-only nodes)
  (entranceNodes || []).forEach(ent => {
    mergedNodes.set(ent.id, { lat: ent.lat, lng: ent.lng });

    let nearestId = null;
    let nearestDist = Infinity;

    mergedNodes.forEach((node, id) => {
      const d = hav(ent.lat, ent.lng, node.lat, node.lng);
      if (d < nearestDist && id !== ent.id) { nearestDist = d; nearestId = id; }
    });

    if (nearestId) {
      const cEnt  = { lat: ent.lat, lng: ent.lng };
      const cNear = mergedNodes.get(nearestId);

      mergedEdges.push({ from: ent.id,    to: nearestId, dist: nearestDist, coordFrom: cEnt,  coordTo: cNear });
      mergedEdges.push({ from: nearestId, to: ent.id,    dist: nearestDist, coordFrom: cNear, coordTo: cEnt  });

      if (buildingPolygons.length > 0 && isInsideBuilding(ent.lat, ent.lng)) {
        indoorNodes.add(ent.id);
      }
    }
  });

  return { nodes: mergedNodes, edges: mergedEdges, indoorNodes, entranceNodes: boundaryEntranceNodes };
}

// ── Dijkstra Shortest Path ─────────────────────────────────────────────────
function runDijkstra(graph, startId, endId) {
  if (!graph.nodes.has(startId) || !graph.nodes.has(endId)) return null;

  const dist = new Map();
  const prev = new Map();
  const unvisited = new Set();

  // Build adjacency list
  const adj = new Map();
  graph.nodes.forEach((_, id) => adj.set(id, []));
  graph.edges.forEach(e => {
    adj.get(e.from).push({ to: e.to, weight: e.dist });
  });

  graph.nodes.forEach((_, id) => {
    dist.set(id, Infinity);
    unvisited.add(id);
  });
  dist.set(startId, 0);

  while (unvisited.size > 0) {
    let u = null;
    let minDist = Infinity;
    for (const node of unvisited) {
      if (dist.get(node) < minDist) { minDist = dist.get(node); u = node; }
    }

    if (u === null) break;
    if (u === endId) break;

    unvisited.delete(u);

    for (const neighbor of adj.get(u)) {
      if (!unvisited.has(neighbor.to)) continue;
      const alt = dist.get(u) + neighbor.weight;
      if (alt < dist.get(neighbor.to)) {
        dist.set(neighbor.to, alt);
        prev.set(neighbor.to, u);
      }
    }
  }

  if (dist.get(endId) === Infinity) return null;

  // Backtrack to reconstruct path
  const pathIds = [];
  let curr = endId;
  while (curr !== undefined) {
    pathIds.unshift(curr);
    curr = prev.get(curr);
  }

  return { path: pathIds, totalDist: dist.get(endId) };
}
