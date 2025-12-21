import { useEffect, useState } from "react";
import { MessageCircle, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation } from "wouter";
import AnnouncementBanner, { type AnnouncementSeverity } from "@/components/ui/announcement-banner";

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
  announcementSeverity?: AnnouncementSeverity;
  announcementActive?: boolean;
}

export default function Storefront() {
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
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const [, navigate] = useLocation();

  useEffect(() => {
    fetchSettings();
    const handleFocus = () => fetchSettings();
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch("/api/settings");
      if (response.ok) {
        const data = await response.json();
        setSettings({
          whatsappLink: data.whatsappLink || "",
          datagodEnabled: data.datagodEnabled !== false,
          fastnetEnabled: data.fastnetEnabled !== false,
          atEnabled: data.atEnabled !== false,
          telecelEnabled: data.telecelEnabled !== false,
          afaEnabled: data.afaEnabled !== false,
          afaLink: data.afaLink || "",
          announcementText: data.announcementText || "",
          announcementLink: data.announcementLink || "",
          announcementSeverity: (data.announcementSeverity as AnnouncementSeverity) || "info",
          announcementActive: data.announcementActive === true,
        });
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
    <div className="min-h-screen bg-background text-foreground">
      <div className="border-b bg-muted/20">
        <div className="mx-auto max-w-6xl px-4 py-3">
          <AnnouncementBanner
            text={settings.announcementText}
            link={settings.announcementLink}
            severity={settings.announcementSeverity || "info"}
            active={settings.announcementActive === true}
          />
        </div>
      </div>

      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="text-lg font-semibold tracking-tight"
            aria-label="WireNet home"
          >
            WireNet
          </button>

          <div className="hidden items-center gap-2 md:flex">
            {settings.whatsappLink ? (
              <Button variant="ghost" onClick={handleWhatsAppClick}>
                WhatsApp
              </Button>
            ) : null}
            <Button variant="ghost" onClick={() => navigate("/admin/login")}>Admin</Button>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </Button>
        </div>

        {menuOpen ? (
          <div className="border-t bg-background md:hidden">
            <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-3">
              {settings.whatsappLink ? (
                <Button
                  variant="ghost"
                  className="justify-start"
                  onClick={() => {
                    handleWhatsAppClick();
                    setMenuOpen(false);
                  }}
                >
                  WhatsApp
                </Button>
              ) : null}
              <Button
                variant="ghost"
                className="justify-start"
                onClick={() => {
                  navigate("/admin/login");
                  setMenuOpen(false);
                }}
              >
                Admin
              </Button>
            </div>
          </div>
        ) : null}
      </header>

      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8">
        <section className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">All-in-One Data & Internet Solutions</h1>
          <p className="text-muted-foreground">Choose a category to shop the right deal and delivery speed.</p>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {settings.datagodEnabled ? (
            <Card>
              <CardHeader>
                <CardTitle>💰 DataGod</CardTitle>
                <CardDescription>Dealership pricing for bulk buyers</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">Wholesale-style rates with slower delivery (up to 24hrs).</p>
                <Button className="w-full" onClick={() => navigate("/datagod")}>Shop DataGod</Button>
              </CardContent>
            </Card>
          ) : null}

          {settings.fastnetEnabled ? (
            <Card>
              <CardHeader>
                <CardTitle>⚡ FastNet</CardTitle>
                <CardDescription>Normal prices, fast delivery</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">Designed for speed—delivery is typically 5–20 minutes.</p>
                <Button className="w-full" onClick={() => navigate("/fastnet")}>Shop FastNet</Button>
              </CardContent>
            </Card>
          ) : null}

          {settings.atEnabled ? (
            <Card>
              <CardHeader>
                <CardTitle>📱 AT ISHARE</CardTitle>
                <CardDescription>Packages for AT subscribers</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">Buy AT data bundles with quick delivery and clear pricing.</p>
                <Button className="w-full" onClick={() => navigate("/at")}>Shop AT</Button>
              </CardContent>
            </Card>
          ) : null}

          {settings.telecelEnabled ? (
            <Card>
              <CardHeader>
                <CardTitle>📡 TELECEL</CardTitle>
                <CardDescription>Telecel bundles and support</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">Flexible Telecel packages with fast processing.</p>
                <Button className="w-full" onClick={() => navigate("/telecel")}>Shop Telecel</Button>
              </CardContent>
            </Card>
          ) : null}

          {settings.afaEnabled ? (
            <Card>
              <CardHeader>
                <CardTitle>📞 MTN AFA Registration</CardTitle>
                <CardDescription>Cheaper calls & free network calls</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">Registration typically takes 12–72 hours depending on verification.</p>
                <Button className="w-full" variant="secondary" onClick={handleAfaClick}>Register Now</Button>
              </CardContent>
            </Card>
          ) : null}
        </section>

        {!settings.datagodEnabled &&
        !settings.fastnetEnabled &&
        !settings.atEnabled &&
        !settings.telecelEnabled &&
        !settings.afaEnabled ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">No categories are currently available. Please check back soon!</CardContent>
          </Card>
        ) : null}
      </main>

      {settings.whatsappLink ? (
        <Button
          type="button"
          onClick={handleWhatsAppClick}
          size="icon"
          className="fixed bottom-5 right-5 z-50 rounded-full"
          aria-label="Chat on WhatsApp"
          title="Chat on WhatsApp"
        >
          <MessageCircle size={20} />
        </Button>
      ) : null}
    </div>
  );
}
