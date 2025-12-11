import { useParams, useNavigate } from "react-router-dom";
import { 
  Button, 
  Dropdown, 
  DropdownTrigger, 
  DropdownMenu, 
  DropdownItem,
  Tooltip
} from "@heroui/react";

export default function Editor() {
  const { projectId } = useParams();
  const navigate = useNavigate();

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Top Header Bar */}
      <div className="h-14 border-b bg-white flex items-center px-4 justify-between shadow-sm z-20">
        
        {/* Left Side: Back + Menus */}
        <div className="flex items-center gap-2">
          <Tooltip content="Back to Dashboard">
            <Button isIconOnly variant="light" onPress={() => navigate("/dashboard")}>
              ←
            </Button>
          </Tooltip>
          
          <div className="h-6 w-px bg-gray-300 mx-2"></div> {/* Divider */}

          {/* FILE MENU */}
          <Dropdown>
            <DropdownTrigger>
              <Button variant="light" size="sm">File</Button>
            </DropdownTrigger>
            <DropdownMenu aria-label="File Actions">
              <DropdownItem key="new">New Diagram</DropdownItem>
              <DropdownItem key="save">Save Project (Ctrl+S)</DropdownItem>
              <DropdownItem key="export" className="text-warning">Export as PDF</DropdownItem>
            </DropdownMenu>
          </Dropdown>

          {/* EDIT MENU */}
          <Dropdown>
            <DropdownTrigger>
              <Button variant="light" size="sm">Edit</Button>
            </DropdownTrigger>
            <DropdownMenu aria-label="Edit Actions">
              <DropdownItem key="undo">Undo (Ctrl+Z)</DropdownItem>
              <DropdownItem key="redo">Redo (Ctrl+Y)</DropdownItem>
              <DropdownItem key="cut">Cut</DropdownItem>
              <DropdownItem key="copy">Copy</DropdownItem>
              <DropdownItem key="paste">Paste</DropdownItem>
            </DropdownMenu>
          </Dropdown>

           {/* VIEW MENU */}
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

        {/* Center: Title */}
        <div className="font-semibold text-gray-700">
           Diagram Editor <span className="text-xs text-gray-400 ml-2">ID: {projectId}</span>
        </div>

        {/* Right Side: Primary Actions */}
        <div className="flex gap-2">
            <Button size="sm" variant="bordered">Share</Button>
            <Button size="sm" color="primary" className="font-medium">Save Changes</Button>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Sidebar: Components */}
        <div className="w-64 bg-white border-r flex flex-col">
          <div className="p-3 border-b font-bold text-sm bg-gray-50">Components</div>
          <div className="p-4 space-y-3 overflow-y-auto flex-1">
             {/* Mock Draggables */}
             <div className="p-3 border rounded-lg hover:shadow-md cursor-move bg-white flex items-center gap-3 transition-all">
                <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center text-xs">R</div>
                <span>Reactor</span>
             </div>
             <div className="p-3 border rounded-lg hover:shadow-md cursor-move bg-white flex items-center gap-3 transition-all">
                <div className="w-8 h-8 bg-green-100 rounded flex items-center justify-center text-xs">P</div>
                <span>Pump</span>
             </div>
             <div className="p-3 border rounded-lg hover:shadow-md cursor-move bg-white flex items-center gap-3 transition-all">
                <div className="w-8 h-8 bg-orange-100 rounded flex items-center justify-center text-xs">H</div>
                <span>Heater</span>
             </div>
          </div>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 bg-gray-100 relative overflow-hidden flex items-center justify-center">
            {/* Grid Background Mockup */}
            <div className="absolute inset-0 opacity-10 pointer-events-none" 
                 style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
            </div>
            
            <div className="text-gray-400 font-medium">
               [ Konva Canvas Area ]
            </div>
        </div>

        {/* Right Sidebar: Properties (Optional placeholder) */}
        <div className="w-60 bg-white border-l p-4 hidden lg:block">
            <h3 className="font-bold text-sm mb-4">Properties</h3>
            <div className="text-xs text-gray-400">Select an item to view properties</div>
        </div>

      </div>
    </div>
  );
}