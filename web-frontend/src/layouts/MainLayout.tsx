import { Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  Navbar, 
  NavbarBrand, 
  NavbarContent, 
  NavbarItem, 
  Link, 
  Button,
  Avatar,
  Popover,
  PopoverTrigger,
  PopoverContent,
  User,
  Divider
} from "@heroui/react";

export default function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-foreground">
      <Navbar isBordered maxWidth="xl" className="bg-white">
        <NavbarBrand className="cursor-pointer" onClick={() => navigate("/dashboard")}>
          <p className="font-bold text-inherit text-xl">🧪 ChemPFD</p>
        </NavbarBrand>

        <NavbarContent className="hidden sm:flex gap-4" justify="center">
          <NavbarItem isActive={location.pathname === "/dashboard"}>
            <Link color="foreground" href="/dashboard">Dashboard</Link>
          </NavbarItem>
          <NavbarItem isActive={location.pathname === "/components"}>
            <Link color="foreground" href="/components">Components DB</Link>
          </NavbarItem>
        </NavbarContent>

        <NavbarContent justify="end">
          <NavbarItem>
            {/* Profile Popover */}
            <Popover placement="bottom-end" showArrow={true}>
              <PopoverTrigger>
                <Avatar 
                  isBordered 
                  as="button" 
                  className="transition-transform" 
                  color="primary" 
                  name="Name" 
                  size="sm" 
                  src="https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png" 
                />
              </PopoverTrigger>
              <PopoverContent className="p-1 w-60">
                <div className="px-1 py-2 w-full">
                  <User
                    name="Name"
                    description=""
                    classNames={{
                        base: "gap-8",
                        name: "text-default-800",
                        description: "text-default-500",
                    }}
                    avatarProps={{
                      src: "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png"
                    }}
                  />
                </div>
                <Divider />
                <div className="flex flex-col gap-1 p-1">
                  <Button size="sm" variant="light" className="justify-start">
                    My Settings
                  </Button>
                  <Button size="sm" variant="light" className="justify-start">
                    Help & Feedback
                  </Button>
                  <Divider className="my-1" />
                  <Button 
                    size="sm" 
                    color="danger" 
                    variant="flat" 
                    className="justify-start"
                    onPress={() => navigate("/login")}
                  >
                    Log Out
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </NavbarItem>
        </NavbarContent>
      </Navbar>

      <main className="container mx-auto max-w-7xl p-6">
        <Outlet />
      </main>
    </div>
  );
}