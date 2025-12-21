import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LogOut, Settings, Menu, X } from "lucide-react";

interface Settings {
  whatsappLink?: string;
  datagodEnabled: boolean;
  fastnetEnabled: boolean;
  atEnabled: boolean;
  telecelEnabled: boolean;
  afaEnabled: boolean;
  afaLink?: string;
  announcementText?: string;
  announcementLink?: string;
  announcementSeverity?: "info" | "success" | "warning" | "error";
  announcementActive?: boolean;
  smsEnabled?: boolean;
  smsNotificationPhones?: string[];
}

export default function AdminDashboard() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [settings, setSettings] = useState<Settings>({
    datagodEnabled: true,
    fastnetEnabled: true,
    atEnabled: true,
    telecelEnabled: true,
    afaEnabled: true,
    whatsappLink: "",
    afaLink: "",
    announcementText: "",
    announcementLink: "",
    announcementSeverity: "info",
    announcementActive: false,
    smsEnabled: false,
    smsNotificationPhones: [],
  });
  const [whatsappLink, setWhatsappLink] = useState("");
  const [afaLink, setAfaLink] = useState("");
  const [announcementText, setAnnouncementText] = useState("");
  const [announcementLink, setAnnouncementLink] = useState("");
  const [announcementSeverity, setAnnouncementSeverity] = useState<"info" | "success" | "warning" | "error">("info");
  const [announcementActive, setAnnouncementActive] = useState(false);
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [smsNotificationPhones, setSmsNotificationPhones] = useState<string[]>([]);
  const [newPhoneInput, setNewPhoneInput] = useState("");
  const [smsBalance, setSmsBalance] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

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

  const loadSettings = async () => {
    try {
      const response = await fetch("/api/settings");
      if (response.ok) {
        const data = await response.json();
        console.log("📊 Loaded settings:", data);
        console.log("🔔 Announcement fields:", {
          text: data.announcementText,
          link: data.announcementLink,
          severity: data.announcementSeverity,
          active: data.announcementActive
        });
        setSettings({
          datagodEnabled: data.datagodEnabled,
          fastnetEnabled: data.fastnetEnabled,
          atEnabled: data.atEnabled !== false,
          telecelEnabled: data.telecelEnabled !== false,
          afaEnabled: data.afaEnabled !== false,
          whatsappLink: data.whatsappLink || "",
          afaLink: data.afaLink || "",
          announcementText: data.announcementText || "",
          announcementLink: data.announcementLink || "",
          announcementSeverity: data.announcementSeverity || "info",
          announcementActive: data.announcementActive === true,
          smsEnabled: data.smsEnabled === true,
          smsNotificationPhones: data.smsNotificationPhones || [],
        });
        setWhatsappLink(data.whatsappLink || "");
        setAfaLink(data.afaLink || "");
        setAnnouncementText(data.announcementText || "");
        setAnnouncementLink(data.announcementLink || "");
        setAnnouncementSeverity(data.announcementSeverity || "info");
        setAnnouncementActive(data.announcementActive === true);
        setSmsEnabled(data.smsEnabled === true);
        setSmsNotificationPhones(data.smsNotificationPhones || []);
      }
      
      // Check SMS balance
      try {
        const balanceRes = await fetch("/api/sms/balance", { credentials: "include" });
        if (balanceRes.ok) {
          const balanceData = await balanceRes.json();
          if (balanceData.success) {
            setSmsBalance(balanceData.balance);
          }
        }
      } catch (e) {
        console.error("Could not fetch SMS balance:", e);
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  };

  const handleToggleDataGod = async () => {
    try {
      const newValue = !settings.datagodEnabled;
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ datagodEnabled: newValue }),
      });
      if (response.ok) {
        setSettings({ ...settings, datagodEnabled: newValue });
        setMessage("DataGod toggle updated!");
        setTimeout(() => setMessage(""), 2000);
      }
    } catch (error) {
      console.error("Error updating DataGod toggle:", error);
    }
  };

  const handleToggleFastNet = async () => {
    try {
      const newValue = !settings.fastnetEnabled;
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ fastnetEnabled: newValue }),
      });
      if (response.ok) {
        setSettings({ ...settings, fastnetEnabled: newValue });
        setMessage("FastNet toggle updated!");
        setTimeout(() => setMessage(""), 2000);
      }
    } catch (error) {
      console.error("Error updating FastNet toggle:", error);
    }
  };

  const handleToggleAfa = async () => {
    try {
      const newValue = !settings.afaEnabled;
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ afaEnabled: newValue }),
      });
      if (response.ok) {
        setSettings({ ...settings, afaEnabled: newValue });
        setMessage("AFA toggle updated!");
        setTimeout(() => setMessage(""), 2000);
      }
    } catch (error) {
      console.error("Error updating AFA toggle:", error);
    }
  };

  const handleToggleAt = async () => {
    try {
      const newValue = !settings.atEnabled;
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ atEnabled: newValue }),
      });
      if (response.ok) {
        setSettings({ ...settings, atEnabled: newValue });
        setMessage("AT ISHARE toggle updated!");
        setTimeout(() => setMessage(""), 2000);
      }
    } catch (error) {
      console.error("Error updating AT toggle:", error);
    }
  };

  const handleToggleTelecel = async () => {
    try {
      const newValue = !settings.telecelEnabled;
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ telecelEnabled: newValue }),
      });
      if (response.ok) {
        setSettings({ ...settings, telecelEnabled: newValue });
        setMessage("TELECEL toggle updated!");
        setTimeout(() => setMessage(""), 2000);
      }
    } catch (error) {
      console.error("Error updating TELECEL toggle:", error);
    }
  };

  const handleSaveSettings = async () => {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          whatsappLink,
          afaLink,
          announcementText,
          announcementLink,
          announcementSeverity,
          announcementActive,
          datagodEnabled: settings.datagodEnabled,
          fastnetEnabled: settings.fastnetEnabled,
          atEnabled: settings.atEnabled,
          telecelEnabled: settings.telecelEnabled,
          afaEnabled: settings.afaEnabled,
          smsEnabled,
          smsNotificationPhones,
        }),
      });

      if (response.ok) {
        const updated = await response.json();
        setSettings({
          ...settings,
          whatsappLink: updated.whatsappLink,
          afaLink: updated.afaLink,
          announcementText: updated.announcementText || "",
          announcementLink: updated.announcementLink || "",
          announcementSeverity: updated.announcementSeverity || "info",
          announcementActive: updated.announcementActive === true,
          datagodEnabled: updated.datagodEnabled,
          fastnetEnabled: updated.fastnetEnabled,
          atEnabled: updated.atEnabled,
          telecelEnabled: updated.telecelEnabled,
          afaEnabled: updated.afaEnabled,
        });
        setAnnouncementText(updated.announcementText || "");
        setAnnouncementLink(updated.announcementLink || "");
        setAnnouncementSeverity(updated.announcementSeverity || "info");
        setAnnouncementActive(updated.announcementActive === true);
        setMessage("Settings saved successfully!");
        setTimeout(() => setMessage(""), 3000);
      } else {
        setMessage("Failed to save settings");
      }
    } catch (error) {
      setMessage("Failed to save settings");
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
          
          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-4">
            <span className="text-sm text-gray-600">Welcome, {email}</span>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut size={16} className="mr-2" />
              Logout
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Menu */}
        {menuOpen && (
          <div className="md:hidden bg-white border-t p-4">
            <div className="flex flex-col gap-4">
              <span className="text-sm text-gray-600">Welcome, {email}</span>
              <Button variant="outline" size="sm" onClick={handleLogout} className="w-full justify-start">
                <LogOut size={16} className="mr-2" />
                Logout
              </Button>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {message && (
          <div className={`mb-6 p-4 rounded ${message.includes("✅") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
            {message}
          </div>
        )}

        {/* Navigation Menu */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <Button 
            variant="outline" 
            className="h-auto py-4 flex flex-col items-center gap-2"
            onClick={() => navigate("/admin")}
          >
            <Settings size={24} />
            <span>Dashboard Home</span>
          </Button>
          <Button 
            variant="outline" 
            className="h-auto py-4 flex flex-col items-center gap-2 bg-yellow-50 hover:bg-yellow-100 border-yellow-200"
            onClick={() => navigate("/admin/datagod")}
          >
            <span className="text-2xl">💰</span>
            <span>DataGod Admin</span>
          </Button>
          <Button 
            variant="outline" 
            className="h-auto py-4 flex flex-col items-center gap-2 bg-blue-50 hover:bg-blue-100 border-blue-200"
            onClick={() => navigate("/admin/fastnet")}
          >
            <span className="text-2xl">⚡</span>
            <span>FastNet Admin</span>
          </Button>
          <Button 
            variant="outline" 
            className="h-auto py-4 flex flex-col items-center gap-2 bg-red-50 hover:bg-red-100 border-red-200"
            onClick={() => navigate("/admin/at")}
          >
            <span className="text-2xl">📱</span>
            <span>AT ISHARE Admin</span>
          </Button>
          <Button 
            variant="outline" 
            className="h-auto py-4 flex flex-col items-center gap-2 bg-cyan-50 hover:bg-cyan-100 border-cyan-200"
            onClick={() => navigate("/admin/telecel")}
          >
            <span className="text-2xl">📡</span>
            <span>TELECEL Admin</span>
          </Button>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Categories Toggle */}
          <Card>
            <CardHeader>
              <CardTitle>Storefront Visibility</CardTitle>
              <CardDescription>
                Toggle categories to show or hide them on the storefront
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* DataGod Toggle */}
              <div className="flex items-center justify-between p-4 border rounded bg-yellow-50/50">
                <div>
                  <h3 className="font-semibold text-yellow-700">DataGod</h3>
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
              <div className="flex items-center justify-between p-4 border rounded bg-blue-50/50">
                <div>
                  <h3 className="font-semibold text-blue-700">FastNet</h3>
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

              {/* AT ISHARE Toggle */}
              <div className="flex items-center justify-between p-4 border rounded bg-red-50/50">
                <div>
                  <h3 className="font-semibold text-red-700">AT ISHARE</h3>
                  <p className="text-sm text-gray-600">High-speed data bundles</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Status: {settings.atEnabled ? "✅ Visible" : "❌ Hidden"}
                  </p>
                </div>
                <button
                  onClick={handleToggleAt}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.atEnabled ? "bg-green-500" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.atEnabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {/* TELECEL Toggle */}
              <div className="flex items-center justify-between p-4 border rounded bg-cyan-50/50">
                <div>
                  <h3 className="font-semibold text-cyan-700">TELECEL</h3>
                  <p className="text-sm text-gray-600">Reliable data bundles</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Status: {settings.telecelEnabled ? "✅ Visible" : "❌ Hidden"}
                  </p>
                </div>
                <button
                  onClick={handleToggleTelecel}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.telecelEnabled ? "bg-green-500" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.telecelEnabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {/* AFA Toggle */}
              <div className="flex items-center justify-between p-4 border rounded bg-purple-50/50">
                <div>
                  <h3 className="font-semibold text-purple-700">MTN AFA Registration</h3>
                  <p className="text-sm text-gray-600">Cheaper calls, free network calls</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Status: {settings.afaEnabled ? "✅ Visible" : "❌ Hidden"}
                  </p>
                </div>
                <button
                  onClick={handleToggleAfa}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.afaEnabled ? "bg-green-500" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.afaEnabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Settings Setup */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings size={20} />
                Platform Settings
              </CardTitle>
              <CardDescription>
                Configure external links and integrations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">WhatsApp Link</label>
                <Input
                  type="url"
                  placeholder="https://wa.link/..."
                  value={whatsappLink}
                  onChange={(e) => setWhatsappLink(e.target.value)}
                />
                <p className="text-xs text-gray-500">
                  Link for the floating WhatsApp button
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">MTN AFA Registration Link</label>
                <Input
                  type="url"
                  placeholder="https://forms.google.com/..."
                  value={afaLink}
                  onChange={(e) => setAfaLink(e.target.value)}
                />
                <p className="text-xs text-gray-500">
                  External link for AFA registration form
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

          {/* SMS Notifications Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                📱 SMS Notifications
              </CardTitle>
              <CardDescription>
                Receive SMS alerts when new orders come in
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded bg-slate-50">
                <div>
                  <h3 className="font-semibold">SMS Alerts</h3>
                  <p className="text-sm text-gray-600">Enable/disable order notifications</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Status: {smsEnabled ? "✅ Enabled" : "❌ Disabled"}
                  </p>
                </div>
                <Button
                  variant={smsEnabled ? "destructive" : "default"}
                  onClick={() => setSmsEnabled(!smsEnabled)}
                  size="sm"
                >
                  {smsEnabled ? "Disable" : "Enable"}
                </Button>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Notification Phone Numbers</label>
                <div className="flex gap-2">
                  <Input
                    type="tel"
                    placeholder="0xxxxxxxxx"
                    value={newPhoneInput}
                    onChange={(e) => setNewPhoneInput(e.target.value)}
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      if (newPhoneInput.trim()) {
                        setSmsNotificationPhones([...smsNotificationPhones, newPhoneInput.trim()]);
                        setNewPhoneInput("");
                      }
                    }}
                  >
                    Add
                  </Button>
                </div>
                <p className="text-xs text-gray-500">
                  Add multiple phone numbers to receive order alerts (Ghana format)
                </p>
                {smsNotificationPhones.length > 0 && (
                  <div className="space-y-1 mt-2">
                    {smsNotificationPhones.map((phone, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded border">
                        <span className="text-sm">{phone}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSmsNotificationPhones(smsNotificationPhones.filter((_, i) => i !== index));
                          }}
                          className="h-6 text-red-600 hover:text-red-700"
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {smsBalance && (
                <div className="p-3 bg-green-50 border border-green-200 rounded">
                  <p className="text-sm text-green-800">
                    <span className="font-semibold">SMS Balance:</span> {smsBalance} credits
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={handleSaveSettings}
                  disabled={loading}
                  className="flex-1"
                >
                  {loading ? "Saving..." : "Save SMS Settings"}
                </Button>
                <Button
                  variant="outline"
                  onClick={async () => {
                    if (smsNotificationPhones.length === 0) {
                      alert("Add at least one phone number first");
                      return;
                    }
                    setMessage("Sending test SMS to all numbers...");
                    try {
                      // Send test to all numbers
                      const res = await fetch("/api/sms/test", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        credentials: "include",
                        body: JSON.stringify({ phones: smsNotificationPhones }),
                      });
                      const data = await res.json();
                      if (data.success) {
                        setMessage(`✅ Test SMS sent to ${smsNotificationPhones.length} number(s)!`);
                      } else {
                        setMessage(`❌ SMS failed: ${data.message}`);
                      }
                    } catch (e: any) {
                      setMessage(`❌ Error: ${e.message}`);
                    }
                    setTimeout(() => setMessage(""), 5000);
                  }}
                >
                  📱 Test SMS ({smsNotificationPhones.length})
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mt-8">
          <Card>
            <CardHeader>
              <CardTitle>Announcement Banner</CardTitle>
              <CardDescription>
                Configure the banner shown on category pages (customers can dismiss per session)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded bg-slate-50">
                <div>
                  <h3 className="font-semibold">Banner Visibility</h3>
                  <p className="text-sm text-gray-600">Show or hide on all category pages</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Status: {announcementActive ? "✅ Active" : "❌ Hidden"}
                  </p>
                </div>
                <button
                  onClick={() => setAnnouncementActive(!announcementActive)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    announcementActive ? "bg-green-500" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      announcementActive ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Banner Text</label>
                <textarea
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  rows={3}
                  placeholder="What should customers know?"
                  value={announcementText}
                  onChange={(e) => setAnnouncementText(e.target.value)}
                />
                <p className="text-xs text-gray-500">Supports multiple lines; will wrap automatically.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Severity</label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    value={announcementSeverity}
                    onChange={(e) => setAnnouncementSeverity(e.target.value as any)}
                  >
                    <option value="info">Info (blue)</option>
                    <option value="success">Success (green)</option>
                    <option value="warning">Warning (amber)</option>
                    <option value="error">Alert (red)</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Optional Link</label>
                  <Input
                    type="url"
                    placeholder="https://example.com"
                    value={announcementLink}
                    onChange={(e) => setAnnouncementLink(e.target.value)}
                  />
                  <p className="text-xs text-gray-500">CTA shown only when link is provided.</p>
                </div>
              </div>

              <Button onClick={handleSaveSettings} disabled={loading} className="w-full">
                {loading ? "Saving..." : "Save Announcement"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
