import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Tooltip } from "@heroui/react";

// Import component configuration with all assets
import { componentsConfig } from "@/assets/config/items";
import { ThemeSwitch } from "@/components/theme-switch";

// Component item interface
interface ComponentItem {
  name: string;
  icon: string;
  svg: string;
  class: string;
  object: string;
  args: any[];
}

// Canvas item interface (extends component with position data)
interface CanvasItem extends ComponentItem {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export default function Editor() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [components, setComponents] = useState<Record<string, Record<string, ComponentItem>>>({});
  const [droppedItems, setDroppedItems] = useState<CanvasItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);

  // Load component configuration
  useEffect(() => {
    setComponents(componentsConfig);
  }, []);

  // Handle dragging from sidebar
  const handleDragStart = (e: React.DragEvent, item: ComponentItem) => {
    e.dataTransfer.setData("component", JSON.stringify(item));
    
    // Set custom drag preview using SVG
    if (item.svg) {
      const img = new Image();
      img.src = item.svg;
      img.width = 80;
      img.height = 80;
      e.dataTransfer.setDragImage(img, 40, 40);
    }
  };

  // Handle dropping onto canvas
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    
    const componentData = e.dataTransfer.getData("component");
    if (!componentData) return;
    
    const item = JSON.parse(componentData) as ComponentItem;
    
    // Calculate drop position
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - 40;
    const y = e.clientY - rect.top - 40;
    
    // Create new canvas item
    const newCanvasItem: CanvasItem = {
      ...item,
      id: Date.now(),
      x,
      y,
      width: 80,
      height: 80
    };
    
    setDroppedItems(prev => [...prev, newCanvasItem]);
    setSelectedItemId(newCanvasItem.id);
  };

  // Move item on canvas
  const handleItemMove = (itemId: number, newX: number, newY: number) => {
    setDroppedItems(prev =>
      prev.map(item =>
        item.id === itemId ? { ...item, x: newX, y: newY } : item
      )
    );
  };

  // Select item
  const handleItemClick = (itemId: number) => {
    setSelectedItemId(itemId);
  };

  // Delete item
  const handleDeleteItem = (itemId: number) => {
    setDroppedItems(prev => prev.filter(item => item.id !== itemId));
    if (selectedItemId === itemId) {
      setSelectedItemId(null);
    }
  };

  const selectedItem = droppedItems.find(item => item.id === selectedItemId);

  return (
    <div className="h-screen flex flex-col">
      {/* Header bar with menus */}
      <div className="h-14 border-b flex items-center px-4 justify-between">
        <div className="flex items-center gap-2">
          <Tooltip content="Back to Dashboard">
            <Button isIconOnly variant="light" onPress={() => navigate("/dashboard")}>←</Button>
          </Tooltip>
          <div className="h-6 w-px bg-gray-300 mx-2" />

          <Dropdown>
            <DropdownTrigger>
              <Button variant="light" size="sm">File</Button>
            </DropdownTrigger>
            <DropdownMenu aria-label="File Actions">
              <DropdownItem key="new">New Diagram</DropdownItem>
              <DropdownItem key="save">Save Project (Ctrl+S)</DropdownItem>
              <DropdownItem key="export">Export as PDF</DropdownItem>
            </DropdownMenu>
          </Dropdown>

          <Dropdown>
            <DropdownTrigger>
              <Button variant="light" size="sm">Edit</Button>
            </DropdownTrigger>
            <DropdownMenu aria-label="Edit Actions">
              <DropdownItem key="undo">Undo (Ctrl+Z)</DropdownItem>
              <DropdownItem key="redo">Redo (Ctrl+Y)</DropdownItem>
              <DropdownItem key="delete" onPress={() => selectedItemId && handleDeleteItem(selectedItemId)}>
                Delete Selected (Del)
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>

          <Dropdown>
            <DropdownTrigger>
              <Button variant="light" size="sm">View</Button>
            </DropdownTrigger>
            <DropdownMenu aria-label="View Actions">
              <DropdownItem key="zoom-in">Zoom In (+)</DropdownItem>
              <DropdownItem key="zoom-out">Zoom Out (-)</DropdownItem>
              <DropdownItem key="fit">Fit to Screen</DropdownItem>
              <DropdownItem key="grid">Toggle Grid</DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </div>

        <div className="font-semibold">
          Diagram Editor <span className="text-xs ml-2">ID: {projectId}</span>
        </div>

        <div className="flex gap-2">
          <ThemeSwitch />
          <Button size="sm" variant="bordered">Share</Button>
          <Button size="sm">Save Changes</Button>
        </div>
      </div>

      {/* Main workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Component library sidebar */}
        <div className="w-64 border-r flex flex-col">
          <div className="p-3 border-b font-bold text-sm">Components Library</div>
          <div className="p-4 overflow-y-auto flex-1">
            {Object.keys(components).map((category) => (
              <div key={category} className="mb-6">
                <h4 className="font-semibold mb-2 ">{category}</h4>
                <div className="grid grid-cols-2 gap-2">
                  {Object.keys(components[category]).map((itemKey) => {
                    const item = components[category][itemKey];
                    return (
                      <div
                        key={itemKey}
                        className="p-2 border rounded hover:bg-gray-50 cursor-move flex flex-col items-center"
                        draggable
                        onDragStart={(e) => handleDragStart(e, item)}
                        title={`Drag to canvas: ${item.name}`}
                      >
                        <img 
                          src={item.icon} 
                          alt={item.name}
                          className="w-8 h-8 object-contain mb-1"
                        />
                        <span className="text-xs text-center line-clamp-2">{item.name}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Canvas area */}
        <div
          className="flex-1 relative overflow-auto"
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          style={{ position: 'relative' }}
        >
          {/* Grid background */}
          <div 
            className="absolute inset-0 opacity-10 pointer-events-none" 
            style={{ 
              backgroundImage: 'radial-gradient(#999 1px, transparent 1px)', 
              backgroundSize: '20px 20px' 
            }} 
          />
          
          {/* Dropped items */}
          {droppedItems.map((item) => (
            <div
              key={item.id}
              className={`absolute cursor-move ${
                selectedItemId === item.id ? 'ring-1 ring-blue-500' : ''
              }`}
              style={{
                left: item.x,
                top: item.y,
                width: item.width,
                height: item.height,
              }}
              draggable
              onClick={() => handleItemClick(item.id)}
              onDragStart={(e) => {
                e.dataTransfer.setData("move", JSON.stringify(item));
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const movedItem = JSON.parse(e.dataTransfer.getData("move"));
                if (movedItem.id === item.id) {
                  const rect = e.currentTarget.parentElement!.getBoundingClientRect();
                  const newX = e.clientX - rect.left - 40;
                  const newY = e.clientY - rect.top - 40;
                  handleItemMove(item.id, newX, newY);
                }
              }}
            >
              <img 
                src={item.svg} 
                alt={item.name} 
                className="w-full h-full object-contain pointer-events-none"
                draggable="false"
              />
            </div>
          ))}
          
          {/* Empty canvas message */}
          {droppedItems.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center p-8 bg-white/80 rounded-lg border">
                <div className="font-medium mb-2">Drag and drop components here</div>
                <div className="text-sm">Components from the sidebar will appear as SVG icons</div>
                <div className="mt-2 text-xs">Click to select, drag to move</div>
              </div>
            </div>
          )}
        </div>

        {/* Properties sidebar */}
        <div className="w-72 border-l p-4 hidden lg:block overflow-y-auto">
          <h3 className="font-bold text-sm mb-4">Properties</h3>
          
          {!selectedItem ? (
            <div className="text-sm">
              {droppedItems.length === 0 
                ? "No items on canvas. Drag components from the sidebar." 
                : "Click on any component to view its properties"}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Selected item info */}
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <img src={selectedItem.svg} alt={selectedItem.name} className="w-10 h-10 object-contain" />
                    <div>
                      <h4 className="font-medium">{selectedItem.name}</h4>
                      <div className="text-xs">{selectedItem.class}</div>
                    </div>
                  </div>
                  <Button 
                    size="sm" 
                    variant="light"
                    onPress={() => handleDeleteItem(selectedItem.id)}
                  >
                    Delete
                  </Button>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <label className="text-xs block mb-1">Position</label>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <div className="text-sm">X: {Math.round(selectedItem.x)}px</div>
                      </div>
                      <div className="flex-1">
                        <div className="text-sm">Y: {Math.round(selectedItem.y)}px</div>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-xs block mb-1">Size</label>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <div className="text-sm">Width: {selectedItem.width}px</div>
                      </div>
                      <div className="flex-1">
                        <div className="text-sm">Height: {selectedItem.height}px</div>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-xs block mb-1">Component Type</label>
                    <div className="text-sm p-2 rounded">
                      {selectedItem.object}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Canvas stats */}
              <div className="border rounded-lg p-4">
                <h4 className="font-medium text-sm mb-2">Canvas Statistics</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Total Items:</span>
                    <span>{droppedItems.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Selected Item ID:</span>
                    <span>{selectedItem.id}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}