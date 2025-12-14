import { useEffect, useState } from "react";
import { MessageCircle, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation } from "wouter";

interface Settings {
  whatsappLink?: string;
  datagodEnabled: boolean;
  fastnetEnabled: boolean;
  afaEnabled: boolean;
  afaLink?: string;
}

export default function Storefront() {
  const [settings, setSettings] = useState<Settings>({
    datagodEnabled: true,
    fastnetEnabled: true,
    afaEnabled: true,
    whatsappLink: "",
    afaLink: "",
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const [, navigate] = useLocation();

  useEffect(() => {
    fetchSettings();
    const handleFocus = () => fetchSettings();
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  const fetchSettings = () => {
    try {
      const savedSettings = localStorage.getItem("wirenetSettings");
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        setSettings(parsed);
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
    }
  };

  const handleWhatsAppClick = () => {
    if (settings.whatsappLink) {
      window.open(settings.whatsappLink, "_blank");
    }
  };

  const handleAfaClick = () => {
    if (settings.afaLink) {
      window.open(settings.afaLink, "_blank");
    } else {
      alert("Registration link not configured yet.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-5 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">WireNet</h1>
          
          {/* Desktop Menu */}
          <div className="hidden md:flex gap-4">
            <Button variant="ghost" onClick={() => navigate("/admin/login")}>
              Admin
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden bg-transparent border-none cursor-pointer p-2"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Menu */}
        {menuOpen && (
          <div className="md:hidden bg-white border-t border-gray-200 px-4 py-2">
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => {
                navigate("/admin/login");
                setMenuOpen(false);
              }}
            >
              Admin
            </Button>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-5 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            All-in-One Data & Internet Solutions
          </h2>
          <p className="text-lg text-gray-600">
            Choose from our premium categories for the best deals and fastest service
          </p>
        </div>

        {/* Categories Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
          {/* DataGod Category */}
          {settings.datagodEnabled && (
            <Card className="rounded-lg shadow-md hover:shadow-lg transition-shadow cursor-pointer flex flex-col h-full">
              <CardHeader>
                <CardTitle className="text-2xl">💰 DataGod</CardTitle>
                <CardDescription>
                  Very cheaper or dealership prices
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col flex-grow">
                <p className="text-gray-600 mb-4 flex-grow">
                  Get the best wholesale prices with 24-hour delivery. Perfect for bulk purchases and resellers.
                </p>
                <Button
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3"
                  onClick={() => navigate("/datagod")}
                >
                  Shop DataGod
                </Button>
              </CardContent>
            </Card>
          )}

          {/* FastNet Category */}
          {settings.fastnetEnabled && (
            <Card className="rounded-lg shadow-md hover:shadow-lg transition-shadow cursor-pointer flex flex-col h-full">
              <CardHeader>
                <CardTitle className="text-2xl">⚡ FastNet</CardTitle>
                <CardDescription>
                  Nice or normal prices with super fast delivery
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col flex-grow">
                <p className="text-gray-600 mb-4 flex-grow">
                  Get your data in 5-20 minutes! Premium service with competitive pricing for instant needs.
                </p>
                <Button
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3"
                  onClick={() => navigate("/fastnet")}
                >
                  Shop FastNet
                </Button>
              </CardContent>
            </Card>
          )}

          {/* AFA Registration Category */}
          {settings.afaEnabled && (
            <Card className="rounded-lg shadow-md hover:shadow-lg transition-shadow cursor-pointer flex flex-col h-full">
              <CardHeader>
                <CardTitle className="text-2xl text-purple-600">📞 MTN AFA Registration</CardTitle>
                <CardDescription>
                  Cheaper calls & free network calls
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col flex-grow">
                <p className="text-gray-600 mb-4 flex-grow">
                  Registration and verification takes 12-72 hours. Get access to cheaper call minutes and free calls to other registered numbers. Register yourself and loved ones today!
                </p>
                <Button
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3"
                  onClick={handleAfaClick}
                >
                  Register Now
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Empty State */}
        {!settings.datagodEnabled && !settings.fastnetEnabled && !settings.afaEnabled && (
          <Card className="text-center p-12">
            <CardContent>
              <p className="text-gray-600">
                No categories are currently available. Please check back soon!
              </p>
            </CardContent>
          </Card>
        )}
      </main>

      {/* WhatsApp Floating Button */}
      {settings.whatsappLink && (
        <button
          onClick={handleWhatsAppClick}
          className="fixed bottom-6 right-6 bg-green-500 hover:bg-green-600 text-white border-none rounded-full w-14 h-14 flex items-center justify-center cursor-pointer shadow-lg hover:scale-110 transition-transform z-50"
          title="Chat on WhatsApp"
        >
          <MessageCircle size={24} />
        </button>
      )}
    </div>
  );
}
