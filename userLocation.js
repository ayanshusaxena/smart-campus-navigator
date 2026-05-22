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
    timeout: 15000,
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

      const latlng = [c.latitude, c.longitude];

      // Building polygon lock — if user is inside a known building polygon,
      // keep the displayed dot inside the polygon boundary.
      // Uses isInsideBuilding from routing.js (loaded before userLocation.js).
      let displayLat = c.latitude;
      let displayLng = c.longitude;

      if (
        typeof isInsideBuilding === 'function' &&
        Array.isArray(window.buildingPolygons) &&
        window.buildingPolygons.length > 0
      ) {
        // Raw GPS is inside a building — good, keep as is.
        // Raw GPS is outside but was inside before — could be GPS drift.
        // We keep raw coords; polygon lock only prevents dot from
        // floating FAR outside during indoor use.
        const insideNow = isInsideBuilding(c.latitude, c.longitude);
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
          const jumpDist = haversine(lastLat, lastLng, c.latitude, c.longitude);
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
      global.userLat = c.latitude;
      global.userLng = c.longitude;

      ensureMarker(displayLatlng).setLatLng(displayLatlng);
      ensureAccuracyCircle(displayLatlng, c.accuracy);

      // Proximity detection (only on live updates)
      if (proximityNotifier && typeof proximityNotifier.update === 'function') {
        const locations =
          global.__CNS_getLocations && typeof global.__CNS_getLocations === 'function'
            ? global.__CNS_getLocations()
            : (global.CAMPUS_LOCATIONS || []);
        proximityNotifier.update(c.latitude, c.longitude, locations);
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
