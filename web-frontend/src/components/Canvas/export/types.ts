export type ExportFormat = 'png' | 'jpeg' | 'svg' | 'pdf';
export type ExportScale = '1x' | '2x' | '4x' | 'custom';

export interface ExportConfig {
  format: ExportFormat;
  scale: number;
  includeBackground: boolean;
  backgroundColor: string;
  padding: number;
  filename: string;
  quality: number; // For JPEG only
}

export interface ExportPreset {
  id: string;
  name: string;
  description: string;
  config: ExportConfig;
}

export const defaultExportConfig: ExportConfig = {
  format: 'png',
  scale: 2,
  includeBackground: true,
  backgroundColor: '#ffffff',
  padding: 40,
  filename: `diagram-${new Date().toISOString().split('T')[0]}`,
  quality: 0.95,
};

export const exportPresets: ExportPreset[] = [
  {
    id: 'high-res-png',
    name: 'High-Res PNG',
    description: 'For presentations and printing',
    config: {
      ...defaultExportConfig,
      format: 'png',
      scale: 3,
      padding: 60,
    },
  },
  {
    id: 'web-optimized',
    name: 'Web Optimized',
    description: 'For websites and documentation',
    config: {
      ...defaultExportConfig,
      format: 'png',
      scale: 2,
      quality: 0.9,
    },
  },
  {
    id: 'print-pdf',
    name: 'Print PDF',
    description: 'Vector PDF for printing',
    config: {
      ...defaultExportConfig,
      format: 'pdf',
      scale: 1,
      padding: 72, // 1 inch margin
    },
  },
  {
    id: 'vector-svg',
    name: 'Vector SVG',
    description: 'Scalable vector graphics',
    config: {
      ...defaultExportConfig,
      format: 'svg',
      scale: 1,
      filename: 'diagram-vector',
    },
  },
];