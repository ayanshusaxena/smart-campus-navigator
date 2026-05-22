# Smart Campus Navigator - Project Summary

## Project Overview

Smart Campus Navigator is a browser-based interactive campus navigation system developed for Dr. B.R. Ambedkar Polytechnic College, Gwalior. The project provides a digital map of the campus, allowing students, faculty, visitors, and administrative users to locate important buildings, departments, facilities, and service points on a live interactive map.

The core problem addressed by the project is campus wayfinding. In a physical college environment, new students, guests, and staff may need help finding academic blocks, laboratories, administrative offices, libraries, canteens, hostels, sports areas, washrooms, parking areas, and other facilities. Smart Campus Navigator solves this by combining map visualization, searchable campus pins, live GPS tracking, proximity alerts, and a custom route-finding engine.

The target audience includes:

- Students navigating between classrooms, labs, library, canteen, hostel, and campus facilities.
- Visitors who are unfamiliar with the college layout.
- Faculty and staff who need a quick reference for campus locations.
- Administrators who need simple tools to add, edit, export, and maintain campus location data.
- Project examiners and academic reviewers evaluating frontend engineering, geospatial data handling, and algorithmic implementation.

The project is intentionally lightweight and static. It does not require a backend server or database for its current operation. Instead, it uses static files, browser APIs, GeoJSON data, and `localStorage`, making it suitable for local deployment, college intranet hosting, GitHub Pages, or any static web hosting service.

## Tech Stack & Libraries

### Core Technologies

| Technology | Usage |
|---|---|
| HTML5 | Defines the structure of the student map, admin dashboard, and path builder pages. |
| CSS3 | Provides responsive layout, glassmorphism-style UI, map overlays, markers, sidebar, search interface, and mobile adjustments. |
| ES6 JavaScript | Implements map initialization, search, routing, GPS tracking, localStorage persistence, admin tools, and dynamic UI behavior. |
| GeoJSON | Stores spatial campus data such as building polygons and walking path LineStrings. |
| Browser localStorage | Provides offline-style persistence for admin-created pins and imported map data without a backend. |
| Geolocation API | Tracks live user position through `navigator.geolocation.watchPosition()`. |

### External Libraries and Services

| Library / Tool | Role |
|---|---|
| Leaflet.js 1.9.4 | Main map rendering engine. It provides map tiles, markers, polygons, polylines, layer groups, popups, and user interaction handling. |
| Leaflet Rotate Plugin | Optional rotation support for the map where available. |
| Mapbox Satellite Streets Tiles | Provides detailed satellite and street map imagery as the map base layer. |
| Google Fonts | Loads Inter and Noto Sans Devanagari fonts for English and Hindi interface text. |
| GeoJSON | Standard format for storing campus paths and polygons in a web-friendly structure. |
| GitHub Pages / Localhost / Static Hosting | Suitable deployment models because the app is frontend-only. |

### Why This Stack Was Chosen

The project uses Vanilla HTML, CSS, and JavaScript to avoid framework overhead and keep the application easy to understand, inspect, and deploy. Leaflet.js was selected because it is lightweight, mature, well documented, and widely used for 2D web mapping. GeoJSON was selected because it is a standard spatial data format that can represent buildings, entrances, points, and walking paths in a single file.

The static, offline-friendly approach is appropriate for an academic campus project because:

- It can run on localhost for demonstrations.
- It can be hosted on GitHub Pages without server infrastructure.
- It avoids database setup complexity.
- Admin-generated data can be persisted in the browser using localStorage.
- Map and routing data can be maintained as version-controlled JSON files.

## Complete Directory & File Structure

```text
smart-campus-navigator/
├── .gitignore
├── README.md
├── PROJECT_SUMMARY.md
├── index.html
├── admin.html
├── path-builder.html
├── map.geojson
├── css/
│   └── style.css
└── js/
    ├── app.js
    ├── routing.js
    ├── userLocation.js
    ├── proximity.js
    ├── adminmap.js
    ├── locations.js
    └── lang.js
```

## Detailed File Breakdown

### `index.html`

`index.html` is the main student-facing application page. It defines the map container, navigation bar, floating search bar, sidebar, live navigation overlay, and photo lightbox. It is the primary entry point for students, faculty, and visitors.

Major responsibilities:

