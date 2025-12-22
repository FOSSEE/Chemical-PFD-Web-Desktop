// Reusable types for canvas and components
export interface Grip {
  x: number;
  y: number;
  side: "top" | "bottom" | "left" | "right";
}

export interface ComponentItem {
  id?: number; // Optional because library items don't have ids
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
  y: number;
  width: number;
  height: number;
  rotation: number;
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
  onSelect: () => void;
  onChange: (newAttrs: CanvasItem) => void;
  onDragEnd?: (item: CanvasItem) => void;
  onTransformEnd?: (item: CanvasItem) => void;
  onGripMouseDown?: (itemId: number, gripIndex: number, x: number, y: number) => void;
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
export type ExportFormat = 'png' | 'jpg' | 'svg' | 'pdf';
export type ExportQuality = 'low' | 'medium' | 'high';

export interface ExportOptions {
  format: ExportFormat;
  quality: ExportQuality;
  scale: number;
  includeGrid: boolean;
  includeWatermark: boolean;
  watermarkText: string;
  padding: number;
  backgroundColor: string;
}

export interface ExportPreset {
  id: string;
  name: string;
  description: string;
  options: Partial<ExportOptions>;
}

export const defaultExportOptions: ExportOptions = {
  format: 'png',
  quality: 'high',
  scale: 2,
  includeGrid: false,
  includeWatermark: false,
  watermarkText: '',
  padding: 20,
  backgroundColor: '#ffffff',
};

export const exportPresets: ExportPreset[] = [
  {
    id: 'presentation',
    name: 'Presentation',
    description: 'High quality for slides',
    options: {
      format: 'png',
      quality: 'high',
      scale: 2,
      includeGrid: false,
      backgroundColor: '#ffffff',
    },
  },
  {
    id: 'print',
    name: 'Print',
    description: 'High resolution for printing',
    options: {
      format: 'pdf',
      quality: 'high',
      scale: 3,
      includeGrid: false,
      padding: 40,
    },
  },
  {
    id: 'web',
    name: 'Web',
    description: 'Optimized for web',
    options: {
      format: 'jpg',
      quality: 'medium',
      scale: 1,
      includeGrid: false,
    },
  },
  {
    id: 'technical',
    name: 'Technical',
    description: 'Include grid for documentation',
    options: {
      format: 'svg',
      quality: 'high',
      includeGrid: true,
      padding: 30,
    },
  },
];