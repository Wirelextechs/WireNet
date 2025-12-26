import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Store, ArrowLeft } from "lucide-react";

export default function UserSignup() {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    name: "",
    phone: "",
    shopName: "",
    shopSlug: ""
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [registrationClosed, setRegistrationClosed] = useState(false);
  const [checkingRegistration, setCheckingRegistration] = useState(true);
  const [, navigate] = useLocation();

  useEffect(() => {
    checkRegistrationStatus();
  }, []);

  const checkRegistrationStatus = async () => {
    try {
      const response = await fetch("/api/admin/shop-settings");
      if (response.ok) {
        const data = await response.json();
        setRegistrationClosed(data.shopRegistrationOpen === false);
      }
    } catch (err) {
      console.error("Failed to check registration status");
    } finally {
      setCheckingRegistration(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    // Auto-generate slug from shop name
    if (name === "shopName") {
      const slug = value
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .trim();
      setFormData(prev => ({ ...prev, shopSlug: slug }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (formData.shopSlug.length < 3) {
      setError("Shop URL must be at least 3 characters");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/user/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          name: formData.name,
          phone: formData.phone,
          shopName: formData.shopName,
          shopSlug: formData.shopSlug
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess("Account created! Your shop is pending approval. You can now login.");
        setTimeout(() => navigate("/login"), 3000);
      } else {
        setError(data.message || "Failed to create account");
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-purple-50 to-fuchsia-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="flex items-center gap-2 mb-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
              <ArrowLeft size={18} className="mr-1" /> Back
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg">
              <Store className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle>Create Your Shop</CardTitle>
              <CardDescription>
                Start your data reselling business with WireNet
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {checkingRegistration ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600 mx-auto mb-4"></div>
              <p className="text-gray-500">Checking registration status...</p>
            </div>
          ) : registrationClosed ? (
            <div className="text-center py-8">
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-6 rounded-lg">
                <h3 className="font-bold text-lg mb-2">Registration Closed</h3>
                <p className="text-sm">Shop registration is currently closed. Please check back later or contact support.</p>
              </div>
              <Button variant="ghost" onClick={() => navigate("/")} className="mt-4">
                <ArrowLeft size={18} className="mr-1" /> Back to Home
              </Button>
            </div>
          ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
                {error}
              </div>
            )}
            {success && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded text-sm">
                {success}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Full Name</label>
                <Input
                  name="name"
                  placeholder="John Doe"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Phone Number</label>
                <Input
                  name="phone"
                  placeholder="0244123456"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <Input
                type="email"
                name="email"
                placeholder="you@example.com"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Password</label>
                <Input
                  type="password"
                  name="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Confirm Password</label>
                <Input
                  type="password"
                  name="confirmPassword"
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="border-t pt-4 mt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Shop Details</h3>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Shop Name</label>
                <Input
                  name="shopName"
                  placeholder="My Data Shop"
                  value={formData.shopName}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="space-y-2 mt-3">
                <label className="text-sm font-medium">Shop URL</label>
                <div className="flex items-center">
                  <span className="text-sm text-gray-500 bg-gray-100 px-3 py-2 rounded-l border border-r-0">
                    wirenet.top/shop/
                  </span>
                  <Input
                    name="shopSlug"
                    placeholder="my-data-shop"
                    value={formData.shopSlug}
                    onChange={handleChange}
                    className="rounded-l-none"
                    required
                  />
                </div>
                <p className="text-xs text-gray-500">
                  Only lowercase letters, numbers, and hyphens allowed
                </p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 p-3 rounded text-sm text-amber-800">
              <strong>Note:</strong> Your shop will be reviewed before activation. You'll receive an email once approved.
            </div>

            <Button type="submit" className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700" disabled={loading}>
              {loading ? "Creating Account..." : "Create Shop Account"}
            </Button>

            <p className="text-center text-sm text-gray-600">
              Already have an account?{" "}
              <button type="button" onClick={() => navigate("/login")} className="text-violet-600 hover:underline">
                Login here
              </button>
            </p>
          </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
