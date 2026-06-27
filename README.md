<div align="center">

# 🗺️ Smart Campus Navigator

**An interactive PWA for navigating Dr. B.R. Ambedkar Polytechnic College, Gwalior**

![HTML](https://img.shields.io/badge/HTML5-E34F26?style=flat-square&logo=html5&logoColor=white)
![CSS](https://img.shields.io/badge/CSS3-1572B6?style=flat-square&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black)
![Leaflet](https://img.shields.io/badge/Leaflet.js-199900?style=flat-square&logo=leaflet&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=flat-square&logo=firebase&logoColor=black)
![PWA](https://img.shields.io/badge/PWA-5A0FC8?style=flat-square&logo=pwa&logoColor=white)

</div>

---

## 📌 What is this?

Smart Campus Navigator (CNS) is a **Progressive Web App** that helps students, visitors, and staff navigate the college campus. It works like Google Maps — but built specifically for the campus, with indoor-aware routing, bilingual support, and offline capability. No app installation needed.

---

## ✨ Features

### 🗺️ Interactive Campus Map
- Satellite aerial view powered by **Mapbox** tile layer
- Pan, zoom (level 16–22), and rotate with compass
- **Tiered pin visibility** — pins appear progressively as you zoom in (4 tiers)
- 26 campus locations across 11 categories: Academic, Lab, Admin, Library, Canteen, Hostel, Sports, Parking, Washroom, Classroom, College

### 📍 Live GPS Navigation
- Real-time **blue dot tracking** with accuracy circle
- Turn-by-turn directions with distance in metres
- GPS smoothing via exponential moving average
- Auto-reroute if user strays 15m off path
- Arrival detection within 15m of destination

### 🧭 Custom Routing Engine
- Campus paths stored as **GeoJSON LineStrings**
- Graph built from path vertices with automatic junction merging
- **Indoor/outdoor classification** using ray-casting point-in-polygon
- Gateway rule — building entry/exit only through designated entrance zones
- **Dijkstra shortest path** algorithm for accurate routing

### 🔍 Smart Search
- Fuzzy search across pin names in **English + Hindi**
- Scoring: exact match → starts-with → contains → character fuzzy
- Top 6 results shown; Enter auto-selects single match

### 📷 Campus Street View
- Custom panoramic photo viewer (no Google dependency)
- **7 campus locations** with draggable panoramas
- Mouse, touch, and keyboard arrow navigation

### 🌐 Bilingual Support (EN / HI)
- Full UI available in **English and Hindi**
- One-click language toggle — switches all labels, search, notifications, and pin names

### 🔔 Proximity Alerts
- Detects when you're within **40 metres** of a campus pin
- Shows a toast notification with the location name
- Bilingual, debounced — no spam

### 📱 Progressive Web App (PWA)
- **Installable** on Android and iOS via Add to Home Screen
- Offline support via **Service Worker** (cache-first strategy)
- Works without internet after first load

### 🔐 Admin Panel
- Firebase Auth protected (Google OAuth + email login)
- Role-based access — only verified admins can enter
- Add, edit, delete campus pins on a live map
- Real-time sync to **Firebase Firestore**

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Map Rendering | Leaflet.js 1.9.4 |
| Map Tiles | Mapbox Satellite Streets v12 |
| Map Rotation | leaflet-rotate 0.2.8 |
| Backend / Database | Firebase Firestore |
| Authentication | Firebase Auth (Google + Email) |
| Offline Support | Service Worker (Cache API) |
| PWA | Web App Manifest |
| Language | Vanilla JS (ES2020+) — no framework |
| Styling | Pure CSS — no CSS framework |

---

## 📂 Project Structure

```
smart-campus-navigator/
├── index.html              # Main map interface
├── admin.html              # Admin panel (auth protected)
├── path-builder.html       # Dev tool — draw routing paths
├── manifest.json           # PWA manifest
├── sw.js                   # Service Worker — offline cache
├── map.geojson             # 47 paths + 18 building polygons
│
├── css/
│   └── style.css           # All app styles
│
├── js/
│   ├── app.js              # Core app logic (1314 lines)
│   ├── routing.js          # Graph builder + Dijkstra
│   ├── userLocation.js     # GPS tracking + smoothing
│   ├── proximity.js        # Proximity detection
│   ├── locations.js        # 26 static campus pins
│   ├── lang.js             # EN / HI string definitions
│   ├── firebase.js         # Firebase init
│   ├── auth.js             # Auth + role detection
│   └── adminmap.js         # Admin pin management
│
├── street-view/
│   ├── index.html          # Street View viewer page
│   ├── sv-app.js           # Panorama viewer logic
│   ├── sv-style.css        # Street View styles
│   └── photos/             # img1–img7.jpeg (7 locations)
│
└── icons/                  # PWA icons (192px, 512px, SVG)
```

---

## 🗃️ Map Data

`map.geojson` contains **65 GeoJSON features**:

| Type | Count | Purpose |
|---|---|---|
| `LineString` | 47 | Walkable campus paths — used to build routing graph |
| `Polygon` | 18 | Building footprints — used for indoor/outdoor classification |

Polygons tagged `is_entrance: true` act as gateways where indoor↔outdoor crossing is allowed.

---

## 🚀 Getting Started

No build step. No npm. Just open in a browser.

```bash
git clone https://github.com/yourusername/smart-campus-navigator.git
cd smart-campus-navigator
# Open index.html in a browser, or serve with any static server:
npx serve .
```

> For PWA install and Service Worker to work, the app must be served over **HTTPS** or `localhost`.

---

## 📋 Pages

| Page | URL | Access |
|---|---|---|
| Main Map | `index.html` | Public |
| Admin Panel | `admin.html` | Firebase Auth (admin role) |
| Street View | `street-view/index.html` | Public |
| Path Builder | `path-builder.html` | Developer only |

---

<div align="center">

Built with ❤️ for Dr. B.R. Ambedkar Polytechnic College, Gwalior

</div>
