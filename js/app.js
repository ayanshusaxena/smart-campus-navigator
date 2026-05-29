// Smart Campus Navigator — main application
// BUG FIXES: BUG1 (tier zoom), BUG6 (labels), BUG7 (auto-return), BUG8 (rotation)



let map;
let currentLang = 'en';
let markers = [];           // [{ marker, location, labelDiv }]
let markersLayerGroup;
let selectedLocationId = null;
let campusPaths = [];
let campusEntranceNodes = [];
let activeCampusPins = [];
let currentRouteLayer = L.layerGroup();
window.isNavigating = false;
window.currentNavDestination = null;
window.currentRouteNodes = [];
let _navGraphCache = null;
let _navLastReroutePos = null;
const REROUTE_THRESHOLD_M = 15;

window.buildingPolygons = window.buildingPolygons || [];
window.state_entrancePolygons = window.state_entrancePolygons || [];

// Expose small hooks for cross-file modules (no build step in this project)
window.__CNS_getLang = () => currentLang;

// ── Campus centre ─────────────────────────────────────────────────────────
const CAMPUS_CENTER = { lat: 26.1923, lng: 78.1743 };

// ── Auto-return state (BUG 7) ─────────────────────────────────────────────
let autoReturnTimer = null;
let autoReturnToast = null;
let autoReturnCountdown = null;

// ── Returns the active set of campus locations ────────────────────────────
function getActiveLocations() {
  if (Array.isArray(activeCampusPins) && activeCampusPins.length > 0) return activeCampusPins;
  return CAMPUS_LOCATIONS;
}

async function loadCampusPins() {
  try {
    // Try Firestore first
    const snapshot = await db.collection('campusPins').get();
    if (!snapshot.empty) {
      const pins = [];
      snapshot.forEach(function(doc) {
        pins.push(doc.data());
      });
      console.log('[CNS] Loaded', pins.length, 'pins from Firestore');
      return pins;
    }
  } catch (err) {
    console.warn('[CNS] Firestore fetch failed, falling back to local:', err.message);
  }
  // Fallback to locations.js
  console.log('[CNS] Using local CAMPUS_LOCATIONS fallback');
  return Array.isArray(window.CAMPUS_LOCATIONS) ? window.CAMPUS_LOCATIONS : CAMPUS_LOCATIONS;
}

window.__CNS_getLocations = () => getActiveLocations();

async function loadCampusPaths() {
  campusPaths = [];
  window.campusPaths = campusPaths;
  campusEntranceNodes = [];
  window.buildingPolygons = [];
  window.state_entrancePolygons = [];

  function processCampusGeoJSON(geojson) {
    if (!geojson || !Array.isArray(geojson.features)) return;

    let pathIdx = 0;

    geojson.features.forEach((feat) => {
      if (feat.geometry?.type === 'Polygon') {
        const ring = feat.geometry.coordinates[0].map((c) => ({ lng: c[0], lat: c[1] }));
        if (feat.properties?.is_entrance === true) {
          window.state_entrancePolygons.push(ring);
        } else {
          window.buildingPolygons.push(ring);
        }
        return;
      }

      if (feat.geometry?.type === 'MultiPolygon') {
        feat.geometry.coordinates.forEach((poly) => {
          const ring = poly[0].map((c) => ({ lng: c[0], lat: c[1] }));
          if (feat.properties?.is_entrance === true) {
            window.state_entrancePolygons.push(ring);
          } else {
            window.buildingPolygons.push(ring);
          }
        });
        return;
      }

      if (feat.geometry?.type === 'LineString') {
        const points = feat.geometry.coordinates.map((c) => ({ lng: c[0], lat: c[1] }));
        campusPaths.push({ id: 'path_' + pathIdx++, points });
        return;
      }

      if (feat.geometry?.type === 'Point' && feat.properties?.type === 'entrance') {
        campusEntranceNodes.push({
          id: 'ent_' + Math.random().toString(36).slice(2, 11),
          lat: feat.geometry.coordinates[1],
          lng: feat.geometry.coordinates[0],
        });
      }
    });
  }

  try {
    const response = await fetch('map.geojson?v=2');
    if (!response.ok) {
      throw new Error('Failed to fetch map.geojson: ' + response.status);
    }

    const geojson = await response.json();
    processCampusGeoJSON(geojson);
  } catch (e) {
    console.warn('Could not load map.geojson, trying localStorage fallback', e);

    try {
      const raw = localStorage.getItem('campusGeoJSON');
      if (!raw) return;

      const geojson = JSON.parse(raw);
      processCampusGeoJSON(geojson);
    } catch (fallbackError) {
      console.error('Error loading fallback campus paths', fallbackError);
    }
  }
}

if (typeof haversine === 'function') {
  window.__CNS_haversine = haversine;
}

