import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Plus, Trash2, Edit2, Download, Upload, RefreshCw } from "lucide-react";

interface Order {
  id: number;
  shortId: string;
  customerPhone: string;
  packageName: string;
  packagePrice: number;
  status: "PAID" | "PROCESSING" | "FULFILLED" | "CANCELLED";
  paymentReference?: string;
  createdAt: string;
  updatedAt?: string;
}

interface Package {
  id: number;
  packageName: string;
  dataValueGB: number;
  priceGHS: number;
  isEnabled: boolean;
}

export default function DataGodAdmin() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<"orders" | "packages" | "settings">("orders");
  const [orders, setOrders] = useState<Order[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [settings, setSettings] = useState({ whatsAppLink: "", transactionCharge: "1.3" });
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [selectedOrders, setSelectedOrders] = useState<Set<number>>(new Set());
  const [bulkStatus, setBulkStatus] = useState("");
  const [message, setMessage] = useState("");
  const [newPackage, setNewPackage] = useState({ name: "", gb: "", price: "" });
  const [editingPackage, setEditingPackage] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadOrders();
    loadPackages();
    loadSettings();
  }, []);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/datagod/orders", { credentials: "include" });
      if (response.ok) {
        const data = await response.json();
        setOrders(data.sort((a: Order, b: Order) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ));
      } else {
        console.error("Failed to load orders:", response.statusText);
      }
    } catch (error) {
      console.error("Error loading orders:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadPackages = async () => {
    try {
      const response = await fetch("/api/datagod/packages/all", { credentials: "include" });
      if (response.ok) {
        const data = await response.json();
        setPackages(data.sort((a: Package, b: Package) => a.dataValueGB - b.dataValueGB));
      } else {
        console.error("Failed to load packages:", response.statusText);
      }
    } catch (error) {
      console.error("Error loading packages:", error);
    }
  };

  const loadSettings = async () => {
    try {
      const response = await fetch("/api/settings", { credentials: "include" });
      if (response.ok) {
        const data = await response.json();
        setSettings({
          whatsAppLink: data.whatsappLink || "",
          transactionCharge: data.datagodTransactionCharge || "1.3",
        });
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  };

  const getFilteredOrders = () => {
    if (filterStatus === "ALL") return orders;
    return orders.filter(o => o.status === filterStatus);
  };

  const handleToggleOrderSelect = (orderId: number) => {
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

  const handleBulkStatusChange = async () => {
    if (selectedOrders.size === 0) {
      setMessage("Please select at least one order");
      return;
    }
    if (!bulkStatus) {
      setMessage("Please select a status");
      return;
    }

    setLoading(true);
    try {
      const updatePromises = Array.from(selectedOrders).map(orderId =>
        fetch(`/api/datagod/orders/${orderId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ status: bulkStatus }),
        })
      );

      await Promise.all(updatePromises);
      await loadOrders();
      setSelectedOrders(new Set());
      setBulkStatus("");
      setMessage(`${selectedOrders.size} orders updated to ${bulkStatus}`);
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      console.error("Error updating orders:", error);
      setMessage("Failed to update orders");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateOrderStatus = async (orderId: number, newStatus: string) => {
    try {
      const response = await fetch(`/api/datagod/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        await loadOrders();
        setMessage("Order status updated");
        setTimeout(() => setMessage(""), 2000);
      } else {
        setMessage("Failed to update order status");
      }
    } catch (error) {
      console.error("Error updating order:", error);
      setMessage("Failed to update order status");
    }
  };

  const handleAddPackage = async () => {
    if (!newPackage.name || !newPackage.gb || !newPackage.price) {
      setMessage("Please fill all fields");
      return;
    }

    try {
      const response = await fetch("/api/datagod/packages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          packageName: newPackage.name,
          dataValueGB: parseFloat(newPackage.gb),
          priceGHS: parseFloat(newPackage.price),
          isEnabled: true,
        }),
      });

      if (response.ok) {
        await loadPackages();
        setNewPackage({ name: "", gb: "", price: "" });
        setMessage("Package added");
        setTimeout(() => setMessage(""), 2000);
      } else {
        setMessage("Failed to add package");
      }
    } catch (error) {
      console.error("Error adding package:", error);
      setMessage("Failed to add package");
    }
  };

  const handleDeletePackage = async (id: number) => {
    try {
      const response = await fetch(`/api/datagod/packages/${id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (response.ok) {
        await loadPackages();
        setMessage("Package deleted");
        setTimeout(() => setMessage(""), 2000);
      } else {
        setMessage("Failed to delete package");
      }
    } catch (error) {
      console.error("Error deleting package:", error);
      setMessage("Failed to delete package");
    }
  };

  const handleTogglePackage = async (id: number, currentEnabled: boolean) => {
    try {
      const response = await fetch(`/api/datagod/packages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isEnabled: !currentEnabled }),
      });

      if (response.ok) {
        await loadPackages();
      } else {
        setMessage("Failed to update package");
      }
    } catch (error) {
      console.error("Error toggling package:", error);
      setMessage("Failed to update package");
    }
  };

  const startEditingPackage = (pkg: Package) => {
    setEditingPackage({
      id: pkg.id,
      packageName: pkg.packageName,
      dataValueGB: String(pkg.dataValueGB),
      priceGHS: String(pkg.priceGHS),
    });
  };

  const savePackageEdit = async () => {
    if (!editingPackage.packageName || !editingPackage.dataValueGB || !editingPackage.priceGHS) {
      setMessage("❌ Fill all fields");
      return;
    }

    try {
      const response = await fetch(`/api/datagod/packages/${editingPackage.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          packageName: editingPackage.packageName,
          dataValueGB: parseFloat(editingPackage.dataValueGB),
          priceGHS: parseFloat(editingPackage.priceGHS),
        }),
      });

      if (response.ok) {
        setMessage("✅ Package updated");
        setEditingPackage(null);
        loadPackages();
      } else {
        setMessage("❌ Failed to update package");
      }
    } catch (error) {
      setMessage("❌ Error updating package");
    }
  };

  const exportOrdersToCSV = () => {
    const selectedOrderObjects = orders.filter(o => selectedOrders.has(o.id));
    if (selectedOrderObjects.length === 0) {
      setMessage("Please select orders to export");
      return;
    }

    const csv = [
      ["Order ID", "Phone", "Package", "Price", "Status", "Date"].join(","),
      ...selectedOrderObjects.map(o =>
        [o.shortId, o.customerPhone, o.packageName, o.packagePrice, o.status, new Date(o.createdAt).toLocaleDateString()].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `datagod-orders-${Date.now()}.csv`;
    a.click();
    setMessage("Orders exported to CSV");
    setTimeout(() => setMessage(""), 2000);
  };

  const filteredOrders = getFilteredOrders();

  return (
    <div style={styles.body}>
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

      <main style={styles.main}>
        {message && (
          <div style={{
            ...styles.message,
            backgroundColor: message.includes("Failed") || message.includes("Please") ? "#f8d7da" : "#d4edda",
            color: message.includes("Failed") || message.includes("Please") ? "#721c24" : "#155724",
          }}>
            {message}
          </div>
        )}

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

        {activeTab === "orders" && (
          <div>
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
                    disabled={loading}
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

                  <Button
                    onClick={loadOrders}
                    disabled={loading}
                    style={styles.refreshButton}
                  >
                    <RefreshCw size={16} style={{ marginRight: "8px" }} />
                    Refresh
                  </Button>
                </div>
              </CardContent>
            </Card>

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
                      {loading ? (
                        <tr>
                          <td colSpan={8} style={{ textAlign: "center", padding: "20px", color: "#999" }}>
                            Loading...
                          </td>
                        </tr>
                      ) : filteredOrders.length === 0 ? (
                        <tr>
                          <td colSpan={8} style={{ textAlign: "center", padding: "20px", color: "#999" }}>
                            No orders found
                          </td>
                        </tr>
                      ) : (
                        filteredOrders.map((order) => (
                          <tr key={order.id} style={styles.tableRow}>
                            <td style={styles.tableCell}>
                              <input
                                type="checkbox"
                                checked={selectedOrders.has(order.id)}
                                onChange={() => handleToggleOrderSelect(order.id)}
                              />
                            </td>
                            <td style={styles.tableCell}>{order.shortId}</td>
                            <td style={styles.tableCell}>{order.customerPhone}</td>
                            <td style={styles.tableCell}>{order.packageName}</td>
                            <td style={styles.tableCell}>GH₵{order.packagePrice}</td>
                            <td style={styles.tableCell}>
                              <select
                                value={order.status}
                                onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value)}
                                style={{
                                  ...styles.statusSelect,
                                  backgroundColor: order.status === "FULFILLED" ? "#28a745" : order.status === "PROCESSING" ? "#ffc107" : order.status === "PAID" ? "#007bff" : "#dc3545",
                                }}
                              >
                                <option value="PAID">Paid</option>
                                <option value="PROCESSING">Processing</option>
                                <option value="FULFILLED">Fulfilled</option>
                                <option value="CANCELLED">Cancelled</option>
                              </select>
                            </td>
                            <td style={styles.tableCell}>{new Date(order.createdAt).toLocaleDateString()}</td>
                            <td style={styles.tableCell}>
                              <button
                                onClick={() => handleUpdateOrderStatus(order.id, "FULFILLED")}
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

        {activeTab === "packages" && (
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
                      placeholder="e.g., 1GB"
                      value={newPackage.name}
                      onChange={(e) => setNewPackage({ ...newPackage, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={styles.label}>Data (GB)</label>
                    <Input
                      type="number"
                      placeholder="e.g., 1"
                      value={newPackage.gb}
                      onChange={(e) => setNewPackage({ ...newPackage, gb: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={styles.label}>Price (GH₵)</label>
                    <Input
                      type="number"
                      placeholder="e.g., 2.5"
                      value={newPackage.price}
                      onChange={(e) => setNewPackage({ ...newPackage, price: e.target.value })}
                    />
                  </div>
                </div>
                <Button onClick={handleAddPackage} style={styles.addButton}>
                  <Plus size={18} style={{ marginRight: "8px" }} />
                  Add Package
                </Button>
              </CardContent>
            </Card>

            <Card style={styles.card}>
              <CardHeader>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <CardTitle>Manage Packages</CardTitle>
                  <Button onClick={loadPackages} size="sm" variant="outline">
                    <RefreshCw size={16} style={{ marginRight: "8px" }} />
                    Refresh
                  </Button>
                </div>
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
                      {packages.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ textAlign: "center", padding: "20px", color: "#999" }}>
                            No packages found
                          </td>
                        </tr>
                      ) : (
                        packages.map((pkg) => (
                          <tr key={pkg.id} style={styles.tableRow}>
                            <td style={styles.tableCell}>{pkg.packageName}</td>
                            <td style={styles.tableCell}>{pkg.dataValueGB}</td>
                            <td style={styles.tableCell}>{pkg.priceGHS}</td>
                            <td style={styles.tableCell}>
                              <button
                                onClick={() => handleTogglePackage(pkg.id, pkg.isEnabled)}
                                style={{
                                  ...styles.statusButton,
                                  backgroundColor: pkg.isEnabled ? "#28a745" : "#dc3545",
                                }}
                              >
                                {pkg.isEnabled ? "Enabled" : "Disabled"}
                              </button>
                            </td>
                            <td style={styles.tableCell}>
                              <div style={{ display: "flex", gap: "5px" }}>
                                <button
                                  onClick={() => startEditingPackage(pkg)}
                                  style={{ ...styles.editButton, flex: 1 }}
                                  title="Edit this package"
                                >
                                  ✎ Edit
                                </button>
                                <button
                                  onClick={() => handleDeletePackage(pkg.id)}
                                  style={styles.deleteButton}
                                  title="Delete this package"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {editingPackage && (
              <Card style={styles.card}>
                <CardHeader>
                  <CardTitle>Edit Package</CardTitle>
                </CardHeader>
                <CardContent>
                  <div style={styles.formGrid}>
                    <Input
                      type="text"
                      placeholder="Package Name"
                      value={editingPackage.packageName}
                      onChange={(e) => setEditingPackage({ ...editingPackage, packageName: e.target.value })}
                    />
                    <Input
                      type="number"
                      placeholder="Data (GB)"
                      value={editingPackage.dataValueGB}
                      onChange={(e) => setEditingPackage({ ...editingPackage, dataValueGB: e.target.value })}
                    />
                    <Input
                      type="number"
                      placeholder="Price (GH₵)"
                      value={editingPackage.priceGHS}
                      onChange={(e) => setEditingPackage({ ...editingPackage, priceGHS: e.target.value })}
                    />
                  </div>
                  <div style={{ display: "flex", gap: "10px", marginTop: "15px" }}>
                    <Button onClick={savePackageEdit} style={styles.saveButton}>
                      Save Changes
                    </Button>
                    <Button onClick={() => setEditingPackage(null)} style={styles.cancelButton}>
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {activeTab === "settings" && (
          <Card style={styles.card}>
            <CardHeader>
              <CardTitle>Platform Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <div style={styles.settingsForm}>
                <div>
                  <label style={styles.label}>WhatsApp Link</label>
                  <Input
                    type="url"
                    placeholder="https://wa.link/..."
                    value={settings.whatsAppLink}
                    onChange={(e) => setSettings({ ...settings, whatsAppLink: e.target.value })}
                  />
                </div>
                <div>
                  <label style={styles.label}>Transaction Charge (%)</label>
                  <Input
                    type="number"
                    placeholder="1.3"
                    value={settings.transactionCharge}
                    onChange={(e) => setSettings({ ...settings, transactionCharge: e.target.value })}
                  />
                  <p style={{ fontSize: "0.8em", color: "#666", marginTop: "5px" }}>
                    Percentage charge added to each transaction
                  </p>
                </div>
                <Button
                  onClick={async () => {
                    try {
                      const response = await fetch("/api/settings", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        credentials: "include",
                        body: JSON.stringify({
                          whatsappLink: settings.whatsAppLink,
                          datagodTransactionCharge: settings.transactionCharge,
                        }),
                      });
                      if (response.ok) {
                        setMessage("Settings saved");
                      } else {
                        setMessage("Failed to save settings");
                      }
                    } catch (error) {
                      console.error("Error saving settings:", error);
                      setMessage("Failed to save settings");
                    }
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
    maxWidth: "1400px",
    margin: "0 auto",
    padding: "16px 20px",
    display: "flex",
    alignItems: "center",
  },
  h1: {
    fontSize: "1.5em",
    fontWeight: "bold",
    color: "#ffcc00",
    margin: 0,
  },
  main: {
    maxWidth: "1400px",
    margin: "0 auto",
    padding: "32px 20px",
  },
  tabs: {
    display: "flex",
    gap: "8px",
    marginBottom: "24px",
    borderBottom: "1px solid #ddd",
  },
  tab: {
    padding: "12px 24px",
    border: "none",
    background: "none",
    cursor: "pointer",
    fontSize: "1em",
    color: "#333",
  },
  card: {
    marginBottom: "24px",
    backgroundColor: "white",
    borderRadius: "8px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
  },
  message: {
    padding: "12px 16px",
    borderRadius: "6px",
    marginBottom: "16px",
    fontWeight: "500",
  },
  filterSection: {
    display: "flex",
    flexWrap: "wrap",
    gap: "16px",
    alignItems: "flex-end",
  },
  filterGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  label: {
    fontSize: "0.875em",
    fontWeight: "500",
    color: "#555",
  },
  select: {
    padding: "8px 12px",
    borderRadius: "6px",
    border: "1px solid #ddd",
    fontSize: "0.875em",
    minWidth: "150px",
  },
  bulkButton: {
    backgroundColor: "#007bff",
    color: "white",
  },
  exportButton: {
    backgroundColor: "#28a745",
    color: "white",
  },
  refreshButton: {
    backgroundColor: "#6c757d",
    color: "white",
  },
  tableWrapper: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "0.875em",
  },
  tableHeader: {
    backgroundColor: "#f8f9fa",
    borderBottom: "2px solid #dee2e6",
  },
  tableRow: {
    borderBottom: "1px solid #dee2e6",
  },
  tableCell: {
    padding: "12px",
    textAlign: "left",
  },
  statusSelect: {
    padding: "4px 8px",
    borderRadius: "4px",
    border: "none",
    color: "white",
    fontWeight: "bold",
    fontSize: "0.75em",
    cursor: "pointer",
  },
  actionButton: {
    padding: "4px 12px",
    backgroundColor: "#28a745",
    color: "white",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    fontWeight: "bold",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "16px",
    marginBottom: "16px",
  },
  addButton: {
    backgroundColor: "#007bff",
    color: "white",
  },
  statusButton: {
    padding: "4px 12px",
    border: "none",
    borderRadius: "4px",
    color: "white",
    fontWeight: "bold",
    fontSize: "0.75em",
    cursor: "pointer",
  },
  deleteButton: {
    padding: "8px",
    backgroundColor: "#dc3545",
    color: "white",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  editButton: {
    padding: "8px",
    backgroundColor: "#28a745",
    color: "white",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "0.75em",
  },
  cancelButton: {
    backgroundColor: "#6c757d",
    color: "white",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: "15px",
    marginBottom: "20px",
  },
  settingsForm: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    maxWidth: "400px",
  },
  saveButton: {
    backgroundColor: "#28a745",
    color: "white",
    marginTop: "8px",
  },
};
