import { useEffect, useState } from "react";
import { MessageCircle, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation } from "wouter";

interface Settings {
  whatsappLink?: string;
  datagodEnabled: boolean;
  fastnetEnabled: boolean;
  atEnabled: boolean;
  telecelEnabled: boolean;
  afaEnabled: boolean;
  afaLink?: string;
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
    <div style={styles.body}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <h1 style={styles.h1}>WireNet</h1>
          
          {/* Desktop Menu */}
          <div style={styles.desktopMenu}>
            <Button variant="ghost" onClick={() => navigate("/admin/login")}>
              Admin
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            style={styles.mobileMenuButton}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Menu */}
        {menuOpen && (
          <div style={styles.mobileMenu}>
            <Button
              variant="ghost"
              style={styles.mobileMenuButton}
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
      <main style={styles.main}>
        {/* Hero Section */}
        <div style={styles.heroSection}>
          <h2 style={styles.heroTitle}>
            All-in-One Data & Internet Solutions
          </h2>
          <p style={styles.heroSubtitle}>
            Choose from our premium categories for the best deals and fastest service
          </p>
        </div>

        {/* Categories Grid */}
        <div style={styles.categoriesGrid}>
          {/* DataGod Category */}
          {settings.datagodEnabled && (
            <Card style={styles.categoryCard}>
              <CardHeader>
                <CardTitle style={styles.categoryTitle}>💰 DataGod</CardTitle>
                <CardDescription>
                  Very cheaper or dealership prices
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p style={styles.categoryDescription}>
                  Get the best wholesale prices with 24-hour delivery. Perfect for bulk purchases and resellers.
                </p>
                <Button
                  style={styles.shopButton}
                  onClick={() => navigate("/datagod")}
                >
                  Shop DataGod
                </Button>
              </CardContent>
            </Card>
          )}

          {/* FastNet Category */}
          {settings.fastnetEnabled && (
            <Card style={styles.categoryCard}>
              <CardHeader>
                <CardTitle style={styles.categoryTitle}>⚡ FastNet</CardTitle>
                <CardDescription>
                  Nice or normal prices with super fast delivery
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p style={styles.categoryDescription}>
                  Get your data in 5-20 minutes! Premium service with competitive pricing for instant needs.
                </p>
                <Button
                  style={styles.shopButton}
                  onClick={() => navigate("/fastnet")}
                >
                  Shop FastNet
                </Button>
              </CardContent>
            </Card>
          )}

          {/* AT ISHARE Category */}
          {settings.atEnabled && (
            <Card style={styles.categoryCard}>
              <CardHeader>
                <CardTitle style={{...styles.categoryTitle, color: "#dc2626"}}>📱 AT ISHARE</CardTitle>
                <CardDescription>
                  Affordable data for AT subscribers
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p style={styles.categoryDescription}>
                  Access high-speed data with instant delivery. Dedicated support for all AT ISHARE packages and competitive pricing.
                </p>
                <Button
                  style={{...styles.shopButton, backgroundColor: "#dc2626"}}
                  onClick={() => navigate("/at")}
                >
                  Shop AT ISHARE
                </Button>
              </CardContent>
            </Card>
          )}

          {/* TELECEL Category */}
          {settings.telecelEnabled && (
            <Card style={styles.categoryCard}>
              <CardHeader>
                <CardTitle style={{...styles.categoryTitle, color: "#0369a1"}}>📡 TELECEL</CardTitle>
                <CardDescription>
                  Fast and reliable Telecel data
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p style={styles.categoryDescription}>
                  Get instant access to Telecel data bundles with flexible packages. Quick delivery and excellent customer support.
                </p>
                <Button
                  style={{...styles.shopButton, backgroundColor: "#0369a1"}}
                  onClick={() => navigate("/telecel")}
                >
                  Shop TELECEL
                </Button>
              </CardContent>
            </Card>
          )}

          {/* MTN AFA Registration Category */}
          {settings.afaEnabled && (
            <Card style={styles.categoryCard}>
              <CardHeader>
                <CardTitle style={{...styles.categoryTitle, color: "#6b21a8"}}>📞 MTN AFA Registration</CardTitle>
                <CardDescription>
                  Cheaper calls & free network calls
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p style={styles.categoryDescription}>
                  Registration and verification takes 12-72 hours. Get access to cheaper call minutes and free calls to other registered numbers. Register yourself and loved ones today!
                </p>
                <Button
                  style={{...styles.shopButton, backgroundColor: "#6b21a8"}}
                  onClick={handleAfaClick}
                >
                  Register Now
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Empty State */}
        {!settings.datagodEnabled && !settings.fastnetEnabled && !settings.atEnabled && !settings.telecelEnabled && !settings.afaEnabled && (
          <Card style={styles.emptyStateCard}>
            <CardContent style={styles.emptyStateContent}>
              <p style={styles.emptyStateText}>
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
          style={styles.whatsappButton}
          title="Chat on WhatsApp"
        >
          <MessageCircle size={24} />
        </button>
      )}
    </div>
  );
}

const styles: any = {
  body: {
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    margin: 0,
    padding: 0,
    backgroundColor: "#f4f4f9",
    color: "#333",
  },
  header: {
    backgroundColor: "white",
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
    position: "sticky",
    top: 0,
    zIndex: 40,
  },
  headerContent: {
    maxWidth: "1200px",
    margin: "0 auto",
    padding: "16px 20px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  h1: {
    fontSize: "1.5em",
    fontWeight: "bold",
    color: "#1a1a1a",
    margin: 0,
  },
  desktopMenu: {
    display: "flex",
    gap: "16px",
  },
  mobileMenuButton: {
    display: "none",
    background: "none",
    border: "none",
    cursor: "pointer",
    "@media (max-width: 768px)": {
      display: "block",
    },
  },
  mobileMenu: {
    display: "none",
    backgroundColor: "white",
    borderTop: "1px solid #ddd",
    padding: "8px 16px",
    "@media (max-width: 768px)": {
      display: "block",
    },
  },
  main: {
    maxWidth: "1200px",
    margin: "0 auto",
    padding: "48px 20px",
  },
  heroSection: {
    textAlign: "center" as const,
    marginBottom: "48px",
  },
  heroTitle: {
    fontSize: "2.25em",
    fontWeight: "bold",
    color: "#1a1a1a",
    marginBottom: "16px",
  },
  heroSubtitle: {
    fontSize: "1.125em",
    color: "#666",
  },
  categoriesGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: "32px",
    marginBottom: "48px",
  },
  categoryCard: {
    borderRadius: "8px",
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
    transition: "box-shadow 0.3s",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column" as const,
    height: "100%",
  },
  categoryTitle: {
    fontSize: "1.5em",
  },
  categoryDescription: {
    color: "#666",
    marginBottom: "16px",
    flexGrow: 1,
  },
  shopButton: {
    width: "100%",
    padding: "12px",
    backgroundColor: "#007bff",
    color: "white",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
    fontWeight: "bold",
  },
  emptyStateCard: {
    textAlign: "center" as const,
    padding: "48px 20px",
  },
  emptyStateContent: {
    padding: "20px",
  },
  emptyStateText: {
    color: "#666",
  },
  whatsappButton: {
    position: "fixed" as const,
    bottom: "24px",
    right: "24px",
    backgroundColor: "#25D366",
    color: "white",
    border: "none",
    borderRadius: "50%",
    width: "56px",
    height: "56px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
    transition: "transform 0.3s",
    zIndex: 50,
  },
};
