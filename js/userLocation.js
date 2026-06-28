// userLocation.js — live user location (Geolocation API + Leaflet)
//
// Usage (non-module script):
//   initUserLocation(map)
//
// Exposed as:
//   window.initUserLocation

(function attachUserLocationModule(global) {
  'use strict';

  const DEFAULT_WATCH_OPTIONS = {
    enableHighAccuracy: true,
    maximumAge: 0,
    timeout: 30000,
  };

  function ensureLeaflet() {
    if (!global.L) return null;
    return global.L;
  }

  /**
   * Initialize live user location tracking.
   *
   * - Uses watchPosition() for continuous updates
   * - Creates marker once and updates with setLatLng()
   * - Optionally draws accuracy circle
   *
   * @param {L.Map} map Leaflet map instance
   * @returns {{ stop: () => void } | null}
   */
  function initUserLocation(map) {
    const L = ensureLeaflet();
    if (!L || !map) return null;

    if (!('geolocation' in navigator) || !navigator.geolocation) {
      console.warn('Location unavailable:', 0);
      return null;
    }

    let watchId = null;
    let hasCentered = false;
    let marker = null;
    let accuracyCircle = null;
    let proximityNotifier = null;
    let smoothLat = null;
    let smoothLng = null;
    const SMOOTH_ALPHA = 0.25; // lower = smoother but laggier, 0.25 is good balance
    const MIN_MOVE_METERS = 3; // ignore updates smaller than this
    const MAX_ACCURACY_METERS = 200; // reject if GPS accuracy is worse than this

    global.__CNS_userLocation = global.__CNS_userLocation || {
      lat: null,
      lng: null,
      accuracy: null,
      updatedAt: null,
    };

    if (typeof global.initProximityNotifier === 'function') {
      proximityNotifier = global.initProximityNotifier({
        getLang: () => (global.__CNS_getLang ? global.__CNS_getLang() : 'en'),
        thresholdMeters: 40,
      });
    }

    // Recenter button — matches Leaflet zoom control style
    const recenterBtn = document.createElement('button');
    recenterBtn.id = 'recenter-btn';
    recenterBtn.setAttribute('aria-label', 'Center on my location');
    recenterBtn.title = 'My location';
    recenterBtn.innerHTML = '⊕';
    recenterBtn.className = 'leaflet-control-recenter';

    recenterBtn.addEventListener('click', function () {
      const loc = global.__CNS_userLocation;
      if (loc && Number.isFinite(loc.lat) && Number.isFinite(loc.lng)) {
        // Find the Leaflet map instance — try common globals
        const mapInstance = global.__CNS_map || global.map || global._leaflet_map;
        if (mapInstance && typeof mapInstance.flyTo === 'function') {
          mapInstance.flyTo([loc.lat, loc.lng], 18, { duration: 0.8 });
        }
      }
    });

    // Append inside the same Leaflet zoom container
    const zoomContainer = document.querySelector('.leaflet-control-zoom');
    if (zoomContainer) zoomContainer.appendChild(recenterBtn);

    function ensureMarker(latlng) {
      if (marker) return marker;

      const icon = L.divIcon({
        className: 'user-location-marker',
        html:
          '<div class="user-location-dot" aria-hidden="true">' +
          '  <div class="user-location-pulse" aria-hidden="true"></div>' +
          '</div>',
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });

      marker = L.marker(latlng, {
        icon,
        interactive: false,
        keyboard: false,
        zIndexOffset: 2000,
      }).addTo(map);

      return marker;
    }

    function ensureAccuracyCircle(latlng, accuracyMeters) {
      if (!Number.isFinite(accuracyMeters) || accuracyMeters <= 0) return null;

      if (!accuracyCircle) {
        accuracyCircle = L.circle(latlng, {
          radius: accuracyMeters,
          color: '#1a73e8',
          weight: 1,
          opacity: 0.6,
          fillColor: '#1a73e8',
          fillOpacity: 0.12,
          interactive: false,
        }).addTo(map);
      } else {
        accuracyCircle.setLatLng(latlng);
        accuracyCircle.setRadius(accuracyMeters);
      }

      return accuracyCircle;
    }

    function onPosition(pos) {
      const c = pos && pos.coords ? pos.coords : null;
      if (!c || typeof c.latitude !== 'number' || typeof c.longitude !== 'number') return;

      // Reject low-accuracy readings (GPS noise)
      if (Number.isFinite(c.accuracy) && c.accuracy > MAX_ACCURACY_METERS) return;

      // Exponential moving average smoothing — reduces GPS noise/jitter
      if (smoothLat === null) {
        smoothLat = c.latitude;
        smoothLng = c.longitude;
      } else {
        smoothLat = smoothLat + SMOOTH_ALPHA * (c.latitude - smoothLat);
        smoothLng = smoothLng + SMOOTH_ALPHA * (c.longitude - smoothLng);
      }
      const smoothedLat = smoothLat;
      const smoothedLng = smoothLng;

      // Dead zone - don't update if movement is smaller than GPS noise floor
      const lastLat = global.__CNS_userLocation?.lat;
      const lastLng = global.__CNS_userLocation?.lng;
      const haversineFn = global.__CNS_haversine || haversine;
      if (
        Number.isFinite(lastLat) && Number.isFinite(lastLng) &&
        haversineFn(smoothedLat, smoothedLng, lastLat, lastLng) < MIN_MOVE_METERS
      ) {
        // Position hasn't meaningfully changed - skip update, prevent drift
        if (global.isNavigating && typeof global.updateLiveNavigation === 'function') {
          global.updateLiveNavigation();
        }
        return;
      }

      const latlng = [smoothedLat, smoothedLng];

      // Building polygon lock — if user is inside a known building polygon,
      // keep the displayed dot inside the polygon boundary.
      // Uses isInsideBuilding from routing.js (loaded before userLocation.js).
      let displayLat = smoothedLat;
      let displayLng = smoothedLng;

      if (
        typeof isInsideBuilding === 'function' &&
        Array.isArray(window.buildingPolygons) &&
        window.buildingPolygons.length > 0
      ) {
        // Raw GPS is inside a building — good, keep as is.
        // Raw GPS is outside but was inside before — could be GPS drift.
        // We keep raw coords; polygon lock only prevents dot from
        // floating FAR outside during indoor use.
        const insideNow = isInsideBuilding(smoothedLat, smoothedLng);
        const lastLat = window.__CNS_userLocation?.lat;
        const lastLng = window.__CNS_userLocation?.lng;

        if (
          !insideNow &&
          Number.isFinite(lastLat) &&
          Number.isFinite(lastLng) &&
          isInsideBuilding(lastLat, lastLng)
        ) {
          // Previous fix was indoor, new fix jumped outside.
          // Check if jump distance is suspiciously large (> 20m = GPS drift).
          const haversine = window.__CNS_haversine || function(a,b,c,d){ return 0; };
          const jumpDist = haversine(lastLat, lastLng, smoothedLat, smoothedLng);
          if (jumpDist > 20) {
            // Reject the jump — hold last known good indoor position.
            displayLat = lastLat;
            displayLng = lastLng;
          }
        }
      }

      const displayLatlng = [displayLat, displayLng];

      global.__CNS_userLocation = {
        lat: c.latitude,
        lng: c.longitude,
        accuracy: c.accuracy,
        updatedAt: Date.now(),
      };
      global.userLat = smoothedLat;
      global.userLng = smoothedLng;

      ensureMarker(displayLatlng).setLatLng(displayLatlng);
      ensureAccuracyCircle(displayLatlng, c.accuracy);
      // Proximity detection (only on live updates)
      if (proximityNotifier && typeof proximityNotifier.update === 'function') {
        const locations =
          global.__CNS_getLocations && typeof global.__CNS_getLocations === 'function'
            ? global.__CNS_getLocations()
            : (global.CAMPUS_LOCATIONS || []);
        proximityNotifier.update(smoothedLat, smoothedLng, locations);
      }

      if (!hasCentered) {
        hasCentered = true;
        // Center once on first fix (avoid continuous auto-centering UX).
        map.flyTo(displayLatlng, 18, { duration: 1.1 });
      }

      if (global.isNavigating && typeof global.updateLiveNavigation === 'function') {
        global.updateLiveNavigation();
      }
    }

    function onError(err) {
      console.warn('Location unavailable:', err && err.code);
      if (proximityNotifier && typeof proximityNotifier.hide === 'function') {
        proximityNotifier.hide();
      }
    }

    try {
      watchId = navigator.geolocation.watchPosition(onPosition, onError, DEFAULT_WATCH_OPTIONS);
    } catch (err) {
      console.warn('Location unavailable:', err && err.code);
      return null;
    }

    return {
      stop() {
        if (typeof watchId === 'number') {
          try {
            navigator.geolocation.clearWatch(watchId);
          } catch (_) { }
        }
        watchId = null;
        smoothLat = null;
        smoothLng = null;

        if (marker) {
          try { marker.remove(); } catch (_) { }
          marker = null;
        }
        if (accuracyCircle) {
          try { accuracyCircle.remove(); } catch (_) { }
          accuracyCircle = null;
        }
        global.__CNS_userLocation = {
          lat: null,
          lng: null,
          accuracy: null,
          updatedAt: null,
        };
        global.userLat = null;
        global.userLng = null;
        if (proximityNotifier && typeof proximityNotifier.hide === 'function') {
          proximityNotifier.hide();
        }
      },
    };
  }

  // "Export" for this no-build setup.
  global.initUserLocation = initUserLocation;
})(window);
