import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button, Input, Card, CardBody, CardHeader, Divider } from "@heroui/react";

export default function Register() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: ""
  });

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      alert("Passwords do not match!");
      return;
    }
    console.log("Registering:", formData);
    // TODO: Add API integration here
    navigate("/dashboard");
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 px-4">
      <Card className="w-full max-w-md p-4">
        <CardHeader className="flex flex-col gap-1 items-start">
          <h1 className="text-2xl font-bold">Create Account</h1>
          <p className="text-small text-default-500">Join the Chemical PFD Builder team</p>
        </CardHeader>

        <Divider className="my-2" />

        <CardBody>
          <form onSubmit={handleRegister} className="flex flex-col gap-4">
            <Input 
              isRequired
              label="Full Name" 
              placeholder="Enter your full name" 
              variant="bordered"
              value={formData.name}
              onValueChange={(v) => handleChange("name", v)}
            />
            <Input 
              isRequired
              label="Email" 
              placeholder="Enter your email" 
              type="email" 
              variant="bordered"
              value={formData.email}
              onValueChange={(v) => handleChange("email", v)}
            />
            <Input 
              isRequired
              label="Password" 
              placeholder="Create a password" 
              type="password" 
              variant="bordered"
              value={formData.password}
              onValueChange={(v) => handleChange("password", v)}
            />
             <Input 
              isRequired
              label="Confirm Password" 
              placeholder="Confirm your password" 
              type="password" 
              variant="bordered"
              value={formData.confirmPassword}
              onValueChange={(v) => handleChange("confirmPassword", v)}
            />

            <Button color="success" type="submit" className="w-full font-semibold text-white">
              Sign Up
            </Button>
          </form>

          <div className="mt-4 text-center text-sm">
            <p className="text-gray-500">
              Already have an account?{" "}
              <Link to="/login" className="text-primary font-bold hover:underline">
                Log In
              </Link>
            </p>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}