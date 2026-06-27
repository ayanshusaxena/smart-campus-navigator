// sv-app.js - Smart Campus Navigator Street View
// GPU-accelerated transform-based panorama viewer with momentum

// ============================================
// Panorama Data
// ============================================

const LOCATIONS = [
  {
    id: "img1",
    label: "Main Gate",
    sublabel: "Campus entrance from Jhansi Road",
    file: "photos/img1.jpeg"
  },
  {
    id: "img2",
    label: "Inside Gate",
    sublabel: "Just inside the main entrance",
    file: "photos/img2.jpeg"
  },
  {
    id: "img3",
    label: "Campus Path",
    sublabel: "Main walking path inside campus",
    file: "photos/img3.jpeg"
  },
  {
    id: "img4",
    label: "Academic Block",
    sublabel: "Approaching academic buildings",
    file: "photos/img4.jpeg"
  },
  {
    id: "img5",
    label: "Mid Campus",
    sublabel: "Central campus area",
    file: "photos/img5.jpeg"
  },
  {
    id: "img6",
    label: "Parking Approach",
    sublabel: "Path leading to parking area",
    file: "photos/img6.jpeg"
  },
  {
    id: "img7",
    label: "Parking Lot",
    sublabel: "Campus parking area",
    file: "photos/img7.jpeg"
  }
];

// ============================================
// State
// ============================================

let currentIndex = 0;
let viewer = null;

// Transform-based panning state
let panState = {
  offsetX: 0,         // Current X offset (negative = panned right)
  isDragging: false,
  startPointerX: 0,
  startOffsetX: 0,
  imgWidth: 0,
  containerWidth: 0,
  // Momentum
  velocity: 0,
  lastPointerX: 0,
  lastTime: 0,
  animFrameId: null,
  img: null
};

// ============================================
// Init
// ============================================

document.addEventListener('DOMContentLoaded', function () {
  buildLocationStrip();
  buildDots();
  loadScene(0);
  setupGlobalTouchPrevention();
});

// Prevent any accidental scrolling/elastic bounce on the whole page
function setupGlobalTouchPrevention() {
  document.addEventListener('touchmove', function (e) {
    // Allow horizontal scrolling on the location strip
    if (e.target.closest('.sv-location-strip')) return;
    e.preventDefault();
  }, { passive: false });
}

// ============================================
// Build UI
// ============================================

function buildLocationStrip() {
  const strip = document.getElementById('location-strip');
  LOCATIONS.forEach(function (loc, i) {
    const chip = document.createElement('button');
    chip.className = 'sv-loc-chip' + (i === 0 ? ' active' : '');
    chip.id = 'chip-' + i;
    chip.textContent = loc.label;
    chip.onclick = function () { loadScene(i); };
    strip.appendChild(chip);
  });
}

function buildDots() {
  const dotsEl = document.getElementById('location-dots');
  LOCATIONS.forEach(function (_, i) {
    const dot = document.createElement('div');
    dot.className = 'sv-dot' + (i === 0 ? ' active' : '');
    dot.id = 'dot-' + i;
    dot.onclick = function () { loadScene(i); };
    dotsEl.appendChild(dot);
  });
}

// ============================================
// Load Scene
// ============================================

function loadScene(index) {
  currentIndex = index;
  const loc = LOCATIONS[index];

  // Cancel any running momentum animation
  if (panState.animFrameId) {
    cancelAnimationFrame(panState.animFrameId);
    panState.animFrameId = null;
  }

  const container = document.getElementById('panorama-container');
  container.classList.remove('is-dragging');

  // Clear previous
  container.innerHTML = '';

  // Reset pan state
  panState.offsetX = 0;
  panState.isDragging = false;
  panState.velocity = 0;
  panState.img = null;

  // Create GPU-accelerated image
  const img = document.createElement('img');
  img.className = 'sv-pano-image loading';
  img.src = loc.file;
  img.alt = loc.label;
  img.draggable = false;

  container.appendChild(img);
  panState.img = img;

  // When image loads, center it and enable interaction
  img.onload = function () {
    panState.imgWidth = img.naturalWidth * (container.offsetHeight / img.naturalHeight);
    panState.containerWidth = container.offsetWidth;

    // Set the image width explicitly to match container height aspect ratio
    img.style.height = '100%';
    img.style.width = panState.imgWidth + 'px';

    // Center the panorama
    panState.offsetX = -(panState.imgWidth - panState.containerWidth) / 2;
    applyTransform();

    // Fade in
    img.classList.remove('loading');
    img.classList.add('loaded');
  };

  // Attach pointer events to container
  setupPointerEvents(container);

  viewer = container;
  updateUI(index);
}

function applyTransform() {
  if (!panState.img) return;

  // Clamp offset so image edges don't go past container edges
  const minOffset = -(panState.imgWidth - panState.containerWidth);
  const maxOffset = 0;

  if (panState.offsetX < minOffset) panState.offsetX = minOffset;
  if (panState.offsetX > maxOffset) panState.offsetX = maxOffset;

  // Normalise pan position to [-1, +1]
  const scrollRange = panState.imgWidth - panState.containerWidth;
  const norm = scrollRange > 0
    ? (panState.offsetX / scrollRange) * 2 + 1
    : 0;

  // Very subtle rotateY — max ±1.5° at the edges only
  const rotY = -norm * 1.5;

  // GPU-composited transform — no scaling, no perspective
  panState.img.style.transform =
    'translate3d(' + panState.offsetX + 'px, 0, 0) ' +
    'rotateY(' + rotY + 'deg)';
}



