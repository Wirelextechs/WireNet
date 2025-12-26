import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Plus, Trash2, RefreshCw } from "lucide-react";

interface Order {
  id: string;
  shortId: string;
  customerPhone: string;
  packageDetails: string;
  packagePrice: number;
  status: "PAID" | "PROCESSING" | "FULFILLED" | "CANCELLED" | "FAILED";
  supplierUsed?: string;
  createdAt: Date;
  shopId?: number;
  shopName?: string;
  shopMarkup?: number;
}

interface Package {
  id: string;
  dataAmount: string;
  price: number;
  deliveryTime: string;
  isEnabled: boolean;
}

export default function AtAdmin() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<"dashboard" | "orders" | "packages" | "settings">("dashboard");
  const [orders, setOrders] = useState<Order[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [newPackage, setNewPackage] = useState({ amount: "", price: "", delivery: "" });
  const [editingPackage, setEditingPackage] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [settings, setSettings] = useState({ transactionCharge: "1.3" });
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadOrders();
    loadPackages();
    loadSettings();
  }, []);

  const loadOrders = async () => {
    try {
      console.log("📥 Fetching AT orders from /api/at/orders");
      const response = await fetch("/api/at/orders", { credentials: "include" });
      console.log("📥 Response status:", response.status);
      if (response.ok) {
        const data = await response.json();
        console.log("📥 Raw data received:", data);
        const mappedOrders = data.map((o: any) => ({ 
          ...o, 
          id: String(o.id),
          shortId: o.shortId || o.short_id,
          customerPhone: o.customerPhone || o.customer_phone,
          packageDetails: o.packageDetails || o.package_details,
          packagePrice: o.packagePrice || o.package_price,
          supplierUsed: o.supplierUsed || o.supplier_used,
          createdAt: new Date(o.createdAt || o.created_at) 
        }));
        console.log("📥 Mapped orders:", mappedOrders);
        setOrders(mappedOrders);
      } else {
        console.error("📥 Failed to fetch orders. Response:", await response.text());
      }
    } catch (error) {
      console.error("Error loading orders:", error);
    }
  };

  const loadPackages = async () => {
    try {
      const response = await fetch("/api/at/packages", { credentials: "include" });
      if (response.ok) {
        const data = await response.json();
        setPackages(data);
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
        setSettings({ transactionCharge: data.atTransactionCharge || "1.3" });
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  };

  const handleSaveSettings = async () => {
    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          atTransactionCharge: settings.transactionCharge,
        }),
      });
      if (response.ok) {
        setMessage("✅ Settings saved");
      } else {
        setMessage("❌ Failed to save settings");
      }
    } catch (error) {
      setMessage("❌ Failed to save settings");
    }
    setTimeout(() => setMessage(""), 2000);
  };

  const refreshAllOrderStatus = async () => {
    setIsRefreshing(true);
    setMessage("🔄 Refreshing order statuses...");
    try {
      const response = await fetch("/api/at/orders/refresh/all", {
        method: "POST",
        credentials: "include",
      });
      if (response.ok) {
        setMessage("✅ Order statuses updated");
        loadOrders();
      } else {
        setMessage("❌ Failed to refresh statuses");
      }
    } catch (error) {
      setMessage("❌ Error refreshing statuses");
    } finally {
      setIsRefreshing(false);
      setTimeout(() => setMessage(""), 3000);
    }
  };

  const refreshSingleOrderStatus = async (orderId: string) => {
    try {
      const response = await fetch(`/api/at/orders/${orderId}/refresh`, {
        method: "POST",
        credentials: "include",
      });
      if (response.ok) {
        const result = await response.json();
        setMessage(`✅ ${result.message}`);
        loadOrders();
      } else {
        setMessage("❌ Failed to refresh order");
      }
    } catch (error) {
      setMessage("❌ Error refreshing order");
    }
    setTimeout(() => setMessage(""), 3000);
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/at/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: newStatus }),
      });
      if (response.ok) {
        setMessage(`✅ Order updated to ${newStatus}`);
        loadOrders();
      } else {
        setMessage("❌ Failed to update order");
      }
    } catch (error) {
      setMessage("❌ Error updating order");
    }
    setTimeout(() => setMessage(""), 3000);
  };

  const addPackage = async () => {
    if (!newPackage.amount || !newPackage.price || !newPackage.delivery) {
      setMessage("❌ Fill all fields");
      return;
    }

    try {
      const response = await fetch("/api/at/packages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          dataAmount: newPackage.amount,
          price: parseFloat(newPackage.price),
          deliveryTime: newPackage.delivery,
        }),
      });

      if (response.ok) {
        setNewPackage({ amount: "", price: "", delivery: "" });
        setMessage("✅ Package added");
        loadPackages();
        setTimeout(() => setMessage(""), 2000);
      } else {
        setMessage("❌ Failed to add package");
      }
    } catch (error) {
      setMessage("❌ Error adding package");
    }
  };

  const deletePackage = async (id: string) => {
    if (!confirm("Delete this package?")) return;
    try {
      const response = await fetch(`/api/at/packages/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (response.ok) {
        setMessage("✅ Package deleted");
        loadPackages();
      } else {
        setMessage("❌ Failed to delete package");
      }
    } catch (error) {
      setMessage("❌ Error deleting package");
    }
  };

  const startEditingPackage = (pkg: Package) => {
    setEditingPackage({
      id: pkg.id,
      dataAmount: pkg.dataAmount,
      price: String(pkg.price),
      deliveryTime: pkg.deliveryTime,
    });
  };

  const savePackageEdit = async () => {
    if (!editingPackage.dataAmount || !editingPackage.price || !editingPackage.deliveryTime) {
      setMessage("❌ Fill all fields");
      return;
    }

    try {
      const response = await fetch(`/api/at/packages/${editingPackage.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          dataAmount: editingPackage.dataAmount,
          price: parseFloat(editingPackage.price),
          deliveryTime: editingPackage.deliveryTime,
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "FULFILLED": return "#28a745";
      case "PROCESSING": return "#ffc107";
      case "PAID": return "#17a2b8";
      case "FAILED": return "#dc3545";
      default: return "#6c757d";
    }
  };

  const getFilteredOrders = () => {
    let filtered = orders;
    
    // Apply status filter
    if (filterStatus !== "ALL") {
      filtered = filtered.filter(o => o.status === filterStatus);
    }
    
    // Apply search filter (by Order ID or Phone Number)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(o => 
        o.shortId.toLowerCase().includes(query) || 
        o.customerPhone.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  };

  const filteredOrders = getFilteredOrders();

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <Button variant="ghost" onClick={() => navigate("/admin")} style={styles.backButton}>
          <ArrowLeft size={20} />
          Back to Dashboard
        </Button>
        <h1 style={styles.title}>AT ISHARE Admin Panel</h1>
      </div>

      {message && (
        <div style={styles.message}>{message}</div>
      )}

      {/* Tabs */}
      <div style={styles.tabs}>
        {["dashboard", "orders", "packages", "settings"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            style={{
              ...styles.tab,
              ...(activeTab === tab ? styles.tabActive : {}),
            }}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Dashboard Tab */}
      {activeTab === "dashboard" && (
        <div style={styles.gridContainer}>
          <Card style={{ ...styles.card, ...styles.statsCard }}>
            <CardHeader>
              <CardTitle style={styles.statsValue}>{orders.length}</CardTitle>
              <CardDescription>Total Orders</CardDescription>
            </CardHeader>
          </Card>
          <Card style={{ ...styles.card, ...styles.statsCard }}>
            <CardHeader>
              <CardTitle style={styles.statsValue}>{orders.filter(o => o.status === "FULFILLED").length}</CardTitle>
              <CardDescription>Fulfilled Orders</CardDescription>
            </CardHeader>
          </Card>
          <Card style={{ ...styles.card, ...styles.statsCard }}>
            <CardHeader>
              <CardTitle style={styles.statsValue}>{packages.length}</CardTitle>
              <CardDescription>Available Packages</CardDescription>
            </CardHeader>
          </Card>
          <Card style={{ ...styles.card, ...styles.statsCard }}>
            <CardHeader>
              <CardTitle style={styles.statsValue}>{settings.transactionCharge}%</CardTitle>
              <CardDescription>Transaction Charge</CardDescription>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* Orders Tab */}
      {activeTab === "orders" && (
        <Card style={styles.card}>
          <CardHeader>
            <CardTitle style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>Recent Orders</span>
              <Button 
                onClick={refreshAllOrderStatus} 
                disabled={isRefreshing}
                style={{ ...styles.refreshButton, opacity: isRefreshing ? 0.6 : 1 }}
              >
                <RefreshCw size={18} style={{ marginRight: "5px" }} />
                {isRefreshing ? "Refreshing..." : "Refresh All"}
              </Button>
            </CardTitle>
            <div style={styles.filterContainer}>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                style={styles.filterSelect}
              >
                <option value="ALL">All Statuses</option>
                <option value="FULFILLED">Fulfilled</option>
                <option value="PROCESSING">Processing</option>
                <option value="PAID">Paid</option>
                <option value="FAILED">Failed</option>
              </select>
              <input
                type="text"
                placeholder="Search by Order ID or Phone Number"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={styles.filterSelect}
              />
            </div>
          </CardHeader>
          <CardContent>
            {filteredOrders.length === 0 ? (
              <p style={styles.noData}>No orders found</p>
            ) : (
              <div style={styles.table}>
                <div style={styles.tableHeader}>
                  <div style={{ ...styles.tableCell, fontWeight: "bold" }}>Order ID</div>
                  <div style={{ ...styles.tableCell, fontWeight: "bold" }}>Phone</div>
                  <div style={{ ...styles.tableCell, fontWeight: "bold" }}>Package</div>
                  <div style={{ ...styles.tableCell, fontWeight: "bold" }}>Price</div>
                  <div style={{ ...styles.tableCell, fontWeight: "bold" }}>Shop</div>
                  <div style={{ ...styles.tableCell, fontWeight: "bold" }}>Status</div>
                  <div style={{ ...styles.tableCell, fontWeight: "bold" }}>Date</div>
                  <div style={{ ...styles.tableCell, fontWeight: "bold" }}>Action</div>
                </div>
                {filteredOrders.map((order) => (
                  <div key={order.id} style={styles.tableRow}>
                    <div style={styles.tableCell}>{order.shortId}</div>
                    <div style={styles.tableCell}>{order.customerPhone}</div>
                    <div style={styles.tableCell}>{order.packageDetails}</div>
                    <div style={styles.tableCell}>GH₵{order.packagePrice}</div>
                    <div style={styles.tableCell}>{order.shopName || "-"}</div>
                    <div style={styles.tableCell}>
                      <select
                        value={order.status}
                        onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                        style={{
                          padding: "4px 8px",
                          borderRadius: "4px",
                          border: "1px solid #ccc",
                          backgroundColor: getStatusColor(order.status),
                          color: "white",
                          fontWeight: "bold",
                          cursor: "pointer",
                        }}
                      >
                        <option value="PROCESSING">PROCESSING</option>
                        <option value="FULFILLED">FULFILLED</option>
                        <option value="PAID">PAID</option>
                        <option value="FAILED">FAILED</option>
                        <option value="CANCELLED">CANCELLED</option>
                      </select>
                    </div>
                    <div style={styles.tableCell}>{order.createdAt.toLocaleString()}</div>
                    <div style={styles.tableCell}>
                      <Button 
                        onClick={() => refreshSingleOrderStatus(order.id)}
                        style={styles.actionButton}
                        title="Refresh this order's status"
                      >
                        <RefreshCw size={16} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Packages Tab */}
      {activeTab === "packages" && (
        <div style={styles.gridContainer}>
          <Card style={styles.card}>
            <CardHeader>
              <CardTitle>Add New Package</CardTitle>
            </CardHeader>
            <CardContent>
              <div style={styles.formGrid}>
                <Input
                  type="text"
                  placeholder="Amount (e.g., 1GB)"
                  value={newPackage.amount}
                  onChange={(e) => setNewPackage({ ...newPackage, amount: e.target.value })}
                />
                <Input
                  type="number"
                  placeholder="Price (GH₵)"
                  value={newPackage.price}
                  onChange={(e) => setNewPackage({ ...newPackage, price: e.target.value })}
                />
                <Input
                  type="text"
                  placeholder="Delivery Time (e.g., 5-20 mins)"
                  value={newPackage.delivery}
                  onChange={(e) => setNewPackage({ ...newPackage, delivery: e.target.value })}
                />
              </div>
              <Button onClick={addPackage} style={styles.addButton}>
                <Plus size={18} />
                Add Package
              </Button>
            </CardContent>
          </Card>

          <Card style={styles.card}>
            <CardHeader>
              <CardTitle>Existing Packages</CardTitle>
            </CardHeader>
            <CardContent>
              {packages.length === 0 ? (
                <p style={styles.noData}>No packages yet</p>
              ) : (
                <div style={styles.packagesList}>
                  {packages.map((pkg) => (
                    <div key={pkg.id} style={styles.packageItem}>
                      <div>
                        <p style={styles.packageName}>{pkg.dataAmount}</p>
                        <p style={styles.packagePrice}>GH₵{pkg.price}</p>
                        <p style={styles.packageDelivery}>{pkg.deliveryTime}</p>
                      </div>
                      <div style={styles.actionButtons}>
                        <Button
                          onClick={() => startEditingPackage(pkg)}
                          style={{ ...styles.editButton, marginRight: "8px" }}
                          title="Edit this package"
                        >
                          ✎ Edit
                        </Button>
                        <Button
                          onClick={() => deletePackage(pkg.id)}
                          style={styles.deleteButton}
                          title="Delete this package"
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
                    placeholder="Amount (e.g., 1GB)"
                    value={editingPackage.dataAmount}
                    onChange={(e) => setEditingPackage({ ...editingPackage, dataAmount: e.target.value })}
                  />
                  <Input
                    type="number"
                    placeholder="Price (GH₵)"
                    value={editingPackage.price}
                    onChange={(e) => setEditingPackage({ ...editingPackage, price: e.target.value })}
                  />
                  <Input
                    type="text"
                    placeholder="Delivery Time (e.g., Instant)"
                    value={editingPackage.deliveryTime}
                    onChange={(e) => setEditingPackage({ ...editingPackage, deliveryTime: e.target.value })}
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

      {/* Settings Tab */}
      {activeTab === "settings" && (
        <Card style={styles.card}>
          <CardHeader>
            <CardTitle>Transaction Settings</CardTitle>
          </CardHeader>
          <CardContent style={styles.settingsForm}>
            <div>
              <label style={styles.label}>Transaction Charge (%)</label>
              <Input
                type="number"
                step="0.1"
                value={settings.transactionCharge}
                onChange={(e) => setSettings({ ...settings, transactionCharge: e.target.value })}
              />
              <p style={styles.helpText}>Applied to all AT orders</p>
            </div>
            <Button onClick={handleSaveSettings} style={styles.saveButton}>
              Save Settings
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

const styles: any = {
  container: {
    minHeight: "100vh",
    backgroundColor: "#f5f5f5",
    padding: "20px",
  },
  header: {
    marginBottom: "30px",
  },
  backButton: {
    marginBottom: "15px",
  },
  title: {
    fontSize: "2em",
    fontWeight: "bold",
    color: "#dc2626",
    margin: 0,
  },
  message: {
    marginBottom: "20px",
    padding: "15px",
    borderRadius: "8px",
    backgroundColor: "#d4edda",
    color: "#155724",
    border: "1px solid #c3e6cb",
  },
  tabs: {
    display: "flex",
    gap: "10px",
    marginBottom: "20px",
    borderBottom: "2px solid #ddd",
  },
  tab: {
    padding: "12px 20px",
    backgroundColor: "transparent",
    border: "none",
    cursor: "pointer",
    fontSize: "1em",
    fontWeight: "500",
    color: "#666",
    borderBottom: "3px solid transparent",
    transition: "all 0.3s",
  },
  tabActive: {
    color: "#dc2626",
    borderBottomColor: "#dc2626",
  },
  gridContainer: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))",
    gap: "20px",
  },
  card: {
    borderRadius: "8px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
  },
  statsCard: {
    backgroundColor: "#fff",
    padding: "20px",
  },
  statsValue: {
    fontSize: "2.5em",
    fontWeight: "bold",
    color: "#dc2626",
    margin: "0",
  },
  filterContainer: {
    marginTop: "15px",
  },
  filterSelect: {
    padding: "8px 12px",
    borderRadius: "4px",
    border: "1px solid #ddd",
    cursor: "pointer",
  },
  table: {
    overflowX: "auto",
  },
  tableHeader: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    gap: "15px",
    padding: "15px",
    backgroundColor: "#f9f9f9",
    borderRadius: "4px 4px 0 0",
    borderBottom: "2px solid #ddd",
    fontWeight: "bold",
  },
  tableRow: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    gap: "15px",
    padding: "15px",
    borderBottom: "1px solid #ddd",
    alignItems: "center",
  },
  tableCell: {
    padding: "12px 0",
  },
  statusBadge: {
    padding: "4px 12px",
    color: "white",
    borderRadius: "4px",
    fontSize: "0.875em",
    fontWeight: "bold",
  },
  noData: {
    textAlign: "center" as const,
    padding: "40px",
    color: "#999",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: "15px",
    marginBottom: "20px",
  },
  addButton: {
    backgroundColor: "#dc2626",
    color: "white",
  },
  packagesList: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: "15px",
  },
  packageItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "15px",
    backgroundColor: "#f9f9f9",
    borderRadius: "4px",
    border: "1px solid #ddd",
  },
  actionButtons: {
    display: "flex",
    gap: "5px",
  },
  packageName: {
    fontSize: "1.2em",
    fontWeight: "bold",
    color: "#dc2626",
    margin: "0 0 5px 0",
  },
  packagePrice: {
    fontSize: "1em",
    fontWeight: "bold",
    color: "#333",
    margin: "0",
  },
  packageDelivery: {
    fontSize: "0.85em",
    color: "#666",
    margin: "5px 0 0 0",
  },
  deleteButton: {
    backgroundColor: "#dc3545",
    color: "white",
  },
  editButton: {
    backgroundColor: "#28a745",
    color: "white",
    padding: "4px 8px",
    fontSize: "0.75em",
  },
  cancelButton: {
    backgroundColor: "#6c757d",
    color: "white",
  },
  settingsForm: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "20px",
  },
  label: {
    fontWeight: "bold",
    marginBottom: "8px",
    display: "block",
  },
  helpText: {
    fontSize: "0.85em",
    color: "#666",
    marginTop: "5px",
  },
  saveButton: {
    backgroundColor: "#dc2626",
    color: "white",
    width: "fit-content",
  },
  refreshButton: {
    backgroundColor: "#dc2626",
    color: "white",
    display: "flex",
    alignItems: "center",
    gap: "5px",
  },
  actionButton: {
    backgroundColor: "#dc2626",
    color: "white",
    padding: "4px 8px",
    fontSize: "0.75em",
  },
};
