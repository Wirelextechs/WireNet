import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Plus, Trash2, Edit2, Download, Upload } from "lucide-react";

interface Order {
  id: string;
  shortId: string;
  customerPhone: string;
  packageGB: number;
  packagePrice: number;
  packageDetails: string;
  status: "PAID" | "PROCESSING" | "FULFILLED" | "CANCELLED";
  createdAt: Date;
  updatedAt?: Date;
}

interface Package {
  id: string;
  packageName: string;
  dataValueGB: number;
  priceGHS: number;
  isEnabled: boolean;
}

const OrderStatus = {
  PAID: "PAID",
  PROCESSING: "PROCESSING",
  FULFILLED: "FULFILLED",
  CANCELLED: "CANCELLED",
};

export default function DataGodAdmin() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<"orders" | "packages" | "settings">("orders");
  const [orders, setOrders] = useState<Order[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [settings, setSettings] = useState({ whatsAppLink: "", transactionCharge: "1.3" });
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState("");
  const [message, setMessage] = useState("");
  const [newPackage, setNewPackage] = useState({ name: "", gb: "", price: "" });
  const [editingPackage, setEditingPackage] = useState<Package | null>(null);

  useEffect(() => {
    loadOrders();
    loadPackages();
    loadSettings();
  }, []);

  const loadOrders = () => {
    try {
      const saved = localStorage.getItem("datagodOrders");
      if (saved) {
        const parsed = JSON.parse(saved);
        setOrders(parsed.map((o: any) => ({ ...o, createdAt: new Date(o.createdAt) })));
      }
    } catch (error) {
      console.error("Error loading orders:", error);
    }
  };

  const loadPackages = () => {
    try {
      const saved = localStorage.getItem("datagodPackages");
      if (saved) {
        setPackages(JSON.parse(saved).sort((a: any, b: any) => a.dataValueGB - b.dataValueGB));
      } else {
        const defaults = [
          { id: "1", packageName: "1GB", dataValueGB: 1, priceGHS: 2.5, isEnabled: true },
          { id: "2", packageName: "2GB", dataValueGB: 2, priceGHS: 4.5, isEnabled: true },
          { id: "3", packageName: "5GB", dataValueGB: 5, priceGHS: 10, isEnabled: true },
          { id: "4", packageName: "10GB", dataValueGB: 10, priceGHS: 18, isEnabled: true },
        ];
        localStorage.setItem("datagodPackages", JSON.stringify(defaults));
        setPackages(defaults.sort((a, b) => a.dataValueGB - b.dataValueGB));
      }
    } catch (error) {
      console.error("Error loading packages:", error);
    }
  };

  const loadSettings = () => {
    try {
      const savedWirenet = localStorage.getItem("wirenetSettings");
      const savedDatagod = localStorage.getItem("datagodSettings");
      
      let whatsAppLink = "";
      let transactionCharge = "1.3";

      if (savedWirenet) {
        const parsed = JSON.parse(savedWirenet);
        whatsAppLink = parsed.whatsappLink || "";
      }
      
      if (savedDatagod) {
        const parsed = JSON.parse(savedDatagod);
        transactionCharge = parsed.transactionCharge || "1.3";
      }

      setSettings({ whatsAppLink, transactionCharge });
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  };

  const getFilteredOrders = () => {
    if (filterStatus === "ALL") return orders;
    return orders.filter(o => o.status === filterStatus);
  };

  const handleToggleOrderSelect = (orderId: string) => {
    const newSelected = new Set(selectedOrders);
    if (newSelected.has(orderId)) {
      newSelected.delete(orderId);
    } else {
      newSelected.add(orderId);
    }
    setSelectedOrders(newSelected);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedOrders(new Set(getFilteredOrders().map(o => o.id)));
    } else {
      setSelectedOrders(new Set());
    }
  };

  const handleBulkStatusChange = () => {
    if (selectedOrders.size === 0) {
      setMessage("❌ Please select at least one order");
      return;
    }
    if (!bulkStatus) {
      setMessage("❌ Please select a status");
      return;
    }

    const updated = orders.map(o =>
      selectedOrders.has(o.id) ? { ...o, status: bulkStatus as any, updatedAt: new Date() } : o
    );
    setOrders(updated);
    localStorage.setItem("datagodOrders", JSON.stringify(updated));
    setSelectedOrders(new Set());
    setBulkStatus("");
    setMessage(`✅ ${selectedOrders.size} orders updated to ${bulkStatus}`);
    setTimeout(() => setMessage(""), 3000);
  };

  const handleUpdateOrderStatus = (orderId: string, newStatus: string) => {
    const updated = orders.map(o =>
      o.id === orderId ? { ...o, status: newStatus as any, updatedAt: new Date() } : o
    );
    setOrders(updated);
    localStorage.setItem("datagodOrders", JSON.stringify(updated));
    setMessage("✅ Order status updated");
    setTimeout(() => setMessage(""), 2000);
  };

  const handleAddPackage = () => {
    if (!newPackage.name || !newPackage.gb || !newPackage.price) {
      setMessage("❌ Please fill all fields");
      return;
    }

    const pkg: Package = {
      id: Date.now().toString(),
      packageName: newPackage.name,
      dataValueGB: parseFloat(newPackage.gb),
      priceGHS: parseFloat(newPackage.price),
      isEnabled: true,
    };

    const updated = [...packages, pkg].sort((a, b) => a.dataValueGB - b.dataValueGB);
    setPackages(updated);
    localStorage.setItem("datagodPackages", JSON.stringify(updated));
    setNewPackage({ name: "", gb: "", price: "" });
    setMessage("✅ Package added");
    setTimeout(() => setMessage(""), 2000);
  };

  const handleDeletePackage = (id: string) => {
    const updated = packages.filter(p => p.id !== id);
    setPackages(updated);
    localStorage.setItem("datagodPackages", JSON.stringify(updated));
    setMessage("✅ Package deleted");
    setTimeout(() => setMessage(""), 2000);
  };

  const handleTogglePackage = (id: string) => {
    const updated = packages.map(p =>
      p.id === id ? { ...p, isEnabled: !p.isEnabled } : p
    );
    setPackages(updated);
    localStorage.setItem("datagodPackages", JSON.stringify(updated));
  };

  const exportOrdersToCSV = () => {
    const selectedOrderObjects = orders.filter(o => selectedOrders.has(o.id));
    if (selectedOrderObjects.length === 0) {
      setMessage("❌ Please select orders to export");
      return;
    }

    const csv = [
      ["Order ID", "Phone", "Package", "Price", "Status", "Date"].join(","),
      ...selectedOrderObjects.map(o =>
        [o.shortId, o.customerPhone, o.packageDetails.replace("GB", ""), o.packagePrice, o.status, o.createdAt.toLocaleDateString()].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `datagod-orders-${Date.now()}.csv`;
    a.click();
    setMessage("✅ Orders exported to CSV");
    setTimeout(() => setMessage(""), 2000);
  };

  const filteredOrders = getFilteredOrders();

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
          <h1 style={styles.h1}>DataGod Admin Dashboard</h1>
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

        {/* Tabs */}
        <div style={styles.tabs}>
          <button
            onClick={() => setActiveTab("orders")}
            style={{
              ...styles.tab,
              borderBottom: activeTab === "orders" ? "3px solid #ffcc00" : "none",
              fontWeight: activeTab === "orders" ? "bold" : "normal",
            }}
          >
            Orders
          </button>
          <button
            onClick={() => setActiveTab("packages")}
            style={{
              ...styles.tab,
              borderBottom: activeTab === "packages" ? "3px solid #ffcc00" : "none",
              fontWeight: activeTab === "packages" ? "bold" : "normal",
            }}
          >
            Packages
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            style={{
              ...styles.tab,
              borderBottom: activeTab === "settings" ? "3px solid #ffcc00" : "none",
              fontWeight: activeTab === "settings" ? "bold" : "normal",
            }}
          >
            Settings
          </button>
        </div>

        {/* Orders Tab */}
        {activeTab === "orders" && (
          <div>
            {/* Filter and Bulk Actions */}
            <Card style={styles.card}>
              <CardHeader>
                <CardTitle>Order Management</CardTitle>
              </CardHeader>
              <CardContent>
                <div style={styles.filterSection}>
                  <div style={styles.filterGroup}>
                    <label style={styles.label}>Filter by Status:</label>
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      style={styles.select}
                    >
                      <option value="ALL">All Orders</option>
                      <option value="PAID">Paid</option>
                      <option value="PROCESSING">Processing</option>
                      <option value="FULFILLED">Fulfilled</option>
                      <option value="CANCELLED">Cancelled</option>
                    </select>
                  </div>

                  <div style={styles.filterGroup}>
                    <label style={styles.label}>Bulk Status Change:</label>
                    <select
                      value={bulkStatus}
                      onChange={(e) => setBulkStatus(e.target.value)}
                      style={styles.select}
                    >
                      <option value="">Select Status</option>
                      <option value="PAID">Paid</option>
                      <option value="PROCESSING">Processing</option>
                      <option value="FULFILLED">Fulfilled</option>
                      <option value="CANCELLED">Cancelled</option>
                    </select>
                  </div>

                  <Button
                    onClick={handleBulkStatusChange}
                    style={styles.bulkButton}
                  >
                    Update ({selectedOrders.size})
                  </Button>

                  <Button
                    onClick={exportOrdersToCSV}
                    style={styles.exportButton}
                  >
                    <Download size={16} style={{ marginRight: "8px" }} />
                    Export CSV
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Orders Table */}
            <Card style={styles.card}>
              <CardContent style={{ padding: "20px" }}>
                <div style={styles.tableWrapper}>
                  <table style={styles.table}>
                    <thead>
                      <tr style={styles.tableHeader}>
                        <th style={styles.tableCell}>
                          <input
                            type="checkbox"
                            checked={selectedOrders.size === filteredOrders.length && filteredOrders.length > 0}
                            onChange={(e) => handleSelectAll(e.target.checked)}
                          />
                        </th>
                        <th style={styles.tableCell}>Order ID</th>
                        <th style={styles.tableCell}>Phone</th>
                        <th style={styles.tableCell}>Package</th>
                        <th style={styles.tableCell}>Price</th>
                        <th style={styles.tableCell}>Status</th>
                        <th style={styles.tableCell}>Date</th>
                        <th style={styles.tableCell}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOrders.length === 0 ? (
                        <tr>
                          <td colSpan={8} style={{ textAlign: \"center\", padding: \"20px\", color: \"#999\" }}>
                            No orders found
                          </td>
                        </tr>
                      ) : (
                        filteredOrders.map((order) => (
                          <tr key={order.id} style={styles.tableRow}>
                            <td style={styles.tableCell}>
                              <input
                                type=\"checkbox\"
                                checked={selectedOrders.has(order.id)}
                                onChange={() => handleToggleOrderSelect(order.id)}
                              />
                            </td>
                            <td style={styles.tableCell}>{order.shortId}</td>
                            <td style={styles.tableCell}>{order.customerPhone}</td>
                            <td style={styles.tableCell}>{order.packageDetails}</td>
                            <td style={styles.tableCell}>GH₵{order.packagePrice}</td>
                            <td style={styles.tableCell}>
                              <select
                                value={order.status}
                                onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value)}
                                style={{
                                  ...styles.statusSelect,
                                  backgroundColor: order.status === \"FULFILLED\" ? \"#28a745\" : order.status === \"PROCESSING\" ? \"#ffc107\" : order.status === \"PAID\" ? \"#007bff\" : \"#dc3545\",
                                }}
                              >
                                <option value=\"PAID\">Paid</option>
                                <option value=\"PROCESSING\">Processing</option>
                                <option value=\"FULFILLED\">Fulfilled</option>
                                <option value=\"CANCELLED\">Cancelled</option>
                              </select>
                            </td>
                            <td style={styles.tableCell}>{order.createdAt.toLocaleDateString()}</td>
                            <td style={styles.tableCell}>
                              <button
                                onClick={() => handleUpdateOrderStatus(order.id, \"FULFILLED\")}
                                style={styles.actionButton}
                              >
                                ✓
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Packages Tab */}
        {activeTab === \"packages\" && (
          <div>
            <Card style={styles.card}>
              <CardHeader>
                <CardTitle>Add New Package</CardTitle>
              </CardHeader>
              <CardContent>
                <div style={styles.formGrid}>
                  <div>
                    <label style={styles.label}>Package Name</label>
                    <Input
                      placeholder=\"e.g., 1GB\"
                      value={newPackage.name}
                      onChange={(e) => setNewPackage({ ...newPackage, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={styles.label}>Data (GB)</label>
                    <Input
                      type=\"number\"
                      placeholder=\"e.g., 1\"
                      value={newPackage.gb}
                      onChange={(e) => setNewPackage({ ...newPackage, gb: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={styles.label}>Price (GH₵)</label>
                    <Input
                      type=\"number\"
                      placeholder=\"e.g., 2.5\"
                      value={newPackage.price}
                      onChange={(e) => setNewPackage({ ...newPackage, price: e.target.value })}
                    />
                  </div>
                </div>
                <Button onClick={handleAddPackage} style={styles.addButton}>
                  <Plus size={18} style={{ marginRight: \"8px\" }} />
                  Add Package
                </Button>
              </CardContent>
            </Card>

            <Card style={styles.card}>
              <CardHeader>
                <CardTitle>Manage Packages</CardTitle>
              </CardHeader>
              <CardContent>
                <div style={styles.tableWrapper}>
                  <table style={styles.table}>
                    <thead>
                      <tr style={styles.tableHeader}>
                        <th style={styles.tableCell}>Package</th>
                        <th style={styles.tableCell}>Data (GB)</th>
                        <th style={styles.tableCell}>Price (GH₵)</th>
                        <th style={styles.tableCell}>Status</th>
                        <th style={styles.tableCell}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {packages.map((pkg) => (
                        <tr key={pkg.id} style={styles.tableRow}>
                          <td style={styles.tableCell}>{pkg.packageName}</td>
                          <td style={styles.tableCell}>{pkg.dataValueGB}</td>
                          <td style={styles.tableCell}>{pkg.priceGHS}</td>
                          <td style={styles.tableCell}>
                            <button
                              onClick={() => handleTogglePackage(pkg.id)}
                              style={{
                                ...styles.statusButton,
                                backgroundColor: pkg.isEnabled ? \"#28a745\" : \"#dc3545\",
                              }}
                            >
                              {pkg.isEnabled ? \"✅ Enabled\" : \"❌ Disabled\"}
                            </button>
                          </td>
                          <td style={styles.tableCell}>
                            <button
                              onClick={() => handleDeletePackage(pkg.id)}
                              style={styles.deleteButton}
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === \"settings\" && (
          <Card style={styles.card}>
            <CardHeader>
              <CardTitle>Platform Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <div style={styles.settingsForm}>
                <div>
                  <label style={styles.label}>WhatsApp Link</label>
                  <Input
                    type=\"url\"
                    placeholder=\"https://wa.link/...\"
                    value={settings.whatsAppLink}
                    onChange={(e) => setSettings({ ...settings, whatsAppLink: e.target.value })}
                  />
                </div>
                <div>
                  <label style={styles.label}>Transaction Charge (%)</label>
                  <Input
                    type=\"number\"
                    placeholder=\"1.3\"
                    value={settings.transactionCharge}
                    onChange={(e) => setSettings({ ...settings, transactionCharge: e.target.value })}
                  />
                  <p style={{ fontSize: "0.8em", color: "#666", marginTop: "5px" }}>
                    Percentage charge added to each transaction
                  </p>
                </div>
                <Button
                  onClick={() => {
                    const updated = { ...settings };
                    // Save WhatsApp link to global settings
                    const currentWirenet = JSON.parse(localStorage.getItem("wirenetSettings") || "{}");
                    localStorage.setItem("wirenetSettings", JSON.stringify({
                      ...currentWirenet,
                      whatsappLink: updated.whatsAppLink,
                    }));
                    
                    // Save transaction charge to DataGod settings
                    localStorage.setItem("datagodSettings", JSON.stringify({
                      transactionCharge: updated.transactionCharge,
                    }));
                    
                    setMessage("✅ Settings saved");
                    setTimeout(() => setMessage(""), 2000);
                  }}
                  style={styles.saveButton}
                >
                  Save Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

const styles: any = {
  body: {
    fontFamily: \"'Segoe UI', Tahoma, Geneva, Verdana, sans-serif\",
    margin: 0,
    padding: 0,
    backgroundColor: \"#f4f4f9\",
    color: \"#333\",
  },
  header: {
    backgroundColor: \"white\",
    boxShadow: \"0 1px 3px rgba(0, 0, 0, 0.1)\",
    position: \"sticky\",
    top: 0,
    zIndex: 40,
  },
  headerContent: {
    maxWidth: \"1400px\",
    margin: \"0 auto\",
    padding: \"16px 20px\",
    display: \"flex\",
    alignItems: \"center\",
  },
  h1: {
    fontSize: \"1.5em\",
    fontWeight: \"bold\",
    color: \"#ffcc00\",
    margin: 0,
  },
  main: {
    maxWidth: \"1400px\",
    margin: \"0 auto\",
    padding: \"32px 20px\",
  },
  message: {
    padding: \"16px\",
    borderRadius: \"8px\",
    marginBottom: \"20px\",
    fontWeight: \"bold\",
  },
  tabs: {
    display: \"flex\",
    gap: \"20px\",
    marginBottom: \"24px\",
    borderBottom: \"2px solid #ddd\",
  },
  tab: {
    padding: \"12px 20px\",
    backgroundColor: \"transparent\",
    border: \"none\",
    cursor: \"pointer\",
    fontSize: \"1em\",
    color: \"#666\",
    transition: \"all 0.3s\",
  },
  card: {
    marginBottom: \"24px\",
    borderRadius: \"8px\",
    boxShadow: \"0 1px 3px rgba(0, 0, 0, 0.1)\",
  },
  filterSection: {
    display: \"grid\",
    gridTemplateColumns: \"repeat(auto-fit, minmax(200px, 1fr))\",
    gap: \"16px\",
    alignItems: \"flex-end\",
  },
  filterGroup: {
    display: \"flex\",
    flexDirection: \"column\" as const,
  },
  label: {
    fontSize: \"0.875em\",
    fontWeight: \"bold\",
    marginBottom: \"8px\",
  },
  select: {
    padding: \"8px\",
    border: \"1px solid #ddd\",
    borderRadius: \"4px\",
    fontSize: \"0.9em\",
  },
  bulkButton: {
    backgroundColor: \"#ffcc00\",
    color: \"#1a1a1a\",
    fontWeight: \"bold\",
  },
  exportButton: {
    backgroundColor: \"#007bff\",
    color: \"white\",
    fontWeight: \"bold\",
  },
  tableWrapper: {
    overflowX: \"auto\" as const,
  },
  table: {
    width: \"100%\",
    borderCollapse: \"collapse\" as const,
  },
  tableHeader: {
    backgroundColor: \"#f9f9f9\",
    borderBottom: \"2px solid #ddd\",
  },
  tableRow: {
    borderBottom: \"1px solid #ddd\",
  },
  tableCell: {
    padding: \"12px\",
    textAlign: \"left\" as const,
  },
  statusSelect: {
    padding: \"6px 12px\",
    color: \"white\",
    border: \"none\",
    borderRadius: \"4px\",
    cursor: \"pointer\",
    fontSize: \"0.875em\",
    fontWeight: \"bold\",
  },
  statusButton: {
    padding: \"6px 12px\",
    color: \"white\",
    border: \"none\",
    borderRadius: \"4px\",
    cursor: \"pointer\",
    fontSize: \"0.875em\",
    fontWeight: \"bold\",
  },
  deleteButton: {
    padding: \"6px 12px\",
    backgroundColor: \"#dc3545\",
    color: \"white\",
    border: \"none\",
    borderRadius: \"4px\",
    cursor: \"pointer\",
  },
  actionButton: {
    padding: \"6px 12px\",
    backgroundColor: \"#28a745\",
    color: \"white\",
    border: \"none\",
    borderRadius: \"4px\",
    cursor: \"pointer\",
  },
  formGrid: {
    display: \"grid\",
    gridTemplateColumns: \"repeat(auto-fit, minmax(150px, 1fr))\",
    gap: \"16px\",
    marginBottom: \"16px\",
  },
  addButton: {
    backgroundColor: \"#ffcc00\",
    color: \"#1a1a1a\",
    fontWeight: \"bold\",
  },
  settingsForm: {
    display: \"flex\",
    flexDirection: \"column\" as const,
    gap: \"16px\",
  },
  saveButton: {
    backgroundColor: \"#ffcc00\",
    color: \"#1a1a1a\",
    fontWeight: \"bold\",
    width: \"fit-content\",
  },
};
