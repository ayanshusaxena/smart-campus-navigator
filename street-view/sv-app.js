// sv-app.js - Smart Campus Navigator Street View
// Pannellum-based 360° panorama viewer

// Panorama data with yaw angles from field measurement

const LOCATIONS = [
  {
    id: "img1",
    label: "Main Gate",
    sublabel: "Campus entrance from Jhansi Road",
    file: "photos/img1.jpeg",
    defaultYaw: 340,
    defaultPitch: 0,
    nextHotspotYaw: 329,
    nextHotspotPitch: 0,
    prevHotspotYaw: 149,
    prevHotspotPitch: 0
  },
  {
    id: "img2",
    label: "Inside Gate",
    sublabel: "Just inside the main entrance",
    file: "photos/img2.jpeg",
    defaultYaw: 151,
    defaultPitch: 0,
    nextHotspotYaw: 171,
    nextHotspotPitch: 0,
    prevHotspotYaw: 340,
    prevHotspotPitch: 0
  },
  {
    id: "img3",
    label: "Campus Path",
    sublabel: "Main walking path inside campus",
    file: "photos/img3.jpeg",
    defaultYaw: 313,
    defaultPitch: 0,
    nextHotspotYaw: 313,
    nextHotspotPitch: 0,
    prevHotspotYaw: 133,
    prevHotspotPitch: 0
  },
  {
    id: "img4",
    label: "Academic Block",
    sublabel: "Approaching academic buildings",
    file: "photos/img4.jpeg",
    defaultYaw: 318,
    defaultPitch: 0,
    nextHotspotYaw: 318,
    nextHotspotPitch: 0,
    prevHotspotYaw: 138,
    prevHotspotPitch: 0
  },
  {
    id: "img5",
    label: "Mid Campus",
    sublabel: "Central campus area",
    file: "photos/img5.jpeg",
    defaultYaw: 33,
    defaultPitch: 0,
    nextHotspotYaw: 315,
    nextHotspotPitch: 0,
    prevHotspotYaw: 135,
    prevHotspotPitch: 0
  },
  {
    id: "img6",
    label: "Parking Approach",
    sublabel: "Path leading to parking area",
    file: "photos/img6.jpeg",
    defaultYaw: 316,
    defaultPitch: 0,
    nextHotspotYaw: 245,
    nextHotspotPitch: 0,
    prevHotspotYaw: 65,
    prevHotspotPitch: 0
  },
  {
    id: "img7",
    label: "Parking Lot",
    sublabel: "Campus parking area",
    file: "photos/img7.jpeg",
    defaultYaw: 322,
    defaultPitch: 0,
    nextHotspotYaw: null,
    nextHotspotPitch: 0,
    prevHotspotYaw: 142,
    prevHotspotPitch: 0
  }
];

// State

let currentIndex = 0;
let viewer = null;

// Init

document.addEventListener('DOMContentLoaded', function() {
  buildLocationStrip();
  buildDots();
  loadScene(0);
});

// Build UI

function buildLocationStrip() {
  const strip = document.getElementById('location-strip');
  LOCATIONS.forEach(function(loc, i) {
    const chip = document.createElement('button');
    chip.className = 'sv-loc-chip' + (i === 0 ? ' active' : '');
    chip.id = 'chip-' + i;
    chip.textContent = loc.label;
    chip.onclick = function() { loadScene(i); };
    strip.appendChild(chip);
  });
}

function buildDots() {
  const dotsEl = document.getElementById('location-dots');
  LOCATIONS.forEach(function(_, i) {
    const dot = document.createElement('div');
    dot.className = 'sv-dot' + (i === 0 ? ' active' : '');
    dot.id = 'dot-' + i;
    dot.onclick = function() { loadScene(i); };
    dotsEl.appendChild(dot);
  });
}

// Load Scene

function loadScene(index) {
  currentIndex = index;
  const loc = LOCATIONS[index];

  // Build hotspots
  const hotspots = [];

  // Next hotspot
  if (loc.nextHotspotYaw !== null && index < LOCATIONS.length - 1) {
    hotspots.push({
      pitch: loc.nextHotspotPitch,
      yaw: loc.nextHotspotYaw,
      type: 'scene',
      text: '→ ' + LOCATIONS[index + 1].label,
      cssClass: 'pnlm-hotspot-base',
      clickHandlerFunc: function() { loadScene(index + 1); }
    });
  }

  // Prev hotspot
  if (index > 0 && loc.prevHotspotYaw !== null) {
    hotspots.push({
      pitch: loc.prevHotspotPitch,
      yaw: loc.prevHotspotYaw,
      type: 'scene',
      text: '← ' + LOCATIONS[index - 1].label,
      cssClass: 'pnlm-hotspot-base',
      clickHandlerFunc: function() { loadScene(index - 1); }
    });
  }

  // Destroy previous viewer
  if (viewer) {
    viewer.destroy();
    viewer = null;
  }

  // Init Pannellum
  viewer = pannellum.viewer('panorama-container', {
    type: 'equirectangular',
    panorama: loc.file,
    autoLoad: true,
    autoRotate: -2,
    autoRotateStopDelay: 3000,
    compass: false,
    showZoomCtrl: true,
    showFullscreenCtrl: true,
    mouseZoom: true,
    keyboardZoom: true,
    yaw: loc.defaultYaw,
    pitch: loc.defaultPitch,
    hfov: 100,
    minHfov: 50,
    maxHfov: 120,
    hotSpots: hotspots,
    strings: {
      loadButtonLabel: 'Click to load panorama',
      loadingLabel: 'Loading...',
      bylineLabel: '',
      noPanoramaError: 'Panorama image not found.',
      fileAccessError: 'Could not load image.',
      malformedURLError: 'Invalid URL.',
      iOS8WebGLError: 'WebGL not supported.',
      genericWebGLError: 'WebGL error.',
      textureSizeError: 'Image too large.',
      unknownError: 'Unknown error.'
    }
  });

  updateUI(index);
}

// Update UI

function updateUI(index) {
  const loc = LOCATIONS[index];

  // Title
  document.getElementById('location-title').textContent = loc.label;
  document.getElementById('location-counter').textContent =
    (index + 1) + ' / ' + LOCATIONS.length;

  // Dots
  document.querySelectorAll('.sv-dot').forEach(function(d, i) {
    d.classList.toggle('active', i === index);
  });

  // Chips
  document.querySelectorAll('.sv-loc-chip').forEach(function(c, i) {
    c.classList.toggle('active', i === index);
  });

  // Scroll chip into view
  const activeChip = document.getElementById('chip-' + index);
  if (activeChip) {
    activeChip.scrollIntoView({ behavior: 'smooth', inline: 'center' });
  }

  // Prev/Next buttons
  document.getElementById('btn-prev').disabled = index === 0;
  document.getElementById('btn-next').disabled =
    index === LOCATIONS.length - 1;
}

// Navigation

function goToPrev() {
  if (currentIndex > 0) loadScene(currentIndex - 1);
}

function goToNext() {
  if (currentIndex < LOCATIONS.length - 1) loadScene(currentIndex + 1);
}

// Keyboard navigation
document.addEventListener('keydown', function(e) {
  if (e.key === 'ArrowRight') goToNext();
  if (e.key === 'ArrowLeft') goToPrev();
  if (e.key === 'Escape') {
    window.location.href = '../index.html';
  }
});
