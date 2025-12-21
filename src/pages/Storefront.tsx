import { useEffect, useState } from "react";
import { MessageCircle, Menu, X, Zap, Clock, Smartphone, Radio, Phone, Sparkles, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
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

const categories = [
  {
    id: "datagod",
    title: "DataGod",
    description: "Wholesale pricing for bulk buyers",
    details: "Best rates • Up to 24hr delivery",
    icon: Sparkles,
    gradient: "from-violet-500 via-purple-500 to-fuchsia-500",
    shadowColor: "shadow-violet-500/25",
    path: "/datagod",
    enabled: "datagodEnabled" as const,
  },
  {
    id: "fastnet",
    title: "FastNet",
    description: "Lightning-fast data delivery",
    details: "5-20 min delivery • Standard rates",
    icon: Zap,
    gradient: "from-amber-500 via-orange-500 to-red-500",
    shadowColor: "shadow-orange-500/25",
    path: "/fastnet",
    enabled: "fastnetEnabled" as const,
  },
  {
    id: "at",
    title: "AT iShare",
    description: "AT network bundles",
    details: "Instant delivery • Clear pricing",
    icon: Smartphone,
    gradient: "from-cyan-500 via-blue-500 to-indigo-500",
    shadowColor: "shadow-blue-500/25",
    path: "/at",
    enabled: "atEnabled" as const,
  },
  {
    id: "telecel",
    title: "Telecel",
    description: "Telecel data packages",
    details: "Fast processing • Flexible bundles",
    icon: Radio,
    gradient: "from-emerald-500 via-teal-500 to-cyan-500",
    shadowColor: "shadow-teal-500/25",
    path: "/telecel",
    enabled: "telecelEnabled" as const,
  },
  {
    id: "afa",
    title: "MTN AFA",
    description: "Registration service",
    details: "12-72hr processing • Cheaper calls",
    icon: Phone,
    gradient: "from-pink-500 via-rose-500 to-red-500",
    shadowColor: "shadow-rose-500/25",
    path: "",
    enabled: "afaEnabled" as const,
    isExternal: true,
  },
];

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

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { type: "spring", stiffness: 100 }
    }
  };

  const enabledCategories = categories.filter(cat => settings[cat.enabled]);

  return (
    <div className="min-h-screen gradient-mesh">
      {/* Announcement Banner */}
      <AnimatePresence>
        {settings.announcementActive && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-600 text-white">
              <div className="mx-auto max-w-7xl px-4 py-3">
                <AnnouncementBanner
                  text={settings.announcementText}
                  link={settings.announcementLink}
                  severity={settings.announcementSeverity || "info"}
                  active={settings.announcementActive === true}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="sticky top-0 z-40 glass border-b border-white/10"
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <motion.button
            type="button"
            onClick={() => navigate("/")}
            className="flex items-center gap-2"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            aria-label="WireNet home"
          >
            <div className="h-10 w-10 rounded-xl gradient-primary flex items-center justify-center">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <motion.span 
              className="text-xl font-extrabold tracking-tight"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
            >
              <span className="bg-gradient-to-r from-violet-600 via-fuchsia-500 to-pink-500 bg-clip-text text-transparent">Wire</span>
              <span className="bg-gradient-to-r from-pink-500 via-orange-500 to-amber-500 bg-clip-text text-transparent">Net</span>
            </motion.span>
          </motion.button>

          <div className="hidden items-center gap-3 md:flex">
            {settings.whatsappLink && (
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button 
                  variant="ghost" 
                  onClick={handleWhatsAppClick}
                  className="gap-2 hover:bg-emerald-500/10 hover:text-emerald-600"
                >
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp
                </Button>
              </motion.div>
            )}
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button 
                onClick={() => navigate("/admin/login")}
                className="gradient-primary text-white border-0 shadow-lg shadow-violet-500/25"
              >
                Admin Portal
              </Button>
            </motion.div>
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

        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-white/10 glass md:hidden overflow-hidden"
            >
              <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-4">
                {settings.whatsappLink && (
                  <Button
                    variant="ghost"
                    className="justify-start gap-2"
                    onClick={() => {
                      handleWhatsAppClick();
                      setMenuOpen(false);
                    }}
                  >
                    <MessageCircle className="h-4 w-4" />
                    WhatsApp
                  </Button>
                )}
                <Button
                  className="justify-start gradient-primary text-white"
                  onClick={() => {
                    navigate("/admin/login");
                    setMenuOpen(false);
                  }}
                >
                  Admin Portal
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>

      <main className="mx-auto max-w-7xl px-3 sm:px-4 py-6 sm:py-12">
        {/* Hero Section */}
        <motion.section
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-6 sm:mb-16"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", delay: 0.2 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-6"
          >
            <Sparkles className="h-4 w-4 text-violet-500" />
            <span className="text-sm font-medium">Ghana's Premier Data Hub</span>
          </motion.div>
          
          {/* Animated WireNet Logo */}
          <motion.div
            className="mb-2 sm:mb-4"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 100, delay: 0.1 }}
          >
            <motion.span 
              className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight inline-block"
              animate={{ 
                backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
              }}
              transition={{ 
                duration: 5, 
                repeat: Infinity, 
                ease: "linear" 
              }}
              style={{
                backgroundImage: "linear-gradient(90deg, #8b5cf6, #d946ef, #ec4899, #f97316, #eab308, #8b5cf6)",
                backgroundSize: "200% auto",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              WireNet
            </motion.span>
          </motion.div>
          
          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-bold mb-3 sm:mb-6">
            <span className="text-gradient">Instant Data</span>
            <br />
            <span className="text-foreground">At Your Fingertips</span>
          </h1>
          
          <p className="text-sm sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-4 sm:mb-8">
            Experience lightning-fast data delivery with competitive prices.
            Choose your network, select a bundle, and get connected instantly.
          </p>

          <motion.div
            className="flex flex-wrap justify-center gap-2 sm:gap-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <div className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1 sm:py-2 rounded-full bg-emerald-500/10 text-emerald-600">
              <Clock className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="text-xs sm:text-sm font-medium">5-20 min delivery</span>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1 sm:py-2 rounded-full bg-violet-500/10 text-violet-600">
              <Zap className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="text-xs sm:text-sm font-medium">Instant activation</span>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1 sm:py-2 rounded-full bg-amber-500/10 text-amber-600">
              <Sparkles className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="text-xs sm:text-sm font-medium">Best prices</span>
            </div>
          </motion.div>
        </motion.section>

        {/* Categories Grid */}
        <motion.section
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 lg:gap-6"
        >
          {enabledCategories.map((category, index) => {
            const Icon = category.icon;
            return (
              <motion.div
                key={category.id}
                variants={itemVariants}
                whileHover={{ y: -4, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => category.isExternal ? handleAfaClick() : navigate(category.path)}
                className={`
                  relative group cursor-pointer rounded-2xl sm:rounded-3xl p-[3px] sm:p-1 
                  bg-gradient-to-br ${category.gradient}
                  ${category.shadowColor} shadow-lg hover:shadow-xl
                  transition-shadow duration-300
                `}
              >
                <div className="relative h-full rounded-[0.9rem] sm:rounded-[1.4rem] bg-white/95 dark:bg-gray-900/95 p-3 sm:p-5 backdrop-blur-sm">
                  {/* Icon */}
                  <div className={`
                    inline-flex p-2 sm:p-3 rounded-xl sm:rounded-2xl mb-2 sm:mb-4
                    bg-gradient-to-br ${category.gradient}
                    shadow-md sm:shadow-lg ${category.shadowColor}
                  `}>
                    <Icon className="h-4 w-4 sm:h-6 sm:w-6 text-white" />
                  </div>

                  {/* Content */}
                  <h3 className="text-sm sm:text-xl font-bold mb-1 sm:mb-2">{category.title}</h3>
                  <p className="text-xs sm:text-base text-muted-foreground mb-1 sm:mb-3 line-clamp-2">{category.description}</p>
                  <p className="text-[10px] sm:text-sm text-muted-foreground/80 hidden sm:block">{category.details}</p>

                  {/* Arrow indicator */}
                  <div className="absolute bottom-3 right-3 sm:bottom-6 sm:right-6 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className={`p-1 sm:p-2 rounded-full bg-gradient-to-br ${category.gradient}`}>
                      <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4 text-white" />
                    </div>
                  </div>

                  {/* Shimmer effect */}
                  <div className="absolute inset-0 rounded-[1.4rem] overflow-hidden pointer-events-none">
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity shimmer" />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.section>

        {/* Empty state */}
        {enabledCategories.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-20"
          >
            <div className="inline-flex p-4 rounded-full bg-muted mb-4">
              <Clock className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Coming Soon</h3>
            <p className="text-muted-foreground">No categories available at the moment. Check back soon!</p>
          </motion.div>
        )}
      </main>

      {/* Floating WhatsApp button */}
      {settings.whatsappLink && (
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.5, type: "spring" }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={handleWhatsAppClick}
          className="fixed bottom-6 right-6 z-50 p-4 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-xl shadow-emerald-500/30 pulse-glow"
          aria-label="Chat on WhatsApp"
          title="Chat on WhatsApp"
        >
          <MessageCircle className="h-6 w-6" />
        </motion.button>
      )}
    </div>
  );
}
