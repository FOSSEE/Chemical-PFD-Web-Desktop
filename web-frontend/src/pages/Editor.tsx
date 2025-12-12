import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Tooltip } from "@heroui/react";
import { SearchIcon } from "@/components/icons";
import { ComponentsConfig, componentsConfig } from "@/assets/config/items";
import { ThemeSwitch } from "@/components/theme-switch";

interface ComponentItem {
  name: string;
  icon: string;
  svg: string;
  class: string;
  object: string;
  args: readonly any[];
}

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
  const [components, setComponents] = useState<ComponentsConfig>(componentsConfig);
  const [droppedItems, setDroppedItems] = useState<CanvasItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    setComponents(componentsConfig);
  }, []);

  const filteredComponents = Object.keys(components).reduce<Record<string, ComponentItem[]>>((result, category) => {
    const items = components[category as keyof ComponentsConfig] as Record<string, ComponentItem>;
    const matched = Object.keys(items).filter((key) =>
      items[key].name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (matched.length > 0) {
      result[category] = matched.map((key) => items[key]);
    }

    return result;
  }, {});

  const handleDragStart = (e: React.DragEvent, item: ComponentItem) => {
    e.dataTransfer.setData("component", JSON.stringify(item));
    
    if (item.svg) {
      const img = new Image();
      img.src = item.svg;
      img.width = 80;
      img.height = 80;
      
      // Create canvas with white background for drag preview
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
      } else {
        e.dataTransfer.setDragImage(img, 40, 40);
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    
    const componentData = e.dataTransfer.getData("component");
    if (!componentData) return;
    
    const item = JSON.parse(componentData) as ComponentItem;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - 40;
    const y = e.clientY - rect.top - 40;
    
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

  const handleItemMove = (itemId: number, newX: number, newY: number) => {
    setDroppedItems(prev =>
      prev.map(item =>
        item.id === itemId ? { ...item, x: newX, y: newY } : item
      )
    );
  };

  const handleItemClick = (itemId: number) => {
    setSelectedItemId(itemId);
  };

  const handleDeleteItem = (itemId: number) => {
    setDroppedItems(prev => prev.filter(item => item.id !== itemId));
    if (selectedItemId === itemId) {
      setSelectedItemId(null);
    }
  };

  const selectedItem = droppedItems.find(item => item.id === selectedItemId);

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header bar - dark theme enabled */}
      <div className="h-14 border-b flex items-center px-4 justify-between bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
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
              <DropdownItem key="undo">Undo (Ctrl+Z)</DropdownItem>
              <DropdownItem key="redo">Redo (Ctrl+Y)</DropdownItem>
              <DropdownItem key="delete" onPress={() => selectedItemId && handleDeleteItem(selectedItemId)}>
                Delete Selected (Del)
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
        {/* Component library sidebar - dark theme enabled */}
        <div className="w-64 border-r flex flex-col bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          {/* Header with search */}
          <div className="p-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-sm flex items-center gap-2 text-gray-800 dark:text-gray-200">
                Components Library
                <span className="text-xs font-normal text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full">
                  {Object.keys(components).reduce((acc, cat) => acc + Object.keys(components[cat as keyof ComponentsConfig] as Record<string, ComponentItem>).length, 0)} items
                </span>
              </h3>
            </div>
            
            {/* Search Bar */}
            <div className="relative mb-3">
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                <SearchIcon className="w-4 h-4 text-gray-400 dark:text-gray-500" />
              </div>
              <input
                type="text"
                placeholder="Search components..."
                className="w-full pl-9 pr-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-400"
                onChange={(e) => setSearchQuery(e.target.value)}
                value={searchQuery}
              />
            </div>
            
            {/* Quick filters */}
            <div className="flex gap-1 overflow-x-auto pb-1">
              <button className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded whitespace-nowrap">
                All
              </button>
              <button className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded whitespace-nowrap">
                Frequently Used
              </button>
              <button className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded whitespace-nowrap">
                Recent
              </button>
            </div>
          </div>
          
        {/* Component List */}
<div className="flex-1 overflow-y-auto">
  {Object.keys(filteredComponents).map((category) => (
    <div key={category} className="mb-6 first:mt-4">
      <div className="px-4 mb-2 flex items-center justify-between group">
        <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300">{category}</h4>
        <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
          {Object.keys(components[category as keyof ComponentsConfig] as Record<string, ComponentItem>).length}
        </span>
      </div>
      <div className="px-2">
        <div className="grid grid-cols-2 gap-2">
          {filteredComponents[category].map((item) => {
            return (
              <div
                key={item.name}
                className="p-2 border rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-200 dark:hover:border-blue-700 cursor-move flex flex-col items-center transition-colors duration-150 group/item bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600"
                draggable
                onDragStart={(e) => handleDragStart(e, item)}
                title={`Drag to canvas: ${item.name}`}
              >
                <div className="relative">
                  <div className="w-10 h-10 mb-1 bg-white rounded flex items-center justify-center p-1 border border-gray-100 dark:border-gray-600 group-hover/item:border-blue-200 dark:group-hover/item:border-blue-700">
                    <img 
                      src={item.icon} 
                      alt={item.name}
                      className="w-8 h-8 object-contain group-hover/item:scale-105 transition-transform duration-150"
                    />
                  </div>
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full text-white text-[10px] flex items-center justify-center hidden group-hover/item:flex">
                    +
                  </div>
                </div>
                <span className="text-xs text-center line-clamp-2 text-gray-700 dark:text-gray-300 group-hover/item:text-blue-600 dark:group-hover/item:text-blue-400">
                  {item.name}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  ))}
</div>
        </div>
        
        {/* CANVAS AREA - ALWAYS WHITE (no dark theme classes) */}
        <div
          className="flex-1 relative overflow-auto bg-white"
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          style={{ position: 'relative' }}
        >
          {/* Grid background - white canvas only */}
          <div 
            className="absolute inset-0 pointer-events-none" 
            style={{ 
              backgroundImage: 'radial-gradient(#999 1px, transparent 1px)', 
              backgroundSize: '20px 20px',
              opacity: '0.15'
            }} 
          />
          
          {/* Dropped items - ALWAYS WHITE */}
          {droppedItems.map((item) => (
            <div
              key={item.id}
              className={`absolute cursor-move bg-white rounded-lg shadow-md border border-gray-200 ${
                selectedItemId === item.id ? 'ring-2 ring-blue-500 shadow-lg' : ''
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
                
                // Create white background drag preview
                if (item.svg) {
                  const img = new Image();
                  img.src = item.svg;
                  img.width = 80;
                  img.height = 80;
                  
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
              <div className="w-full h-full p-2">
                <img 
                  src={item.svg} 
                  alt={item.name} 
                  className="w-full h-full object-contain pointer-events-none"
                  draggable="false"
                  onError={(e) => {
                    e.currentTarget.src = item.icon;
                  }}
                />
              </div>
            </div>
          ))}
          
          {/* Empty canvas message - white background */}
          {droppedItems.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center p-8 bg-white rounded-lg border border-gray-300 shadow-lg">
                <div className="font-medium mb-2 text-gray-800">Drag and drop components here</div>
                <div className="text-sm text-gray-600">Components from the sidebar will appear as SVG icons</div>
                <div className="mt-2 text-xs text-gray-500">Click to select, drag to move</div>
              </div>
            </div>
          )}
        </div>

        {/* Properties sidebar - dark theme enabled */}
        <div className="w-72 border-l p-4 hidden lg:block overflow-y-auto bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <h3 className="font-bold text-sm mb-4 text-gray-800 dark:text-gray-200">Properties</h3>
          
          {!selectedItem ? (
            <div className="text-sm text-gray-600 dark:text-gray-300">
              {droppedItems.length === 0 
                ? "No items on canvas. Drag components from the sidebar." 
                : "Click on any component to view its properties"}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Selected item info */}
              <div className="border rounded-lg p-4 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white rounded p-1 flex items-center justify-center border border-gray-200">
                      <img src={selectedItem.svg} alt={selectedItem.name} className="w-8 h-8 object-contain" />
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-800 dark:text-gray-200">{selectedItem.name}</h4>
                      <div className="text-xs text-gray-600 dark:text-gray-400">{selectedItem.class}</div>
                    </div>
                  </div>
                  <Button 
                    size="sm" 
                    variant="light"
                    onPress={() => handleDeleteItem(selectedItem.id)}
                    className="text-red-600 dark:text-red-400"
                  >
                    Delete
                  </Button>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <label className="text-xs block mb-1 text-gray-600 dark:text-gray-400">Position</label>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <div className="text-sm p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200">
                          X: {Math.round(selectedItem.x)}px
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="text-sm p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200">
                          Y: {Math.round(selectedItem.y)}px
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-xs block mb-1 text-gray-600 dark:text-gray-400">Size</label>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <div className="text-sm p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200">
                          Width: {selectedItem.width}px
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="text-sm p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200">
                          Height: {selectedItem.height}px
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-xs block mb-1 text-gray-600 dark:text-gray-400">Component Type</label>
                    <div className="text-sm p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200">
                      {selectedItem.object}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Canvas stats */}
              <div className="border rounded-lg p-4 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                <h4 className="font-medium text-sm mb-2 text-gray-800 dark:text-gray-200">Canvas Statistics</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between text-gray-700 dark:text-gray-300">
                    <span>Total Items:</span>
                    <span>{droppedItems.length}</span>
                  </div>
                  <div className="flex justify-between text-gray-700 dark:text-gray-300">
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