// Snaps a raw GPS coordinate to the nearest point on campusPaths.
// Returns { lat, lng, snapped: true } if a close path is found,
// or { lat, lng, snapped: false } if no path is within threshold.
function snapToNearestPath(rawLat, rawLng) {
  const SNAP_THRESHOLD_M = 25; // tighter than PIN_SNAP_THRESHOLD_M for live GPS
  const paths = window.campusPaths;

  if (!Array.isArray(paths) || paths.length === 0) {
    return { lat: rawLat, lng: rawLng, snapped: false };
  }

  let bestDist = Infinity;
  let bestLat = rawLat;
  let bestLng = rawLng;

  paths.forEach(function (path) {
    const pts = path.points;
    if (!Array.isArray(pts) || pts.length < 2) return;

    for (let i = 0; i < pts.length - 1; i++) {
      const A = pts[i];
      const B = pts[i + 1];

      const ax = A.lng, ay = A.lat;
      const bx = B.lng, by = B.lat;
      const px = rawLng,  py = rawLat;

      const dx = bx - ax, dy = by - ay;
      // Scale lng component by cos(lat) to account for Earth's curvature
      const cosLat = Math.cos(ay * Math.PI / 180);
      const dyM = dy;
      const dxM = dx * cosLat;
      const pyM = py - ay;
      const pxM = (px - ax) * cosLat;
      const lenSqM = dxM * dxM + dyM * dyM;
      let tFixed = lenSqM > 0 ? (pxM * dxM + pyM * dyM) / lenSqM : 0;
      tFixed = Math.max(0, Math.min(1, tFixed));
      const projLat = ay + tFixed * dy;
      const projLng = ax + tFixed * dx;
      const dist = haversine(rawLat, rawLng, projLat, projLng);

      if (dist < bestDist) {
        bestDist = dist;
        bestLat = projLat;
        bestLng = projLng;
      }
    }
  });

  if (bestDist <= SNAP_THRESHOLD_M) {
    return { lat: bestLat, lng: bestLng, snapped: true };
  }

  return { lat: rawLat, lng: rawLng, snapped: false };
}

function getLiveUserCoordinates() {
  const liveState = window.__CNS_userLocation;
  const rawLat = Number.isFinite(liveState?.lat) ? liveState.lat : window.userLat;
  const rawLng = Number.isFinite(liveState?.lng) ? liveState.lng : window.userLng;

  if (!Number.isFinite(rawLat) || !Number.isFinite(rawLng)) return null;

  // If navigation is active, snap to nearest path for smoother routing.
  // If not navigating, return raw GPS so blue dot shows true position.
  if (window.isNavigating) {
    const snapped = snapToNearestPath(rawLat, rawLng);
    return { lat: snapped.lat, lng: snapped.lng };
  }

  return { lat: rawLat, lng: rawLng };
}

function setNavigationOverlayVisible(isVisible) {
  const overlay = document.getElementById('active-nav-overlay');
  if (overlay) {
    overlay.style.display = isVisible ? 'flex' : 'none';
  }
}

function setNavigationOverlayDestination(destination) {
  const label = document.getElementById('active-nav-label');
  if (!label || !destination) return;
  label.textContent = 'Navigating to: ' + getLocationName(destination);
}

function getRouteNodes(pathIds, graph) {
  if (!Array.isArray(pathIds) || !graph || !graph.nodes) return [];
  return pathIds
    .map(function(id) {
      const node = graph.nodes.get(id);
      return node ? { lat: node.lat, lng: node.lng } : null;
    })
    .filter(Boolean);
}

function getBearing(lat1, lng1, lat2, lng2) {
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const lat1R = lat1 * Math.PI / 180;
  const lat2R = lat2 * Math.PI / 180;
  const y = Math.sin(dLng) * Math.cos(lat2R);
  const x = Math.cos(lat1R) * Math.sin(lat2R) -
             Math.sin(lat1R) * Math.cos(lat2R) * Math.cos(dLng);
  return Math.atan2(y, x) * 180 / Math.PI;
}

function getUpcomingTurn(routeNodes, userLat, userLng) {
  if (!Array.isArray(routeNodes) || routeNodes.length < 3) return null;

  let closestIdx = 0;
  let closestDist = Infinity;

  routeNodes.forEach(function(node, i) {
    const d = haversine(userLat, userLng, node.lat, node.lng);
    if (d < closestDist) {
      closestDist = d;
      closestIdx = i;
    }
  });

  for (let i = closestIdx + 1; i < routeNodes.length - 1; i++) {
    const distToNode = haversine(userLat, userLng, routeNodes[i].lat, routeNodes[i].lng);
    if (distToNode > 40) break;

    const prev = routeNodes[i - 1];
    const curr = routeNodes[i];
    const next = routeNodes[i + 1];
    const bearingIn = getBearing(prev.lat, prev.lng, curr.lat, curr.lng);
    const bearingOut = getBearing(curr.lat, curr.lng, next.lat, next.lng);
    let angleDiff = bearingOut - bearingIn;

    while (angleDiff > 180) angleDiff -= 360;
    while (angleDiff < -180) angleDiff += 360;

    if (Math.abs(angleDiff) > 30) {
      return {
        direction: angleDiff > 0 ? 'right' : 'left',
        distance: Math.round(distToNode),
        angle: Math.abs(Math.round(angleDiff))
      };
    }
  }
  return null;
}

function drawLiveRoute(pathIds, graph, options = {}) {
  const shouldFitBounds = options.fitBounds !== false;
  currentRouteLayer.clearLayers();
  const latlngs = [];

  for (let i = 0; i < pathIds.length - 1; i++) {
    const fromId = pathIds[i];
    const toId = pathIds[i + 1];
    const edge = graph.edges.find((e) => e.from === fromId && e.to === toId);

    if (edge && edge.coordFrom && edge.coordTo) {
      const fromPoint = [edge.coordFrom.lat, edge.coordFrom.lng];
      const toPoint = [edge.coordTo.lat, edge.coordTo.lng];

      if (!latlngs.length || latlngs[latlngs.length - 1][0] !== fromPoint[0] || latlngs[latlngs.length - 1][1] !== fromPoint[1]) {
        latlngs.push(fromPoint);
      }
      latlngs.push(toPoint);
    }
  }

  if (latlngs.length > 0) {
    L.polyline(latlngs, {
      color: '#2563eb',
      weight: 6,
      opacity: 0.8,
      dashArray: '10 10',
    }).addTo(currentRouteLayer);

    if (shouldFitBounds) {
      map.fitBounds(L.latLngBounds(latlngs), { padding: [50, 50] });
    }
  }
}