// ============================================
// Pointer Events (Mouse + Touch unified)
// ============================================

function setupPointerEvents(container) {
  // --- Mouse Events ---
  container.addEventListener('mousedown', function (e) {
    e.preventDefault();
    startDrag(e.clientX);
    container.classList.add('is-dragging');
  });

  document.addEventListener('mousemove', function (e) {
    if (!panState.isDragging) return;
    e.preventDefault();
    moveDrag(e.clientX);
  });

  document.addEventListener('mouseup', function () {
    if (!panState.isDragging) return;
    endDrag();
    var c = document.getElementById('panorama-container');
    if (c) c.classList.remove('is-dragging');
  });

  // --- Touch Events ---
  container.addEventListener('touchstart', function (e) {
    // Only handle single finger
    if (e.touches.length !== 1) return;
    e.preventDefault();
    startDrag(e.touches[0].clientX);
    container.classList.add('is-dragging');
  }, { passive: false });

  container.addEventListener('touchmove', function (e) {
    if (!panState.isDragging) return;
    if (e.touches.length !== 1) return;
    e.preventDefault();
    moveDrag(e.touches[0].clientX);
  }, { passive: false });

  container.addEventListener('touchend', function () {
    if (!panState.isDragging) return;
    endDrag();
    container.classList.remove('is-dragging');
  });

  container.addEventListener('touchcancel', function () {
    if (!panState.isDragging) return;
    endDrag();
    container.classList.remove('is-dragging');
  });
}

// ============================================
// Drag Logic
// ============================================

function startDrag(pointerX) {
  // Stop any ongoing momentum
  if (panState.animFrameId) {
    cancelAnimationFrame(panState.animFrameId);
    panState.animFrameId = null;
  }

  panState.isDragging = true;
  panState.startPointerX = pointerX;
  panState.startOffsetX = panState.offsetX;
  panState.lastPointerX = pointerX;
  panState.lastTime = performance.now();
  panState.velocity = 0;
}

function moveDrag(pointerX) {
  const now = performance.now();
  const dt = now - panState.lastTime;

  // Calculate delta
  const deltaX = pointerX - panState.startPointerX;
  panState.offsetX = panState.startOffsetX + deltaX;

  // Track velocity (pixels per millisecond)
  if (dt > 0) {
    const instantVel = (pointerX - panState.lastPointerX) / dt;
    // Smooth velocity with exponential moving average
    panState.velocity = panState.velocity * 0.4 + instantVel * 0.6;
  }

  panState.lastPointerX = pointerX;
  panState.lastTime = now;

  applyTransform();
}

function endDrag() {
  panState.isDragging = false;

  // Only start momentum if velocity is significant enough
  if (Math.abs(panState.velocity) > 0.1) {
    startMomentum();
  }
}

// ============================================
// Momentum Animation (requestAnimationFrame)
// ============================================

function startMomentum() {
  // Convert velocity from px/ms to px/frame (target ~16ms frames)
  let velocity = panState.velocity * 16;
  const friction = 0.95;   // Deceleration factor per frame
  const minVelocity = 0.3; // Stop threshold in px/frame

  function tick() {
    velocity *= friction;

    // Stop when velocity is negligible
    if (Math.abs(velocity) < minVelocity) {
      panState.animFrameId = null;
      return;
    }

    panState.offsetX += velocity;
    applyTransform();

    panState.animFrameId = requestAnimationFrame(tick);
  }

  panState.animFrameId = requestAnimationFrame(tick);
}

// ============================================
// Update UI
// ============================================

function updateUI(index) {
  const loc = LOCATIONS[index];

  // Title
  document.getElementById('location-title').textContent = loc.label;
  document.getElementById('location-counter').textContent =
    (index + 1) + ' / ' + LOCATIONS.length;

  // Dots
  document.querySelectorAll('.sv-dot').forEach(function (d, i) {
    d.classList.toggle('active', i === index);
  });

  // Chips
  document.querySelectorAll('.sv-loc-chip').forEach(function (c, i) {
    c.classList.toggle('active', i === index);
  });

  // Scroll chip into view
  var activeChip = document.getElementById('chip-' + index);
  if (activeChip) {
    activeChip.scrollIntoView({ behavior: 'smooth', inline: 'center' });
  }

  // Prev/Next buttons
  document.getElementById('btn-prev').disabled = index === 0;
  document.getElementById('btn-next').disabled =
    index === LOCATIONS.length - 1;
}

// ============================================
// Navigation
// ============================================

function goToPrev() {
  if (currentIndex > 0) loadScene(currentIndex - 1);
}

function goToNext() {
  if (currentIndex < LOCATIONS.length - 1) loadScene(currentIndex + 1);
}

// Keyboard navigation
document.addEventListener('keydown', function (e) {
  if (e.key === 'ArrowRight') goToNext();
  if (e.key === 'ArrowLeft') goToPrev();
  if (e.key === 'Escape') {
    window.location.href = '../index.html';
  }
});