- Loads Leaflet CSS and JavaScript.
- Loads the application stylesheet `css/style.css`.
- Defines the full-screen `#map` element used by Leaflet.
- Provides a language toggle button for English/Hindi UI text.
- Provides an Admin navigation button linking to `admin.html`.
- Defines search input and search result containers.
- Defines the sidebar used to show location name, category, floor, block, description, photos, and the "Navigate Here" button.
- Defines the active navigation overlay and stop navigation button.
- Loads JavaScript files in dependency order:
  - `js/locations.js`
  - `js/lang.js`
  - `js/routing.js`
  - `js/userLocation.js`
  - `js/proximity.js`
  - `js/app.js`

The corrected script order is important because each later script depends on globals or functions exposed by earlier files.

### `admin.html`

`admin.html` is an administrative GUI for managing campus pins. It is a standalone page that includes its own HTML structure, CSS styles, and inline JavaScript logic. It allows a non-technical user to place, edit, delete, import, and export campus location pins.

Major responsibilities:

- Initializes an admin Leaflet map.
- Loads default campus pins from `js/locations.js` when no saved pins exist.
- Saves edited pin data to `localStorage` under the key `campusPins`.
- Supports pin creation by entering drop-pin mode and clicking on the map.
- Supports editing metadata such as English name, Hindi name, category, tier, floor, block, description, indoor flag, and photos.
- Supports dragging pins to update coordinates.
- Provides a pin list for quick edit/delete operations.
- Supports JSON import/export of pin data.
- Links to `path-builder.html` for route/path data workflows.

This file gives administrators a way to update campus points of interest without modifying JavaScript source code manually.

### `path-builder.html`

`path-builder.html` is a utility page for working with campus spatial data and testing route computation. It is used to import a unified GeoJSON campus map, inspect polygons and paths, and test routing between selected pins.

Major responsibilities:

- Loads Leaflet and `js/routing.js`.
- Loads pins from `localStorage.campusPins` or falls back to `window.CAMPUS_LOCATIONS`.
- Imports GeoJSON containing buildings, entrance zones, LineString walking paths, and optional entrance points.
- Processes imported GeoJSON into:
  - `buildingPolygons`
  - `state_entrancePolygons`
  - `state_paths`
  - `state_entranceNodes`
- Saves imported spatial data to `localStorage.campusGeoJSON`.
- Renders building polygons and walking paths on the map.
- Allows route testing between two selected pins using `buildRoutingGraph()` and `runDijkstra()`.
- Exports the currently loaded GeoJSON as `campus-paths.geojson`.

This page acts as a data preparation and verification tool. It helps confirm whether spatial data is usable before the main student map consumes it.

### `map.geojson`

`map.geojson` is the static campus spatial data file. It is loaded by the main app through:

```js
fetch('map.geojson?v=2')
```

The `?v=2` query parameter is used for cache busting, especially on mobile browsers that may aggressively cache old GeoJSON files.

Current feature summary:

| Feature Type | Count | Purpose |
|---|---:|---|
| `Polygon` | 18 | Represents campus buildings or other area boundaries. |
| `LineString` | 47 | Represents walkable paths used by the routing engine. |

GeoJSON coordinates use standard `[longitude, latitude]` ordering. During application processing, these coordinates are converted into Leaflet-compatible `{ lat, lng }` objects.

### `css/style.css`

`css/style.css` contains the visual design for the main student-facing map interface.

Major responsibilities:

- Defines design tokens such as colors, fonts, transition timing, navbar height, sidebar width, and layout spacing.
- Styles the full-screen Leaflet map.
- Styles the glassmorphism navbar, search bar, search dropdown, sidebar, details panel, badges, photo area, and buttons.
- Styles Leaflet controls and popups to match the application design.
- Defines custom marker label styles.
- Defines live GPS blue dot styles, including pulsing animation.
- Defines proximity notification UI.
- Provides responsive behavior for tablet and mobile screen widths.

The stylesheet gives the application a polished interface while keeping the map as the central visual element.

### `js/app.js`

`js/app.js` is the main application controller for `index.html`. It coordinates the map, data loading, markers, search, language switching, routing, navigation UI, photo display, live GPS integration, and auto-return behavior.

Major responsibilities:

