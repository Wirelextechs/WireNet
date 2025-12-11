import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";

interface Package {
  id: string;
  dataAmount: string;
  price: number;
  deliveryTime: string;
  isEnabled: boolean;
}

export default function FastNetAdmin() {
  const [, navigate] = useLocation();
  const [packages, setPackages] = useState<Package[]>([]);
  const [newPackage, setNewPackage] = useState({ amount: "", price: "", delivery: "" });
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadPackages();
  }, []);

  const loadPackages = () => {
    try {
      const saved = localStorage.getItem("fastnetPackages");
      if (saved) {
        setPackages(JSON.parse(saved));
      } else {
        const defaults = [
          { id: "1", dataAmount: "1GB", price: 5, deliveryTime: "5-10 mins", isEnabled: true },
          { id: "2", dataAmount: "2GB", price: 9, deliveryTime: "5-10 mins", isEnabled: true },
          { id: "3", dataAmount: "5GB", price: 20, deliveryTime: "10-15 mins", isEnabled: true },
          { id: "4", dataAmount: "10GB", price: 35, deliveryTime: "15-20 mins", isEnabled: true },
          { id: "5", dataAmount: "20GB", price: 65, deliveryTime: "20 mins", isEnabled: true },
          { id: "6", dataAmount: "50GB", price: 150, deliveryTime: "20 mins", isEnabled: true },
        ];
        localStorage.setItem("fastnetPackages", JSON.stringify(defaults));
        setPackages(defaults);
      }
    } catch (error) {
      console.error("Error loading packages:", error);
    }
  };

  const handleAddPackage = () => {
    if (!newPackage.amount || !newPackage.price || !newPackage.delivery) {
      setMessage("❌ Please fill all fields");
      return;
    }

    const pkg: Package = {
      id: Date.now().toString(),
      dataAmount: newPackage.amount,
      price: parseFloat(newPackage.price),
      deliveryTime: newPackage.delivery,
      isEnabled: true,
    };

    const updated = [...packages, pkg];
    setPackages(updated);
    localStorage.setItem("fastnetPackages", JSON.stringify(updated));
    setNewPackage({ amount: "", price: "", delivery: "" });
    setMessage("✅ Package added successfully!");
    setTimeout(() => setMessage(""), 2000);
  };

  const handleDeletePackage = (id: string) => {
    const updated = packages.filter(p => p.id !== id);
    setPackages(updated);
    localStorage.setItem("fastnetPackages", JSON.stringify(updated));
    setMessage("✅ Package deleted!");
    setTimeout(() => setMessage(""), 2000);
  };

  const handleTogglePackage = (id: string) => {
    const updated = packages.map(p =>
      p.id === id ? { ...p, isEnabled: !p.isEnabled } : p
    );
    setPackages(updated);
    localStorage.setItem("fastnetPackages", JSON.stringify(updated));
  };

  return (
    <div style={styles.body}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/admin")}
            style={{ marginRight: "16px" }}
          >
            <ArrowLeft size={18} style={{ marginRight: "8px" }} />
            Back
          </Button>
          <h1 style={styles.h1}>FastNet Admin - Package Management</h1>
        </div>
      </header>

      {/* Main Content */}
      <main style={styles.main}>
        {message && (
          <div style={{
            ...styles.message,
            backgroundColor: message.includes("✅") ? "#d4edda" : "#f8d7da",
            color: message.includes("✅") ? "#155724" : "#721c24",
          }}>
            {message}
          </div>
        )}

        {/* Add New Package */}
        <Card style={styles.card}>
          <CardHeader>
            <CardTitle>Add New Package</CardTitle>
            <CardDescription>Create a new data package</CardDescription>
          </CardHeader>
          <CardContent>
            <div style={styles.formGrid}>
              <div>
                <label style={styles.label}>Data Amount</label>
                <Input
                  placeholder="e.g., 1GB"
                  value={newPackage.amount}
                  onChange={(e) => setNewPackage({ ...newPackage, amount: e.target.value })}
                />
              </div>
              <div>
                <label style={styles.label}>Price (GH₵)</label>
                <Input
                  type="number"
                  placeholder="e.g., 5"
                  value={newPackage.price}
                  onChange={(e) => setNewPackage({ ...newPackage, price: e.target.value })}
                />
              </div>
              <div>
                <label style={styles.label}>Delivery Time</label>
                <Input
                  placeholder="e.g., 5-10 mins"
                  value={newPackage.delivery}
                  onChange={(e) => setNewPackage({ ...newPackage, delivery: e.target.value })}
                />
              </div>
            </div>
            <Button onClick={handleAddPackage} style={styles.addButton}>
              <Plus size={18} style={{ marginRight: "8px" }} />
              Add Package
            </Button>
          </CardContent>
        </Card>

        {/* Packages List */}
        <Card style={styles.card}>
          <CardHeader>
            <CardTitle>Manage Packages</CardTitle>
            <CardDescription>Edit or delete existing packages</CardDescription>
          </CardHeader>
          <CardContent>
            <div style={styles.packagesTable}>
              <div style={styles.tableHeader}>
                <div style={styles.tableCell}>Data Amount</div>
                <div style={styles.tableCell}>Price (GH₵)</div>
                <div style={styles.tableCell}>Delivery Time</div>
                <div style={styles.tableCell}>Status</div>
                <div style={styles.tableCell}>Action</div>
              </div>
              {packages.map((pkg) => (
                <div key={pkg.id} style={styles.tableRow}>
                  <div style={styles.tableCell}>{pkg.dataAmount}</div>
                  <div style={styles.tableCell}>{pkg.price}</div>
                  <div style={styles.tableCell}>{pkg.deliveryTime}</div>
                  <div style={styles.tableCell}>
                    <button
                      onClick={() => handleTogglePackage(pkg.id)}
                      style={{
                        ...styles.statusButton,
                        backgroundColor: pkg.isEnabled ? "#28a745" : "#dc3545",
                      }}
                    >
                      {pkg.isEnabled ? "✅ Enabled" : "❌ Disabled"}
                    </button>
                  </div>
                  <div style={styles.tableCell}>
                    <button
                      onClick={() => handleDeletePackage(pkg.id)}
                      style={styles.deleteButton}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
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
    alignItems: "center",
  },
  h1: {
    fontSize: "1.5em",
    fontWeight: "bold",
    color: "#007bff",
    margin: 0,
  },
  main: {
    maxWidth: "1200px",
    margin: "0 auto",
    padding: "32px 20px",
  },
  message: {
    padding: "16px",
    borderRadius: "8px",
    marginBottom: "20px",
    fontWeight: "bold",
  },
  card: {
    marginBottom: "24px",
    borderRadius: "8px",
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: "16px",
    marginBottom: "16px",
  },
  label: {
    display: "block",
    fontSize: "0.875em",
    fontWeight: "bold",
    marginBottom: "8px",
  },
  addButton: {
    backgroundColor: "#007bff",
    color: "white",
    fontWeight: "bold",
  },
  packagesTable: {
    overflowX: "auto",
  },
  tableHeader: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr",
    gap: "16px",
    padding: "12px",
    backgroundColor: "#f9f9f9",
    fontWeight: "bold",
    borderBottom: "2px solid #ddd",
  },
  tableRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr",
    gap: "16px",
    padding: "12px",
    borderBottom: "1px solid #ddd",
    alignItems: "center",
  },
  tableCell: {
    padding: "8px",
  },
  statusButton: {
    padding: "6px 12px",
    color: "white",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "0.875em",
    fontWeight: "bold",
  },
  deleteButton: {
    padding: "6px 12px",
    backgroundColor: "#dc3545",
    color: "white",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
  },
};
