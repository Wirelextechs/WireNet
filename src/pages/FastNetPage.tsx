import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

interface Package {
  id: string;
  dataAmount: string;
  price: number;
  deliveryTime: string;
}

export default function FastNetPage() {
  const [, navigate] = useLocation();
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    fetchPackages();
  }, []);

  const fetchPackages = async () => {
    try {
      // Mock data - in production, fetch from database
      const mockPackages: Package[] = [
        { id: "1", dataAmount: "1GB", price: 5, deliveryTime: "5-10 mins" },
        { id: "2", dataAmount: "2GB", price: 9, deliveryTime: "5-10 mins" },
        { id: "3", dataAmount: "5GB", price: 20, deliveryTime: "10-15 mins" },
        { id: "4", dataAmount: "10GB", price: 35, deliveryTime: "15-20 mins" },
        { id: "5", dataAmount: "20GB", price: 65, deliveryTime: "20 mins" },
        { id: "6", dataAmount: "50GB", price: 150, deliveryTime: "20 mins" },
        { id: "7", dataAmount: "100GB", price: 280, deliveryTime: "20 mins" },
      ];
      setPackages(mockPackages);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching packages:", error);
      setLoading(false);
    }
  };

  const handlePurchase = async () => {
    if (!phoneNumber || !selectedPackage) {
      alert("Please enter phone number and select a package");
      return;
    }

    setPurchasing(true);

    try {
      const response = await fetch("/api/fastnet/purchase", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phoneNumber,
          dataAmount: selectedPackage.dataAmount,
          price: selectedPackage.price,
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        alert(`✅ Purchase successful! ${result.message}`);
        setPhoneNumber("");
        setSelectedPackage(null);
      } else {
        alert(`❌ Purchase failed: ${result.message}`);
      }
    } catch (error) {
      console.error("Purchase error:", error);
      alert("❌ An error occurred while processing your request.");
    } finally {
      setPurchasing(false);
    }
  };

  return (
    <div style={styles.body}>
      {/* Header */}
      <div style={styles.container}>
        <div style={styles.header}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/")}
            style={{ marginBottom: "10px" }}
          >
            <ArrowLeft size={18} style={{ marginRight: "8px" }} />
            Back to WireNet
          </Button>
          <h1 style={styles.h1}>FastNet - NON-EXPIRY MTN DATA</h1>
          <p style={styles.subtitle}>⚡ Super Fast Delivery • 5-20 Minutes</p>
        </div>

        <div style={styles.contactBar}>
          📞 Contact: <a href="tel:+233XXXXXXXXX" style={styles.contactLink}>+233 XXX XXX XXX</a> | 
          💬 WhatsApp: <a href="https://wa.me/233XXXXXXXXX" style={styles.contactLink}>Chat with us</a>
        </div>

        {/* Purchase Section */}
        <h2 style={styles.sectionTitle}>Purchase Data</h2>
        <div style={styles.purchaseSection}>
          <div style={styles.purchaseCard}>
            <h3>Phone Number</h3>
            <Input
              type="tel"
              placeholder="Enter MTN number"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              style={styles.input}
            />
          </div>

          <div style={styles.purchaseCard}>
            <h3>Selected Package</h3>
            {selectedPackage ? (
              <div style={styles.selectedPackageInfo}>
                <p style={styles.packageName}>{selectedPackage.dataAmount}</p>
                <p style={styles.packagePrice}>GH₵{selectedPackage.price}</p>
                <p style={styles.deliveryTime}>⏱️ {selectedPackage.deliveryTime}</p>
              </div>
            ) : (
              <p style={styles.noSelection}>Select a package below</p>
            )}
          </div>

          <div style={styles.purchaseCard}>
            <h3>Complete Purchase</h3>
            <Button
              onClick={handlePurchase}
              disabled={!phoneNumber || !selectedPackage || purchasing}
              style={{
                ...styles.buyButton,
                opacity: !phoneNumber || !selectedPackage || purchasing ? 0.5 : 1,
              }}
            >
              {purchasing ? "Processing..." : "Buy Now"}
            </Button>
            <p style={styles.paymentNote}>Secure payment via Paystack</p>
          </div>
        </div>

        {/* Packages Grid */}
        <h2 style={styles.sectionTitle}>Available Packages</h2>
        {loading ? (
          <p style={styles.loading}>Loading packages...</p>
        ) : (
          <div style={styles.packagesGrid}>
            {packages.map((pkg) => (
              <div
                key={pkg.id}
                onClick={() => setSelectedPackage(pkg)}
                style={{
                  ...styles.packageCard,
                  ...(selectedPackage?.id === pkg.id ? styles.packageCardSelected : {}),
                }}
              >
                <p style={styles.packageCardName}>{pkg.dataAmount}</p>
                <p style={styles.packageCardPrice}>GH₵{pkg.price}</p>
                <p style={styles.packageCardDelivery}>⏱️ {pkg.deliveryTime}</p>
              </div>
            ))}
          </div>
        )}

        {/* Features Section */}
        <div style={styles.featuresSection}>
          <h2 style={styles.sectionTitle}>Why Choose FastNet?</h2>
          <div style={styles.featuresGrid}>
            <div style={styles.featureCard}>
              <h3>⚡ Lightning Fast</h3>
              <p>Get your data in 5-20 minutes</p>
            </div>
            <div style={styles.featureCard}>
              <h3>💰 Affordable</h3>
              <p>Competitive pricing for all packages</p>
            </div>
            <div style={styles.featureCard}>
              <h3>🔒 Secure</h3>
              <p>Safe payment processing with Paystack</p>
            </div>
            <div style={styles.featureCard}>
              <h3>♾️ Non-Expiry</h3>
              <p>Your data never expires</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: any = {
  body: {
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    margin: 0,
    padding: 0,
    backgroundColor: "#f0f4f8",
    color: "#333",
  },
  container: {
    maxWidth: "1200px",
    margin: "20px auto",
    padding: "20px",
    backgroundColor: "white",
    borderRadius: "10px",
    boxShadow: "0 4px 15px rgba(0, 0, 0, 0.1)",
  },
  header: {
    textAlign: "center" as const,
    paddingBottom: "20px",
    borderBottom: "3px solid #007bff",
  },
  h1: {
    color: "#007bff",
    marginBottom: "5px",
    fontSize: "2.5em",
  },
  subtitle: {
    color: "#666",
    fontSize: "1.1em",
  },
  contactBar: {
    backgroundColor: "#007bff",
    color: "white",
    padding: "10px",
    textAlign: "center" as const,
    borderRadius: "5px",
    marginBottom: "20px",
  },
  contactLink: {
    color: "#fff",
    textDecoration: "none",
    fontWeight: "bold",
  },
  sectionTitle: {
    fontSize: "1.8em",
    marginTop: "30px",
    marginBottom: "20px",
    color: "#007bff",
  },
  purchaseSection: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
    gap: "20px",
    marginBottom: "30px",
  },
  purchaseCard: {
    padding: "20px",
    backgroundColor: "#f9f9f9",
    borderRadius: "8px",
    border: "1px solid #ddd",
  },
  selectedPackageInfo: {
    textAlign: "center" as const,
  },
  packageName: {
    fontSize: "2em",
    fontWeight: "bold",
    color: "#007bff",
    margin: "10px 0",
  },
  packagePrice: {
    fontSize: "1.5em",
    fontWeight: "bold",
    color: "#1a1a1a",
  },
  deliveryTime: {
    fontSize: "0.9em",
    color: "#666",
    margin: "5px 0 0 0",
  },
  noSelection: {
    color: "#999",
    textAlign: "center" as const,
  },
  buyButton: {
    width: "100%",
    padding: "12px",
    backgroundColor: "#007bff",
    color: "white",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
    fontWeight: "bold",
    fontSize: "1.1em",
  },
  paymentNote: {
    fontSize: "0.8em",
    color: "#999",
    textAlign: "center" as const,
    marginTop: "10px",
  },
  loading: {
    textAlign: "center" as const,
    color: "#666",
  },
  packagesGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
    gap: "15px",
    marginBottom: "30px",
  },
  packageCard: {
    padding: "20px",
    backgroundColor: "#fff",
    border: "2px solid #ddd",
    borderRadius: "8px",
    textAlign: "center" as const,
    cursor: "pointer",
    transition: "all 0.3s",
  },
  packageCardSelected: {
    border: "2px solid #007bff",
    backgroundColor: "#f0f7ff",
    boxShadow: "0 0 10px rgba(0, 123, 255, 0.3)",
  },
  packageCardName: {
    fontSize: "1.3em",
    fontWeight: "bold",
    color: "#007bff",
    margin: "10px 0",
  },
  packageCardPrice: {
    fontSize: "1.2em",
    fontWeight: "bold",
    color: "#1a1a1a",
  },
  packageCardDelivery: {
    fontSize: "0.85em",
    color: "#666",
    margin: "5px 0 0 0",
  },
  featuresSection: {
    marginTop: "40px",
    paddingTop: "30px",
    borderTop: "2px solid #eee",
  },
  featuresGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "20px",
  },
  featureCard: {
    padding: "20px",
    backgroundColor: "#f0f7ff",
    borderRadius: "8px",
    border: "1px solid #007bff",
    textAlign: "center" as const,
  },
};