- Initializes global map state.
- Reads active campus locations from `localStorage.campusPins`, falling back to `CAMPUS_LOCATIONS`.
- Loads campus route data from `map.geojson?v=2`.
- Falls back to `localStorage.campusGeoJSON` if fetching `map.geojson` fails.
- Parses building polygons, entrance polygons, LineString paths, and entrance points.
- Initializes Leaflet map and Mapbox tile layer.
- Creates and manages marker layers.
- Applies tier-based visibility rules for pins and labels.
- Provides search and location focusing.
- Shows location details in the sidebar.
- Attaches the "Navigate Here" button to live navigation.
- Builds a routing graph from the user's live GPS position to a destination pin.
- Draws the live route polyline on the map.
- Updates the active route when the user's GPS location changes.
- Manages lightbox/gallery display for location photos.
- Exposes small cross-module hooks:
  - `window.__CNS_getLang`
  - `window.__CNS_getLocations`
  - `window.stopLiveNavigation`
  - `window.updateLiveNavigation`

Important application variables include:

- `map`: Leaflet map instance.
- `currentLang`: Active UI language.
- `markers`: Active marker records.
- `campusPaths`: Parsed LineString path data.
- `campusEntranceNodes`: Optional routing entrance nodes.
- `currentRouteLayer`: Leaflet layer group for the active navigation route.
- `window.buildingPolygons`: Building geometry used by routing.
- `window.state_entrancePolygons`: Entrance zone geometry used by routing.

### `js/routing.js`

`js/routing.js` implements the custom routing engine shared by the main app and the path builder.

Major responsibilities:

- Calculates geographic distance using the Haversine formula.
- Calculates total path length.
- Performs point-in-polygon checks for building and entrance zone classification.
- Converts path LineStrings into graph nodes and graph edges.
- Merges nearby path vertices into canonical junctions using a configurable distance threshold.
- Classifies route graph nodes as indoor or outdoor.
- Applies gateway restrictions so indoor/outdoor boundary crossing can be controlled through entrance zones.
- Snaps pins to nearby route segments.
- Adds explicit entrance nodes if present in the GeoJSON.
- Computes shortest paths using Dijkstra's algorithm.

Important constants:

- `JUNCTION_THRESHOLD_M = 5`: Nearby vertices within this distance are treated as the same junction.
- `PIN_SNAP_THRESHOLD_M = 60`: Maximum distance for snapping a pin to a path.
- `WALK_SPEED = 80`: Approximate walking speed in meters per minute.

The routing engine is framework-independent and operates on plain JavaScript data structures such as arrays, maps, sets, and objects.

### `js/userLocation.js`

`js/userLocation.js` manages live user GPS tracking through the browser Geolocation API.

Major responsibilities:

- Exposes `window.initUserLocation(map)`.
- Checks whether `navigator.geolocation` is available.
- Starts continuous location tracking using `navigator.geolocation.watchPosition()`.
- Stores the latest user coordinates in:
  - `window.__CNS_userLocation`
  - `window.userLat`
  - `window.userLng`
- Creates a blue live-location marker on the Leaflet map.
- Creates an accuracy circle using the reported GPS accuracy radius.
- Centers the map once on the first successful GPS fix.
- Sends location updates to the proximity notification module.
- Calls `window.updateLiveNavigation()` when active navigation is running.
- Provides a `stop()` method to clear the GPS watch and remove live-location layers.

The module uses high-accuracy mode with:

```js
{
  enableHighAccuracy: true,
  maximumAge: 5000,
  timeout: 10000
}
```

This configuration is appropriate for campus-level navigation where location precision matters.

### `js/proximity.js`

`js/proximity.js` implements proximity detection between the live user location and campus pins.

Major responsibilities:

- Exposes `window.checkNearbyLocation(userLat, userLng, locations, options)`.
- Exposes `window.initProximityNotifier(options)`.
- Uses Haversine distance to calculate distance between the user and each campus pin.
- Finds the nearest pin within a configurable threshold, defaulting to 40 meters.
- Dynamically creates a proximity notification element in the DOM.
- Shows a message such as "You are near [location name]".
- Avoids repeated updates while the user remains near the same pin.
- Supports language-aware pin naming by using `window.__CNS_getLang`.

This module is intentionally independent of the Geolocation API. It receives coordinates from `userLocation.js`, making it reusable and easy to test.

### `js/adminmap.js`

`js/adminmap.js` provides shared visual marker helper logic for the admin page.

Major responsibilities:

- Defines category colors for campus pin categories.
- Creates custom SVG-based Leaflet marker icons.
- Creates text label overlays for map pins.

Although similar marker logic exists in `js/app.js`, this file is separate because `admin.html` is a standalone page and does not load the main student application script.

### `js/locations.js`

`js/locations.js` defines the default campus location dataset as `CAMPUS_LOCATIONS`.

Major responsibilities:

- Provides fallback pin data when `localStorage.campusPins` does not exist.
- Stores each campus location with:
  - `id`
  - `nameEn`
  - `nameHi`
  - `category`
  - `tier`
  - `lat`
  - `lng`
  - `floor`
  - `block`
  - `description`
  - `photo`
- Defines important initial locations such as main gate, parking area, sports ground, academic block, principal office, library, canteen, boys hostel, workshop, computer lab, and washrooms.

This file acts as the seed data for the application.

### `js/lang.js`

`js/lang.js` defines the UI language dictionary as `LANG`.

Major responsibilities:

- Provides English UI strings.
- Provides Hindi UI strings.
- Defines labels for sidebar text, search placeholder, admin button, floor/block labels, no-result messages, and category names.
- Supports language switching in `js/app.js`.

The language file keeps translation content separate from the main application logic.

### `README.md`

`README.md` is a short repository introduction. It summarizes the project purpose, core features, and basic technology stack.

Major responsibilities:

- Identifies the project as Smart Campus Navigator.
- Lists major features such as interactive map, live navigation, routing engine, and mobile-friendly UI.
- Documents the high-level tech stack.

### `DEBUG_REPORT.md`

`DEBUG_REPORT.md` is a QA-oriented audit report generated during debugging. It documents historical issues, including navigation data problems, script loading order, localStorage usage, global variables, and recommended fix priorities.

It is useful for maintenance, regression testing, and explaining why specific fixes were made.

### `.gitignore`

`.gitignore` defines files and folders that should not be tracked in version control. Although small, it supports good repository hygiene by excluding local or generated artifacts.

### `PROJECT_SUMMARY.md`

This file is the comprehensive technical project summary prepared for academic presentation and architectural review.

## Core Architecture & Data Flow

### High-Level Architecture

Smart Campus Navigator follows a static frontend architecture:

```text
Static files
  |
  |-- index.html
  |-- css/style.css
  |-- js/*.js
  |-- map.geojson
  |
Browser runtime
  |
  |-- Leaflet map
  |-- localStorage
  |-- Geolocation API
  |-- Routing engine
```

There is no Node.js server, database server, REST API, or backend authentication layer in the current version. All application logic runs in the browser.

### Student Map Data Flow

```text
index.html
  |
  | loads scripts in dependency order
  v
locations.js -> default CAMPUS_LOCATIONS
lang.js      -> LANG translation dictionary
routing.js   -> graph construction and Dijkstra functions
userLocation.js -> GPS tracking module
proximity.js -> proximity alert module
app.js       -> main controller
```

When the student map starts:

1. `index.html` loads the HTML structure and all scripts.
2. `app.js` initializes the Leaflet map.
3. `app.js` loads pin data:
   - First from `localStorage.campusPins`, if admin-created pins exist.
   - Otherwise from `CAMPUS_LOCATIONS` in `js/locations.js`.
4. `app.js` loads route geometry:
   - First by fetching `map.geojson?v=2`.
   - If fetch fails, it falls back to `localStorage.campusGeoJSON`.
5. GeoJSON Polygons are converted into building polygon rings.
6. GeoJSON LineStrings are converted into `campusPaths`.
7. Leaflet renders map tiles, markers, labels, and route layers.
8. If location permission is granted, `userLocation.js` adds the user's live position.
9. When navigation is started, the routing engine builds a graph and computes the shortest path.
10. `app.js` draws the computed route as a Leaflet polyline.

### GeoJSON to Leaflet Data Flow

GeoJSON stores coordinates in `[lng, lat]` order:

```json
[78.1743, 26.1923]
```

Leaflet generally expects `[lat, lng]` order for map drawing:

```js
[26.1923, 78.1743]
```

The application converts GeoJSON coordinates into JavaScript objects:

```js
{ lng: c[0], lat: c[1] }
```

Then, when rendering on Leaflet, it converts them to:

```js
[p.lat, p.lng]
```

This conversion is essential for accurate map placement.

### Offline-First and Static Operation

The project is not fully offline because map tiles and external fonts/scripts may require network access unless cached. However, the application design is offline-friendly in several important ways:

- Campus pins can be stored in `localStorage`.
- Imported campus GeoJSON can be stored in `localStorage`.
- The main spatial file `map.geojson` is a static project file.
- No backend is required for reading campus data.
- The app can run on localhost or static hosting.
- Admin-generated data can persist in the browser.

This approach makes the system simpler to deploy in an academic environment.

### localStorage Data Flow