function startLiveNavigation(destinationPin) {
  window.__CNS_preNavZoom = map.getZoom();
  const liveCoords = getLiveUserCoordinates();

  if (!liveCoords) {
    alert('Live location not available yet. Please ensure GPS is enabled.');
    return;
  }

  if (!Array.isArray(campusPaths) || campusPaths.length === 0) {
    alert('Campus routing paths are not available yet.');
    return;
  }

  if (typeof buildRoutingGraph !== 'function' || typeof runDijkstra !== 'function') {
    alert('Routing engine is not available.');
    return;
  }

  const destinationId = destinationPin.id || ('dest_' + Math.random().toString(36).slice(2, 11));
  const destinationNode = {
    ...destinationPin,
    id: destinationId,
  };

  const ghostNode = {
    id: 'live_user_001',
    lat: liveCoords.lat,
    lng: liveCoords.lng,
    nameEn: 'My Location',
  };

  const graph = buildRoutingGraph(campusPaths, [ghostNode, destinationNode], campusEntranceNodes);
  const result = runDijkstra(graph, ghostNode.id, destinationNode.id);

  if (!result || !Array.isArray(result.path) || result.path.length === 0) {
    alert('Could not find a path to this location.');
    return;
  }

  window.isNavigating = true;
  window.currentNavDestination = destinationNode;
  window.currentRouteNodes = getRouteNodes(result.path, graph);
  setNavigationOverlayDestination(destinationNode);
  setNavigationOverlayVisible(true);
  drawLiveRoute(result.path, graph);
  if (map.getZoom() < window.__CNS_preNavZoom) {
    map.setZoom(window.__CNS_preNavZoom);
  }
  toggleSidebar();
}

window.stopLiveNavigation = function stopLiveNavigation() {
  window.isNavigating = false;
  window.currentNavDestination = null;
  window.currentRouteNodes = [];
  currentRouteLayer.clearLayers();
  _navGraphCache = null;
  _navLastReroutePos = null;
  setNavigationOverlayVisible(false);
};

window.updateLiveNavigation = function updateLiveNavigation() {
  if (!window.isNavigating || !window.currentNavDestination) return;

  const liveCoords = getLiveUserCoordinates();
  if (!liveCoords) return;

  const destination = window.currentNavDestination;
  const distToDest = haversine(liveCoords.lat, liveCoords.lng, destination.lat, destination.lng);

  const turnInfo = getUpcomingTurn(window.currentRouteNodes, liveCoords.lat, liveCoords.lng);
  const turnEl = document.getElementById('turn-indicator');
  if (turnEl) {
    if (turnInfo) {
      const arrow = turnInfo.direction === 'right' ? '➡️' : '⬅️';
      turnEl.textContent = arrow + ' Turn ' + turnInfo.direction + ' in ' + turnInfo.distance + 'm';
      turnEl.style.display = 'block';
    } else {
      turnEl.style.display = 'none';
    }
  }

  if (distToDest < 15) {
    alert('You have arrived at your destination!');
    window.stopLiveNavigation();
    return;
  }

  // Only reroute if user moved significantly from last reroute position
  const movedEnough = !_navLastReroutePos ||
    haversine(liveCoords.lat, liveCoords.lng, _navLastReroutePos.lat, _navLastReroutePos.lng) > REROUTE_THRESHOLD_M;

  if (!movedEnough && _navGraphCache) return;

  _navLastReroutePos = { lat: liveCoords.lat, lng: liveCoords.lng };

  const ghostNode = {
    id: 'live_user_001',
    lat: liveCoords.lat,
    lng: liveCoords.lng,
    nameEn: 'My Location',
  };

  _navGraphCache = buildRoutingGraph(campusPaths, [ghostNode, destination], campusEntranceNodes);
  const result = runDijkstra(_navGraphCache, ghostNode.id, destination.id);

  if (result && Array.isArray(result.path) && result.path.length > 0) {
    window.currentRouteNodes = getRouteNodes(result.path, _navGraphCache);
    drawLiveRoute(result.path, _navGraphCache, { fitBounds: false });
  }
};
// ── Category colours ──────────────────────────────────────────────────────
const categoryColors = {
  academic: '#4285F4',
  lab: '#FF6D00',
  admin: '#E53935',
  library: '#8E24AA',
  canteen: '#F9A825',
  hostel: '#43A047',
  sports: '#2E7D32',
  parking: '#757575',
  washroom: '#00ACC1',
  classroom: '#1565C0',
  washroom_girls: '#E91E8C',
  college: '#E53935',
};

