import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

interface Package {
  id: string;
  packageName: string;
  dataValueGB: number;
  priceGHS: number;
  isEnabled: boolean;
}

export default function DataGodPage() {
  const [, navigate] = useLocation();
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [statusCheckId, setStatusCheckId] = useState("");
  const [statusReport, setStatusReport] = useState<any>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  useEffect(() => {
    fetchPackages();
  }, []);

  const fetchPackages = async () => {
    try {
      // Mock data - in production, fetch from Supabase
      const mockPackages: Package[] = [
        { id: "1", packageName: "1GB", dataValueGB: 1, priceGHS: 2.5, isEnabled: true },
        { id: "2", packageName: "2GB", dataValueGB: 2, priceGHS: 4.5, isEnabled: true },
        { id: "3", packageName: "5GB", dataValueGB: 5, priceGHS: 10, isEnabled: true },
        { id: "4", packageName: "10GB", dataValueGB: 10, priceGHS: 18, isEnabled: true },
        { id: "5", packageName: "20GB", dataValueGB: 20, priceGHS: 35, isEnabled: true },
        { id: "6", packageName: "50GB", dataValueGB: 50, priceGHS: 80, isEnabled: true },
      ];
      setPackages(mockPackages.filter(p => p.isEnabled));
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

    try {
      // TODO: Integrate with Paystack and Supabase
      alert(`Purchase initiated for ${selectedPackage.packageName} to ${phoneNumber}`);
    } catch (error) {
      console.error("Purchase error:", error);
    }
  };

  const handleStatusCheck = async () => {
    if (!statusCheckId) {
      alert("Please enter an order ID");
      return;
    }

    setStatusLoading(true);
    try {
      // TODO: Fetch from Supabase
      setStatusReport({
        shortId: statusCheckId,
        status: "PROCESSING",
        packageDetails: "5GB Data",
        createdAt: new Date().toLocaleDateString(),
      });
    } catch (error) {
      console.error("Status check error:", error);
      setStatusReport(null);
    } finally {
      setStatusLoading(false);
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
          <h1 style={styles.h1}>DataGod Vending Platform</h1>
          <p style={styles.subtitle}>Cheapest Data Prices • 24hr Delivery</p>
        </div>

        <div style={styles.contactBar}>
          📞 Contact: <a href="tel:+233XXXXXXXXX" style={styles.contactLink}>+233 XXX XXX XXX</a> | 
          💬 WhatsApp: <a href="https://wa.me/233XXXXXXXXX" style={styles.contactLink}>Chat with us</a>
        </div>

        {/* Status Checker */}
        <div style={styles.statusChecker}>
          <h2 style={styles.statusCheckerH2}>Check Order Status</h2>
          <div style={styles.statusCheckerForm}>
            <Input
              type="text"
              placeholder="Enter Order ID"
              value={statusCheckId}
              onChange={(e) => setStatusCheckId(e.target.value)}
              style={styles.input}
            />
            <Button
              onClick={handleStatusCheck}
              disabled={statusLoading}
              style={styles.statusButton}
            >
              {statusLoading ? "Checking..." : "Check Status"}
            </Button>
          </div>
          {statusReport && (
            <div style={styles.statusReport}>
              <p><strong>Order ID:</strong> {statusReport.shortId}</p>
              <p><strong>Status:</strong> {statusReport.status}</p>
              <p><strong>Package:</strong> {statusReport.packageDetails}</p>
              <p><strong>Date:</strong> {statusReport.createdAt}</p>
            </div>
          )}
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
                <p style={styles.packageName}>{selectedPackage.packageName}</p>
                <p style={styles.packagePrice}>GH₵{selectedPackage.priceGHS}</p>
              </div>
            ) : (
              <p style={styles.noSelection}>Select a package below</p>
            )}
          </div>

          <div style={styles.purchaseCard}>
            <h3>Complete Purchase</h3>
            <Button
              onClick={handlePurchase}
              disabled={!phoneNumber || !selectedPackage}
              style={{
                ...styles.buyButton,
                opacity: !phoneNumber || !selectedPackage ? 0.5 : 1,
              }}
            >
              Buy Now
            </Button>
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
                <p style={styles.packageCardName}>{pkg.packageName}</p>
                <p style={styles.packageCardPrice}>GH₵{pkg.priceGHS}</p>
              </div>
            ))}
          </div>
        )}
      </div>
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
    borderBottom: "3px solid #ffcc00",
  },
  h1: {
    color: "#1a1a1a",
    marginBottom: "5px",
    fontSize: "2.5em",
  },
  subtitle: {
    color: "#666",
    fontSize: "1.1em",
  },
  contactBar: {
    backgroundColor: "#1a1a1a",
    color: "white",
    padding: "10px",
    textAlign: "center" as const,
    borderRadius: "5px",
    marginBottom: "20px",
  },
  contactLink: {
    color: "#ffcc00",
    textDecoration: "none",
    fontWeight: "bold",
  },
  statusChecker: {
    backgroundColor: "#e9ecef",
    padding: "20px",
    borderRadius: "8px",
    marginBottom: "30px",
    textAlign: "center" as const,
  },
  statusCheckerH2: {
    marginTop: 0,
    color: "#007bff",
  },
  statusCheckerForm: {
    display: "flex",
    justifyContent: "center",
    gap: "10px",
    flexWrap: "wrap" as const,
  },
  input: {
    padding: "10px",
    border: "1px solid #ccc",
    borderRadius: "5px",
    width: "150px",
  },
  statusButton: {
    padding: "10px 20px",
    backgroundColor: "#007bff",
    color: "white",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
  },
  statusReport: {
    marginTop: "15px",
    textAlign: "left" as const,
    padding: "10px",
    backgroundColor: "#fff",
    borderRadius: "5px",
  },
  sectionTitle: {
    fontSize: "1.8em",
    marginTop: "30px",
    marginBottom: "20px",
    color: "#1a1a1a",
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
    color: "#ffcc00",
    margin: "10px 0",
  },
  packagePrice: {
    fontSize: "1.5em",
    fontWeight: "bold",
    color: "#1a1a1a",
  },
  noSelection: {
    color: "#999",
    textAlign: "center" as const,
  },
  buyButton: {
    width: "100%",
    padding: "12px",
    backgroundColor: "#ffcc00",
    color: "#1a1a1a",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
    fontWeight: "bold",
    fontSize: "1.1em",
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
    border: "2px solid #ffcc00",
    backgroundColor: "#fffbf0",
    boxShadow: "0 0 10px rgba(255, 204, 0, 0.3)",
  },
  packageCardName: {
    fontSize: "1.3em",
    fontWeight: "bold",
    color: "#ffcc00",
    margin: "10px 0",
  },
  packageCardPrice: {
    fontSize: "1.2em",
    fontWeight: "bold",
    color: "#1a1a1a",
  },
};
