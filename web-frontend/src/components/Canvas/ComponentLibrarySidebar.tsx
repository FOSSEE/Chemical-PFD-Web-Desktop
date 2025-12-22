import { useState } from "react";
import { Button } from "@heroui/button";

import { SearchIcon } from "@/components/icons";
import {
  type ComponentLibrarySidebarProps,
  type CanvasPropertiesSidebarProps,
  ComponentItem,
} from "@/store/useEditorStore";

export const ComponentLibrarySidebar = ({
  components,
  onDragStart,
  onSearch,
  onCategoryChange,
  initialSearchQuery = "",
  selectedCategory = "All",
  className = "",
}: ComponentLibrarySidebarProps) => {
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [activeCategory, setActiveCategory] = useState(selectedCategory);

  // Get all categories
  const categories = Object.keys(components);

  // Filter logic
  const filteredComponents = Object.keys(components).reduce(
    (result, category) => {
      const items = components[category];
      const matched = Object.keys(items).filter((key) =>
        items[key].name.toLowerCase().includes(searchQuery.toLowerCase()),
      );

      if (matched.length > 0) {
        result[category] = matched.map((key) => items[key]);
      }

      return result;
    },
    {} as Record<string, ComponentItem[]>,
  );

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    onSearch?.(query);
  };

  const handleCategorySelect = (category: string) => {
    setActiveCategory(category);
    onCategoryChange?.(category);
  };

  return (
    <div
      className={`w-64 border-r flex flex-col bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 h-full ${className}`}
    >
      <br />
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <div className="relative mb-3">
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
            <SearchIcon className="w-4 h-4 text-gray-400" />
          </div>
          <input
            className="w-full pl-9 pr-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200"
            placeholder="Search components..."
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>

        <div className="flex gap-1 overflow-x-auto pb-1">
          <button
            className={`text-xs px-2 py-1 rounded whitespace-nowrap ${activeCategory === "All"
                ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300"
                : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
              }`}
            onClick={() => handleCategorySelect("All")}
          >
            All
          </button>
          {categories.map((category) => (
            <button
              key={category}
              className={`text-xs px-2 py-1 rounded whitespace-nowrap ${activeCategory === category
                  ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                }`}
              onClick={() => handleCategorySelect(category)}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeCategory === "All" ? (
          categories.map((category) => (
            <ComponentCategorySection
              key={category}
              category={category}
              items={filteredComponents[category] || []}
              totalItems={Object.keys(components[category]).length}
              onDragStart={onDragStart}
            />
          ))
        ) : filteredComponents[activeCategory] ? (
          <ComponentCategorySection
            category={activeCategory}
            items={filteredComponents[activeCategory]}
            totalItems={Object.keys(components[activeCategory]).length}
            onDragStart={onDragStart}
          />
        ) : (
          <div className="p-4 text-center text-sm text-gray-500">
            No components found
          </div>
        )}
      </div>
    </div>
  );
};

// Sub-component for category sections
interface ComponentCategorySectionProps {
  category: string;
  items: ComponentItem[];
  totalItems: number;
  onDragStart: (e: React.DragEvent, item: ComponentItem) => void;
}

const ComponentCategorySection = ({
  category,
  items,
  totalItems,
  onDragStart,
}: ComponentCategorySectionProps) => (
  <div key={category} className="mb-6 first:mt-4">
    <div className="px-4 mb-2 flex items-center justify-between group">
      <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300">
        {category}
      </h4>
      <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
        {totalItems}
      </span>
    </div>
    <div className="px-2">
      <div className="grid grid-cols-2 gap-2">
        {items.map((item) => (
          <div
            key={item.id}
            draggable
            className="p-2 border rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-move flex flex-col items-center bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600"
            onDragStart={(e) => onDragStart(e, item)}
          >
            <div className="w-10 h-10 mb-1 flex items-center justify-center">
              <img
                alt={item.name}
                className="w-8 h-8 object-contain"
                src={item.icon}
              />
            </div>
            <span className="text-xs text-center line-clamp-2 text-gray-700 dark:text-gray-300">
              {item.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export const CanvasPropertiesSidebar = ({
  items,
  selectedItemId,
  onSelectItem,
  onDeleteItem,
  onUpdateItem,
  className = "",
  showAllItemsByDefault = true,
}: CanvasPropertiesSidebarProps) => {
  const [viewMode, setViewMode] = useState<"list" | "details">(
    showAllItemsByDefault ? "list" : "details",
  );

  const selectedItem = items.find((item) => item.id === selectedItemId);

  // Toggle between list view and details view
  const toggleView = () => {
    setViewMode((prev) => (prev === "list" ? "details" : "list"));
  };

  // Sort items by name for the list view
  const sortedItems = [...items].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div
      className={`w-72 border-l p-4 flex flex-col bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 h-full ${className}`}
    >
      {/* Header with view toggle */}
      <br />
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-sm text-gray-800 dark:text-gray-200">
          {viewMode === "list" ? "Canvas Items" : "Properties"}
        </h3>
        <Button
          className="text-xs"
          size="sm"
          variant="light"
          onPress={toggleView}
        >
          {viewMode === "list" ? "View Properties" : "View All Items"}
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {viewMode === "list" ? (
          // LIST VIEW - Show all canvas items
          <div className="space-y-2">
            {sortedItems.length === 0 ? (
              <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
                No items on canvas
              </div>
            ) : (
              <>
                <div className="text-xs text-gray-500 mb-2">
                  {sortedItems.length} item{sortedItems.length !== 1 ? "s" : ""}{" "}
                  on canvas
                </div>
                <div className="space-y-2">
                  {sortedItems.map((item) => (
                    <div
                      key={item.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-all ${selectedItemId === item.id
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                          : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                        }`}
                      onClick={() => onSelectItem(item.id)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white dark:bg-gray-700 rounded p-1 flex items-center justify-center border border-gray-200 dark:border-gray-600">
                          <img
                            alt={item.name}
                            className="w-8 h-8 object-contain"
                            src={item.svg || item.icon}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-gray-800 dark:text-gray-200 truncate">
                            {item.name}
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {Math.round(item.width)}×{Math.round(item.height)}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              ({Math.round(item.x)}, {Math.round(item.y)})
                            </span>
                          </div>
                        </div>
                        {selectedItemId === item.id && (
                          <div className="w-2 h-2 rounded-full bg-blue-500" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          // DETAILS VIEW - Show selected item properties
          <>
            {!selectedItem ? (
              <div className="text-sm text-gray-600 dark:text-gray-300 py-8 text-center">
                Select an item to view properties
                <div className="mt-2 text-xs text-gray-500">
                  Click on an item in the canvas or switch to list view
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Item header */}
                <div className="border rounded-lg p-4 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-white dark:bg-gray-700 rounded p-1 flex items-center justify-center border border-gray-200 dark:border-gray-600">
                        <img
                          alt={selectedItem.name}
                          className="w-10 h-10 object-contain"
                          src={selectedItem.svg || selectedItem.icon}
                        />
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-800 dark:text-gray-200">
                          {selectedItem.name}
                        </h4>
                        <div className="text-xs text-gray-500 mt-1">
                          ID: {selectedItem.id}
                        </div>
                      </div>
                    </div>
                    <Button
                      color="danger"
                      size="sm"
                      variant="light"
                      onPress={() => onDeleteItem(selectedItem.id)}
                    >
                      Delete
                    </Button>
                  </div>

                  {/* Item details */}
                  <div className="space-y-4">
                    {/* Position */}
                    <div>
                      <h5 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Position
                      </h5>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <div className="text-xs text-gray-500 block mb-1">
                            X Position
                          </div>
                          <input
                            className="w-full text-sm p-2 border rounded bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200"
                            type="number"
                            value={Math.round(selectedItem.x)}
                            onChange={(e) =>
                              onUpdateItem?.(selectedItem.id, {
                                x: parseInt(e.target.value) || 0,
                              })
                            }
                          />
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 block mb-1">
                            Y Position
                          </div>
                          <input
                            className="w-full text-sm p-2 border rounded bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200"
                            type="number"
                            value={Math.round(selectedItem.y)}
                            onChange={(e) =>
                              onUpdateItem?.(selectedItem.id, {
                                y: parseInt(e.target.value) || 0,
                              })
                            }
                          />
                        </div>
                      </div>
                    </div>

                    {/* Size */}
                    <div>
                      <h5 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Size
                      </h5>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <div className="text-xs text-gray-500 block mb-1">
                            Width
                          </div>
                          <input
                            className="w-full text-sm p-2 border rounded bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200"
                            type="number"
                            value={Math.round(selectedItem.width)}
                            onChange={(e) =>
                              onUpdateItem?.(selectedItem.id, {
                                width: Math.max(
                                  5,
                                  parseInt(e.target.value) || 0,
                                ),
                              })
                            }
                          />
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 block mb-1">
                            Height
                          </div>
                          <input
                            className="w-full text-sm p-2 border rounded bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200"
                            type="number"
                            value={Math.round(selectedItem.height)}
                            onChange={(e) =>
                              onUpdateItem?.(selectedItem.id, {
                                height: Math.max(
                                  5,
                                  parseInt(e.target.value) || 0,
                                ),
                              })
                            }
                          />
                        </div>
                      </div>
                    </div>

                    {/* Rotation */}
                    <div>
                      <h5 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Rotation
                      </h5>
                      <div className="flex items-center gap-3">
                        <input
                          className="flex-1"
                          max="360"
                          min="0"
                          type="range"
                          value={selectedItem.rotation}
                          onChange={(e) =>
                            onUpdateItem?.(selectedItem.id, {
                              rotation: parseInt(e.target.value) || 0,
                            })
                          }
                        />
                        <div className="text-sm text-gray-700 dark:text-gray-300 w-12 text-center">
                          {Math.round(selectedItem.rotation)}°
                        </div>
                      </div>
                    </div>

                    {/* Quick Stats */}
                    <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                      <h5 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Quick Stats
                      </h5>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="bg-gray-100 dark:bg-gray-700/50 p-2 rounded">
                          <div className="text-gray-500">Area</div>
                          <div className="font-medium">
                            {Math.round(
                              selectedItem.width * selectedItem.height,
                            )}{" "}
                            px²
                          </div>
                        </div>
                        <div className="bg-gray-100 dark:bg-gray-700/50 p-2 rounded">
                          <div className="text-gray-500">Aspect Ratio</div>
                          <div className="font-medium">
                            {(selectedItem.width / selectedItem.height).toFixed(
                              2,
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Selected item preview */}
                <div className="border rounded-lg p-4 border-gray-200 dark:border-gray-700">
                  <h5 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    Preview
                  </h5>
                  <div className="relative h-32 bg-gray-100 dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600 overflow-hidden">
                    <div
                      className="absolute border-2 border-blue-500 bg-blue-500/10"
                      style={{
                        left: "50%",
                        top: "50%",
                        transform: `translate(-50%, -50%) rotate(${selectedItem.rotation}deg)`,
                        width: Math.min(selectedItem.width, 120),
                        height: Math.min(selectedItem.height, 120),
                      }}
                    >
                      <div className="absolute inset-0 flex items-center justify-center">
                        <img
                          alt=""
                          className="w-8 h-8 object-contain opacity-50"
                          src={selectedItem.svg || selectedItem.icon}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer stats */}
      <div className="pt-4 mt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="text-xs text-gray-500 flex justify-between">
          <span>Total Items: {items.length}</span>
          <span>Selected: {selectedItem ? 1 : 0}</span>
        </div>
      </div>
    </div>
  );
};