// ── Marker Icon (BUG 5 — perfect circle, no tail) ─────────────────────────
function createMarkerIcon(category, labelEn, labelHi) {
  const color = categoryColors[category] || '#4285F4';
  const uid = category + '_' + Math.random().toString(36).slice(2, 7);

  const icons = {
    academic: '<path stroke-linecap="round" stroke-linejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5"/>',

    lab: '<path stroke-linecap="round" stroke-linejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 0-6.23-.693L5 14.5m14.8.8 1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0 1 12 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5"/>',

    admin: '<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Z"/>',

    library: '<path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25"/>',

    canteen: '<path d="m16 2-2.3 2.3a3 3 0 0 0 0 4.2l1.8 1.8a3 3 0 0 0 4.2 0L22 8"/><path d="M15 15 3.3 3.3a4.2 4.2 0 0 0 0 6l7.3 7.3c.7.7 2 .7 2.8 0L15 15Zm0 0 7 7"/><path d="m2.1 21.8 6.4-6.3"/><path d="m19 5-7 7"/>',

    hostel: '<path stroke-linecap="round" stroke-linejoin="round" d="M8.25 21v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21m0 0h4.5V3.545M12.75 21h7.5V10.75M2.25 21h1.5m18 0h-18M2.25 9l4.5-1.636M18.75 3l-1.5.545m0 6.205 3 1m1.5.5-1.5-.5M6.75 7.364V3h-3v18m3-13.636 10.5-3.819"/>',

    sports: '<path stroke-linecap="round" stroke-linejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 0 0 2.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 0 1 2.916.52 6.003 6.003 0 0 1-5.395 4.972m0 0a6.726 6.726 0 0 1-2.749 1.35m0 0a6.772 6.772 0 0 1-3.044 0"/>',

    parking: '<path stroke-linecap="round" stroke-linejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12"/>',

    washroom: '<path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"/>',

    washroom_girls: '<path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"/>',

    classroom: '<path stroke-linecap="round" stroke-linejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0V12a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 12V5.25"/>',

    college: '<path stroke-linecap="round" stroke-linejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0 0 12 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z"/>',
  };

  const innerIcon = icons[category] || '<circle cx="12" cy="12" r="5" fill="#ffffff"/>';

  // 36×36 pure circle pin with inner white dot
  const svg = `
    <svg width="36" height="36" viewBox="0 0 36 36"
         xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="sh-${uid}" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="3" stdDeviation="3.5"
                        flood-color="rgba(0,0,0,0.35)"/>
        </filter>
      </defs>
      <circle cx="18" cy="18" r="15"
              fill="${color}"
              stroke="#ffffff" stroke-width="3"
              filter="url(#sh-${uid})"/>
      <g transform="translate(6, 6)">
        <svg stroke="white" fill="none" stroke-width="1.5" viewBox="0 0 24 24" width="24" height="24">
          ${innerIcon}
        </svg>
      </g>
    </svg>`;

  return L.divIcon({
    className: 'custom-marker-wrap',
    html: `<div class="custom-marker-inner">${svg.trim()}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20],
  });
}

// ── Pin on-map label (BUG 6) — Leaflet DivOverlay text label ─────────────
function createLabelOverlay(location) {
  const nameEn = location.nameEn || '';
  const nameHi = location.nameHi || '';

  const labelDiv = L.divIcon({
    className: 'pin-label-wrap',
    html: '<div class="pin-label-inner">' +
      '<span class="pin-label-en">' + nameEn + '</span>' +
      '<span class="pin-label-hi">' + nameHi + '</span>' +
      '</div>',
    iconSize: [120, 30],
    iconAnchor: [60, -22],
  });

  return L.marker([location.lat, location.lng], {
    icon: labelDiv,
    interactive: false,
    keyboard: false,
    zIndexOffset: -100,
  });
}

// ── Map Initialisation ────────────────────────────────────────────────────
async function initMap() {
  const centerLat = CAMPUS_CENTER.lat;
  const centerLng = CAMPUS_CENTER.lng;

  // BUG 8: Leaflet Rotate options
  const mapOptions = {
    center: [centerLat, centerLng],
    zoom: 18,
    minZoom: 16,
    maxZoom: 22,
    zoomControl: true,
    rotate: true,
    rotateControl: {
      closeOnZeroBearing: true
    },
  };

  // Try to enable rotate plugin if available
  if (typeof L.Map.prototype.setBearing !== 'undefined' || window.leafletRotate) {
    mapOptions.rotate = true;
    mapOptions.touchRotate = true;
    mapOptions.rotateControl = { closeOnZeroBearing: true, position: 'topleft' };
  }

  map = L.map('map', mapOptions);
  currentRouteLayer.addTo(map);
  await loadCampusPaths();

  // Mapbox Satellite Streets tile layer
  L.tileLayer(
    'https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/{z}/{x}/{y}?access_token=pk.eyJ1Ijoic2FsbW9uMjMxIiwiYSI6ImNtbTM1MDRhdjBkZHgycHIzN3hkaTU1MGUifQ.2RR52XcJr8gwvHKhgoQRFA',
    {
      attribution: '© <a href="https://www.mapbox.com/">Mapbox</a> © <a href="https://www.openstreetmap.org/">OpenStreetMap</a>',
      tileSize: 512,
      zoomOffset: -1,
      maxNativeZoom: 19,
      maxZoom: 22,
      minZoom: 16,
    }
  ).addTo(map);

  markersLayerGroup = L.layerGroup().addTo(map);

  loadMarkers();

  // Live user location (Geolocation API)
  if (typeof window.initUserLocation === 'function') {
    window.initUserLocation(map);
  }

  function updateTierVisibility() {
    const z = map.getZoom();
    markers.forEach(function (entry) {
      const visibleTiers = Array.isArray(entry.location.visibleTiers)
        ? entry.location.visibleTiers
        : [parseInt(entry.location.tier, 10) || 1];

      let shouldShow = false;
      if (visibleTiers.includes(0) && z >= 16 && z < 18) shouldShow = true;
      if (visibleTiers.includes(1) && z >= 18 && z < 19) shouldShow = true;
      if (visibleTiers.includes(2) && z >= 19 && z < 21) shouldShow = true;
      if (visibleTiers.includes(3) && z >= 21) shouldShow = true;

      if (shouldShow) {
        if (!markersLayerGroup.hasLayer(entry.marker)) {
          markersLayerGroup.addLayer(entry.marker);
        }
      } else {
        if (markersLayerGroup.hasLayer(entry.marker)) {
          markersLayerGroup.removeLayer(entry.marker);
        }
      }
    });
    updatePinLabels();
  }

  map.on('zoomend', updateTierVisibility);
  updateTierVisibility();

  // BUG 6: Update visibility on zoom
  map.on('zoomend', () => {
    updatePinLabels();
  });

  // BUG 7: Track last user interaction
  map.on('drag zoom', resetAutoReturnTimer);
  map.on('zoomstart', resetAutoReturnTimer);

  // BUG 8: Add compass / reset-rotation button
  // addCompassControl();

  // Start auto-return watcher
  resetAutoReturnTimer();

}

// ── Compass Control (BUG 8) ───────────────────────────────────────────────
function addCompassControl() {
  const CompassControl = L.Control.extend({
    onAdd(m) {
      const btn = L.DomUtil.create('button', 'compass-btn leaflet-bar');
      btn.id = 'compass-btn';
      btn.title = 'Reset map rotation to north';
      btn.innerHTML = '🧭';
      btn.style.cssText =
        'width:34px;height:34px;background:rgba(255,255,255,0.82);' +
        'backdrop-filter:blur(10px);border:1px solid rgba(0,0,0,0.08);' +
        'border-radius:12px;box-shadow:0 2px 10px rgba(0,0,0,0.08);' +
        'cursor:pointer;font-size:18px;display:flex;align-items:center;' +
        'justify-content:center;transition:all 0.3s cubic-bezier(0.4,0,0.2,1);';
      L.DomEvent.on(btn, 'click', L.DomEvent.stopPropagation);
      L.DomEvent.on(btn, 'click', L.DomEvent.preventDefault);
      L.DomEvent.on(btn, 'click', () => {
        if (m.setBearing) m.setBearing(0);
        btn.style.transform = 'rotate(0deg)';
      });

      // Update compass icon as bearing changes
      m.on('rotate', (e) => {
        if (e && e.bearing !== undefined) {
          btn.style.transform = `rotate(${-e.bearing}deg)`;
        }
      });

      return btn;
    },
    onRemove() { },
  });

  new CompassControl({ position: 'topleft' }).addTo(map);
}

// ── Markers ───────────────────────────────────────────────────────────────
function loadMarkers() {
  markersLayerGroup.clearLayers();
  markers = [];

  getActiveLocations().forEach((location) => {
    const marker = L.marker([location.lat, location.lng], {
      icon: createMarkerIcon(location.category, location.nameEn, location.nameHi),
    });

    marker.on('click', () => {
      focusLocation(location, { fromMarker: true });
    });

    markersLayerGroup.addLayer(marker);

    // Create the label overlay (initially hidden via CSS)
    const labelMarker = createLabelOverlay(location);
    labelMarker._locationId = location.id;

    markers.push({ marker, location, labelMarker, visible: true, labelVisible: false });
  });

  // Apply initial visibility based on starting zoom
  updatePinLabels();
}

// ── BUG 6 — Show/hide pin labels with tier logic ─────────────────────────
function updatePinLabels() {
  const z = map.getZoom();
  markers.forEach(function (entry) {
    const visibleTiers = Array.isArray(entry.location.visibleTiers)
      ? entry.location.visibleTiers
      : [parseInt(entry.location.tier, 10) || 1];

    let shouldShowLabel = false;
    if (visibleTiers.includes(0) && z >= 16 && z < 18) shouldShowLabel = true;
    if (visibleTiers.includes(1) && z >= 18 && z < 19) shouldShowLabel = true;
    if (visibleTiers.includes(2) && z >= 19 && z < 21) shouldShowLabel = true;
    if (visibleTiers.includes(3) && z >= 21) shouldShowLabel = true;

    if (shouldShowLabel) {
      if (!markersLayerGroup.hasLayer(entry.labelMarker)) {
        markersLayerGroup.addLayer(entry.labelMarker);
      }
    } else {
      if (markersLayerGroup.hasLayer(entry.labelMarker)) {
        markersLayerGroup.removeLayer(entry.labelMarker);
      }
    }
  });
}

// ── BUG 7 — Auto-return to campus ────────────────────────────────────────
const AUTO_RETURN_IDLE_MS = 45000;   // 45 s of no interaction
const AUTO_RETURN_WARN_MS = 3000;    // 3 s of warning toast before flying
const AWAY_THRESHOLD_DEG = 0.01;    // degrees

function resetAutoReturnTimer() {
  clearTimeout(autoReturnTimer);
  autoReturnTimer = setTimeout(checkAutoReturn, AUTO_RETURN_IDLE_MS);
}

function checkAutoReturn() {
  const center = map.getCenter();
  const dLat = Math.abs(center.lat - CAMPUS_CENTER.lat);
  const dLng = Math.abs(center.lng - CAMPUS_CENTER.lng);

  if (dLat > AWAY_THRESHOLD_DEG || dLng > AWAY_THRESHOLD_DEG) {
    showAutoReturnToast();
  } else {
    // Still near campus — reset timer
    resetAutoReturnTimer();
  }
}

function showAutoReturnToast() {
  // Remove any existing auto-return toast
  dismissAutoReturnToast();

  const toast = document.createElement('div');
  toast.id = 'auto-return-toast';
  toast.style.cssText =
    'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);' +
    'background:rgba(255,255,255,0.92);backdrop-filter:blur(16px);' +
    'border:1px solid rgba(0,0,0,0.08);border-radius:16px;' +
    'box-shadow:0 6px 28px rgba(0,0,0,0.14);padding:12px 20px;' +
    'font-family:-apple-system,BlinkMacSystemFont,"Inter",sans-serif;' +
    'font-size:14px;font-weight:500;color:#1c1c1e;' +
    'display:flex;align-items:center;gap:12px;z-index:9999;' +
    'animation:toast-slide-up 0.35s cubic-bezier(0.34,1.56,0.64,1);';

  toast.innerHTML =
    '<span>🏛️ Returning to campus…</span>' +
    '<button id="auto-return-cancel" style="' +
    'background:rgba(120,120,128,0.16);border:none;border-radius:8px;' +
    'padding:5px 12px;font-size:12px;font-weight:600;cursor:pointer;' +
    'color:#3a3a3c;font-family:inherit;">Cancel</button>';

  document.body.appendChild(toast);
  autoReturnToast = toast;

  document.getElementById('auto-return-cancel').addEventListener('click', () => {
    dismissAutoReturnToast();
    resetAutoReturnTimer();
  });

  // After 3 s, fly to campus
  autoReturnCountdown = setTimeout(() => {
    dismissAutoReturnToast();
    map.flyTo([CAMPUS_CENTER.lat, CAMPUS_CENTER.lng], 18, { duration: 2 });
    resetAutoReturnTimer();
  }, AUTO_RETURN_WARN_MS);
}

function dismissAutoReturnToast() {
  clearTimeout(autoReturnCountdown);
  autoReturnCountdown = null;
  if (autoReturnToast) {
    autoReturnToast.remove();
    autoReturnToast = null;
  }
}

// ── Language Helpers ──────────────────────────────────────────────────────
function getLocationName(location) {
  return currentLang === 'hi' ? location.nameHi : location.nameEn;
}

function getCategoryLabel(category) {
  const strings = LANG[currentLang];
  return strings.categories[category] || category;
}

// ── UI String Update ──────────────────────────────────────────────────────
function updateUIStrings() {
  const strings = LANG[currentLang];

  const sidebarTitleEl = document.getElementById('sidebar-title');
  const sidebarSubtitleEl = document.getElementById('sidebar-subtitle');
  const sidebarDefaultEl = document.getElementById('sidebar-default-text');
  const searchInput = document.getElementById('search-input');
  const adminBtn = document.getElementById('admin-btn');
  const langToggle = document.getElementById('lang-toggle');
  const floorLabel = document.getElementById('floor-label');
  const blockLabel = document.getElementById('block-label');

  if (sidebarTitleEl) sidebarTitleEl.textContent = strings.sidebarTitle;
  if (sidebarSubtitleEl) sidebarSubtitleEl.textContent = strings.sidebarSubtitle;
  if (sidebarDefaultEl) sidebarDefaultEl.textContent = strings.sidebarDefault;
  if (searchInput) searchInput.placeholder = strings.searchPlaceholder;
  if (adminBtn) adminBtn.textContent = strings.adminButton;
  if (langToggle) langToggle.textContent = strings.languageToggle;
  if (floorLabel) floorLabel.textContent = strings.floorLabel;
  if (blockLabel) blockLabel.textContent = strings.blockLabel;

  // Refresh popup + icon for all markers
  markers.forEach(({ marker, location }) => {
    marker.setIcon(createMarkerIcon(location.category, location.nameEn, location.nameHi));
  });

  // Refresh details panel if a location is selected
  if (selectedLocationId) {
    const loc = getActiveLocations().find((l) => l.id === selectedLocationId);
    if (loc) showLocationDetails(loc);
  }
}

// ── Sidebar / Location Details ────────────────────────────────────────────
function showLocationDetails(location) {
  const sidebarDefault = document.getElementById('sidebar-default');
  const details = document.getElementById('location-details');

  const nameEl = document.getElementById('location-name');
  const categoryEl = document.getElementById('location-category');
  const floorEl = document.getElementById('location-floor');
  const blockEl = document.getElementById('location-block');
  const descEl = document.getElementById('location-description');
  const photoArea = document.getElementById('location-photo-area');
  const navBtn = document.getElementById('btn-navigate-live');

  if (!details || !sidebarDefault) return;

  sidebarDefault.style.display = 'none';
  details.classList.remove('hidden');

  if (nameEl) nameEl.textContent = getLocationName(location);

  if (categoryEl) {
    categoryEl.textContent = getCategoryLabel(location.category);
    categoryEl.style.backgroundColor = categoryColors[location.category] || '#2563eb';
  }

  if (floorEl) floorEl.textContent = location.floor || '-';
  if (blockEl) blockEl.textContent = location.block || '-';
  if (descEl) descEl.textContent = location.description || '';
  if (navBtn) {
    navBtn.onclick = () => startLiveNavigation(location);
  }

  // BUG 4 & 5 — Show photo or placeholder with multi-photo support
  if (photoArea) {
    const photos = (location.photos && location.photos.length > 0)
      ? location.photos
      : (location.photo ? [location.photo] : []);

    if (photos.length === 0) {
      photoArea.innerHTML =
        '<div class="photo-placeholder">' +
        '<span style="font-size:24px;display:block;margin-bottom:6px;">📷</span>' +
        '<span>No photo available</span></div>';
    } else {
      // Show first photo full width
      const wrapper = document.createElement('div');
      wrapper.style.cssText = 'position:relative;';

      const mainImg = document.createElement('img');
      mainImg.src = photos[0];
      mainImg.style.cssText = 'width:100%;height:160px;object-fit:cover;' +
        'border-radius:12px;display:block;cursor:pointer;';
      mainImg.addEventListener('click', function () { openLightbox(photos[0]); });

      wrapper.appendChild(mainImg);

      // If more than 1 photo, show "See all photos" button
      if (photos.length > 1) {
        const seeAll = document.createElement('button');
        seeAll.textContent = '🖼 See all ' + photos.length + ' photos';
        seeAll.style.cssText =
          'position:absolute;bottom:10px;left:10px;' +
          'background:rgba(0,0,0,0.45);backdrop-filter:blur(8px);' +
          'color:#fff;border:none;border-radius:20px;' +
          'padding:5px 12px;font-size:12px;font-weight:500;' +
          'cursor:pointer;font-family:inherit;';
        seeAll.addEventListener('click', function () {
          openPhotoGallery(photos);
        });
        wrapper.appendChild(seeAll);
      }

      photoArea.innerHTML = '';
      photoArea.appendChild(wrapper);
    }
  }
}

function openSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.classList.remove('sidebar-collapsed');
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;
  sidebar.classList.toggle('sidebar-collapsed');
}

function focusLocation(location, options = {}) {
  selectedLocationId = location.id;
  openSidebar();

  const visibleTiers = Array.isArray(location.visibleTiers)
    ? location.visibleTiers
    : [parseInt(location.tier, 10) || 1];

  const maxTier = Math.max(...visibleTiers);
  let targetZoom;

  if (maxTier === 0) targetZoom = 17;
  else if (maxTier === 1) targetZoom = 18.5;
  else if (maxTier === 2) targetZoom = 19.5;
  else if (maxTier === 3) targetZoom = 21;
  else targetZoom = 18.5;

  const currentZoom = map.getZoom();
  const safeZoom = Math.max(currentZoom, targetZoom);
  map.flyTo([location.lat, location.lng], safeZoom, { animate: true, duration: 0.8 });

  showLocationDetails(location);

  if (!options.fromMarker) {
    const entry = markers.find((m) => m.location.id === location.id);
    if (entry) entry.marker.openPopup();
  }
}

// ── Search ────────────────────────────────────────────────────────────────
function setupSearch() {
  const searchInput = document.getElementById('search-input');
  const searchResults = document.getElementById('search-results');
  if (!searchInput || !searchResults) return;

  function clearResults() {
    searchResults.innerHTML = '';
    searchResults.classList.remove('visible');
  }

  function fuzzyScore(str, query) {
    str = str.toLowerCase();
    query = query.toLowerCase().trim();
    if (!query) return 0;
    if (str === query) return 100;
    if (str.startsWith(query)) return 90;
    if (str.includes(query)) return 75;

    // Character-by-character fuzzy match
    let si = 0, qi = 0, score = 0;
    while (si < str.length && qi < query.length) {
      if (str[si] === query[qi]) { score++; qi++; }
      si++;
    }
    return qi === query.length ? Math.round((score / query.length) * 60) : 0;
  }

  function getSearchMatches(query) {
    return getActiveLocations()
      .map((pin) => ({
        pin,
        score: Math.max(
          fuzzyScore(pin.nameEn, query),
          fuzzyScore(pin.nameHi || '', query),
          fuzzyScore(pin.category || '', query)
        )
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map((item) => item.pin);
  }

  function renderResults(query) {
    const strings = LANG[currentLang];
    const trimmed = query.trim().toLowerCase();

    if (!trimmed) { clearResults(); return; }

    const matches = getSearchMatches(trimmed);

    searchResults.innerHTML = '';

    if (!matches.length) {
      const item = document.createElement('div');
      item.className = 'search-result-item';
      item.textContent = strings.noResults;
      searchResults.appendChild(item);
      searchResults.classList.add('visible');
      return;
    }

    matches.forEach((loc) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'search-result-item';

      const nameSpan = document.createElement('span');
      nameSpan.className = 'search-result-name';
      nameSpan.textContent = getLocationName(loc);

      const catSpan = document.createElement('span');
      catSpan.className = 'search-result-category';
      catSpan.textContent = getCategoryLabel(loc.category);

      button.appendChild(nameSpan);
      button.appendChild(catSpan);

      button.addEventListener('click', () => {
        focusLocation(loc, { fromSearch: true });
        clearResults();
        searchInput.blur();
      });

      searchResults.appendChild(button);
    });

    searchResults.classList.add('visible');
  }

  searchInput.addEventListener('input', (e) => renderResults(e.target.value || ''));

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const trimmed = (searchInput.value || '').trim().toLowerCase();
      const matches = getSearchMatches(trimmed);
      if (matches.length === 1) {
        focusLocation(matches[0], { fromSearch: true });
        clearResults();
        searchInput.blur();
      }
    } else if (e.key === 'Escape') {
      clearResults();
      searchInput.blur();
    }
  });

  document.addEventListener('click', (e) => {
    if (!searchResults.contains(e.target) && e.target !== searchInput) {
      clearResults();
    }
  });
}

// ── Setup Helpers ─────────────────────────────────────────────────────────
function setupLanguageToggle() {
  const langToggle = document.getElementById('lang-toggle');
  if (!langToggle) return;
  langToggle.addEventListener('click', () => {
    currentLang = currentLang === 'en' ? 'hi' : 'en';
    updateUIStrings();
  });
}

function setupSidebarToggle() {
  const sidebarToggle = document.getElementById('sidebar-toggle');
  if (!sidebarToggle) return;
  sidebarToggle.addEventListener('click', toggleSidebar);
}

// ── CSS for toast animation (injected once) ───────────────────────────────
function injectDynamicStyles() {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes toast-slide-up {
      from { transform: translateX(-50%) translateY(20px); opacity: 0; }
      to   { transform: translateX(-50%) translateY(0);    opacity: 1; }
    }

    /* BUG 6 — Pin label styles */
    .pin-label-wrap {
      background: transparent !important;
      border: none !important;
      pointer-events: none;
    }
    .pin-label-inner {
      display: flex;
      flex-direction: column;
      align-items: center;
      background: transparent;
      padding: 2px 0;
      white-space: nowrap;
      pointer-events: none;
      margin-top: 2px;
    }
    .pin-label-en {
      font-size: 12px;
      font-weight: 600;
      color: #ffffff;
      display: block;
      font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif;
      text-shadow: 
        0px 1px 3px rgba(0,0,0,0.9),
        0px 0px 6px rgba(0,0,0,0.8),
        1px 1px 0px rgba(0,0,0,0.9),
        -1px -1px 0px rgba(0,0,0,0.9),
        1px -1px 0px rgba(0,0,0,0.9),
        -1px 1px 0px rgba(0,0,0,0.9);
      letter-spacing: 0.1px;
    }
    .pin-label-hi {
      font-size: 11px;
      font-weight: 500;
      color: rgba(255,255,255,0.88);
      display: block;
      font-family: 'Noto Sans Devanagari', -apple-system, BlinkMacSystemFont, sans-serif;
      text-shadow: 
        0px 1px 3px rgba(0,0,0,0.9),
        0px 0px 6px rgba(0,0,0,0.8),
        1px 1px 0px rgba(0,0,0,0.9),
        -1px -1px 0px rgba(0,0,0,0.9);
      letter-spacing: 0.1px;
    }

    /* BUG 5 — Hover scale on pin */
    .custom-marker-inner:hover svg {
      transform: scale(1.05);
    }
    .custom-marker-inner {
      overflow: visible;
      transform-origin: center;
    }
    .custom-marker-inner svg {
      transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    /* College teardrop pin */
    .college-marker-wrap {
      background: transparent !important;
      border: none !important;
    }
    .college-marker-inner svg {
      transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .college-marker-inner:hover svg {
      transform: scale(1.1);
    }
  `;
  document.head.appendChild(style);
}

// ── Boot ──────────────────────────────────────────────────────────────────
function openLightbox(src) {
  const lb = document.getElementById('photo-lightbox');
  const img = document.getElementById('lightbox-img');
  img.src = src;
  lb.style.display = 'flex';
}

function openPhotoGallery(photos) {
  // Simple gallery — open first photo in lightbox,
  // add prev/next arrows to cycle through all
  let current = 0;

  const lb = document.getElementById('photo-lightbox');
  const img = document.getElementById('lightbox-img');

  // Add nav buttons if not already present
  let prevBtn = document.getElementById('lightbox-prev');
  let nextBtn = document.getElementById('lightbox-next');

  if (!prevBtn) {
    prevBtn = document.createElement('button');
    prevBtn.id = 'lightbox-prev';
    prevBtn.textContent = '‹';
    prevBtn.style.cssText =
      'position:fixed;left:20px;top:50%;transform:translateY(-50%);' +
      'width:44px;height:44px;border-radius:50%;border:none;' +
      'background:rgba(255,255,255,0.2);color:#fff;font-size:28px;' +
      'cursor:pointer;display:flex;align-items:center;justify-content:center;';
    lb.appendChild(prevBtn);
  }

  if (!nextBtn) {
    nextBtn = document.createElement('button');
    nextBtn.id = 'lightbox-next';
    nextBtn.textContent = '›';
    nextBtn.style.cssText =
      'position:fixed;right:20px;top:50%;transform:translateY(-50%);' +
      'width:44px;height:44px;border-radius:50%;border:none;' +
      'background:rgba(255,255,255,0.2);color:#fff;font-size:28px;' +
      'cursor:pointer;display:flex;align-items:center;justify-content:center;';
    lb.appendChild(nextBtn);
  }

  function showPhoto(idx) {
    current = (idx + photos.length) % photos.length;
    img.src = photos[current];
    prevBtn.style.display = photos.length > 1 ? 'flex' : 'none';
    nextBtn.style.display = photos.length > 1 ? 'flex' : 'none';
  }

  prevBtn.onclick = function (e) { e.stopPropagation(); showPhoto(current - 1); };
  nextBtn.onclick = function (e) { e.stopPropagation(); showPhoto(current + 1); };

  showPhoto(0);
  lb.style.display = 'flex';
}

function closeLightbox() {
  const lb = document.getElementById('photo-lightbox');
  lb.style.display = 'none';
  document.getElementById('lightbox-img').src = '';
  const prev = document.getElementById('lightbox-prev');
  const next = document.getElementById('lightbox-next');
  if (prev) prev.style.display = 'none';
  if (next) next.style.display = 'none';
}

async function initApp() {
  injectDynamicStyles();
  activeCampusPins = await loadCampusPins();
  await initMap();
  populateReportPinDropdown();
  setupSearch();
  setupLanguageToggle();
  setupSidebarToggle();
  updateUIStrings();

  const stopNavBtn = document.getElementById('btn-stop-nav');
  if (stopNavBtn) {
    stopNavBtn.onclick = window.stopLiveNavigation;
  }

  const lbClose = document.getElementById('lightbox-close');
  const lb = document.getElementById('photo-lightbox');
  if (lbClose) lbClose.addEventListener('click', closeLightbox);
  if (lb) lb.addEventListener('click', function (e) {
    if (e.target === lb) closeLightbox();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeLightbox();
  });
}

function populateReportPinDropdown() {
  const select = document.getElementById('report-pin-select');
  if (!select) return;
  select.length = 1;
  const pins = getActiveLocations();
  pins.forEach(function(pin) {
    const opt = document.createElement('option');
    opt.value = pin.id;
    opt.textContent = pin.nameEn;
    select.appendChild(opt);
  });
}

async function submitReport() {
  const pinId = document.getElementById('report-pin-select').value;
  const type = document.getElementById('report-type').value;
  const desc = document.getElementById('report-description').value.trim();
  const email = document.getElementById('report-user-email').value;
  const status = document.getElementById('report-status');

  if (!pinId) {
    status.textContent = 'Please select a location.';
    status.style.color = '#f87171';
    return;
  }

  status.textContent = 'Submitting...';
  status.style.color = 'var(--color-text-secondary)';

  try {
    await db.collection('pinReports').add({
      pinId: pinId,
      type: type,
      description: desc,
      reportedBy: email || 'anonymous',
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      status: 'open'
    });
    status.textContent = '✅ Report submitted. Thank you!';
    status.style.color = '#4ade80';
    setTimeout(function() {
      closeReportModal();
      document.getElementById('report-description').value = '';
      document.getElementById('report-status').textContent = '';
    }, 2000);
  } catch (err) {
    status.textContent = '❌ Submission failed. Please try again.';
    console.error('[CNS] Report submission error:', err);
    status.style.color = '#f87171';
  }
}

document.addEventListener('DOMContentLoaded', initApp);
