// sv-app.js - Smart Campus Navigator Street View
// CSS-based panorama slider

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

  // Destroy previous viewer
  if (viewer) {
    viewer = null;
  }

  const container = document.getElementById('panorama-container');
  container.innerHTML = '';

  // Create draggable panorama
  const wrapper = document.createElement('div');
  wrapper.style.cssText = `
    width: 100%;
    height: 100%;
    overflow: hidden;
    position: relative;
    cursor: grab;
    user-select: none;
  `;

  const img = document.createElement('img');
  img.src = loc.file;
  img.style.cssText = `
    height: 100%;
    width: auto;
    max-width: none;
    display: block;
    pointer-events: none;
    position: absolute;
    left: 0;
    top: 0;
  `;

  wrapper.appendChild(img);
  container.appendChild(wrapper);

  // Wait for image to load then center it
  img.onload = function() {
    const startX = (img.offsetWidth - wrapper.offsetWidth) / 2;
    wrapper.scrollLeft = startX;
    img.style.left = '';
    img.style.position = 'relative';
    wrapper.style.overflowX = 'scroll';
    wrapper.style.overflowY = 'hidden';
    wrapper.style.scrollbarWidth = 'none';
  };

  // Drag to scroll
  let isDragging = false;
  let startX = 0;
  let scrollLeft = 0;

  wrapper.addEventListener('mousedown', function(e) {
    isDragging = true;
    wrapper.style.cursor = 'grabbing';
    startX = e.pageX - wrapper.offsetLeft;
    scrollLeft = wrapper.scrollLeft;
  });

  wrapper.addEventListener('mouseleave', function() {
    isDragging = false;
    wrapper.style.cursor = 'grab';
  });

  wrapper.addEventListener('mouseup', function() {
    isDragging = false;
    wrapper.style.cursor = 'grab';
  });

  wrapper.addEventListener('mousemove', function(e) {
    if (!isDragging) return;
    e.preventDefault();
    const x = e.pageX - wrapper.offsetLeft;
    const walk = (x - startX) * 1.5;
    wrapper.scrollLeft = scrollLeft - walk;
  });

  // Touch support for mobile
  wrapper.addEventListener('touchstart', function(e) {
    startX = e.touches[0].pageX;
    scrollLeft = wrapper.scrollLeft;
  }, { passive: true });

  wrapper.addEventListener('touchmove', function(e) {
    const x = e.touches[0].pageX;
    const walk = (startX - x) * 1.5;
    wrapper.scrollLeft = scrollLeft + walk;
  }, { passive: true });

  viewer = wrapper;

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
