# Chemical PFD Web Frontend

[![React](https://img.shields.io/badge/react-18.3-61DAFB.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/typescript-5.6-3178C6.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/vite-5.x-646CFF.svg)](https://vitejs.dev/)
[![Zustand](https://img.shields.io/badge/zustand-5.x-orange.svg)](https://zustand-demo.pmnd.rs/)
[![License](https://img.shields.io/badge/license-MIT-lightgrey.svg)](LICENSE)

---

## Table of Contents

- [Overview](#overview)
- [Architecture & Dependencies](#architecture--dependencies)
- [Core Features & Mechanics](#core-features--mechanics)
- [Test Suite & Verification](#test-suite--verification)
- [Operational Notes & Limitations](#operational-notes--limitations)

---

## Overview

The web frontend is the browser-based editor for the Chemical PFD system. It provides an interactive Konva canvas where engineers drag, place, connect, resize, and export chemical process flow diagram components fetched from the Django backend (`/api/components/`, `/api/project/<id>/`). The editor hydrates from and persists to the backend's `canvas_state` JSON field — the same format consumed by the desktop PyQt5 client — so diagrams are interchangeable between the two frontends. The primary workflows are: authenticate → open/create a project → edit the canvas → save or export.

---

## Architecture & Dependencies

### Core Stack

| Layer | Technology |
|---|---|
| UI Framework | React 18.3 (functional components, hooks) |
| Language | TypeScript 5.6, strict mode |
| Build tool | Vite 5 with `@vitejs/plugin-react` |
| Canvas rendering | `react-konva` 18 / `konva` 9 |
| Global state | Zustand 5 (`useEditorStore`) |
| Routing | React Router DOM 6.23 |
| UI component kit | HeroUI (based on NextUI v2) |
| Styling | Tailwind CSS 4 via `@tailwindcss/vite` |
| HTTP client | Axios 1.x |
| Export | `html2canvas`, `jspdf` |
| Test runner | Vitest 2 + `@testing-library/react` 16 |

### Project Structure

```text
web-frontend/
├── src/
│   ├── api/
│   │   ├── auth.ts              # JWT login / register calls
│   │   ├── client.ts            # Axios instance with token interceptor
│   │   └── projectApi.ts        # Project CRUD (list, get, create, save, delete)
│   ├── components/
│   │   ├── Canvas/
│   │   │   ├── CanvasItemImage.tsx   # Selectable/transformable component node
│   │   │   ├── ComponentLibrarySidebar.tsx
│   │   │   ├── ConnectionLine.tsx    # Orthogonal pipe rendering + segment drag
│   │   │   ├── ExportFormat.ts
│   │   │   ├── ExportModal.tsx
│   │   │   ├── ExportReportModal.tsx
│   │   │   └── types.ts             # CanvasItem, Connection, CanvasState, …
│   │   ├── navbar.tsx
│   │   └── ...
│   ├── context/
│   │   └── ComponentContext.tsx  # Global component library cache
│   ├── hooks/                   # Custom React hooks
│   ├── pages/
│   │   ├── Dashboard.tsx        # Project list, create/delete
│   │   ├── Editor.tsx           # Main canvas editor (90 KB — the core of the app)
│   │   ├── Login.tsx / Register.tsx
│   │   └── Components.tsx       # Component library browser
│   ├── store/
│   │   └── useEditorStore.ts    # Zustand store with undo/redo history
│   └── utils/
│       ├── routing.ts           # smartRoute, grip position math
│       ├── layout.ts            # calculateAspectFit
│       ├── aiMatcher.ts         # Fuzzy component name matching
│       └── pathfinding/
│           ├── obstacles.ts     # AABB collision + padding
│           ├── segmentDrag.ts   # Rigid-rod segment kinematics
│           └── types.ts
├── tests/
│   ├── App/                     # Login, Register, Navbar, Dashboard tests
│   ├── Canvas/                  # Editor smoke tests
│   ├── routing/                 # Routing, obstacles, segment drag, connection line
│   ├── Ai/                      # aiMatcher unit tests
│   └── setup.ts
├── web-frontend-UnitTests/      # Reserved for future module-level unit tests
├── vite.config.ts               # Vitest config (jsdom environment, @/ alias)
└── package.json
```

### Prerequisites

**Required only for the web frontend:**

- **Node.js ≥ 18** — `node --version` to verify
- **npm ≥ 9** — bundled with Node 18+
- The Django backend must be running and accessible if you need live project data (see [backend README](../backend/README.md))

**Environment variables** — create a `.env` file in `web-frontend/`:

```env
# Base URL of the Django API (no trailing slash)
VITE_API_BASE_URL=http://127.0.0.1:8000/api
```

| Variable | Description |
|---|---|
| `VITE_API_BASE_URL` | Injected into the Axios client at build time via `import.meta.env` |

> ⚠️ Vite exposes only variables prefixed with `VITE_` to the browser bundle. Do not use `REACT_APP_` prefixes here.

### Setup

```bash
cd web-frontend
npm install
```

Start the dev server:

```bash
npm run dev
```

The app is served at `http://localhost:5173` by default. Requests to `/api/*` are proxied to `VITE_API_BASE_URL`.

---

## Core Features & Mechanics

### Authentication & Protected Routes

JWT tokens (access + refresh) are stored in `localStorage`. `App.tsx` wraps all non-public routes in a `ProtectedRoutes` component that reads `localStorage.getItem("access_token")` and redirects to `/login` if absent. The Axios client (`src/api/client.ts`) attaches the access token to every request via a request interceptor.

### Project Dashboard

`Dashboard.tsx` lists all projects owned by the authenticated user via `GET /api/project/`. Each card links to `/editor/:projectId`. Creating a project calls `POST /api/project/` and navigates to the new project's editor immediately.

### Canvas Editor

`Editor.tsx` orchestrates the full editing session. On mount it calls `GET /api/project/<id>/` and hydrates the Zustand store via `hydrateEditor(editorId, canvasState)`. The Konva `Stage` renders `CanvasItemImage` nodes for each item and `ConnectionLine` components for each connection. On save it calls `PUT /api/project/<id>/` with the serialized `canvas_state`.

For example, opening Project #101 (which contains a `GasFilter` at `x:100, y:150` and an `Interlock` at `x:300, y:150` connected at grip indices 0→1) will hydrate the store, render both SVG nodes on the canvas, and draw an orthogonal pipe between them.

### Canvas Resizing System

This is the most mechanically involved part of `CanvasItemImage.tsx`. When a component is selected, Konva's `Transformer` attaches to its `Group` and exposes **8 resize handles** (`top-left`, `top-center`, `top-right`, `middle-left`, `middle-right`, `bottom-left`, `bottom-center`, `bottom-right`).

**How the resize loop works:**

1. During drag, Konva calls `boundBoxFunc(oldBox, newBox)` on every pointer-move frame — this is where size constraints are enforced synchronously, before the canvas redraws.
2. On `transformend` (pointer up), `handleTransformEnd` fires once. It reads the accumulated `scaleX`/`scaleY` from the `Group` node, multiplies them against the stored `width`/`height` to get true pixel dimensions, resets the node's scale back to `1`, then calls `onTransformEnd` (commits one undo snapshot to the store) followed by `onChange` (updates local visual state).

**Aspect-ratio constraint (Shift key):**

The component tracks Shift key state via a `useRef` (`shiftHeldRef`) populated by `window` `keydown`/`keyup` listeners — this avoids changing the strict two-argument signature of `boundBoxFunc`. When `shiftHeldRef.current` is `true`, `boundBoxFunc` locks the ratio:

```ts
const ratio = oldBox.width / oldBox.height;
const dw = Math.abs(newBox.width - oldBox.width);
const dh = Math.abs(newBox.height - oldBox.height);
if (dw >= dh) {
  newBox = { ...newBox, height: newBox.width / ratio };
} else {
  newBox = { ...newBox, width: newBox.height * ratio };
}
```

The dominant axis (larger delta) drives the other, so the ratio is preserved regardless of which handle is dragged.

**Minimum size threshold (zoom-aware):**

```ts
const MIN_PX = 20 / (stageScale > 0 ? stageScale : 1);
```

At canvas zoom 1.0 the minimum is 20 logical pixels. At zoom 0.5 it becomes 40 screen pixels — preventing components from being accidentally shrunk to invisible at low zoom. If either dimension would go below `MIN_PX`, `boundBoxFunc` returns `oldBox` (the resize is blocked for that frame).

**Flip prevention:** `flipEnabled={false}` on the `Transformer` prevents negative-scale artifacts if a handle is dragged past the opposite edge.

**State sync timing:** `onTransformEnd` is deliberately called before `onChange`. This ensures exactly one undo snapshot is pushed to the Zustand `past` stack per resize gesture, not one per pixel. Calling `updateItem` directly inside the drag loop would flood the history buffer.

**Image aspect-fit within the bounding box:** The SVG image itself is rendered inside the bounding box using `calculateAspectFit` (`src/utils/layout.ts`), which letterboxes the image to preserve its native aspect ratio. Grip connection points are positioned relative to the *rendered image rect*, not the outer container box.

### Orthogonal Connection Routing

`src/utils/routing.ts` → `smartRoute(start, end, items)` generates an orthogonal (H/V only) path between two grip points. It builds four ranked L-shape or Z-shape candidates and picks the first that does not intersect any padded obstacle bounding box (20px expansion on all sides). If all candidates collide, it falls back to candidate 0. The chosen waypoints are stored on the `Connection` object and persisted via `PUT /api/project/<id>/`.

`ConnectionLine.tsx` renders each connection as a draggable SVG path with a rigid-rod segment interaction: vertical segments can only be dragged horizontally (Y is locked), horizontal segments can only be dragged vertically (X is locked). Obstacle-aware clamping prevents dragging a segment into a component bounding box.

### Zustand Store & Undo/Redo

`useEditorStore` (`src/store/useEditorStore.ts`) holds one `EditorStateWithHistory` record per open project (keyed by `editorId`). Every mutation — `addItem`, `updateItem`, `deleteItem`, `addConnection`, `batchUpdateItems`, etc. — snapshots the previous state into `past[]` before applying the change and clears `future[]`. `undo` pops from `past` and pushes to `future`; `redo` does the reverse. `hydrateEditor` (called on project load) resets both stacks so loading a saved state never pollutes the undo history.

### Export System

The editor supports PNG, JPG, PDF, and a custom JSON `.export` format. The PDF and image exports use `html2canvas` and `jspdf`. `ExportReportModal.tsx` renders a report with a footer title block (project name, created-by, date) anchored to the bottom of the export page — the footer is composited after the diagram area, not overlaid on top of it.

---

## Test Suite & Verification

### Implemented Test Cases

| Test module | Location | What it covers |
|---|---|---|
| `Login.test.tsx` | `tests/App/` | Form rendering, field updates, `loginUser` called with correct credentials, navigation to `/dashboard` on success, alert on failure, loading state during async login |
| `Register.test.tsx` | `tests/App/` | Registration form, field validation, `registerUser` API call, success navigation |
| `Navbar.test.tsx` | `tests/App/` | Navigation link rendering, active state |
| `Dashboard.test.tsx` | `tests/App/` | Project list rendering (mock component), "New Diagram" button, search input |
| `Editor.test.tsx` | `tests/Canvas/` | Canvas component smoke tests (DOM environment check) |
| `routing.test.ts` | `tests/routing/` | `getClosestSide` (grip-to-side mapping), `getStandoff` offsets, `getGripPosition` coordinate math, `smartRoute` orthogonality across 7 diagonal/straight cases, obstacle avoidance (E01 reactor + C01A/B layout), fallback-to-candidate-0 when all candidates blocked, `calculateManualPathsWithBridges` path data format |
| `obstacles.test.ts` | `tests/routing/` | `getObstacleRects` AABB mapping, `getPaddedObstacleRects` expansion math (20px padding on E01/C01A/C01B), `segmentHitsObstacle` AABB collision, `orthogonalSegmentHitsObstacle` strict H/V boundary edge cases, `pathHitsObstacle` multi-segment path validation, `applyStandoff` direction and distance |
| `segmentDrag.test.ts` | `tests/routing/` | `snap()` grid rounding (default 10px, custom, negative values), `findSegmentIndex()` with ±4px tolerance, `moveSegment()` rigid-rod kinematics: Y-locked for vertical drag, X-locked for horizontal drag, adjacent segment connectivity, path immutability, chained multi-drag orthogonality |
| `connectionLine.test.tsx` | `tests/routing/` | `dragBoundFunc` vertical segment (Y always 0, rightward/leftward clamping at obstacle boundaries), `dragBoundFunc` horizontal segment (X always 0, up/down clamping), zero-delta drag suppression, `onSegmentDragEnd` callback assertion |
| `aiMatcher.test.ts` | `tests/Ai/` | `normalizeType` string normalization (pump, valve, vessel), `matchComponent` exact match, fuzzy/generic match, fallback for unknown input |

### How to Run Tests

From the `web-frontend/` directory:

```bash
# Run the full test suite once
npm test

# Watch mode — re-runs on file changes
npm run test:watch
```

Vitest runs in a `jsdom` environment (configured in `vite.config.ts`). The `@/` alias resolves to `src/`, matching the production build.

There is no `test:coverage` script in `package.json` yet. To generate a coverage report manually:

```bash
npx vitest run --coverage
```

### Expected Output

A full passing run looks like:

```
 ✓ tests/App/Login.test.tsx (6)
 ✓ tests/App/Register.test.tsx (...)
 ✓ tests/App/Navbar.test.tsx (...)
 ✓ tests/App/Dashboard.test.tsx (1)
 ✓ tests/Canvas/Editor.test.tsx (2)
 ✓ tests/routing/routing.test.ts (...)
 ✓ tests/routing/obstacles.test.ts (...)
 ✓ tests/routing/segmentDrag.test.ts (...)
 ✓ tests/routing/connectionLine.test.tsx (...)
 ✓ tests/Ai/aiMatcher.test.ts (7)

 Test Files  10 passed (10)
 Tests       XX passed (XX)
 Duration    X.XXs
```

**If a routing or canvas test fails**, the most likely causes are:

- A change to `boundBoxFunc` logic that altered the minimum-size or aspect-ratio behaviour — check `CanvasItemImage.tsx` lines around `boundBoxFunc` and `handleTransformEnd`.
- A change to `smartRoute` candidate generation that broke orthogonality — the `assertOrthogonal` helper in `routing.test.ts` will point to the exact diagonal segment.
- A mock mismatch — `routing.test.ts` and `obstacles.test.ts` both mock `@/utils/layout.calculateAspectFit` to return an identity rect. If `calculateAspectFit`'s import path changes, the mock will stop intercepting the call and grip positions will be wrong.

---

## Operational Notes & Limitations

- **Canvas zoom and resize minimums.** The 20px logical minimum in `boundBoxFunc` and `handleTransformEnd` is zoom-aware: `MIN_PX = 20 / stageScale`. If you change the zoom implementation, verify that `stageScale` is still passed correctly from `Editor.tsx` into every `CanvasItemImage`.

- **Large diagram performance.** The Konva stage redraws on every state change. Diagrams with more than ~150 items will show noticeable lag on drag because each `onChange` call triggers a Zustand update, which re-renders the entire item list. The `batchUpdateItems` action exists specifically to group multi-item operations into a single store update — use it for any feature that moves or modifies multiple components simultaneously.

- **Pointer event quirks (Safari).** `onMouseDown` / `onMouseEnter` / `onMouseLeave` on Konva `Circle` grip nodes work correctly on Chrome and Firefox. On Safari ≤ 16 there are known cases where `onMouseLeave` does not fire if the pointer leaves the canvas stage entirely during a connection draw. The cursor style may remain `pointer` until the next `mousemove` event.

- **Aspect-fit SVG rendering.** `CanvasItemImage` renders the SVG inside a `calculateAspectFit`-derived bounding box. If a component's SVG has no explicit `viewBox`, `naturalWidth` and `naturalHeight` will both be `0` until the image loads, and the rendered image will be invisible (zero dimensions) for one frame. This resolves automatically on the next `useEffect` triggered by the `image` state from `useImage`.

- **Undo history memory.** The Zustand `past` array is unbounded. For very long editing sessions with hundreds of operations, this can accumulate a significant amount of object references. There is currently no `MAX_HISTORY` cap — if this becomes an issue, add a slice in `createSnapshot` callers: `past: [...ed.past.slice(-50), snapshot]`.

- **Backend dependency for live data.** The editor's component library is loaded from `GET /api/components/` on startup via `ComponentContext`. If the backend is unreachable, the sidebar will be empty and drag-drop will not work. The canvas itself (Konva rendering) does not require the backend — a previously-hydrated store will continue to function, and saves will fail with an Axios error that surfaces as a console warning.

- **`VITE_API_BASE_URL` must be set at build time.** Unlike Create React App's `REACT_APP_*` variables which can be injected at runtime via a server, Vite bakes environment variables into the bundle at build time. Deploying the same build artifact to a different API host requires a rebuild.

---

## Running the Application

```bash
cd web-frontend
npm install
npm run dev
```

Access the app at `http://localhost:5173`. Log in with a user created via the backend API (`POST /api/auth/register/`). After login, the dashboard lists your projects; clicking one opens the editor at `/editor/<id>`.

### Available npm Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | TypeScript compile + production bundle |
| `npm run preview` | Serve the `dist/` folder locally |
| `npm test` | Run Vitest test suite once |
| `npm run test:watch` | Vitest in watch mode |
| `npm run lint` | ESLint with auto-fix |