| Key | Producer | Consumer | Purpose |
|---|---|---|---|
| `campusPins` | `admin.html` | `index.html`, `path-builder.html`, `admin.html` | Stores admin-edited campus pins. |
| `campusGeoJSON` | `path-builder.html` | `index.html`, `path-builder.html` | Stores imported campus map geometry as a fallback/source for routing. |
| `campusBuildingGeoJSON` | Defined in `path-builder.html` | Currently unused | Legacy or planned split building-data key. |

## Key Modules Explained

### Custom Routing Engine

The routing engine transforms campus walking paths into a graph. A graph is a mathematical structure containing:

- Nodes: Points or junctions on paths.
- Edges: Walkable connections between nodes.
- Weights: Distances between connected nodes.

In this project, nodes are created from the vertices of GeoJSON LineString features. Consecutive coordinates in a LineString become connected graph edges. The distance between two connected coordinates is calculated using the Haversine formula, which estimates real-world distance on the Earth's surface.

The graph builder performs several additional steps:

1. Path vertices are converted into coordinate-based node IDs.
2. Nearby junctions are merged if they are within `JUNCTION_THRESHOLD_M`.
3. Building polygons are used to classify nodes as indoor or outdoor.
4. Entrance polygons are used to control valid indoor/outdoor transitions.
5. Campus pins are snapped to the nearest valid path node or segment.
6. Optional entrance nodes are added to the graph.

After the graph is built, the shortest route is calculated using Dijkstra's algorithm.

Dijkstra's algorithm works by:

1. Assigning an initial distance of `0` to the start node.
2. Assigning infinity to all other nodes.
3. Repeatedly selecting the unvisited node with the smallest known distance.
4. Relaxing its edges, which means checking whether reaching a neighbor through the current node gives a shorter distance.
5. Storing previous-node pointers for path reconstruction.
6. Stopping when the destination node is reached or no reachable nodes remain.

The output is:

```js
{
  path: [...nodeIds],
  totalDist: distanceInMeters
}
```

The main app then converts the node path into a visible Leaflet polyline.

### Live GPS Tracking

Live GPS tracking is handled by `js/userLocation.js`.

The module calls:

```js
navigator.geolocation.watchPosition(onPosition, onError, options)
```

Unlike `getCurrentPosition()`, which returns a single location fix, `watchPosition()` continuously reports updated coordinates as the user moves.

On each successful location update:

1. Latitude and longitude are read from `pos.coords`.
2. The global user location state is updated.
3. The blue dot marker is created or moved.
4. The accuracy circle is created or updated.
5. Proximity detection is triggered.
6. If live navigation is active, the route is recalculated from the current GPS position.

This creates a dynamic navigation experience where the path can be refreshed as the user moves across campus.

### Proximity Alerts

Proximity alerts are handled by `js/proximity.js`.

The logic compares the user's current GPS coordinates with every campus pin. For each pin, it calculates distance using the Haversine formula. If a pin is within the configured threshold, the nearest matching pin is selected and a notification is shown.

The default threshold is 40 meters. This is reasonable for a campus setting because GPS accuracy on mobile devices can vary depending on environment, signal quality, buildings, and device hardware.

The proximity module avoids repeatedly showing the same message while the user remains near the same location. This improves usability and prevents notification noise.

### Admin and Path Building Tools

The project includes two data-management tools:

1. `admin.html`
2. `path-builder.html`

The admin page is focused on point-of-interest data. It allows administrators to create and maintain campus pins through a GUI. Instead of editing `locations.js` manually, the admin can drop markers on the map, fill in metadata, and persist the data in localStorage.

The path builder is focused on route geometry. It allows the project maintainer to import GeoJSON, visualize polygons and paths, save route data to localStorage, test shortest-path routing, and export usable GeoJSON.

Together, these tools reduce manual editing and support a practical data workflow:

```text
Admin creates or edits pins
  |
  v
Pins saved to localStorage.campusPins
  |
  v
Path Builder imports route GeoJSON
  |
  v
GeoJSON saved to localStorage.campusGeoJSON or exported
  |
  v
Student map loads pins and routing data
```

## Important Design Decisions

### Static-First Design

The project favors static files over backend infrastructure. This lowers deployment complexity and makes the system suitable for academic demonstrations, local labs, and static hosting.

### Separation of Concerns

The codebase separates concerns across multiple files:

