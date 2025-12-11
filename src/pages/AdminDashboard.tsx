import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { LogOut, Settings } from "lucide-react";

interface Settings {
  whatsappLink?: string;
  datagodEnabled: boolean;
  fastnetEnabled: boolean;
}

export default function AdminDashboard() {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [settings, setSettings] = useState<Settings>({
    datagodEnabled: true,
    fastnetEnabled: true,
  });
  const [whatsappLink, setWhatsappLink] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/admin/login");
    } else {
      fetchSettings();
    }
  }, [isAuthenticated, navigate]);

  const fetchSettings = async () => {
    try {
      const response = await fetch("/api/settings");
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
        setWhatsappLink(data.whatsappLink || "");
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
    }
  };

  const handleSaveSettings = async () => {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          whatsappLink,
          datagodEnabled: settings.datagodEnabled,
          fastnetEnabled: settings.fastnetEnabled,
        }),
      });

      if (response.ok) {
        setMessage("Settings saved successfully!");
        setTimeout(() => setMessage(""), 3000);
      } else {
        setMessage("Failed to save settings");
      }
    } catch (error) {
      setMessage("An error occurred");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      navigate("/admin/login");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-primary">WireNet Admin</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">Welcome, {user?.username}</span>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut size={16} className="mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {message && (
          <div className={`mb-6 p-4 rounded ${message.includes("success") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
            {message}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-8">
          {/* Categories Toggle */}
          <Card>
            <CardHeader>
              <CardTitle>Categories</CardTitle>
              <CardDescription>
                Toggle categories to show or hide them on the storefront
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded">
                <div>
                  <h3 className="font-semibold">DataGod</h3>
                  <p className="text-sm text-gray-600">Cheap prices, 24hr delivery</p>
                </div>
                <button
                  onClick={() =>
                    setSettings({
                      ...settings,
                      datagodEnabled: !settings.datagodEnabled,
                    })
                  }
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.datagodEnabled ? "bg-green-500" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.datagodEnabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between p-4 border rounded">
                <div>
                  <h3 className="font-semibold">FastNet</h3>
                  <p className="text-sm text-gray-600">Fast delivery (5-20 mins)</p>
                </div>
                <button
                  onClick={() =>
                    setSettings({
                      ...settings,
                      fastnetEnabled: !settings.fastnetEnabled,
                    })
                  }
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.fastnetEnabled ? "bg-green-500" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.fastnetEnabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </CardContent>
          </Card>

          {/* WhatsApp Setup */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings size={20} />
                WhatsApp Setup
              </CardTitle>
              <CardDescription>
                Configure WhatsApp link for the floating button
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">WhatsApp Link</label>
                <Input
                  type="url"
                  placeholder="https://wa.link/... or WhatsApp group/channel link"
                  value={whatsappLink}
                  onChange={(e) => setWhatsappLink(e.target.value)}
                />
                <p className="text-xs text-gray-500">
                  Paste your wa.link, WhatsApp group, or channel link here
                </p>
              </div>

              <Button
                onClick={handleSaveSettings}
                disabled={loading}
                className="w-full"
              >
                {loading ? "Saving..." : "Save Settings"}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Category Management */}
        <div className="mt-8 grid md:grid-cols-2 gap-8">
          {/* DataGod Admin */}
          <Card>
            <CardHeader>
              <CardTitle>DataGod Admin</CardTitle>
              <CardDescription>
                Manage DataGod packages and orders
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => window.location.href = "/datagod/admin"}
              >
                Open DataGod Admin
              </Button>
            </CardContent>
          </Card>

          {/* FastNet Admin */}
          <Card>
            <CardHeader>
              <CardTitle>FastNet Admin</CardTitle>
              <CardDescription>
                Manage FastNet packages and orders
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => window.location.href = "/fastnet/admin"}
              >
                Open FastNet Admin
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
