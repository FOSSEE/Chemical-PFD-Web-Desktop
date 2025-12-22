import React, { useState } from "react";
import { Button, Input, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure, Select, SelectItem, Card, CardBody, CardFooter, Image, Tooltip } from "@heroui/react";
import { useComponents } from "@/context/ComponentContext";
import { ComponentItem } from "@/components/Canvas/types";

export default function Components() {
    const { components, addComponent, updateComponent, deleteComponent } = useComponents();
    const { isOpen, onOpen, onOpenChange } = useDisclosure();

    // Form State
    const [name, setName] = useState("");
    const [category, setCategory] = useState("");
    const [newCategory, setNewCategory] = useState("");
    const [iconFile, setIconFile] = useState<string | null>(null);
    const [svgFile, setSvgFile] = useState<string | null>(null);
    const [grips, setGrips] = useState<{ x: number; y: number; side: "top" | "bottom" | "left" | "right" }[]>([]);

    // Edit State
    const [editingComponent, setEditingComponent] = useState<{ category: string; name: string } | null>(null);

    // Helpers
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'icon' | 'svg') => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                if (type === 'icon') setIconFile(reader.result as string);
                else setSvgFile(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleAddGrip = () => {
        setGrips([...grips, { x: 50, y: 50, side: "right" }]);
    };

    const updateGrip = (index: number, field: keyof typeof grips[0], value: any) => {
        const newGrips = [...grips];
        newGrips[index] = { ...newGrips[index], [field]: value };
        setGrips(newGrips);
    };

    const removeGrip = (index: number) => {
        setGrips(grips.filter((_, i) => i !== index));
    };

    // Open modal specific for editing
    const handleEdit = (catName: string, item: ComponentItem) => {
        setEditingComponent({ category: catName, name: item.name });

        // Prefill form
        setName(item.name);
        setCategory(catName);
        setNewCategory("");
        setIconFile(typeof item.icon === 'string' ? item.icon : (item.icon as any)?.src || "");
        setSvgFile(typeof item.svg === 'string' ? item.svg : (item.svg as any)?.src || "");
        setGrips(item.grips ? item.grips.map(g => ({ ...g })) : []);

        onOpen();
    };

    // Open modal for new
    const handleAddNew = () => {
        setEditingComponent(null);
        setName("");
        setCategory("");
        setNewCategory("");
        setIconFile(null);
        setSvgFile(null);
        setGrips([]);
        onOpen();
    };

    const handleDelete = (onClose: () => void) => {
        if (!editingComponent) return;
        if (window.confirm(`Are you sure you want to delete "${editingComponent.name}"? This cannot be undone.`)) {
            deleteComponent(editingComponent.category, editingComponent.name);
            onClose();
        }
    };

    const handleSubmit = (onClose: () => void) => {
        if (!name || (!category && !newCategory)) return;

        const finalCategory = newCategory || category;

        // Construct new component object as per requirements
        const newComponent: ComponentItem = {
            name,
            icon: iconFile || "",
            svg: svgFile || iconFile || "", // Fallback to icon if SVG not provided
            class: finalCategory,
            object: name.replace(/\s+/g, ''),
            args: [],
            grips,
            isCustom: true
        };

        if (editingComponent) {
            updateComponent(editingComponent.category, editingComponent.name, finalCategory, newComponent);
        } else {
            addComponent(finalCategory, newComponent);
        }

        // Reset form
        setName("");
        setCategory("");
        setNewCategory("");
        setIconFile(null);
        setSvgFile(null);
        setGrips([]);
        setEditingComponent(null);
        onClose();
    };

    const categories = Object.keys(components);

    return (
        <div className="p-8 h-full overflow-y-auto bg-gray-50 dark:bg-gray-900">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Component Library</h1>
                    <p className="text-gray-500 dark:text-gray-400">Manage and add custom components</p>
                </div>
                <Button color="primary" onPress={handleAddNew}>
                    Add Component
                </Button>
            </div>

            <div className="space-y-8">
                {Object.entries(components).map(([catName, items]) => (
                    <div key={catName}>
                        <h2 className="text-xl font-semibold mb-4 text-gray-700 dark:text-gray-300 border-b pb-2 border-gray-200 dark:border-gray-700">
                            {catName}
                        </h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                            {Object.values(items).map((item) => (
                                <Tooltip content={<div className="text-xs"><div className="font-bold">{item.name}</div></div>}>
                                    <Card key={item.name} isPressable className="border-none bg-white dark:bg-gray-800 shadow-sm hover:shadow-md group relative">
                                        <CardBody className="p-4 flex items-center justify-center bg-gray-50/50 dark:bg-gray-900/50">
                                            <div className="w-16 h-16 flex items-center justify-center">
                                                <Image
                                                    src={typeof item.icon === 'string' ? item.icon : (item.icon as any)?.src || item.icon} // Handle imported image module vs string
                                                    alt={item.name}
                                                    className="max-w-full max-h-full object-contain"
                                                    radius="none"
                                                />
                                            </div>
                                        </CardBody>
                                        <CardFooter className="justify-between">
                                            <div className="text-small font-medium truncate w-full text-center text-gray-700 dark:text-gray-300">{item.name}</div>
                                            {item.isCustom && (
                                                <Button
                                                    size="sm"
                                                    variant="light"
                                                    isIconOnly
                                                    className="absolute top-1 right-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity bg-white/50 backdrop-blur-sm z-10"
                                                    onPress={() => handleEdit(catName, item)}
                                                    aria-label="Edit"
                                                >
                                                    <span className="text-lg">✎</span>
                                                </Button>
                                            )}
                                        </CardFooter>
                                    </Card>
                                </Tooltip>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* Add Component Modal */}
            <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="2xl" scrollBehavior="inside">
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader className="flex flex-col gap-1">
                                {editingComponent ? `Edit ${editingComponent.name}` : "Add New Component"}
                            </ModalHeader>
                            <ModalBody>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2">
                                        <Input
                                            label="Component Name"
                                            placeholder="e.g. My Custom Heat Exchanger"
                                            value={name}
                                            onValueChange={setName}
                                            isRequired
                                        />
                                    </div>

                                    <div>
                                        <Select
                                            label="Category"
                                            placeholder="Select category"
                                            selectedKeys={category ? [category] : []}
                                            onChange={(e) => {
                                                setCategory(e.target.value);
                                                setNewCategory("");
                                            }}
                                        >
                                            {categories.map((cat) => (
                                                <SelectItem key={cat}>
                                                    {cat}
                                                </SelectItem>
                                            ))}
                                        </Select>
                                    </div>

                                    <div>
                                        <Input
                                            label="New Category (Optional)"
                                            placeholder="Or create new..."
                                            value={newCategory}
                                            onValueChange={(val) => {
                                                setNewCategory(val);
                                                if (val) setCategory("");
                                            }}
                                        />
                                    </div>

                                    <div className="col-span-2 border p-6 rounded-xl border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                                        <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-4">Component Images</h3>
                                        <div className="flex flex-col gap-6">
                                            <div className="flex items-center gap-6">
                                                <div className="flex-1">
                                                    <label className="block text-sm font-medium mb-2 text-gray-600 dark:text-gray-400">Toolbar Icon (PNG)</label>
                                                    <p className="text-xs text-gray-400 mb-2">Small icon shown in the sidebar</p>
                                                    <input type="file" accept="image/png" onChange={(e) => handleFileChange(e, 'icon')} className="block w-full text-sm text-gray-500
                                                        file:mr-4 file:py-2 file:px-4
                                                        file:rounded-full file:border-0
                                                        file:text-sm file:font-semibold
                                                        file:bg-blue-50 file:text-blue-700
                                                        hover:file:bg-blue-100
                                                    "/>
                                                </div>
                                                {iconFile && (
                                                    <div className="p-2 border rounded bg-white">
                                                        <img src={iconFile} alt="Preview" className="h-12 w-12 object-contain" />
                                                    </div>
                                                )}
                                            </div>

                                            <div className="w-full h-px bg-gray-200 dark:bg-gray-700"></div>

                                            <div className="flex items-center gap-6">
                                                <div className="flex-1">
                                                    <label className="block text-sm font-medium mb-2 text-gray-600 dark:text-gray-400">Canvas SVG</label>
                                                    <p className="text-xs text-gray-400 mb-2">Scalable graphic drawn on the canvas</p>
                                                    <input type="file" accept="image/svg+xml" onChange={(e) => handleFileChange(e, 'svg')} className="block w-full text-sm text-gray-500
                                                        file:mr-4 file:py-2 file:px-4
                                                        file:rounded-full file:border-0
                                                        file:text-sm file:font-semibold
                                                        file:bg-purple-50 file:text-purple-700
                                                        hover:file:bg-purple-100
                                                    "/>
                                                </div>
                                                {svgFile && (
                                                    <div className="p-2 border rounded bg-white">
                                                        <img src={svgFile} alt="Preview" className="h-12 w-12 object-contain" />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="col-span-2">
                                        <div className="flex justify-between items-center mb-2">
                                            <label className="font-medium">Connection Grips ({grips.length})</label>
                                            <Button size="sm" variant="flat" onPress={handleAddGrip}>+ Add Grip</Button>
                                        </div>

                                        <div className="space-y-2 max-h-60 overflow-y-auto p-1">
                                            {grips.map((grip, idx) => (
                                                <div key={idx} className="grid grid-cols-12 gap-3 items-center bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm">
                                                    <div className="col-span-1 flex justify-center">
                                                        <div className="h-6 w-6 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-500">
                                                            {idx + 1}
                                                        </div>
                                                    </div>
                                                    <div className="col-span-3">
                                                        <Input
                                                            type="number"
                                                            label="X Pos %"
                                                            placeholder="0-100"
                                                            labelPlacement="outside"
                                                            size="md"
                                                            value={grip.x.toString()}
                                                            onValueChange={(v) => updateGrip(idx, 'x', parseFloat(v))}
                                                            endContent={<div className="pointer-events-none flex items-center"><span className="text-default-400 text-small">%</span></div>}
                                                        />
                                                    </div>
                                                    <div className="col-span-3">
                                                        <Input
                                                            type="number"
                                                            label="Y Pos %"
                                                            placeholder="0-100"
                                                            labelPlacement="outside"
                                                            size="md"
                                                            value={grip.y.toString()}
                                                            onValueChange={(v) => updateGrip(idx, 'y', parseFloat(v))}
                                                            endContent={<div className="pointer-events-none flex items-center"><span className="text-default-400 text-small">%</span></div>}
                                                        />
                                                    </div>
                                                    <div className="col-span-4">
                                                        <Select
                                                            label="Side"
                                                            labelPlacement="outside"
                                                            size="md"
                                                            defaultSelectedKeys={[grip.side]}
                                                            onChange={(e) => updateGrip(idx, 'side', e.target.value)}
                                                        >
                                                            <SelectItem key="top">Top</SelectItem>
                                                            <SelectItem key="bottom">Bottom</SelectItem>
                                                            <SelectItem key="left">Left</SelectItem>
                                                            <SelectItem key="right">Right</SelectItem>
                                                        </Select>
                                                    </div>
                                                    <div className="col-span-1 flex justify-end">
                                                        <Button isIconOnly size="sm" color="danger" variant="light" onPress={() => removeGrip(idx)}>
                                                            <span className="text-lg">×</span>
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                            {grips.length === 0 && <div className="text-sm text-gray-400 italic">No grips defined. Component will not be connectable.</div>}
                                        </div>
                                    </div>

                                </div>
                            </ModalBody>
                            <ModalFooter className="flex justify-between">
                                <div>
                                    {editingComponent && (
                                        <Button color="danger" variant="flat" onPress={() => handleDelete(onClose)}>
                                            Delete Component
                                        </Button>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <Button color="danger" variant="light" onPress={onClose}>
                                        Cancel
                                    </Button>
                                    <Button color="primary" onPress={() => handleSubmit(onClose)}>
                                        {editingComponent ? "Save Changes" : "Create Component"}
                                    </Button>
                                </div>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>
        </div>
    );
}