- `index.html`: Student UI structure.
- `style.css`: Visual design.
- `app.js`: Main behavior and orchestration.
- `routing.js`: Algorithmic routing logic.
- `userLocation.js`: GPS tracking.
- `proximity.js`: Nearby-location detection.
- `locations.js`: Seed location data.
- `lang.js`: Translations.
- `admin.html`: Pin management.
- `path-builder.html`: Spatial data management.

This modular separation makes the project easier to understand and maintain.

### Browser-Native APIs

The project uses browser-native APIs wherever possible:

- `fetch()` for loading GeoJSON.
- `localStorage` for persistence.
- `navigator.geolocation` for live GPS.
- DOM APIs for dynamic UI.

This keeps the project lightweight and avoids build tooling.

### Progressive Enhancement

The application remains useful even when some capabilities are unavailable:

- If admin pins are not present, default pins from `locations.js` are used.
- If fetching `map.geojson` fails, localStorage GeoJSON is attempted.
- If GPS is unavailable, the map and search still function.
- If live route data is missing, pins and map exploration still work.

## Deployment Model

The project can be deployed in several ways:

### Localhost

Useful for development and demonstration:

```text
Open through a local HTTP server so fetch('map.geojson?v=2') works reliably.
```

Opening the HTML file directly through `file://` may block `fetch()` in some browsers, so a local server is preferred.

### GitHub Pages

Suitable for static hosting:

- Upload repository to GitHub.
- Enable GitHub Pages.
- Serve `index.html`, `map.geojson`, CSS, and JS as static files.

### College Intranet

The project can be hosted on a college LAN server so students can access it from mobile browsers on campus.

## Future Scope

The current project is a strong frontend and algorithmic prototype. The following features can be added in future versions:

### Backend and Database

- Add Firebase, Supabase, or a custom backend API.
- Store pins, paths, photos, and user reports centrally.
- Allow real-time updates across devices.
- Add role-based admin authentication.

### Indoor Floor Mapping

- Add floor-specific maps for multi-story academic buildings.
- Include stairs, corridors, elevators, classrooms, and labs.
- Add floor selector controls.
- Support routing between floors.

### Improved Path Builder

- Integrate a drawing plugin such as Leaflet Geoman.
- Allow drawing paths, entrances, and buildings directly in the browser.
- Add feature-type selection after drawing.
- Validate path connectivity visually.

### Turn-by-Turn Navigation

- Convert computed routes into step-by-step instructions.
- Add distance to next turn.
- Add arrival estimates.
- Provide voice guidance for accessibility.

### Enhanced GPS Handling

- Smooth location movement using interpolation.
- Detect low GPS accuracy and warn users.
- Support orientation and compass heading.
- Snap live user location to nearest walking path.

### Search and Filtering

- Add category filters.
- Add fuzzy search.
- Add Hindi transliteration support.
- Add recent searches and favorite locations.

### Accessibility Improvements

- Improve keyboard navigation.
- Add ARIA labels for controls.
- Increase contrast modes.
- Add screen-reader friendly route summaries.

### Data Validation

- Add a validation panel for GeoJSON.
- Detect disconnected route segments.
- Detect invalid coordinates.
- Detect pins too far from paths.
- Detect missing translations and categories.

### Analytics and Feedback

- Add a feedback form for wrong locations or blocked paths.
- Track most searched locations.
- Add admin review workflow for suggested corrections.

## Academic and Technical Significance

Smart Campus Navigator demonstrates multiple important software engineering concepts:

- Interactive frontend development using HTML, CSS, and JavaScript.
- Geospatial data representation with GeoJSON.
- Map rendering with Leaflet.js.
- Graph construction from spatial LineString data.
- Shortest path computation using Dijkstra's algorithm.
- Browser-based GPS tracking using the Geolocation API.
- Offline-style persistence using localStorage.
- Modular JavaScript architecture without a build system.
- Practical admin tooling for data management.

The project is suitable for academic evaluation because it combines user interface engineering, spatial data processing, algorithm design, and real-world usability in a single coherent application.

## Conclusion

Smart Campus Navigator is a lightweight, static, and technically rich campus navigation system designed for Dr. B.R. Ambedkar Polytechnic College, Gwalior. It provides an interactive map, searchable campus locations, live GPS tracking, proximity alerts, and a custom route-finding engine based on graph theory.

The current architecture is intentionally simple and deployable, while still demonstrating meaningful engineering depth. With future additions such as backend synchronization, indoor floor mapping, enhanced admin tooling, and turn-by-turn guidance, the project can evolve from a strong academic prototype into a production-ready smart campus navigation platform.
