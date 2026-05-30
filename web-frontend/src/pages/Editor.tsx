// Editor.tsx (integrated version)
import { useParams, useNavigate } from "react-router-dom";
import { Stage, Layer, Shape } from "react-konva";
import {
  Button,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Slider,
  Switch,
  Tooltip,
} from "@heroui/react";
import Konva from "konva";
import React, { useEffect, useMemo, useRef, useState } from "react";

import {
  TbFileImport,
  TbLayoutSidebarLeftCollapse,
  TbLayoutSidebarLeftExpand,
  TbLayoutSidebarRightCollapse,
  TbLayoutSidebarRightExpand,
} from "react-icons/tb";
import { MdZoomIn, MdZoomOut, MdCenterFocusWeak } from "react-icons/md";
import { FiDownload } from "react-icons/fi";
import { Popover, PopoverTrigger, PopoverContent } from "@heroui/react";
import { TbGridDots, TbGridPattern } from "react-icons/tb";

import { buildGraph } from "../utils/graph/buildGraph";
import { validateGraph } from "../utils/graph/validateGraph";

import { CanvasItemImage } from "@/components/Canvas/CanvasItemImage";
import {
  CanvasPropertiesSidebar,
  ComponentLibrarySidebar,
} from "@/components/Canvas/ComponentLibrarySidebar";
import {
  moveSegment,
  findSegmentIndex,
  snap,
} from "@/utils/pathfinding/segmentDrag";
import {
  optimizePath,
  enforceManhattanShape,
} from "@/utils/pathfinding/optimize";
import {
  getPaddedObstacleRects,
  pathHitsObstacle,
} from "@/utils/pathfinding/obstacles";

import ExportModal from "@/components/Canvas/ExportModal";
import { ThemeSwitch } from "@/components/theme-switch";
import { useComponents } from "@/context/ComponentContext";
import {
  calculateManualPathsWithBridges,
  getGripPosition,
  getStandoff,
  smartRoute,
} from "@/utils/routing";
// import { exportDiagram, downloadBlob } from "@/utils/exports";
import { ExportReportModal } from "@/components/Canvas/ExportReportModal";
import {
  ExportOptions,
  type CanvasItem,
  type ComponentItem,
  type Connection,
} from "@/components/Canvas/types";
import { NewProjectModal } from "@/components/NewProjectModal";
import { SaveConfirmationModal } from "@/components/SaveConfirmationModal";
import { UnsavedChangesModal } from "@/components/UnsavedChangesModal";
import { useEditorStore } from "@/store/useEditorStore";
import {
  createExportData,
  exportToDiagramFile,
  importFromDiagramFile,
  migrateExportData,
} from "@/utils/diagramExport";
import { appendFooterToImage } from "@/utils/exportFooter";
import {
  createProject,
  fetchProject,
  saveProjectCanvas,
  generateAIDiagram,
} from "@/api/projectApi";
import { convertToBackendFormat, SavedProject } from "@/utils/projectStorage";
import { ConnectionPreview } from "@/components/Canvas/ConnectionPreview";
import { ConnectionLine } from "@/components/Canvas/ConnectionLine";
import { matchComponent, normalizeType } from "@/utils/aiMatcher";

type Shortcut = {
  key: string;
  label: string;
  display: string;
  handler: () => void;
  requireCtrl?: boolean;
};

// Helper to resolve image URLs
const resolveImageUrl = (url: string) => {
  if (!url) return "";
  // Check if it's a data URI or already absolute
  if (url.startsWith("data:") || url.startsWith("http")) return url;
  // If relative path (e.g. /media/...), prepend backend host
  // Assuming backend is at localhost:8000 based on projectApi.ts
  if (url.startsWith("/")) return `http://localhost:8000${url}`;

  return url;
};

