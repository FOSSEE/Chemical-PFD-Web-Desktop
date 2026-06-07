// Reusable types for canvas and components
export interface Grip {
  x: number;
  y: number;
  side: "top" | "bottom" | "left" | "right";
}
import { KonvaEventObject } from "konva/lib/Node";

export interface ComponentItem {
  id: number; // Optional because library items don't have ids
  name: string;
  icon: string; // Required, not optional
  svg: string; // Required, not optional
  class: string;
  object: string;
  args: any[];
  grips?: Grip[];
  isCustom?: boolean;
  // Additional properties from first block
  legend?: string;
  suffix?: string;
  description?: string;
  png?: string;
}
export interface CanvasItem extends ComponentItem {
  id: number;
  x: number;
  component_id: number; // This is a foreing and primary key
  y: number;
  width: number;
  height: number;
  rotation: number;
  sequence: number; // increasing counter for insertion order
  addedAt: number; // timestamp
  label?: string; // e.g. PRV01A/B or Insulation01
  objectKey?: string; // for counting
  naturalWidth?: number;
  naturalHeight?: number;
}

export interface Connection {
  id: number;
  sourceItemId: number;
  sourceGripIndex: number;
  targetItemId: number;
  targetGripIndex: number;
  // Optional manual waypoints (absolute canvas coordinates) between source and target grips.
  // When present, the rendered line will go: sourceGrip -> ...waypoints... -> targetGrip.
  waypoints?: { x: number; y: number }[];
}

export interface CanvasState {
  items: CanvasItem[];
  connections: Connection[];
  counts: Record<string, number>; // counts keyed by objectKey
  sequenceCounter: number; // increments each add to preserve order
}

export interface StagePosition {
  x: number;
  y: number;
}

export interface CanvasDimensions {
  width: number;
  height: number;
}

export interface ComponentLibrarySidebarProps {
  components: Record<string, Record<string, ComponentItem>>;
  onDragStart: (e: React.DragEvent, item: ComponentItem) => void;
  onSearch?: (query: string) => void;
  onCategoryChange?: (category: string) => void;
  initialSearchQuery?: string;
  selectedCategory?: string;
  className?: string;
}

export interface CanvasItemImageProps {
  item: CanvasItem;
  isSelected: boolean;
  isInvalid?: boolean;
  onSelect: (e?: KonvaEventObject<MouseEvent>) => void; // Strict typing
  onChange: (newAttrs: CanvasItem) => void;
  onDragEnd?: (item: CanvasItem) => void;
  /** Called ONCE when the user finishes a resize gesture (mouseUp). Use this
   *  to commit to the global store so only one undo snapshot is pushed. */
  onTransformEnd?: (item: CanvasItem) => void;
  /** Current canvas zoom/scale — used to compute a zoom-aware minimum size. */
  stageScale?: number;
  onGripMouseDown?: (
    itemId: number,
    gripIndex: number,
    x: number,
    y: number,
  ) => void;
  onGripMouseEnter?: (itemId: number, gripIndex: number) => void;
  onGripMouseLeave?: () => void;
  isDrawingConnection?: boolean;
  hoveredGrip?: { itemId: number; gripIndex: number } | null;
}

export interface CanvasPropertiesSidebarProps {
  items: CanvasItem[];
  selectedItemId: number | null;
  onSelectItem: (itemId: number) => void;
  onDeleteItem: (itemId: number) => void;
  onUpdateItem?: (itemId: number, updates: Partial<CanvasItem>) => void;
  className?: string;
  showAllItemsByDefault?: boolean;
}

// Export image types

export interface ExportPreset {
  id: string;
  name: string;
  description: string;
  options: Partial<ExportOptions>;
}

export type ExportFormat = "png" | "jpg" | "pdf" | "export";
export type ExportQuality = "low" | "medium" | "high";
export interface ExportOptions {
  format: "png" | "jpg" | "pdf" | "export";
  scale: number;
  backgroundColor: string;
  padding: number;
  showGrid: boolean;
  includeGrid: boolean;
  quality: "low" | "medium" | "high";
  connections?: Connection[];
}

export const defaultExportOptions: ExportOptions = {
  format: "png",
  scale: 1, // Changed from 2 to match ExportModal default
  quality: "high",
  padding: 20, // Changed from 40 to match ExportModal default
  backgroundColor: "#ffffff",
  includeGrid: false,
  includeWatermark: false,
  watermarkText: "",
  filename: "diagram", // Added
  showGrid: false,
};
export interface ExportOptions {
  format: ExportFormat;
  scale: number;
  backgroundColor: string;
  padding: number;
  includeGrid: boolean;
  includeWatermark: boolean;
  watermarkText?: string;
  quality: ExportQuality;
  filename?: string;
  // Remove showGrid since it's not in the ExportModal
  // connections?: Connection[]; // Remove if not used
}
export const exportPresets = [
  {
    id: "presentation",
    name: "Presentation",
    description: "High-res PNG for slides",
    options: {
      format: "png" as ExportFormat,
      scale: 2,
      quality: "high" as ExportQuality,
      padding: 40,
      backgroundColor: "#ffffff",
      showGrid: false,
    },
  },
  {
    id: "print",
    name: "Print",
    description: "PDF for printing",
    options: {
      format: "pdf" as ExportFormat,
      scale: 3,
      quality: "high" as ExportQuality,
      padding: 60,
      backgroundColor: "#ffffff",
      showGrid: false,
    },
  },
  {
    id: "web",
    name: "Web",
    description: "Optimized JPG for web",
    options: {
      format: "jpg" as ExportFormat,
      scale: 1,
      quality: "medium" as ExportQuality,
      padding: 20,
      backgroundColor: "#ffffff",
      showGrid: false,
    },
  },
  {
    id: "dark",
    name: "Dark Mode",
    description: "Dark background export",
    options: {
      format: "png" as ExportFormat,
      scale: 2,
      quality: "high" as ExportQuality,
      padding: 40,
      backgroundColor: "#1e293b",
      showGrid: false,
    },
  },
];
// Add interface for the custom export format
export interface DiagramExportData {
  // Document metadata
  version: string;
  exportedAt: string;
  editorVersion: string;

  // Canvas state (what's needed to restore everything)
  canvasState: {
    items: CanvasItem[];
    connections: Connection[];
    counts: Record<string, number>;
    sequenceCounter: number;
  };

  // Viewport state (so we can restore zoom/position)
  viewport: {
    scale: number;
    position: { x: number; y: number };
    gridSize: number;
    showGrid: boolean;
    snapToGrid: boolean;
  };

  // Project metadata
  project: {
    id: string;
    name: string;
    createdAt: string;
    lastModified: string;
  };

  // Export settings used
  exportSettings?: Partial<ExportOptions>;
}

export interface SavedProject {
  name: string;
  description: string | null;
}

export interface BackendCanvasItem {
  id: number;
  project: number;
  component_id: number;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  sequence: number;
  s_no: string;
  parent: string;
  name: string;
  svg: string | null;
  png: string | null;
  object: string;
  legend: string;
  suffix: string;
  grips: any[];
}

export interface BackendConnection {
  id: number;
  sourceItemId: number;
  sourceGripIndex: number;
  targetItemId: number;
  targetGripIndex: number;
  waypoints: Array<{ x: number; y: number }>;
}
