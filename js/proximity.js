// proximity.js — proximity detection for live user location vs campus pins
//
// Exposed as:
//   window.checkNearbyLocation(userLat, userLng, locations, [options])
//   window.initProximityNotifier([options]) -> { update(userLat, userLng, locations), hide() }

(function attachProximityModule(global) {
  'use strict';

  const DEFAULT_THRESHOLD_M = 40;
  const UI_ID = 'proximity-notice';

  function isFiniteNumber(n) {
    return typeof n === 'number' && Number.isFinite(n);
  }

  // Haversine distance in meters
  function haversineMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000; // meters
    const toRad = (d) => (d * Math.PI) / 180;

    const φ1 = toRad(lat1);
    const φ2 = toRad(lat2);
    const Δφ = toRad(lat2 - lat1);
    const Δλ = toRad(lon2 - lon1);

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Find nearest pin within a proximity threshold.
   *
   * @param {number} userLat
   * @param {number} userLng
   * @param {Array<object>} locations pins (must contain lat,lng,id,nameEn,nameHi)
   * @param {{ thresholdMeters?: number }} [options]
   * @returns {{ pin: object, distanceMeters: number } | null}
   */
  function checkNearbyLocation(userLat, userLng, locations, options) {
    if (!isFiniteNumber(userLat) || !isFiniteNumber(userLng)) return null;
    if (!Array.isArray(locations) || locations.length === 0) return null;

    const thresholdMeters =
      options && isFiniteNumber(options.thresholdMeters)
        ? options.thresholdMeters
        : DEFAULT_THRESHOLD_M;

    let best = null;

    for (let i = 0; i < locations.length; i += 1) {
      const pin = locations[i];
      if (!pin) continue;

      const lat = pin.lat;
      const lng = pin.lng;
      if (!isFiniteNumber(lat) || !isFiniteNumber(lng)) continue;

      const d = haversineMeters(userLat, userLng, lat, lng);
      if (d > thresholdMeters) continue;

      if (!best || d < best.distanceMeters) {
        best = { pin, distanceMeters: d };
      }
    }

    return best;
  }

  function ensureUI() {
    let el = document.getElementById(UI_ID);
    if (el) return el;

    el = document.createElement('div');
    el.id = UI_ID;
    el.className = 'proximity-notice';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');

    // Inner content container (easier to style)
    const inner = document.createElement('div');
    inner.className = 'proximity-notice-inner';
    el.appendChild(inner);

    document.body.appendChild(el);
    return el;
  }

  function getPinNameByLang(pin, lang) {
    const l = (lang || 'en').toLowerCase();
    if (l === 'hi') return pin.nameHi || pin.nameEn || '';
    return pin.nameEn || pin.nameHi || '';
  }

  /**
   * UI helper that avoids repeated updates when still near same pin.
   *
   * options:
   * - getLang: () => 'en' | 'hi'
   * - thresholdMeters: number (default 40)
   */
  function initProximityNotifier(options) {
    const getLang =
      options && typeof options.getLang === 'function'
        ? options.getLang
        : () => (global.__CNS_getLang ? global.__CNS_getLang() : 'en');

    const thresholdMeters =
      options && isFiniteNumber(options.thresholdMeters)
        ? options.thresholdMeters
        : DEFAULT_THRESHOLD_M;

    const el = ensureUI();
    const inner = el.querySelector('.proximity-notice-inner');

    let lastDetectedPinId = null;
    let visible = false;

    function show(text) {
      if (inner) inner.textContent = text;
      if (!visible) {
        visible = true;
        el.classList.add('visible');
      }
    }

    function hide() {
      if (!visible) return;
      visible = false;
      el.classList.remove('visible');
      lastDetectedPinId = null;
    }

    function update(userLat, userLng, locations) {
      const match = checkNearbyLocation(userLat, userLng, locations, { thresholdMeters });

      if (!match || !match.pin) {
        hide();
        return;
      }

      const pin = match.pin;
      const pinId = pin.id || null;
      if (pinId && pinId === lastDetectedPinId) return; // avoid repeated UI updates

      lastDetectedPinId = pinId;
      const lang = getLang();
      const name = getPinNameByLang(pin, lang);
      if (!name) return;

      show(`You are near ${name}`);
    }

    return { update, hide };
  }

  global.checkNearbyLocation = checkNearbyLocation;
  global.initProximityNotifier = initProximityNotifier;
})(window);

