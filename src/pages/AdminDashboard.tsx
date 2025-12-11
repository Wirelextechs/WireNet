import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LogOut, Settings } from "lucide-react";

interface Settings {
  whatsappLink?: string;
  datagodEnabled: boolean;
  fastnetEnabled: boolean;
}

export default function AdminDashboard() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [settings, setSettings] = useState<Settings>({
    datagodEnabled: true,
    fastnetEnabled: true,
    whatsappLink: "",
  });
  const [whatsappLink, setWhatsappLink] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    // Check if user is logged in
    const loggedIn = sessionStorage.getItem("adminLoggedIn");
    const adminEmail = sessionStorage.getItem("adminEmail");

    if (!loggedIn || !adminEmail) {
      navigate("/admin/login");
      return;
    }

    setEmail(adminEmail);
    loadSettings();
  }, [navigate]);

  const loadSettings = () => {
    try {
      // Load from localStorage
      const savedSettings = localStorage.getItem("wirenetSettings");
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        setSettings(parsed);
        setWhatsappLink(parsed.whatsappLink || "");
      } else {
        // Initialize with defaults
        const defaultSettings = {
          whatsappLink: "",
          datagodEnabled: true,
          fastnetEnabled: true,
        };
        localStorage.setItem("wirenetSettings", JSON.stringify(defaultSettings));
        setSettings(defaultSettings);
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  };

  const handleToggleDataGod = () => {
    const newSettings = {
      ...settings,
      datagodEnabled: !settings.datagodEnabled,
    };
    setSettings(newSettings);
    localStorage.setItem("wirenetSettings", JSON.stringify(newSettings));
    setMessage("✅ DataGod toggle updated!");
    setTimeout(() => setMessage(""), 2000);
  };

  const handleToggleFastNet = () => {
    const newSettings = {
      ...settings,
      fastnetEnabled: !settings.fastnetEnabled,
    };
    setSettings(newSettings);
    localStorage.setItem("wirenetSettings", JSON.stringify(newSettings));
    setMessage("✅ FastNet toggle updated!");
    setTimeout(() => setMessage(""), 2000);
  };

  const handleSaveSettings = async () => {
    setLoading(true);
    setMessage("");

    try {
      const updatedSettings = {
        whatsappLink,
        datagodEnabled: settings.datagodEnabled,
        fastnetEnabled: settings.fastnetEnabled,
      };

      // Save to localStorage
      localStorage.setItem("wirenetSettings", JSON.stringify(updatedSettings));
      setSettings(updatedSettings);
      setMessage("✅ Settings saved successfully!");
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      setMessage("❌ Failed to save settings");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem("adminLoggedIn");
    sessionStorage.removeItem("adminEmail");
    navigate("/admin/login");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-primary">WireNet Admin</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">Welcome, {email}</span>
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
          <div className={`mb-6 p-4 rounded ${message.includes("✅") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
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
              {/* DataGod Toggle */}
              <div className="flex items-center justify-between p-4 border rounded">
                <div>
                  <h3 className="font-semibold">DataGod</h3>
                  <p className="text-sm text-gray-600">Cheap prices, 24hr delivery</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Status: {settings.datagodEnabled ? "✅ Visible" : "❌ Hidden"}
                  </p>
                </div>
                <button
                  onClick={handleToggleDataGod}
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

              {/* FastNet Toggle */}
              <div className="flex items-center justify-between p-4 border rounded">
                <div>
                  <h3 className="font-semibold">FastNet</h3>
                  <p className="text-sm text-gray-600">Fast delivery (5-20 mins)</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Status: {settings.fastnetEnabled ? "✅ Visible" : "❌ Hidden"}
                  </p>
                </div>
                <button
                  onClick={handleToggleFastNet}
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
                onClick={() => navigate("/datagod")}
              >
                Open DataGod
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
                onClick={() => navigate("/fastnet")}
              >
                Open FastNet
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
