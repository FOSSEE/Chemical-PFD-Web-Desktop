import { useEffect, useState, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Stage, Layer, Line } from "react-konva";
import Konva from "konva";
import { Button, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Tooltip } from "@heroui/react";
import { ThemeSwitch } from "@/components/theme-switch";
import { componentsConfig } from "@/assets/config/items";
import { CanvasItemImage } from "@/components/Canvas/CanvasItemImage";
import { ConnectionLine } from "@/components/Canvas/ConnectionLine";
import { ComponentLibrarySidebar, CanvasPropertiesSidebar } from "@/components/Canvas/ComponentLibrarySidebar";
import { ComponentItem, CanvasItem, Connection, Grip } from "@/components/Canvas/types";
import { calculateManualPathsWithBridges } from "@/utils/routing";
import { useHistory } from "@/hooks/useHistory";

interface CanvasState {
  items: CanvasItem[];
  connections: Connection[];
}

export default function Editor() {
  const { projectId } = useParams();
  const navigate = useNavigate();

  // --- State ---
  const [components, setComponents] = useState<Record<string, Record<string, ComponentItem>>>({});
  
  // History Managed State (Items & Connections)
  const { 
    state: canvasState, 
    set: setCanvasState, 
    undo, 
    redo, 
    canUndo, 
    canRedo 
  } = useHistory<CanvasState>({ items: [], connections: [] });

  const droppedItems = canvasState.items;
  const connections = canvasState.connections;

  // Helpers to maintain compatibility with existing code while pushing to history
  const setDroppedItems = (update: React.SetStateAction<CanvasItem[]>) => {
      setCanvasState(prev => {
          const newItems = typeof update === 'function' ? (update as any)(prev.items) : update;
          return { ...prev, items: newItems };
      });
  };

  const setConnections = (update: React.SetStateAction<Connection[]>) => {
      setCanvasState(prev => {
          const newConnections = typeof update === 'function' ? (update as any)(prev.connections) : update;
          return { ...prev, connections: newConnections };
      });
  };

  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Connection State
  // const [connections, setConnections] = useState<Connection[]>([]); // Replaced by history state
  const [selectedConnectionId, setSelectedConnectionId] = useState<number | null>(null);
  const [isDrawingConnection, setIsDrawingConnection] = useState(false);
  const [tempConnection, setTempConnection] = useState<{
    sourceItemId: number;
    sourceGripIndex: number;
    startX: number;
    startY: number;
    // Manually placed intermediate points while drawing
    waypoints: { x: number; y: number }[];
    currentX: number;
    currentY: number;
  } | null>(null);
  const [hoveredGrip, setHoveredGrip] = useState<{ itemId: number; gripIndex: number } | null>(null);

  // Canvas Viewport State
  const [stageScale, setStageScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });

  // Refs
  const stageRef = useRef<Konva.Stage>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragItemRef = useRef<ComponentItem | null>(null);

  // --- Initialization ---
  useEffect(() => {
    setComponents(componentsConfig);
  }, []);

  // --- Helpers ---
  const getGripPosition = (item: CanvasItem, gripIndex: number): { x: number; y: number } | null => {
    if (!item.grips || gripIndex >= item.grips.length) return null;
    const grip: Grip = item.grips[gripIndex];
    const x = item.x + (grip.x / 100) * item.width;
    const y = item.y + ((100 - grip.y) / 100) * item.height;
    return { x, y };
  };


  // Precompute final polylines with small "bridge" bumps where
  // manually drawn lines cross.
  const connectionPaths = useMemo(
    () => calculateManualPathsWithBridges(connections, droppedItems),
    [connections, droppedItems]
  );

  // --- Event Listeners ---

  // Handle keyboard events (Delete key)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Undo/Redo
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace' || e.key.toLowerCase() === 'd') {
        if (selectedConnectionId !== null) {
          // Delete selected connection
          setConnections(prev => prev.filter(conn => conn.id !== selectedConnectionId));
          setSelectedConnectionId(null);
        } else if (selectedItemId !== null) {
          // Delete selected item
          handleDeleteItem(selectedItemId);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedConnectionId, selectedItemId, undo, redo]);

  // --- Handlers ---

  const handleDragStart = (e: React.DragEvent, item: ComponentItem) => {
    dragItemRef.current = item;

    // Set drag image (ghost)
    if (item.svg) {
      const img = new Image();
      img.src = item.svg;
      // White background for drag preview
      const canvas = document.createElement('canvas');
      canvas.width = 80;
      canvas.height = 80;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 80, 80);
        img.onload = () => {
          ctx.drawImage(img, 0, 0, 80, 80);
          e.dataTransfer.setDragImage(canvas, 40, 40);
        };
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const stage = stageRef.current;

    // If we dropped a sidebar item
    if (dragItemRef.current && stage) {
      stage.setPointersPositions(e.nativeEvent);
      const pointer = stage.getRelativePointerPosition();

      if (pointer) {
        // Capture the current item before async operations
        const droppedItem = dragItemRef.current;

        // Create a temporary image to get aspect ratio
        const img = new Image();
        img.src = droppedItem.svg || droppedItem.icon;

        img.onload = () => {
          const aspectRatio = img.width / img.height;
          const baseSize = 80;
          let width = baseSize;
          let height = baseSize;

          // Preserve aspect ratio
          if (aspectRatio > 1) {
            // Wider than tall
            height = baseSize / aspectRatio;
          } else {
            // Taller than wide
            width = baseSize * aspectRatio;
          }

          const newItem: CanvasItem = {
            ...droppedItem,
            id: Date.now(),
            x: pointer.x - width / 2,
            y: pointer.y - height / 2,
            width,
            height,
            rotation: 0
          };

          setDroppedItems(prev => [...prev, newItem]);
          setSelectedItemId(newItem.id);
        };

        // Fallback if image doesn't load
        img.onerror = () => {
          const newItem: CanvasItem = {
            ...droppedItem,
            id: Date.now(),
            x: pointer.x - 40,
            y: pointer.y - 40,
            width: 80,
            height: 80,
            rotation: 0
          };

          setDroppedItems(prev => [...prev, newItem]);
          setSelectedItemId(newItem.id);
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
      // Zoom logic
      const scaleBy = 1.05;
      const oldScale = stage.scaleX();
      const pointer = stage.getPointerPosition();

      if (!pointer) return;

      const mousePointTo = {
        x: (pointer.x - stage.x()) / oldScale,
        y: (pointer.y - stage.y()) / oldScale,
      };

      const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;

      setStageScale(newScale);
      setStagePos({
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale,
      });
    } else {
      // Pan logic
      setStagePos(prev => ({
        x: prev.x - e.evt.deltaX,
        y: prev.y - e.evt.deltaY
      }));
    }
  };

  const handleDeleteItem = (itemId: number) => {
    // Atomic update for history
    setCanvasState(prev => ({
        items: prev.items.filter(item => item.id !== itemId),
        connections: prev.connections.filter(c => c.sourceItemId !== itemId && c.targetItemId !== itemId)
    }));

    if (selectedItemId === itemId) {
      setSelectedItemId(null);
    }
  };

  const handleUpdateItem = (itemId: number, updates: Partial<CanvasItem>) => {
    setDroppedItems(prev =>
      prev.map(item =>
        item.id === itemId ? { ...item, ...updates } : item
      )
    );
  };

  const handleSelectItem = (itemId: number) => {
    setSelectedItemId(itemId);
  };

  const handleClearSelection = () => {
    setSelectedItemId(null);
  };

  // --- Connection Handlers ---

  const handleGripMouseDown = (itemId: number, gripIndex: number, x: number, y: number) => {
    // If we are already drawing and user clicks a *different* grip, finish the connection.
    if (
      isDrawingConnection &&
      tempConnection &&
      (tempConnection.sourceItemId !== itemId || tempConnection.sourceGripIndex !== gripIndex)
    ) {
      const newConnection: Connection = {
        id: Date.now(),
        sourceItemId: tempConnection.sourceItemId,
        sourceGripIndex: tempConnection.sourceGripIndex,
        targetItemId: itemId,
        targetGripIndex: gripIndex,
        waypoints: tempConnection.waypoints,
      };

      setConnections(prev => [...prev, newConnection]);
      setIsDrawingConnection(false);
      setTempConnection(null);
      return;
    }

    // Otherwise, start a new manual polyline from this grip.
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
          setTempConnection(prev => prev ? {
            ...prev,
            currentX: pointer.x,
            currentY: pointer.y,
          } : null);
        }
      }
    }
  };

  const handleStageMouseUp = () => {
    // In manual mode we don't auto-cancel on mouse up; user either clicks
    // empty canvas to add waypoints or a grip to finish the connection.
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header Bar */}
      <div className="h-14 border-b flex items-center px-4 justify-between bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 z-10">
        <div className="flex items-center gap-2">
          <Tooltip content="Back to Dashboard">
            <Button
              isIconOnly
              variant="light"
              onPress={() => navigate("/dashboard")}
              className="text-gray-700 dark:text-gray-300"
            >←</Button>
          </Tooltip>
          <div className="h-6 w-px bg-gray-300 dark:bg-gray-700 mx-2" />
          <Dropdown>
            <DropdownTrigger>
              <Button variant="light" size="sm" className="text-gray-700 dark:text-gray-300">File</Button>
            </DropdownTrigger>
            <DropdownMenu aria-label="File Actions">
              <DropdownItem key="new">New Diagram</DropdownItem>
              <DropdownItem key="save">Save Project (Ctrl+S)</DropdownItem>
              <DropdownItem key="export">Export as PDF</DropdownItem>
            </DropdownMenu>
          </Dropdown>

          <Dropdown>
            <DropdownTrigger>
              <Button variant="light" size="sm" className="text-gray-700 dark:text-gray-300">Edit</Button>
            </DropdownTrigger>
            <DropdownMenu aria-label="Edit Actions">
              <DropdownItem key="undo" onPress={undo} isDisabled={!canUndo}>Undo (Ctrl+Z)</DropdownItem>
              <DropdownItem key="redo" onPress={redo} isDisabled={!canRedo}>Redo (Ctrl+Y)</DropdownItem>
              <DropdownItem key="delete" onPress={() => selectedItemId && handleDeleteItem(selectedItemId)}>
                Delete Selected (Del)
              </DropdownItem>
              <DropdownItem key="clear" onPress={handleClearSelection}>
                Clear Selection
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>

          <Dropdown>
            <DropdownTrigger>
              <Button variant="light" size="sm" className="text-gray-700 dark:text-gray-300">View</Button>
            </DropdownTrigger>
            <DropdownMenu aria-label="View Actions">
              <DropdownItem key="zoom-in">Zoom In (+)</DropdownItem>
              <DropdownItem key="zoom-out">Zoom Out (-)</DropdownItem>
              <DropdownItem key="fit">Fit to Screen</DropdownItem>
              <DropdownItem key="grid">Toggle Grid</DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </div>

        <div className="font-semibold text-gray-800 dark:text-gray-200">
          Diagram Editor <span className="text-xs ml-2 text-gray-600 dark:text-gray-400">ID: {projectId}</span>
        </div>

        <div className="flex gap-2">
          <ThemeSwitch />
          <Button size="sm" variant="bordered" className="border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300">
            Share
          </Button>
          <Button size="sm" className="bg-blue-600 text-white hover:bg-blue-700">Save Changes</Button>
        </div>
      </div>

      {/* Main workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Component Library */}
        <ComponentLibrarySidebar
          components={components}
          onDragStart={handleDragStart}
          onSearch={setSearchQuery}
          initialSearchQuery={searchQuery}
        />

        {/* Canvas Area - Konva */}
        <div
          className="flex-1 relative overflow-hidden bg-white"
          ref={containerRef}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
        >
          {/* CSS Grid Background */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(#9ca3af 1px, transparent 1px)',
              backgroundSize: `${20 * stageScale}px ${20 * stageScale}px`,
              backgroundPosition: `${stagePos.x}px ${stagePos.y}px`,
              opacity: 0.3
            }}
          />

          <Stage
            width={window.innerWidth - (64 + 72 + 16)} // 64(left) + 72(right) + 16(padding)
            height={window.innerHeight - 56}
            scaleX={stageScale}
            scaleY={stageScale}
            x={stagePos.x}
            y={stagePos.y}
            draggable
            onWheel={handleWheel}
            ref={stageRef}
            onMouseDown={(e) => {
              const clickedOnEmpty = e.target === e.target.getStage();

              // While drawing a connection, clicking on empty canvas creates a waypoint
              if (clickedOnEmpty && isDrawingConnection && tempConnection) {
                const stage = stageRef.current;
                if (stage) {
                  const pointer = stage.getRelativePointerPosition();
                  if (pointer) {
                    setTempConnection(prev =>
                      prev
                        ? {
                          ...prev,
                          waypoints: [...prev.waypoints, { x: pointer.x, y: pointer.y }],
                        }
                        : prev
                    );
                  }
                }
                return;
              }

              // Otherwise, click on empty stage deselects
              if (clickedOnEmpty) {
                handleClearSelection();
                setSelectedConnectionId(null);
              }
            }}
            onMouseMove={() => {
              const stage = stageRef.current;
              if (stage) {
                const pointer = stage.getRelativePointerPosition();
                if (pointer) setCursorPos({ x: Math.round(pointer.x), y: Math.round(pointer.y) });
              }
              handleStageMouseMove();
            }}
            onMouseUp={handleStageMouseUp}
            onDragEnd={(e) => {
              // Update stage position state when panning finishes
              if (e.target === stageRef.current) {
                setStagePos({ x: e.target.x(), y: e.target.y() });
              }
            }}
          >
            <Layer>
              {/* Render Connections */}
              {connections.map((connection) => (
                <ConnectionLine
                  key={connection.id}
                  connection={connection}
                  items={droppedItems}
                  // We now pass pathData instead of points for rendering
                  // points is kept empty [] to satisfy type if needed, or we can just ignore it
                  points={[]}
                  pathData={connectionPaths[connection.id]}
                  isSelected={connection.id === selectedConnectionId}
                  onSelect={() => {
                    setSelectedConnectionId(connection.id);
                    setSelectedItemId(null);
                  }}
                />
              ))}

              {/* Render Temporary Connection Line (Drawing) */}
              {tempConnection && (
                <Line
                  points={[
                    tempConnection.startX,
                    tempConnection.startY,
                    ...tempConnection.waypoints.flatMap((p) => [p.x, p.y]),
                    tempConnection.currentX,
                    tempConnection.currentY,
                  ]}
                  stroke="#9ca3af"
                  strokeWidth={2}
                  dash={[10, 5]}
                  listening={false}
                />
              )}

              {/* Render Components */}
              {droppedItems.map((item) => (
                <CanvasItemImage
                  key={item.id}
                  item={item}
                  isSelected={item.id === selectedItemId}
                  onSelect={() => handleSelectItem(item.id)}
                  onChange={(newAttrs) => {
                    setDroppedItems(prev =>
                      prev.map(i => i.id === newAttrs.id ? newAttrs : i)
                    );
                  }}
                  onGripMouseDown={handleGripMouseDown}
                  onGripMouseEnter={handleGripMouseEnter}
                  onGripMouseLeave={handleGripMouseLeave}
                  isDrawingConnection={isDrawingConnection}
                  hoveredGrip={hoveredGrip}
                />
              ))}
            </Layer>
          </Stage>

          {/* Floating Info Bubble */}
          <div className="absolute bottom-6 right-[45%] flex flex-col items-end gap-2 pointer-events-none">
            <div className="flex items-center gap-3 px-4 py-2 bg-white/90 dark:bg-[#1f2938]  backdrop-blur shadow-lg border border-gray-200 rounded-full text-xs font-mono text-gray-600 pointer-events-auto">
              <div className="flex gap-2 dark:text-gray-200">
                <span className="font-bold text-gray-400">X</span> {cursorPos.x}
              </div>
              <div className="w-px h-3 bg-gray-400"></div>
              <div className="flex gap-2 dark:text-gray-200">
                <span className="font-bold text-gray-400">Y</span> {cursorPos.y}
              </div>
              <div className="w-px h-3 bg-gray-300"></div>
              <div className="font-semibold text-blue-600">
                {Math.round(stageScale * 100)}%
              </div>
            </div>
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
                  Click empty space to add corner • Click target point to finish
                </span>
              </div>
            </div>
          )}

          {/* Selection Guidance Overlay */}
          {!isDrawingConnection && (selectedItemId !== null || selectedConnectionId !== null) && (
            <div className="absolute top-6 left-1/2 -translate-x-1/2 pointer-events-none">
              <div className="px-4 py-2 bg-black/70 backdrop-blur text-white text-sm rounded-full shadow-lg border border-white/10 flex items-center gap-3">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                  Selection Active
                </span>
                <div className="w-px h-3 bg-white/20" />
                <span className="text-white/80 text-xs">
                  Press 'Del', 'Backspace' or 'D' to delete selection
                </span>
              </div>
            </div>
          )}

          {/* Empty State Overlay */}
          {droppedItems.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center p-6 bg-white/80 backdrop-blur rounded-xl border border-gray-200 shadow-sm">
                <div className="text-gray-500 font-medium">Canvas Empty</div>
                <div className="text-xs text-gray-400 mt-1">Drag components from the sidebar</div>
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar - Canvas Properties/Items List */}
        <CanvasPropertiesSidebar
          items={droppedItems}
          selectedItemId={selectedItemId}
          onSelectItem={handleSelectItem}
          onDeleteItem={handleDeleteItem}
          onUpdateItem={handleUpdateItem}
          className="hidden lg:flex"
          showAllItemsByDefault={true}
        />
      </div>
    </div>
  );
}