export default function Editor() {
  const [aiError, setAiError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [snapToGrid, setSnapToGrid] = useState(true);

  const [gridSize, setGridSize] = useState(20);
  const [componentSize, setComponentSize] = useState(1500); // Component drop size
  const prevComponentSizeRef = useRef(componentSize); // Initialize with current default to prevent unintended scaling on first drop
  // In your state section, add:
  const [isImporting, setIsImporting] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [projectMetadata, setProjectMetadata] = useState<Pick<
    SavedProject,
    "name" | "description"
  > | null>(null);

  // Unsaved changes tracking
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSavedState, setLastSavedState] = useState<string | null>(null);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [unsavedContext, setUnsavedContext] = useState<
    "navigation" | "newProject"
  >("navigation");
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);

  // Get editor store methods
  const editorStore = useEditorStore();

  // Get current state from store
  const currentState = useMemo(() => {
    if (!projectId) return null;

    return editorStore.getEditorState(projectId);
  }, [projectId, editorStore]);

  useEffect(() => {
    if (!projectId) return;

    let mounted = true;

    const loadProject = async () => {
      try {
        // 1) Fetch from backend
        const resp = await fetchProject(Number(projectId));

        if (!mounted) return;

        // resp may be wrapped with status keys in backend, get project object
        // In your backend, ProjectDetailView returns project serializer + "canvas_state".
        const projectObj = resp; // resp already contains fields + canvas_state per backend

        // Update metadata
        setProjectMetadata({
          name: projectObj.name ?? `Project ${projectId}`,
          description: projectObj.description ?? null,
        });

        // Canvas data (might be located at projectObj.canvas_state or resp.canvas_state)
        const canvasState =
          projectObj.canvas_state ?? projectObj.canvas_state ?? null;

        if (canvasState && canvasState.items) {
          // Convert backend CanvasState -> CanvasItem (your frontend types)
          const canvasItems = canvasState.items.map((item: any) => {
            const objectKey =
              item.object ||
              item.name ||
              (item.component ? item.component.name : "");
            const rawSvg = item.svg || "";
            const rawPng = item.png || "";

            return {
              id: item.id,
              name:
                item.name ||
                (item.component && item.component.name) ||
                objectKey ||
                "Component",
              icon: resolveImageUrl(rawPng || rawSvg),
              svg: resolveImageUrl(rawSvg),
              class: item.object || item.class || "",
              object:
                item.object || (item.component && item.component.name) || "",
              args: item.args || [],
              addedAt: Date.now(),
              x: item.x ?? 0,
              y: item.y ?? 0,
              width: item.width ?? item.w ?? 80,
              height: item.height ?? item.h ?? 80,
              rotation: item.rotation ?? 0,
              scaleX: item.scaleX ?? 1,
              scaleY: item.scaleY ?? 1,
              sequence: item.sequence ?? 0,
              label: item.label ?? "",
              grips: item.grips ?? [],
              legend: item.legend ?? "",
              suffix: item.suffix ?? "",
              png: resolveImageUrl(rawPng),
              component_id: item.component_id, // Ensure this is preserved
              objectKey,
            } as any;
          });

          // connections come as array
          const connections = canvasState.connections ?? [];

          // Build initial counts (derive counts from items)
          const counts: Record<string, number> = {};

          canvasItems.forEach((it: any) => {
            const k = it.objectKey ?? it.object ?? it.name ?? "Component";

            counts[k] = (counts[k] || 0) + 1;
          });

          // hydrate editor store
          editorStore.hydrateEditor(projectId, {
            items: canvasItems,
            connections,
            counts,
            sequenceCounter:
              canvasState.sequence_counter ??
              (canvasItems.length
                ? Math.max(...canvasItems.map((i: any) => i.sequence)) + 1
                : 0),
          });

          // restore viewport if present in response
          if (projectObj.viewport) {
            setStageScale(projectObj.viewport.scale ?? 1);
            setStagePos(projectObj.viewport.position ?? { x: 0, y: 0 });
            setGridSize(projectObj.viewport.gridSize ?? gridSize);
            setShowGrid(projectObj.viewport.showGrid ?? showGrid);
            setSnapToGrid(projectObj.viewport.snapToGrid ?? snapToGrid);
          }
        } else {
          // No canvas state -> initialize an empty editor (frontend only)
          editorStore.initEditor(projectId);
        }
      } catch (error) {
        console.error("Failed to load project from backend:", error);
        // fallback: initialize empty editor (optional)
        editorStore.initEditor(projectId);
      }
    };

    loadProject();

    return () => {
      mounted = false;
    };
  }, [projectId]); // depends on projectId

  // Extract data from current state
  const droppedItems = useMemo(() => {
    if (!projectId) return [];

    return editorStore.getItemsInOrder(projectId);
  }, [projectId, editorStore, currentState?.items]);

  const connections = useMemo(() => {
    return currentState?.connections || [];
  }, [currentState?.connections]);

  // Graph validation state
  const [validationResult, setValidationResult] = useState<any>(null);

  // Rebuild graph and validate process structure whenever components or connections change
  useEffect(() => {
    if (!droppedItems || droppedItems.length === 0) return;

    const graph = buildGraph(droppedItems, connections);
    const result = validateGraph(graph);

    setValidationResult(result);
  }, [droppedItems, connections]);

  // Update all existing components when size slider changes
  useEffect(() => {
    if (!projectId || droppedItems.length === 0) return;

    const prevSize = prevComponentSizeRef.current;

    if (prevSize === componentSize) return; // No change

    // Calculate scale factor
    const scaleFactor = Math.sqrt(componentSize / prevSize);

    // Update all items proportionally
    const updates = droppedItems.map((item) => ({
      id: item.id,
      patch: {
        width: item.width * scaleFactor,
        height: item.height * scaleFactor,
      },
    }));

    editorStore.batchUpdateItems(projectId, updates);

    // Update the ref for next change
    prevComponentSizeRef.current = componentSize;
  }, [componentSize, projectId, droppedItems, editorStore]);

  const canUndo = projectId ? editorStore.canUndo(projectId) : false;
  const canRedo = projectId ? editorStore.canRedo(projectId) : false;

  const isCtrlOrCmd = (e: KeyboardEvent) => e.ctrlKey || e.metaKey;

  // Export diagram states
  const [showExportModal, setShowExportModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showGrid, setShowGrid] = useState(true);

  const [isExporting, setIsExporting] = useState(false);

  // Add this component inside your Editor component, after all state declarations
  const FileDropZone = () => {
    const [isDragging, setIsDragging] = useState(false);

    const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
    };

    const handleDrop = async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];

      if (!file || !file.name.endsWith(".export")) return;

      // Create a synthetic event for handleImportDiagram
      const syntheticEvent = {
        target: {
          files: [file],
        },
      } as unknown as React.ChangeEvent<HTMLInputElement>;

      await handleImportDiagram(syntheticEvent);
    };

    if (!isDragging) return null;

    return (
      <div
        className="absolute inset-0 z-50 flex items-center justify-center bg-blue-500/10 backdrop-blur-sm border-4 border-dashed border-blue-400 rounded-lg"
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}>
        <div className="text-center p-8 bg-white dark:bg-gray-800 rounded-lg shadow-2xl">
          <TbFileImport className="w-16 h-16 text-blue-500 mx-auto mb-4" />
          <p className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">
            Drop Diagram File Here
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            .export files only
          </p>
        </div>
      </div>
    );
  };
  const handleImportDiagram = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];

    if (!file || !projectId) return;

    setIsImporting(true);

    try {
      const importData = await importFromDiagramFile(file);
      const migratedData = migrateExportData(importData);

      // Restore the canvas state
      editorStore.hydrateEditor(projectId, migratedData.canvasState);

      // Restore viewport settings
      setStageScale(migratedData.viewport.scale);
      setStagePos(migratedData.viewport.position);
      setGridSize(migratedData.viewport.gridSize);
      setShowGrid(migratedData.viewport.showGrid);
      setSnapToGrid(migratedData.viewport.snapToGrid);

      alert(`Diagram "${migratedData.project.name}" imported successfully!`);
    } catch (error) {
      console.error("Import failed:", error);
      alert(`Import failed: ${(error as Error).message}`);
    } finally {
      setIsImporting(false);
      event.target.value = ""; // Reset file input
    }
  };
  const waitForKonvaImages = async (stage: Konva.Stage) => {
    const imageNodes = stage.find("Image") as Konva.Image[];

    await Promise.all(
      imageNodes.map(
        (node) =>
          new Promise<void>((resolve) => {
            const img = node.image();

            if (!img) {
              resolve();

              return;
            }

            // Check if it is an HTMLImageElement
            if (img instanceof HTMLImageElement) {
              if (img.complete && img.naturalWidth > 0) {
                resolve();

                return;
              }
              img.onload = () => resolve();
              img.onerror = () => resolve();
            } else {
              // For other types (Canvas, ImageBitmap), assume ready
              resolve();
            }
          }),
      ),
    );
  };

  // In your Editor.tsx handleExport function:

  const handleExport = async (options: ExportOptions) => {
    if (!projectId || !currentState) {
      alert("No project loaded");

      return;
    }

    setIsExporting(true);
    const originalShowGrid = showGrid;

    try {
      /* =========================
     DIAGRAM FILE EXPORT (.pfd)
     ========================= */
      if (options.format === "export") {
        const exportData = createExportData(
          currentState,
          {
            scale: stageScale,
            position: stagePos,
            gridSize,
            showGrid,
            snapToGrid,
          },
          projectId,
          `Diagram ${projectId}`,
        );

        const fileName = options.filename
          ? `${options.filename}.pfd`
          : `diagram-${projectId}.pfd`;

        exportToDiagramFile(exportData, fileName);
        setShowExportModal(false);

        return;
      }

      /* =========================
     IMAGE / PDF EXPORT
     ========================= */
      if (!stageRef.current) {
        throw new Error("Canvas not ready");
      }

      // Apply grid option
      if (options.includeGrid !== undefined) {
        setShowGrid(options.includeGrid);
      }

      // Let React re-render
      await new Promise((resolve) => setTimeout(resolve, 100));

      const stage = stageRef.current;

      // Force draw
      stage.batchDraw();

      // WAIT FOR ALL IMAGES TO LOAD
      await waitForKonvaImages(stage);

      // Extra frame for safety
      await new Promise((resolve) => requestAnimationFrame(resolve));

      /* =========================
     DETERMINE BACKGROUND COLOR
     ========================= */
      // Get the actual stage background color
      const isDarkMode = document.documentElement.classList.contains("dark");
      const defaultBackground = isDarkMode ? "#1f2937" : "#ffffff";

      let backgroundFill = options.backgroundColor || defaultBackground;

      // Handle transparent background
      if (backgroundFill === "transparent") {
        backgroundFill = "rgba(0,0,0,0)";
      }

      console.log("Export settings:", {
        background: backgroundFill,
        isDarkMode,
        format: options.format,
        scale: options.scale,
        quality: options.quality,
      });

      /* =========================
     EXPORT TO DATA URL
     ========================= */
      const pixelRatio = options.scale ?? 2;
      const mimeType = options.format === "jpg" ? "image/jpeg" : "image/png";
      const quality =
        options.quality === "low"
          ? 0.7
          : options.quality === "medium"
            ? 0.85
            : 1;

      // IMPORTANT: Create a temporary stage clone with fixed background
      const tempContainer = document.createElement("div");

      tempContainer.style.position = "absolute";
      tempContainer.style.left = "-9999px";
      tempContainer.style.top = "-9999px";
      tempContainer.style.width = `${stage.width()}px`;
      tempContainer.style.height = `${stage.height()}px`;
      document.body.appendChild(tempContainer);

      const tempStage = new Konva.Stage({
        container: tempContainer,
        width: stage.width(),
        height: stage.height(),
      });

      // Add background layer first
      if (backgroundFill !== "rgba(0,0,0,0)") {
        const bgLayer = new Konva.Layer();
        const bgRect = new Konva.Rect({
          x: 0,
          y: 0,
          width: stage.width(),
          height: stage.height(),
          fill: backgroundFill,
        });

        bgLayer.add(bgRect);
        tempStage.add(bgLayer);
      }

      // Clone the main layer (skip grid if not needed)
      const originalLayer = stage.findOne("Layer");

      if (originalLayer) {
        const clonedLayer = originalLayer.clone({
          listening: false,
        });

        // Remove grid if not included
        if (!options.includeGrid) {
          clonedLayer
            .find(".grid-line, .grid-shape")
            .forEach((node: Konva.Node) => node.destroy());
        }

        tempStage.add(clonedLayer);
      }

      tempStage.batchDraw();

      // Generate data URL from temp stage
      let dataUrl = tempStage.toDataURL({
        pixelRatio,
        mimeType,
        quality,
      });

      // Clean up temp stage
      tempStage.destroy();
      document.body.removeChild(tempContainer);

      // Append Footer Block (mimicking PyQt title block)
      const projectName = projectMetadata?.name || "Untitled Project";
      const createdBy = localStorage.getItem("username") || "Unknown User";
      const exportDate = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
      
      dataUrl = await appendFooterToImage(dataUrl, projectName, createdBy, exportDate, backgroundFill, pixelRatio);

      /* =========================
     PDF EXPORT - FIXED
     ========================= */
      if (options.format === "pdf") {
        const { jsPDF } = await import("jspdf");

        // Create image from data URL
        const img = new Image();

        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = dataUrl;
        });

        // Calculate PDF dimensions (A4 landscape)
        const pdfWidth = 297; // mm
        const pdfHeight = 210; // mm

        // Calculate image aspect ratio
        const imgRatio = img.width / img.height;

        // Scale image to fit PDF
        let imgWidth = pdfWidth - 20; // 10mm margins
        let imgHeight = imgWidth / imgRatio;

        // Adjust if too tall
        if (imgHeight > pdfHeight - 20) {
          imgHeight = pdfHeight - 20;
          imgWidth = imgHeight * imgRatio;
        }

        // Center image
        const xOffset = (pdfWidth - imgWidth) / 2;
        const yOffset = (pdfHeight - imgHeight) / 2;

        const pdf = new jsPDF({
          orientation: "landscape",
          unit: "mm",
          format: "a4",
        });

        // Set PDF background color (convert hex to RGB)
        if (backgroundFill !== "rgba(0,0,0,0)") {
          const rgb = hexToRgb(backgroundFill);

          if (rgb) {
            pdf.setFillColor(rgb.r, rgb.g, rgb.b);
            pdf.rect(0, 0, pdfWidth, pdfHeight, "F");
          }
        }

        pdf.addImage(dataUrl, "PNG", xOffset, yOffset, imgWidth, imgHeight);

        const pdfName = options.filename
          ? `${options.filename}.pdf`
          : `diagram-${Date.now()}.pdf`;

        pdf.save(pdfName);
      } else {
        /* =========================
       PNG / JPG EXPORT
       ========================= */
        const extension = options.format === "jpg" ? ".jpg" : ".png";
        const filename = options.filename
          ? `${options.filename}${extension}`
          : `diagram-${Date.now()}${extension}`;

        const link = document.createElement("a");

        link.download = filename;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();

        // Clean up
        setTimeout(() => {
          document.body.removeChild(link);
          URL.revokeObjectURL(dataUrl);
        }, 100);
      }

      setShowExportModal(false);
    } catch (error) {
      console.error("Export failed:", error);
      alert(`Export failed: ${(error as Error).message}`);
    } finally {
      // Restore grid state
      setShowGrid(originalShowGrid);
      setIsExporting(false);
    }
  };

  // Helper function to convert hex to RGB
  const hexToRgb = (hex: string) => {
    // Remove # if present
    hex = hex.replace("#", "");

    // Parse hex values
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    return { r, g, b };
  };

  // Handle save changes to localStorage
  const handleSaveChanges = async () => {
    if (!projectId || !currentState || !projectMetadata) {
      alert("No project loaded");

      return;
    }

    try {
      // Convert the editor state to backend format (use your existing util)
      const canvasState = convertToBackendFormat(
        Number(projectId),
        currentState.items,
        currentState.connections,
        currentState.sequenceCounter || 0,
      );

      // Prepare payload expected by backend update view
      const payload = {
        name: projectMetadata.name,
        description: projectMetadata.description,
        canvas_state: canvasState,
        // optionally include viewport so backend can persist it
        viewport: {
          scale: stageScale,
          position: stagePos,
          gridSize,
          showGrid,
          snapToGrid,
        },
      };

      // PUT to backend
      const updated = await saveProjectCanvas(Number(projectId), payload);

      // After successful save, update local "lastSavedState" tracking
      const savedStateStr = JSON.stringify({
        items: currentState.items,
        connections: currentState.connections,
      });

      setLastSavedState(savedStateStr);
      setHasUnsavedChanges(false);

      // Optionally update project metadata from backend response
      if (updated && updated.name) {
        setProjectMetadata({
          name: updated.name,
          description: updated.description ?? null,
        });
      }

      alert(`Project "${projectMetadata.name}" saved successfully!`);
    } catch (error) {
      console.error("Save failed:", error);
      alert(`Save failed: ${(error as Error).message}`);
    }
  };

  // Initialize lastSavedState only on first load
  useEffect(() => {
    if (!currentState || lastSavedState) return;

    // Initialize on first load only (when lastSavedState is null)
    const currentStateStr = JSON.stringify({
      items: currentState.items,
      connections: currentState.connections,
    });

    setLastSavedState(currentStateStr);
  }, [currentState, lastSavedState]);
  // Track changes to detect unsaved modifications
  useEffect(() => {
    if (!currentState || !lastSavedState) return;

    const currentStateStr = JSON.stringify({
      items: currentState.items,
      connections: currentState.connections,
    });

    const changed = currentStateStr !== lastSavedState;

    if (changed !== hasUnsavedChanges) {
      setHasUnsavedChanges(changed);
    }
  }, [
    currentState?.items,
    currentState?.connections,
    lastSavedState,
    hasUnsavedChanges,
  ]);

  // Warn on browser refresh/close
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Handler for save and proceed with navigation
  const handleSaveAndNavigate = () => {
    handleSaveChanges();
    setHasUnsavedChanges(false);
    navigate("/dashboard");
  };

  // Handler for discard and proceed with navigation
  const handleDiscardAndNavigate = () => {
    setHasUnsavedChanges(false);
    navigate("/dashboard");
  };

  // Handler for new project button
  const handleNewProjectClick = () => {
    if (hasUnsavedChanges) {
      setUnsavedContext("newProject");
      setShowUnsavedModal(true);
    } else {
      setShowNewProjectModal(true);
    }
  };

  // Handler for save and create new project
  const handleSaveAndCreateNew = () => {
    handleSaveChanges();
    setHasUnsavedChanges(false);
    setShowNewProjectModal(true);
  };

  // Handler for discard and create new project
  const handleDiscardAndCreateNew = () => {
    setHasUnsavedChanges(false);
    setShowNewProjectModal(true);
  };

  // Handler for creating new project from modal
  const handleCreateNewProject = async (name: string, description: string) => {
    try {
      const created = await createProject(name, description || null);

      navigate(`/editor/${created.id}`);
    } catch (error) {
      console.error("Failed to create project:", error);
      alert("Failed to create project");
    }
  };

  useEffect(() => {
    if (showExportModal) {
      // Clear all selections when export modal opens
      setSelectedItemIds(new Set());
      setSelectedConnectionIds(new Set());
    }
  }, [showExportModal]);

  // --- State ---
  const { components, isLoading, error } = useComponents();
  const handleZoomIn = () => {
    setStageScale((prev) => Math.min(3, prev + 0.1));
  };

  const handleZoomOut = () => {
    setStageScale((prev) => Math.max(0.1, prev - 0.1));
  };

  const handleToggleGrid = () => {
    setShowGrid((prev) => !prev);
  };

  const handleCenterToContent = () => {
    if (droppedItems.length === 0) {
      setStagePos({ x: 0, y: 0 });
      setStageScale(1);

      return;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    droppedItems.forEach((item) => {
      minX = Math.min(minX, item.x);
      minY = Math.min(minY, item.y);
      maxX = Math.max(maxX, item.x + item.width);
      maxY = Math.max(maxY, item.y + item.height);
    });

    const padding = 100;
    const contentWidth = maxX - minX + padding * 2;
    const contentHeight = maxY - minY + padding * 2;

    if (stageRef.current && containerRef.current) {
      const containerWidth = stageSize.width;
      const containerHeight = stageSize.height;

      const scaleX = containerWidth / contentWidth;
      const scaleY = containerHeight / contentHeight;
      const scale = Math.min(scaleX, scaleY, 1);

      const centerX = minX - padding + contentWidth / 2;
      const centerY = minY - padding + contentHeight / 2;

      const targetX = containerWidth / 2 - centerX * scale;
      const targetY = containerHeight / 2 - centerY * scale;

      setStageScale(scale);
      setStagePos({ x: targetX, y: targetY });
    }
  };

  // Selection state
  const [selectedItemIds, setSelectedItemIds] = useState<Set<number>>(
    new Set(),
  );
  const [selectedConnectionIds, setSelectedConnectionIds] = useState<
    Set<number>
  >(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  // Connection drawing state
  const [isDrawingConnection, setIsDrawingConnection] = useState(false);
  const [tempConnection, setTempConnection] = useState<{
    sourceItemId: number;
    sourceGripIndex: number;
    startX: number;
    startY: number;
    waypoints: { x: number; y: number }[];
    currentX: number;
    currentY: number;
  } | null>(null);
  const [hoveredGrip, setHoveredGrip] = useState<{
    itemId: number;
    gripIndex: number;
  } | null>(null);

  // Canvas Viewport State
  const [stageScale, setStageScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });

  // Refs
  const stageRef = useRef<Konva.Stage>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragItemRef = useRef<ComponentItem | null>(null);

  // --- Helpers ---
  const connectionPaths = useMemo(
    () =>
      calculateManualPathsWithBridges(
        connections,
        droppedItems,
        2000,
        1500,
        true,
      ),
    [connections, droppedItems],
  );

  const handleCancelDrawing = () => {
    if (isDrawingConnection) {
      setIsDrawingConnection(false);
      setTempConnection(null);
    }
  };

  const snapToGridPosition = (x: number, y: number) => {
    if (!snapToGrid) return { x, y };
    const effectiveGridSize = gridSize;

    return {
      x: Math.round(x / effectiveGridSize) * effectiveGridSize,
      y: Math.round(y / effectiveGridSize) * effectiveGridSize,
    };
  };

  // --- Shortcuts ---
  const shortcuts: Shortcut[] = useMemo(
    () => [
      {
        key: "z",
        label: "Undo",
        display: "Ctrl + Z",
        requireCtrl: true,
        handler: () => projectId && editorStore.undo(projectId),
      },
      {
        key: "a",
        label: "Select All",
        display: "Ctrl + A",
        requireCtrl: true,
        handler: () => {
          // Select all items
          const allItemIds = new Set(droppedItems.map((item) => item.id));

          setSelectedItemIds(allItemIds);

          // Select all connections
          const allConnectionIds = new Set(connections.map((conn) => conn.id));

          setSelectedConnectionIds(allConnectionIds);
        },
      },
      {
        key: "g",
        label: "Toggle Grid",
        display: "Ctrl+G",
        requireCtrl: true,
        handler: handleToggleGrid,
      },
      {
        key: "h",
        label: "Toggle Snap to Grid",
        display: "Ctrl+h",
        requireCtrl: true,
        handler: () => setSnapToGrid((prev) => !prev),
      },
      {
        key: "y",
        label: "Redo",
        display: "Ctrl + Y",
        requireCtrl: true,
        handler: () => projectId && editorStore.redo(projectId),
      },
      {
        key: "c",
        label: "Center to Content",
        display: "Ctrl + C",
        requireCtrl: true,
        handler: handleCenterToContent,
      },
      {
        key: "delete",
        label: "Delete Selection",
        display: "d / Del / Backspace",
        requireCtrl: false,
        handler: () => {
          if (!projectId) return;

          if (selectedConnectionIds.size > 0) {
            editorStore.batchRemoveConnections(
              projectId,
              Array.from(selectedConnectionIds),
            );
            setSelectedConnectionIds(new Set());
          }

          if (selectedItemIds.size > 0) {
            editorStore.batchDeleteItems(
              projectId,
              Array.from(selectedItemIds),
            );
            setSelectedItemIds(new Set());
          }
        },
      },
      {
        key: "escape",
        label: "Cancel Drawing",
        display: "Esc",
        requireCtrl: false,
        handler: handleCancelDrawing,
      },
    ],
    [
      projectId,
      editorStore,
      selectedItemIds,
      selectedConnectionIds,
      snapToGrid,
      droppedItems,
      connections,
    ],
  );

  // Handle keyboard events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();

      // Check if target is an input field
      const target = e.target as HTMLElement;

      if (
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable) &&
        key !== "escape" // Optional: let Escape still unfocus inputs
      ) {
        return;
      }

      for (const shortcut of shortcuts) {
        const matchesKey =
          key === shortcut.key ||
          (shortcut.key === "delete" &&
            (key === "delete" || key === "backspace" || key === "d"));

        if (matchesKey && (!shortcut.requireCtrl || isCtrlOrCmd(e))) {
          e.preventDefault();
          shortcut.handler();

          return;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [shortcuts]);

  // --- Handlers ---
  const handleDragStart = (e: React.DragEvent, item: ComponentItem) => {
    dragItemRef.current = item;

    if (item.svg) {
      const img = new Image();

      img.src = item.svg;
      const canvas = document.createElement("canvas");

      canvas.width = 80;
      canvas.height = 80;
      const ctx = canvas.getContext("2d");

      if (ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, 80, 80);
        img.onload = () => {
          ctx.drawImage(img, 0, 0, 80, 80);
          try {
            e.dataTransfer.setDragImage(canvas, 40, 40);
          } catch {
            // ignore in unsupported environments
          }
        };
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const stage = stageRef.current;

    if (dragItemRef.current && stage && projectId) {
      try {
        stage.setPointersPositions(e.nativeEvent);
      } catch {
        // fallback
      }

      const pointer = stage.getRelativePointerPosition?.();

      if (pointer) {
        const droppedItem = dragItemRef.current;
        const img = new Image();

        img.src = droppedItem.svg || droppedItem.icon || "";

        const finalizeAdd = (width: number, height: number) => {
          let x = pointer.x - width / 2;
          let y = pointer.y - height / 2;

          if (snapToGrid) {
            const snapped = snapToGridPosition(x, y);

            x = snapped.x;
            y = snapped.y;
          }

          const newItem = editorStore.addItem(projectId, droppedItem, {
            x,
            y,
            width,
            height,
            rotation: 0,
          });

          if (newItem) {
            setSelectedItemIds(new Set([newItem.id]));
          }
        };

        img.onload = () => {
          const aspectRatio = img.width / img.height;
          // Use the dynamic component size from slider
          const targetArea = componentSize;
          let width: number;
          let height: number;

          // Calculate dimensions to match target area while maintaining aspect ratio
          height = Math.sqrt(targetArea / aspectRatio);
          width = height * aspectRatio;

          finalizeAdd(width, height);
        };

        img.onerror = () => {
          finalizeAdd(80, 80);
        };
      }
      dragItemRef.current = null;
    }
  };

  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current;

    if (!stage) return;

    if (e.evt.ctrlKey) {
      const scaleBy = 1.05;
      const oldScale = stage.scaleX();
      const pointer = stage.getPointerPosition();

      if (!pointer) return;

      const mousePointTo = {
        x: (pointer.x - stage.x()) / oldScale,
        y: (pointer.y - stage.y()) / oldScale,
      };

      const newScale =
        e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;

      setStageScale(newScale);
      setStagePos({
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale,
      });
    } else {
      setStagePos((prev: { x: number; y: number }) => ({
        x: prev.x - e.evt.deltaX,
        y: prev.y - e.evt.deltaY,
      }));
    }
  };

  const handleDeleteItem = (itemId: number) => {
    if (!projectId) return;

    editorStore.deleteItem(projectId, itemId);
    setSelectedItemIds((prev: Set<number>) => {
      const next = new Set(prev);

      next.delete(itemId);

      return next;
    });
  };

  const handleUpdateItem = (itemId: number, updates: Partial<CanvasItem>) => {
    if (!projectId) return;

    let snappedUpdates: Partial<CanvasItem> = { ...updates };

    if (snapToGrid && (updates.x !== undefined || updates.y !== undefined)) {
      const currentItem = droppedItems.find((i) => i.id === itemId);

      if (currentItem) {
        const x = updates.x ?? currentItem.x;
        const y = updates.y ?? currentItem.y;
        const snapped = snapToGridPosition(x, y);

        if (updates.x !== undefined) snappedUpdates.x = snapped.x;
        if (updates.y !== undefined) snappedUpdates.y = snapped.y;
      }
    }

    // Multi-drag support
    // Only apply multi-drag if we are moving (x/y change) but NOT resizing (width/height change)
    // This prevents resizing updates from being swallowed by the batch update which only tracks x/y.
    const isResizing =
      updates.width !== undefined || updates.height !== undefined;

    if (
      !isResizing &&
      selectedItemIds.has(itemId) &&
      (snappedUpdates.x !== undefined || snappedUpdates.y !== undefined)
    ) {
      const currentItem = droppedItems.find((i) => i.id === itemId);

      if (currentItem) {
        const deltaX = (snappedUpdates.x ?? currentItem.x) - currentItem.x;
        const deltaY = (snappedUpdates.y ?? currentItem.y) - currentItem.y;

        if (deltaX !== 0 || deltaY !== 0) {
          const batchUpdates = droppedItems
            .filter((item) => selectedItemIds.has(item.id))
            .map((item) => ({
              id: item.id,
              patch: {
                x: snapToGrid
                  ? snapToGridPosition(item.x + deltaX, item.y + deltaY).x
                  : item.x + deltaX,
                y: snapToGrid
                  ? snapToGridPosition(item.x + deltaX, item.y + deltaY).y
                  : item.y + deltaY,
              },
            }));

          editorStore.batchUpdateItems(projectId, batchUpdates);

          return;
        }
      }
    }

    // Skip history entry for image metadata sync
const isMetadataSync =
  "naturalWidth" in snappedUpdates ||
  "naturalHeight" in snappedUpdates;

editorStore.updateItem(
  projectId,
  itemId,
  snappedUpdates,
  !isMetadataSync,
);

    // If the component moved, reset connection waypoints so routing recalculates
    if (updates.x !== undefined || updates.y !== undefined) {
      const relatedConnections = connections.filter(
        (conn) => conn.sourceItemId === itemId || conn.targetItemId === itemId,
      );

      relatedConnections.forEach((conn) => {
        editorStore.updateConnection(projectId, conn.id, {
          waypoints: [],
        });
      });
    }
  };

  /**
   * Called ONCE when the user finishes a resize gesture (Konva onTransformEnd).
   * Writes the final dimensions to the store in a single atomic update so only
   * ONE undo snapshot is pushed — mirroring the desktop ResizeCommand pattern.
   * Also resets waypoints on connected pipes so they re-route around the new bounds.
   */
  const handleResizeEnd = (item: CanvasItem) => {
    if (!projectId) return;

    // Single atomic store write = single undo entry
    editorStore.updateItem(projectId, item.id, {
      x: item.x,
      y: item.y,
      width: item.width,
      height: item.height,
      rotation: item.rotation,
    });

    // Reset waypoints for all pipes attached to this component so they re-route
    const relatedConnections = connections.filter(
      (conn) => conn.sourceItemId === item.id || conn.targetItemId === item.id,
    );

    relatedConnections.forEach((conn) => {
      editorStore.updateConnection(projectId, conn.id, { waypoints: [] });
    });
  };

  const handleSelectItem = (
    itemId: number,
    e?: Konva.KonvaEventObject<MouseEvent>,
  ) => {
    const isCtrl = e?.evt.ctrlKey || e?.evt.metaKey;

    setSelectedItemIds((prev) => {
      const next = new Set(isCtrl ? prev : []);

      if (isCtrl && prev.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }

      return next;
    });

    if (!isCtrl) {
      setSelectedConnectionIds(new Set());
    }
  };

  const handleClearSelection = () => {
    setSelectedItemIds(new Set());
    setSelectedConnectionIds(new Set());
  };

  // Connection Handlers
  const handleGripMouseDown = (
    itemId: number,
    gripIndex: number,
    x: number,
    y: number,
  ) => {
    if (!projectId) return;

    if (
      isDrawingConnection &&
      tempConnection &&
      (tempConnection.sourceItemId !== itemId ||
        tempConnection.sourceGripIndex !== gripIndex)
    ) {
      const sourceItem = droppedItems.find(
        (i) => i.id === tempConnection.sourceItemId,
      );
      const targetItem = droppedItems.find((i) => i.id === itemId);

      let initialWaypoints = tempConnection.waypoints || [];

      if (initialWaypoints.length === 0 && sourceItem && targetItem) {
        const start = getGripPosition(
          sourceItem,
          tempConnection.sourceGripIndex,
        );
        const end = getGripPosition(targetItem, gripIndex);
        const sourceGrip = sourceItem.grips?.[tempConnection.sourceGripIndex];
        const targetGrip = targetItem.grips?.[gripIndex];

        if (start && end) {
          const startStandoff = getStandoff(start, sourceGrip);
          const endStandoff = getStandoff(end, targetGrip);

          initialWaypoints = smartRoute(
            startStandoff,
            endStandoff,
            droppedItems,
          );
        }
      }

      const newConnection = editorStore.addConnection(projectId, {
        sourceItemId: tempConnection.sourceItemId,
        sourceGripIndex: tempConnection.sourceGripIndex,
        targetItemId: itemId,
        targetGripIndex: gripIndex,
        waypoints: initialWaypoints,
      });

      setIsDrawingConnection(false);
      setTempConnection(null);
      setSelectedConnectionIds(new Set([newConnection.id]));

      return;
    }

    setIsDrawingConnection(true);
    setTempConnection({
      sourceItemId: itemId,
      sourceGripIndex: gripIndex,
      startX: x,
      startY: y,
      waypoints: [],
      currentX: x,
      currentY: y,
    });
  };

  const handleGripMouseEnter = (itemId: number, gripIndex: number) => {
    setHoveredGrip({ itemId, gripIndex });
  };

  const handleGripMouseLeave = () => {
    setHoveredGrip(null);
  };

  const handleStageMouseMove = () => {
    if (isDrawingConnection && tempConnection) {
      const stage = stageRef.current;

      if (stage) {
        const pointer = stage.getRelativePointerPosition();

        if (pointer) {
          setTempConnection((prev: any) =>
            prev
              ? {
                ...prev,
                currentX: pointer.x,
                currentY: pointer.y,
              }
              : null,
          );
        }
      }
    }
  };

  const handleStageMouseUp = () => {
    // Manual connection drawing - no auto-cancel
  };

  // Handle stage resize
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      const rect = entries[0].contentRect;

      setStageSize({
        width: rect.width,
        height: rect.height,
      });
    });

    resizeObserver.observe(containerRef.current);

    return () => resizeObserver.disconnect();
  }, []);

  // Undo/Redo handlers
  const handleUndo = () => {
    if (projectId && canUndo) {
      editorStore.undo(projectId);
    }
  };

  const handleRedo = () => {
    if (projectId && canRedo) {
      editorStore.redo(projectId);
    }
  };

  // Grid Layer Component
  const GridLayer = React.memo(function GridLayer({
    width,
    height,
    gridSize,
    showGrid,
  }: {
    width: number;
    height: number;
    gridSize: number;
    showGrid: boolean;
  }) {
    if (!showGrid) return null;

    return (
      <Layer listening={false}>
        <Shape
          opacity={0.3}
          perfectDrawEnabled={false}
          sceneFunc={(context: any, shape: Konva.Shape) => {
            context.beginPath();

            const startX = -5000;
            const endX = width + 5000;
            const startY = -5000;
            const endY = height + 5000;

            // Vertical Lines
            for (let x = startX; x <= endX; x += gridSize) {
              context.moveTo(x, startY);
              context.lineTo(x, endY);
            }

            // Horizontal Lines
            for (let y = startY; y <= endY; y += gridSize) {
              context.moveTo(startX, y);
              context.lineTo(endX, y);
            }

            context.fillStrokeShape(shape);
          }}
          stroke="#9ca3af"
          strokeWidth={1}
        />
      </Layer>
    );
  });

  GridLayer.displayName = "GridLayer";

  // --- Preview Connection Logic ---
  let previewPathData: string | null = null;
  let previewEnd: any;
  let previewAngle: number | undefined;

  if (isDrawingConnection && tempConnection) {
    const fakeTarget = {
      id: -9999,
      x: tempConnection.currentX,
      y: tempConnection.currentY,
      width: 1,
      height: 1,
      naturalWidth: 1,
      naturalHeight: 1,
      grips: [{ x: 50, y: 50 }],
    };

    const previewConn = {
      id: -1,
      sourceItemId: tempConnection.sourceItemId,
      sourceGripIndex: tempConnection.sourceGripIndex,
      targetItemId: -9999,
      targetGripIndex: 0,
      waypoints: tempConnection.waypoints,
    };

    const map = calculateManualPathsWithBridges(
      [previewConn as any],
      [...droppedItems, fakeTarget as any],
      2000,
      1500,
      true,
    );

    const meta = map[-1];

    if (meta) {
      previewPathData = meta.pathData ?? null;
      previewEnd = meta.endPoint;
      previewAngle = meta.arrowAngle;
    }
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header Bar */}
      <div className="h-14 shrink-0 border-b flex items-center px-4 justify-between bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 z-10">
        <div className="flex items-center gap-2">
          <Tooltip content="Back to Dashboard">
            <Button
              isIconOnly
              className="text-gray-700 dark:text-gray-300"
              variant="light"
              onPress={() => {
                if (hasUnsavedChanges) {
                  setUnsavedContext("navigation");
                  setShowUnsavedModal(true);
                } else {
                  navigate("/dashboard");
                }
              }}>
              ←
            </Button>
          </Tooltip>
          <div className="h-6 w-px bg-gray-300 dark:bg-gray-700 mx-2" />

          <Dropdown>
            <DropdownTrigger>
              <Button
                className="text-gray-700 dark:text-gray-300"
                size="sm"
                variant="light">
                Edit
              </Button>
            </DropdownTrigger>
            <DropdownMenu
              aria-label="Edit Actions"
              disabledKeys={
                [!canUndo && "undo", !canRedo && "redo"].filter(
                  Boolean,
                ) as string[]
              }>
              <DropdownItem key="undo" onPress={handleUndo}>
                Undo (Ctrl+Z)
              </DropdownItem>
              <DropdownItem key="redo" onPress={handleRedo}>
                Redo (Ctrl+Y)
              </DropdownItem>
              <DropdownItem
                key="delete"
                onPress={() => {
                  if (
                    selectedItemIds.size > 0 ||
                    selectedConnectionIds.size > 0
                  ) {
                    if (projectId && selectedItemIds.size > 0)
                      editorStore.batchDeleteItems(
                        projectId,
                        Array.from(selectedItemIds),
                      );
                    if (projectId && selectedConnectionIds.size > 0)
                      editorStore.batchRemoveConnections(
                        projectId,
                        Array.from(selectedConnectionIds),
                      );
                    setSelectedItemIds(new Set());
                    setSelectedConnectionIds(new Set());
                  }
                }}>
                Delete Selected (d)
              </DropdownItem>
              <DropdownItem key="clear" onPress={handleClearSelection}>
                Clear Selection
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>

          <Dropdown>
            <DropdownTrigger>
              <Button
                className="text-gray-700 dark:text-gray-300"
                size="sm"
                variant="light">
                View
              </Button>
            </DropdownTrigger>
            <DropdownMenu aria-label="View Actions">
              <DropdownItem key="zoom-in" onPress={handleZoomIn}>
                Zoom In (+)
              </DropdownItem>
              <DropdownItem key="zoom-out" onPress={handleZoomOut}>
                Zoom Out (-)
              </DropdownItem>
              <DropdownItem key="fit" onPress={handleCenterToContent}>
                Fit to Screen
              </DropdownItem>
              <DropdownItem key="grid" onPress={handleToggleGrid}>
                {showGrid ? "Hide Grid" : "Show Grid"}
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </div>

        <div className="font-semibold text-gray-800 dark:text-gray-200">
          Diagram Editor{" "}
          <span className="text-xs ml-2 text-gray-600 dark:text-gray-400">
            ID: {projectId}
          </span>
        </div>

        <div className="flex gap-2">
          <ThemeSwitch />
          <Button
            className="border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300"
            size="sm"
            variant="bordered"
            onPress={handleNewProjectClick}>
            New Project
          </Button>
          <Button
            className="border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300"
            isLoading={isImporting}
            size="sm"
            startContent={<TbFileImport />}
            variant="bordered"
            onPress={() => {
              // Create a hidden file input
              const input = document.createElement("input");

              input.type = "file";
              input.accept = ".pfd";
              input.onchange = (e) => handleImportDiagram(e as any);
              input.click();
            }}>
            Import
          </Button>
          <Button
            className="border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300"
            size="sm"
            startContent={<FiDownload />}
            variant="bordered"
            onPress={() => setShowExportModal(true)}>
            Export
          </Button>
          <Button
            className="border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300"
            size="sm"
            startContent={<FiDownload />}
            variant="bordered"
            onPress={() => setShowReportModal(true)}>
            Generate Report
          </Button>
          <Button
            className="border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300"
            size="sm"
            startContent={<span>⚡</span>}
            variant="bordered"
            onPress={() => setShowAIModal(true)}>
            AI Generate
          </Button>
          <Button
            className="bg-blue-600 text-white hover:bg-blue-700"
            isDisabled={!projectId}
            size="sm"
            onPress={() => setShowSaveModal(true)}>
            Save Changes
          </Button>
        </div>
      </div>

      {/* Main workspace */}
      <div
        className="flex-1 grid overflow-hidden transition-all duration-300"
        style={{
          gridTemplateColumns: `
            ${leftCollapsed ? "48px" : "256px"}
            minmax(0, 1fr)
            ${rightCollapsed ? "48px" : "288px"}
          `,
        }}>
        {/* Left Sidebar - Component Library */}
        <div className="relative overflow-hidden border-r border-gray-200 dark:border-gray-800">
          {!leftCollapsed && (
            <ComponentLibrarySidebar
              components={components}
              error={error}
              initialSearchQuery={searchQuery}
              isLoading={isLoading}
              selectedCategory={selectedCategory}
              onCategoryChange={(cat) => setSelectedCategory(cat)}
              onDragStart={handleDragStart}
              onSearch={(q) => setSearchQuery(q)}
            />
          )}
        </div>

        {/* Canvas Area - Konva */}
        {/* Canvas Area - Konva */}
        <div
          ref={containerRef}
          className="relative min-w-0 overflow-hidden bg-white"
          onDragLeave={(e) => {
            e.preventDefault();
          }}
          onDragOver={(e) => {
            e.preventDefault(); // Allow drop
            // Also handle file drags
            if (e.dataTransfer.types.includes("Files")) {
              e.dataTransfer.dropEffect = "copy";
            }
          }}
          onDrop={(e) => {
            e.preventDefault();

            // First check if it's a file drop (for .export files)
            if (e.dataTransfer.files.length > 0) {
              const file = e.dataTransfer.files[0];

              if (file.name.endsWith(".export")) {
                // Create a synthetic event for handleImportDiagram
                const syntheticEvent = {
                  target: {
                    files: [file],
                  },
                } as unknown as React.ChangeEvent<HTMLInputElement>;

                handleImportDiagram(syntheticEvent);

                return;
              }
            }

            // Otherwise, it's a component drag from the sidebar
            handleDrop(e);
          }}>
          <FileDropZone />

          {/* Left Sidebar Collapse Button */}
          <button
            className="absolute top-1/2 -translate-y-1/2 left-2 z-30 w-8 h-16 flex items-center justify-center
            rounded-lg bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900
            border border-gray-300/50 dark:border-gray-600/50
            shadow-lg hover:shadow-xl
            hover:scale-105 active:scale-95
            transition-all duration-200 ease-out
            hover:border-blue-400/50 dark:hover:border-blue-500/50
            group pointer-events-auto"
            title={leftCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            onClick={() => setLeftCollapsed((v) => !v)}>
            {!leftCollapsed ? (
              <TbLayoutSidebarLeftCollapse className="w-5 h-5 text-gray-600 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
            ) : (
              <TbLayoutSidebarLeftExpand className="w-5 h-5 text-gray-600 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
            )}
          </button>

          {/* Right Sidebar Collapse Button */}
          <button
            className="absolute top-1/2 -translate-y-1/2 right-2 z-30 w-8 h-16 flex items-center justify-center
            rounded-lg bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900
            border border-gray-300/50 dark:border-gray-600/50
            shadow-lg hover:shadow-xl
            hover:scale-105 active:scale-95
            transition-all duration-200 ease-out
            hover:border-blue-400/50 dark:hover:border-blue-500/50
            group pointer-events-auto"
            title={rightCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            onClick={() => setRightCollapsed((v: boolean) => !v)}>
            {!rightCollapsed ? (
              <TbLayoutSidebarRightCollapse className="w-5 h-5 text-gray-600 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
            ) : (
              <TbLayoutSidebarRightExpand className="w-5 h-5 text-gray-600 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
            )}
          </button>

          <Stage
            ref={stageRef}
            draggable
            className="flex relative"
            height={stageSize.height}
            scaleX={stageScale}
            scaleY={stageScale}
            width={stageSize.width}
            x={stagePos.x}
            y={stagePos.y}
            onDragEnd={(e) => {
              if (e.target === stageRef.current) {
                setStagePos({ x: e.target.x(), y: e.target.y() });
              }
            }}
            onMouseDown={(e) => {
              const clickedOnEmpty = e.target === e.target.getStage();

              if (clickedOnEmpty && isDrawingConnection) {
                handleCancelDrawing();

                return;
              }

              if (clickedOnEmpty) {
                handleClearSelection();
              }
            }}
            onMouseMove={() => {
              const stage = stageRef.current;

              if (stage) {
                const pointer = stage.getRelativePointerPosition();

                if (pointer)
                  setCursorPos({
                    x: Math.round(pointer.x),
                    y: Math.round(pointer.y),
                  });
              }
              handleStageMouseMove();
            }}
            onMouseUp={handleStageMouseUp}
            onWheel={handleWheel}>
            <GridLayer
              gridSize={gridSize}
              height={stageSize.height}
              showGrid={showGrid}
              width={stageSize.width}
            />
            <Layer>
              {/* Render Connections */}
              {connections.map((connection: Connection) => {
                const savedWaypoints = connection.waypoints || [];

                return (
                  <ConnectionLine
                    key={connection.id}
                    arrowAngle={connectionPaths[connection.id]?.arrowAngle}
                    isSelected={selectedConnectionIds.has(connection.id)}
                    items={droppedItems}
                    pathData={connectionPaths[connection.id]?.pathData}
                    segments={connectionPaths[connection.id]?.segments}
                    targetPosition={connectionPaths[connection.id]?.endPoint}
                    onSegmentDragEnd={(
                      segment: any,
                      dx: number,
                      dy: number,
                    ) => {
                      if (!projectId) return;

                      // Phase 4: jitter guard — ignore micro drags
                      if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return;

                      const pathMeta = connectionPaths[connection.id];

                      // Resolve the current path from stored waypoints
                      // pathMeta.waypoints contains all bend points between standoff ends
                      const currentPath: { x: number; y: number }[] =
                        pathMeta?.waypoints && pathMeta.waypoints.length > 0
                          ? pathMeta.waypoints
                          : connection.waypoints || [];

                      if (currentPath.length === 0) return;

                      // Find which segment index in the path corresponds to the dragged segment
                      const segIdx = findSegmentIndex(
                        currentPath,
                        segment.p1,
                        segment.p2,
                        8, // tolerance in pixels
                      );

                      if (segIdx === -1) {
                        // Fallback: shift all waypoints by drag delta (old behaviour)
                        const shifted = currentPath.map((wp) => ({
                          x: snap(wp.x + dx),
                          y: snap(wp.y + dy),
                        }));
                        editorStore.updateConnection(projectId, connection.id, {
                          waypoints: shifted,
                        });
                        return;
                      }

                      // Phase 3: move the segment within the path
                      const moved = moveSegment(currentPath, segIdx, dx, dy);

                      // Phase 4: snap all points to grid
                      const snapped = moved.map((p) => ({
                        x: snap(p.x),
                        y: snap(p.y),
                      }));

                      // Get padded obstacles for drag check
                      const obstacles = getPaddedObstacleRects(
                        droppedItems,
                        20,
                      );

                      // Post-process: re-optimize and enforce clean shape
                      const clean = enforceManhattanShape(
                        optimizePath(snapped),
                        obstacles,
                      );

                      // Phase 6: Add rejection logic
                      if (pathHitsObstacle(clean, obstacles)) {
                        return; // revert by doing nothing
                      }

                      editorStore.updateConnection(projectId, connection.id, {
                        waypoints: clean,
                      });
                    }}
                    onSelect={(e: Konva.KonvaEventObject<MouseEvent>) => {
                      const isCtrl = e.evt.ctrlKey || e.evt.metaKey;

                      setSelectedConnectionIds((prev: Set<number>) => {
                        const next = new Set(isCtrl ? prev : []);

                        if (isCtrl && prev.has(connection.id)) {
                          next.delete(connection.id);
                        } else {
                          next.add(connection.id);
                        }

                        return next;
                      });

                      if (!isCtrl) setSelectedItemIds(new Set());

                      // Add a waypoint when the user clicks a connection without explicit waypoints
                      if (projectId && savedWaypoints.length === 0) {
                        const stage = stageRef.current;
                        const pointer = stage?.getPointerPosition();

                        if (pointer) {
                          const snapped = snapToGridPosition(
                            pointer.x,
                            pointer.y,
                          );

                          editorStore.updateConnection(
                            projectId,
                            connection.id,
                            {
                              waypoints: [snapped],
                            },
                          );
                        }
                      }
                    }}
                  />
                );
              })}

              {/* Render Temporary Connection Line (Drawing) */}
              {isDrawingConnection && tempConnection && (
                <ConnectionPreview
                  arrowAngle={previewAngle}
                  endPoint={previewEnd}
                  pathData={previewPathData}
                />
              )}

              {/* Render Components */}
              {droppedItems.map((item: CanvasItem) => {
                const isInvalid =
                  validationResult &&
                  (validationResult.isolated.includes(item.id) ||
                    validationResult.circular.includes(item.id) ||
                    validationResult.brokenFlow.includes(item.id));

                return (
                  <CanvasItemImage
                    key={item.id}
                    hoveredGrip={hoveredGrip}
                    isDrawingConnection={isDrawingConnection}
                    isInvalid={isInvalid}
                    isSelected={selectedItemIds.has(item.id)}
                    item={item}
                    stageScale={stageScale}
                    onChange={(newAttrs) =>
                      handleUpdateItem(newAttrs.id, newAttrs)
                    }
                    onGripMouseDown={handleGripMouseDown}
                    onGripMouseEnter={handleGripMouseEnter}
                    onGripMouseLeave={handleGripMouseLeave}
                    onSelect={(e) => handleSelectItem(item.id, e)}
                    onTransformEnd={handleResizeEnd}
                  />
                );
              })}
            </Layer>
          </Stage>

          {/* Floating Info Bubble */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none">
            <div className="flex items-center gap-3 px-4 py-2 bg-white/90 dark:bg-[#1f2938] backdrop-blur shadow-lg border border-gray-200 rounded-full text-xs font-mono text-gray-600 pointer-events-auto">
              {/* XY Coordinates */}
              <div className="flex gap-2 dark:text-gray-200">
                <span className="font-bold text-gray-400">X</span> {cursorPos.x}
              </div>
              <div className="w-px h-3 bg-gray-400" />
              <div className="flex gap-2 dark:text-gray-200">
                <span className="font-bold text-gray-400">Y</span> {cursorPos.y}
              </div>

              <div className="w-px h-3 bg-gray-300" />

              <div className="flex items-center gap-3">
                {/* Show Grid Button */}
                <Tooltip
                  content={showGrid ? "Hide Grid" : "Show Grid"}
                  placement="top">
                  <button
                    aria-label="Toggle Grid Visibility"
                    className={`w-8 h-8 flex items-center justify-center rounded-md 
        border border-gray-300 dark:border-gray-700 
        bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 
        transition-all duration-150`}
                    onClick={() => setShowGrid((prev) => !prev)}>
                    {showGrid ? (
                      <TbGridDots className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                    ) : (
                      <TbGridPattern className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                    )}
                  </button>
                </Tooltip>

                {/* Snap to Grid Switch */}
                <Tooltip
                  content={snapToGrid ? "Snap Enabled" : "Snap Disabled"}
                  placement="top">
                  <Switch
                    aria-label="Snap to Grid"
                    color="primary"
                    isSelected={snapToGrid}
                    size="sm"
                    thumbIcon={({ isSelected, className }) =>
                      isSelected ? (
                        <TbGridDots className={className} />
                      ) : (
                        <TbGridPattern className={className} />
                      )
                    }
                    onValueChange={setSnapToGrid}
                  />
                </Tooltip>
              </div>

              <div className="w-px h-3 bg-gray-300" />

              {/* Component Size Slider */}
              <div className="flex items-center gap-2">
                <Tooltip content="Component Size" placement="top">
                  <div className="flex items-center gap-2 px-2">
                    <span className="text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
                      Size
                    </span>
                    <Slider
                      aria-label="Component Size"
                      className="w-24"
                      classNames={{
                        track:
                          "bg-gradient-to-r from-blue-200 to-blue-400 dark:from-blue-800 dark:to-blue-600",
                        thumb: "bg-blue-600 dark:bg-blue-500",
                      }}
                      maxValue={8000}
                      minValue={2000}
                      size="sm"
                      step={100}
                      value={componentSize}
                      onChange={(value) => setComponentSize(value as number)}
                    />
                  </div>
                </Tooltip>
              </div>

              <div className="w-px h-3 bg-gray-300" />

              {/* Zoom Controls */}
              <div className="flex items-center gap-2">
                {/* Zoom Out Button */}
                <button
                  className="w-8 h-8 flex items-center justify-center rounded-full
                bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700
                border border-gray-300 dark:border-gray-600
                shadow-sm hover:shadow
                disabled:opacity-40 disabled:cursor-not-allowed
                transition-all duration-200"
                  disabled={stageScale <= 0.1}
                  title="Zoom Out"
                  onClick={handleZoomOut}>
                  <MdZoomOut className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                </button>

                {/* Zoom Percentage Display */}
                <div className="flex items-center">
                  <div
                    className="px-3 py-1.5 text-sm font-medium
                bg-gray-50 dark:bg-gray-800 
                rounded-l-md
                text-gray-700 dark:text-gray-300">
                    {Math.round(stageScale * 100)}%
                  </div>
                </div>

                {/* Center Content Button */}
                <button
                  className="w-8 h-8 flex items-center justify-center rounded-full
                bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700
                border border-gray-300 dark:border-gray-600
                shadow-sm hover:shadow
                disabled:opacity-40 disabled:cursor-not-allowed
                transition-all duration-200"
                  disabled={droppedItems.length === 0}
                  title="Center to Content"
                  onClick={handleCenterToContent}>
                  <MdCenterFocusWeak className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                </button>

                {/* Zoom In Button */}
                <button
                  className="w-8 h-8 flex items-center justify-center rounded-full
                bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700
                border border-gray-300 dark:border-gray-600
                shadow-sm hover:shadow
                disabled:opacity-40 disabled:cursor-not-allowed
                transition-all duration-200"
                  disabled={stageScale >= 3}
                  title="Zoom In"
                  onClick={handleZoomIn}>
                  <MdZoomIn className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                </button>
              </div>
            </div>
          </div>
          {/* Canvas Shortcuts Help */}
          <div className="absolute bottom-6 right-6 z-20">
            <Popover showArrow offset={8} placement="top-end">
              <PopoverTrigger>
                <Button
                  isIconOnly
                  className="rounded-ful bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  size="sm"
                  variant="bordered">
                  ?
                </Button>
              </PopoverTrigger>

              <PopoverContent className="w-64">
                <div className="p-3 space-y-2">
                  <div className="text-sm font-semibold text-foreground">
                    Keyboard Shortcuts
                  </div>

                  <div className="space-y-1">
                    {shortcuts.map((s) => (
                      <div
                        key={s.label}
                        className="flex justify-between items-center text-xs">
                        <span className="text-foreground/70">{s.label}</span>
                        <span className="font-mono bg-content2 px-2 py-0.5 rounded">
                          {s.display}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 text-[10px] text-foreground/50">
                    Ctrl (Windows/Linux) or Cmd (Mac)
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Connection Guidance Overlay */}
          {isDrawingConnection && (
            <div className="absolute top-6 left-1/2 -translate-x-1/2 pointer-events-none">
              <div className="px-4 py-2 bg-black/70 backdrop-blur text-white text-sm rounded-full shadow-lg border border-white/10 flex items-center gap-3">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                  Drawing Connection
                </span>
                <div className="w-px h-3 bg-white/20" />
                <span className="text-white/80 text-xs">
                  Click target point to finish • Press Esc to cancel
                </span>
              </div>
            </div>
          )}

          {/* Selection Guidance Overlay */}
          {!isDrawingConnection &&
            (selectedItemIds.size > 0 || selectedConnectionIds.size > 0) && (
              <div className="absolute top-6 left-1/2 -translate-x-1/2 pointer-events-none">
                <div className="px-4 py-2 bg-black/70 backdrop-blur text-white text-sm rounded-full shadow-lg border border-white/10 flex items-center gap-3">
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                    {selectedItemIds.size + selectedConnectionIds.size} Selected
                  </span>
                  <div className="w-px h-3 bg-white/20" />
                  <span className="text-white/80 text-xs">
                    Press &apos;d&apos; to delete selection • Ctrl+Click to add
                    more
                  </span>
                </div>
              </div>
            )}

          {/* Empty State Overlay */}
          {droppedItems.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center p-6 bg-white/20 backdrop-blur rounded-xl border border-gray-200 shadow-sm">
                <div className="text-black font-medium">Canvas Empty</div>
                <div className="text-sm text-gray-400 mt-1">
                  Drag components from the sidebar <br />
                  <span className="font-bold">OR Generate using AI</span> <br />
                  or drag and drop a .pfd file to get started.
                </div>
              </div>
            </div>
          )}
        </div>
        {/* Right Sidebar - Canvas Properties/Items List */}
        <div className="relative overflow-hidden border-l border-gray-200 dark:border-gray-800 hidden lg:block">
          {!rightCollapsed && (
            <CanvasPropertiesSidebar
              showAllItemsByDefault
              items={droppedItems}
              selectedItemId={
                selectedItemIds.size === 1
                  ? Array.from(selectedItemIds)[0]
                  : null
              }
              onDeleteItem={handleDeleteItem}
              onSelectItem={(id: number) => setSelectedItemIds(new Set([id]))}
              onUpdateItem={handleUpdateItem}
            />
          )}
        </div>
        <ExportModal
          isExporting={isExporting}
          isOpen={showExportModal}
          onClose={() => setShowExportModal(false)}
          onExport={handleExport}
        />

        <ExportReportModal
          editorId={projectId || ""}
          open={showReportModal}
          projectName={projectMetadata?.name || "Untitled Project"}
          onClose={() => setShowReportModal(false)}
        />

        {/* Save Confirmation Modal */}
        <SaveConfirmationModal
          connectionCount={connections.length}
          isOpen={showSaveModal}
          itemCount={droppedItems.length}
          projectName={projectMetadata?.name || "Untitled Project"}
          onClose={() => setShowSaveModal(false)}
          onConfirm={handleSaveChanges}
        />
        {/* Unsaved Changes Modal */}
        <UnsavedChangesModal
          context={unsavedContext}
          isOpen={showUnsavedModal}
          projectName={projectMetadata?.name || "Untitled Project"}
          onClose={() => {
            setShowUnsavedModal(false);
          }}
          onDiscardAndProceed={
            unsavedContext === "navigation"
              ? handleDiscardAndNavigate
              : handleDiscardAndCreateNew
          }
          onSaveAndProceed={
            unsavedContext === "navigation"
              ? handleSaveAndNavigate
              : handleSaveAndCreateNew
          }
        />

        {/* New Project Modal */}
        <NewProjectModal
          isOpen={showNewProjectModal}
          onClose={() => setShowNewProjectModal(false)}
          onCreate={handleCreateNewProject}
        />
        {validationResult &&
          (!validationResult.hasInlet ||
            !validationResult.hasOutlet ||
            validationResult.isolated.length > 0 ||
            validationResult.circular.length > 0 ||
            validationResult.brokenFlow.length > 0) && (
            <div className="absolute bottom-6 right-6 bg-white border border-red-300 shadow-xl px-4 py-2 rounded text-sm z-[9999] space-y-1">
              {!validationResult.hasInlet && (
                <div className="text-red-600 font-medium">
                  ⚠ No Inlet Component Found
                </div>
              )}

              {!validationResult.hasOutlet && (
                <div className="text-red-600 font-medium">
                  ⚠ No Outlet Component Found
                </div>
              )}

              {validationResult.isolated.length > 0 && (
                <div className="text-red-600 font-medium">
                  ⚠ {validationResult.isolated.length} Isolated Component(s)
                </div>
              )}

              {validationResult.circular.length > 0 && (
                <div className="text-red-600 font-medium">
                  ⚠ {validationResult.circular.length} Component(s) in Circular
                  Loop
                </div>
              )}

              {validationResult.brokenFlow.length > 0 && (
                <div className="text-red-600 font-medium">
                  ⚠ {validationResult.brokenFlow.length} Component(s) with
                  Broken Flow
                </div>
              )}
            </div>
          )}
      </div>

      {/* AI GENERATE MODAL */}
      {showAIModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
          <div className="bg-white dark:bg-gray-900 p-5 rounded-lg w-[400px] shadow-xl">
            <h2 className="text-lg font-bold mb-3">AI Diagram Generator</h2>

            <textarea
              className="w-full border p-2 mb-3 rounded dark:bg-gray-800"
              placeholder="e.g. Pump → Heat Exchanger → Tank"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
            />

            {aiError && (
              <div className="text-red-500 text-sm mb-2">{aiError}</div>
            )}

            {/* EXAMPLES ADDED HERE */}
            <div className="text-xs text-gray-500 mb-3">
              <p className="font-semibold mb-1">Examples:</p>
              <p>• Pump → Heat Exchanger → Tank</p>
              <p>• Tank → Pump → Valve</p>
              <p>• Pump → Valve → Tank</p>
            </div>

            <div className="flex justify-end gap-2">
              <button
                className="px-3 py-1 text-gray-500"
                onClick={() => setShowAIModal(false)}>
                Cancel
              </button>
              <button
                className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
                disabled={isGenerating}
                onClick={async () => {
                  if (!aiPrompt.trim()) {
                    setAiError("Please enter a description first.");
                    return;
                  }

                  if (!projectId) {
                    setAiError("You must create or open a project first.");
                    return;
                  }

                  setAiError("");
                  setIsGenerating(true);

                  try {
                    // Flatten components to find available types
                    const allComps = Object.values(components).flatMap(
                      (group: any) => Object.values(group),
                    );

                    const availableTypes = Array.from(
                      new Set(allComps.map((c: any) => normalizeType(c.name || c.object || "")))
                    ).filter(Boolean);

                    const result = await generateAIDiagram(aiPrompt, availableTypes);

                    if (result.error) {
                      setAiError(result.error);
                      return;
                    }

                    const idMapping: Record<string, { id: number, item: any }> = {};

                    let currentX = 100;
                    const defaultY = 300;

                    const generatedComponents = result.components || [];
                    const generatedConnections = result.connections || [];

                    // Pre-validation to avoid silent failures
                    let hasError = false;
                    for (const aiComp of generatedComponents) {
                      const searchText = (aiComp.variant || aiComp.type || "")
                        .toString()
                        .toLowerCase()
                        .trim();

                      if (!searchText) continue;

                      const match = matchComponent(searchText, allComps as any);

                      if (!match) {
                        console.warn("❌ No match:", aiComp);
                        setAiError(`Unsupported component generated by AI: ${searchText}`);
                        hasError = true;
                        break;
                      }
                    }

                    if (hasError) {
                      setIsGenerating(false);
                      return;
                    }

                    generatedComponents.forEach((aiComp: any) => {
                      const searchText = (aiComp.variant || aiComp.type || "")
                        .toString()
                        .toLowerCase()
                        .trim();

                      if (!searchText) return;

                      const match = matchComponent(searchText, allComps as any);
                      if (!match) return; // Already validated

                      // Use AI provided coordinates, or fallback
                      const compX = aiComp.x !== undefined ? aiComp.x : currentX;
                      const compY = aiComp.y !== undefined ? aiComp.y : defaultY;

                      const added = editorStore.addItem(projectId, match, {
                        x: compX,
                        y: compY,
                      });

                      if (added) {
                        idMapping[aiComp.id] = { id: added.id, item: match };
                        if (aiComp.x === undefined) {
                          currentX += 300;
                        }
                      }
                    });

                    // 🔗 Add connections (ONLY ONCE)
                    generatedConnections.forEach((conn: any) => {
                      const sourceNode = idMapping[conn.from];
                      const targetNode = idMapping[conn.to];

                      if (!sourceNode || !targetNode) return;

                      // Dynamically find valid grips to prevent connection rendering failures
                      const sourceGripLen = sourceNode.item.grips?.length || 0;
                      const targetGripLen = targetNode.item.grips?.length || 0;

                      const sGrip = sourceGripLen > 1 ? 1 : 0;
                      const tGrip = targetGripLen > 3 ? 3 : (targetGripLen > 0 ? 0 : 0);

                      editorStore.addConnection(projectId, {
                        sourceItemId: sourceNode.id,
                        targetItemId: targetNode.id,
                        sourceGripIndex: sGrip,
                        targetGripIndex: tGrip,
                        waypoints: [],
                      });
                    });

                    // Cleanup
                    setShowAIModal(false);
                    setAiPrompt("");
                  } catch (err: any) {
                    console.error("❌ AI ERROR:", err);
                    setAiError(
                      err?.response?.data?.error ||
                      err?.message ||
                      "Something went wrong. Please try again.",
                    );
                  } finally {
                    setIsGenerating(false);
                  }
                }}>
                {isGenerating ? "Generating..." : "Generate Diagram"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
