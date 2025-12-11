import { Button, Card, CardHeader, CardBody, CardFooter, Divider, Chip } from "@heroui/react";
import { useNavigate } from "react-router-dom";

// Mock Data
const projects = [
    { id: 101, title: "Distillation Unit A", updated: "2 hrs ago", status: "Draft" },
    { id: 102, title: "Reactor Process Flow", updated: "1 day ago", status: "Review" },
    { id: 103, title: "Heat Exchanger Loop", updated: "5 days ago", status: "Final" },
];

export default function Dashboard() {
    const navigate = useNavigate();

    const createNewProject = () => {
        const newId = Date.now();
        navigate(`/editor/${newId}`);
    };

    return (
        <div className="flex flex-col gap-6">
            {/* Header Section */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">My Projects</h1>
                    <p className="text-gray-500">Manage your PFD diagrams</p>
                </div>
                <Button color="primary" onPress={createNewProject}>
                    + New Diagram
                </Button>
            </div>

            <Divider />

            {/* Projects Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {projects.map((proj) => (
                    <Card key={proj.id} className="p-2 hover:scale-[1.01] transition-transform cursor-pointer" isPressable onPress={() => navigate(`/editor/${proj.id}`)}>
                        <CardHeader className="flex gap-3">
                            <div className="bg-primary/10 p-2 rounded-lg text-2xl">📄</div>
                            <div className="flex flex-col">
                                <p className="text-md font-bold">{proj.title}</p>
                                <p className="text-small text-default-500">Edited {proj.updated}</p>
                            </div>
                        </CardHeader>
                        <Divider />
                        <CardBody>
                            <p className="text-gray-500 text-sm">
                                Chemical process flow diagram for standard industrial unit...
                            </p>
                        </CardBody>
                        <CardFooter className="flex justify-between">
                            <Chip size="sm" color={proj.status === "Final" ? "success" : "warning"} variant="flat">
                                {proj.status}
                            </Chip>
                            <Button size="sm" variant="light" color="primary">
                                Open Editor
                            </Button>
                        </CardFooter>
                    </Card>
                ))}
            </div>
        </div>
    );
}