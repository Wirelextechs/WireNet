import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Plus, Trash2, ShoppingCart, Package as PackageIcon, Clock, CheckCircle2, Settings as SettingsIcon, RefreshCw, Search } from "lucide-react";
import { packagesAPI } from "@/lib/supabase";

interface Order {
  id: string;
  shortId: string;
  customerPhone: string;
  packageDetails: string;
  packagePrice: number;
  status: "PAID" | "PROCESSING" | "FULFILLED" | "CANCELLED" | "FAILED";
  supplierUsed?: string;
  createdAt: Date;
}

interface Package {
  id: string;
  dataAmount: string;
  price: number;
  deliveryTime: string;
  isEnabled: boolean;
}

type Supplier = "dataxpress" | "hubnet" | "dakazina";

interface WalletBalance {
  balance: string;
  currency: string;
}

export default function FastNetAdmin() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<"dashboard" | "orders" | "packages" | "settings">("dashboard");
  const [orders, setOrders] = useState<Order[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [newPackage, setNewPackage] = useState({ amount: "", price: "", delivery: "" });
  const [message, setMessage] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState("");
  const [activeSupplier, setActiveSupplier] = useState<Supplier>("dataxpress");
  const [checkingStatus, setCheckingStatus] = useState<string | null>(null);
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [walletBalances, setWalletBalances] = useState<{
    dataxpress: WalletBalance;
    hubnet: WalletBalance;
    dakazina: WalletBalance;
  }>({
    dataxpress: { balance: "...", currency: "" },
    hubnet: { balance: "...", currency: "" },
    dakazina: { balance: "...", currency: "" },
  });
  const [settings, setSettings] = useState({ transactionCharge: "1.3" });

  useEffect(() => {
    loadOrders();
    loadPackages();
    loadSettings();
    fetchWalletBalances();
  }, []);

  const fetchWalletBalances = async () => {
    try {
      const response = await fetch("/api/fastnet/balances");
      if (response.ok) {
        const data = await response.json();
        
        const formatBalance = (supplierData: any) => {
          if (!supplierData || !supplierData.success) return "Error";
          const balance = parseFloat(supplierData.balance);
          return isNaN(balance) ? "0.00" : balance.toFixed(2);
        };

        setWalletBalances({
          dataxpress: { 
            balance: formatBalance(data.dataxpress), 
            currency: data.dataxpress?.currency || "GH₵" 
          },
          hubnet: { 
            balance: formatBalance(data.hubnet), 
            currency: data.hubnet?.currency || "GH₵" 
          },
          dakazina: { 
            balance: formatBalance(data.dakazina), 
            currency: data.dakazina?.currency || "GH₵" 
          },
        });
      }
    } catch (error) {
      console.error("Error fetching wallet balances:", error);
    }
  };

  const loadOrders = async () => {
    try {
      const response = await fetch("/api/fastnet/orders");
      if (response.ok) {
        const data = await response.json();
        setOrders(data.map((o: any) => ({ 
          ...o, 
          id: String(o.id),
          shortId: o.shortId || o.short_id,
          customerPhone: o.customerPhone || o.customer_phone,
          packageDetails: o.packageDetails || o.package_details,
          packagePrice: o.packagePrice || o.package_price,
          supplierUsed: o.supplierUsed || o.supplier_used,
          createdAt: new Date(o.createdAt || o.created_at) 
        })));
      } else if (response.status === 401) {
        console.log("Not authenticated - orders will be empty until login");
        setOrders([]);
      } else {
        console.error("Failed to load orders from API");
        setOrders([]);
      }
    } catch (error) {
      console.error("Error loading orders:", error);
      setOrders([]);
    }
  };

  const loadPackages = async () => {
    try {
      const data = await packagesAPI.getAll("fastnet");
      if (data && data.length > 0) {
        setPackages(data);
      } else {
        setPackages([]);
      }
    } catch (error) {
      console.error("Error loading packages from Supabase:", error);
      setPackages([]);
    }
  };

  const loadSettings = () => {
    try {
      const saved = localStorage.getItem("fastnetSettings");
      if (saved) {
        const parsed = JSON.parse(saved);
        setActiveSupplier(parsed.activeSupplier || "dataxpress");
        setSettings({ transactionCharge: parsed.transactionCharge || "1.3" });
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  };

  const handleSupplierChange = (supplier: Supplier) => {
    setActiveSupplier(supplier);
    const currentSettings = JSON.parse(localStorage.getItem("fastnetSettings") || "{}");
    localStorage.setItem("fastnetSettings", JSON.stringify({ ...currentSettings, activeSupplier: supplier }));
    
    fetch("/api/fastnet/supplier", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ supplier }),
    }).catch(console.error);

    setMessage(`✅ Active supplier changed to ${supplier.toUpperCase()}`);
    setTimeout(() => setMessage(""), 3000);
  };

  const handleSaveSettings = () => {
    const currentSettings = JSON.parse(localStorage.getItem("fastnetSettings") || "{}");
    localStorage.setItem("fastnetSettings", JSON.stringify({
      ...currentSettings,
      transactionCharge: settings.transactionCharge,
    }));
    setMessage("✅ Settings saved");
    setTimeout(() => setMessage(""), 2000);
  };

  // --- Dashboard Stats ---
  const totalRevenue = orders.reduce((sum, o) => sum + (o.packagePrice || 0), 0);
  const pendingCount = orders.filter(o => o.status === "PROCESSING" || o.status === "PAID").length;
  const completedCount = orders.filter(o => o.status === "FULFILLED").length;

  // --- Order Management ---
  const getFilteredOrders = () => {
    if (filterStatus === "ALL") return orders;
    return orders.filter(o => o.status === filterStatus);
  };

  const handleToggleOrderSelect = (orderId: string) => {
    const newSelected = new Set(selectedOrders);
    if (newSelected.has(orderId)) newSelected.delete(orderId);
    else newSelected.add(orderId);
    setSelectedOrders(newSelected);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) setSelectedOrders(new Set(getFilteredOrders().map(o => o.id)));
    else setSelectedOrders(new Set());
  };

  const handleBulkStatusChange = async () => {
    if (selectedOrders.size === 0 || !bulkStatus) return;
    
    try {
      const updatePromises = Array.from(selectedOrders).map(orderId =>
        fetch(`/api/fastnet/orders/${orderId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: bulkStatus }),
        })
      );
      
      await Promise.all(updatePromises);
      
      const updated = orders.map(o => selectedOrders.has(o.id) ? { ...o, status: bulkStatus as any } : o);
      setOrders(updated);
      setSelectedOrders(new Set());
      setBulkStatus("");
      setMessage(`✅ ${selectedOrders.size} orders updated`);
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      console.error("Error updating orders:", error);
      setMessage("❌ Failed to update orders");
      setTimeout(() => setMessage(""), 3000);
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/fastnet/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      
      if (response.ok) {
        const updated = orders.map(o => o.id === orderId ? { ...o, status: newStatus as any } : o);
        setOrders(updated);
        setMessage("✅ Order status updated");
      } else {
        setMessage("❌ Failed to update order");
      }
      setTimeout(() => setMessage(""), 2000);
    } catch (error) {
      console.error("Error updating order:", error);
      setMessage("❌ Failed to update order");
      setTimeout(() => setMessage(""), 2000);
    }
  };

  const handleCheckOrderStatus = async (orderId: string) => {
    setCheckingStatus(orderId);
    try {
      const response = await fetch(`/api/fastnet/orders/${orderId}/check-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setMessage(`✅ Status from ${result.supplier}: ${result.supplierStatus}`);
          await loadOrders(); // Reload orders to get updated status
        } else {
          setMessage(`⚠️ ${result.message || "Could not check status"}`);
        }
      } else {
        const error = await response.json();
        setMessage(`❌ ${error.message || "Failed to check status"}`);
      }
    } catch (error) {
      console.error("Error checking order status:", error);
      setMessage("❌ Failed to check order status");
    } finally {
      setCheckingStatus(null);
      setTimeout(() => setMessage(""), 3000);
    }
  };

  const handleRefreshAllStatuses = async () => {
    setRefreshingAll(true);
    try {
      const response = await fetch("/api/fastnet/orders/refresh-all-statuses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      
      if (response.ok) {
        const result = await response.json();
        setMessage(`✅ ${result.message}`);
        await loadOrders(); // Reload orders to get updated statuses
      } else {
        const error = await response.json();
        setMessage(`❌ ${error.message || "Failed to refresh statuses"}`);
      }
    } catch (error) {
      console.error("Error refreshing all statuses:", error);
      setMessage("❌ Failed to refresh all statuses");
    } finally {
      setRefreshingAll(false);
      setTimeout(() => setMessage(""), 3000);
    }
  };

  // --- Package Management ---
  const handleAddPackage = async () => {
    if (!newPackage.amount || !newPackage.price || !newPackage.delivery) {
      setMessage("❌ Please fill all fields");
      return;
    }
    try {
      const dataAmountNum = parseInt(newPackage.amount.replace(/\D/g, ''));
      await packagesAPI.create({
        category: 'fastnet',
        data_amount: dataAmountNum,
        price: parseFloat(newPackage.price),
        delivery_time: newPackage.delivery,
        enabled: true,
      });
      await loadPackages();
      setNewPackage({ amount: "", price: "", delivery: "" });
      setMessage("✅ Package added");
      setTimeout(() => setMessage(""), 2000);
    } catch (error) {
      console.error("Error adding package:", error);
      setMessage("❌ Failed to add package");
      setTimeout(() => setMessage(""), 2000);
    }
  };

  const handleDeletePackage = async (id: string) => {
    try {
      await packagesAPI.delete(id);
      await loadPackages();
      setMessage("✅ Package deleted");
      setTimeout(() => setMessage(""), 2000);
    } catch (error) {
      console.error("Error deleting package:", error);
      setMessage("❌ Failed to delete package");
      setTimeout(() => setMessage(""), 2000);
    }
  };

  const handleTogglePackage = async (id: string) => {
    try {
      const pkg = packages.find(p => p.id === id);
      if (pkg) {
        await packagesAPI.toggle(id, !pkg.isEnabled);
        await loadPackages();
      }
    } catch (error) {
      console.error("Error toggling package:", error);
      setMessage("❌ Failed to update package");
      setTimeout(() => setMessage(""), 2000);
    }
  };

  const filteredOrders = getFilteredOrders();

  return (
    <div style={styles.body}>
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <Button variant="ghost" size="sm" onClick={() => navigate("/admin")} style={{ marginRight: "16px" }}>
            <ArrowLeft size={18} style={{ marginRight: "8px" }} /> Back
          </Button>
          <h1 style={styles.h1}>FastNet Admin Dashboard</h1>
          <div style={styles.activeSupplierBadge}>
            Active: {activeSupplier.toUpperCase()}
          </div>
        </div>
      </header>

      <main style={styles.main}>
        {message && (
          <div style={{ ...styles.message, backgroundColor: message.includes("✅") ? "#d4edda" : "#f8d7da", color: message.includes("✅") ? "#155724" : "#721c24" }}>
            {message}
          </div>
        )}

        <div style={styles.tabs}>
          {["dashboard", "orders", "packages", "settings"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              style={{
                ...styles.tab,
                borderBottom: activeTab === tab ? "3px solid #007bff" : "none",
                fontWeight: activeTab === tab ? "bold" : "normal",
                color: activeTab === tab ? "#007bff" : "#666",
              }}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {activeTab === "dashboard" && (
          <div style={styles.dashboardGrid}>
            <Card style={styles.statCard}>
              <CardContent style={styles.statContent}>
                <div>
                  <p style={styles.statLabel}>Total Orders</p>
                  <p style={styles.statValue}>{orders.length}</p>
                </div>
                <ShoppingCart size={24} color="#007bff" />
              </CardContent>
            </Card>
            <Card style={styles.statCard}>
              <CardContent style={styles.statContent}>
                <div>
                  <p style={styles.statLabel}>Total Revenue</p>
                  <p style={styles.statValue}>GH₵{totalRevenue.toFixed(2)}</p>
                </div>
                <PackageIcon size={24} color="#28a745" />
              </CardContent>
            </Card>
            <Card style={styles.statCard}>
              <CardContent style={styles.statContent}>
                <div>
                  <p style={styles.statLabel}>Pending</p>
                  <p style={styles.statValue}>{pendingCount}</p>
                </div>
                <Clock size={24} color="#ffc107" />
              </CardContent>
            </Card>
            <Card style={styles.statCard}>
              <CardContent style={styles.statContent}>
                <div>
                  <p style={styles.statLabel}>Completed</p>
                  <p style={styles.statValue}>{completedCount}</p>
                </div>
                <CheckCircle2 size={24} color="#28a745" />
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "orders" && (
          <div>
            <Card style={styles.card}>
              <CardHeader><CardTitle>Order Management</CardTitle></CardHeader>
              <CardContent>
                <div style={styles.filterSection}>
                  <div style={styles.filterGroup}>
                    <label style={styles.label}>Filter Status:</label>
                    <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={styles.select}>
                      <option value="ALL">All</option>
                      <option value="PAID">Paid</option>
                      <option value="PROCESSING">Processing</option>
                      <option value="FULFILLED">Fulfilled</option>
                      <option value="CANCELLED">Cancelled</option>
                    </select>
                  </div>
                  <div style={styles.filterGroup}>
                    <label style={styles.label}>Bulk Action:</label>
                    <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)} style={styles.select}>
                      <option value="">Select Status</option>
                      <option value="PAID">Paid</option>
                      <option value="PROCESSING">Processing</option>
                      <option value="FULFILLED">Fulfilled</option>
                      <option value="CANCELLED">Cancelled</option>
                    </select>
                  </div>
                  <Button onClick={handleBulkStatusChange} style={styles.bulkButton}>Update ({selectedOrders.size})</Button>
                  <Button onClick={handleRefreshAllStatuses} disabled={refreshingAll} style={{ ...styles.bulkButton, marginLeft: "10px", backgroundColor: "#17a2b8" }}>
                    <RefreshCw size={16} style={{ marginRight: "6px" }} className={refreshingAll ? "animate-spin" : ""} />
                    {refreshingAll ? "Refreshing..." : "Refresh All Statuses"}
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
                        <th style={styles.tableCell}><input type="checkbox" checked={selectedOrders.size === filteredOrders.length && filteredOrders.length > 0} onChange={(e) => handleSelectAll(e.target.checked)} /></th>
                        <th style={styles.tableCell}>Order ID</th>
                        <th style={styles.tableCell}>Phone</th>
                        <th style={styles.tableCell}>Package</th>
                        <th style={styles.tableCell}>Price</th>
                        <th style={styles.tableCell}>Status</th>
                        <th style={styles.tableCell}>Supplier</th>
                        <th style={styles.tableCell}>Date</th>
                        <th style={styles.tableCell}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOrders.map((order) => (
                        <tr key={order.id} style={styles.tableRow}>
                          <td style={styles.tableCell}><input type="checkbox" checked={selectedOrders.has(order.id)} onChange={() => handleToggleOrderSelect(order.id)} /></td>
                          <td style={styles.tableCell}>{order.shortId}</td>
                          <td style={styles.tableCell}>{order.customerPhone}</td>
                          <td style={styles.tableCell}>{order.packageDetails}</td>
                          <td style={styles.tableCell}>GH₵{order.packagePrice}</td>
                          <td style={styles.tableCell}>
                            <select value={order.status} onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value)} style={{ ...styles.statusSelect, backgroundColor: order.status === "FULFILLED" ? "#28a745" : order.status === "PROCESSING" ? "#ffc107" : order.status === "FAILED" ? "#dc3545" : "#007bff" }}>
                              <option value="PAID">Paid</option>
                              <option value="PROCESSING">Processing</option>
                              <option value="FULFILLED">Fulfilled</option>
                              <option value="FAILED">Failed</option>
                              <option value="CANCELLED">Cancelled</option>
                            </select>
                          </td>
                          <td style={styles.tableCell}>{order.supplierUsed ? order.supplierUsed.toUpperCase() : "-"}</td>
                          <td style={styles.tableCell}>{order.createdAt.toLocaleDateString()}</td>
                          <td style={styles.tableCell}>
                            <div style={{ display: "flex", gap: "5px" }}>
                              <button onClick={() => handleUpdateOrderStatus(order.id, "FULFILLED")} style={styles.actionButton} title="Mark Fulfilled">✓</button>
                              {order.supplierUsed && order.supplierUsed !== "hubnet" && (order.status === "PROCESSING" || order.status === "PAID") && (
                                <button 
                                  onClick={() => handleCheckOrderStatus(order.id)} 
                                  disabled={checkingStatus === order.id}
                                  style={{ ...styles.actionButton, backgroundColor: "#17a2b8" }}
                                  title="Check Status from Supplier"
                                >
                                  {checkingStatus === order.id ? "..." : <Search size={14} />}
                                </button>
                              )}
                            </div>
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

        {activeTab === "packages" && (
          <div>
            <Card style={styles.card}>
              <CardHeader><CardTitle>Add Package</CardTitle></CardHeader>
              <CardContent>
                <div style={styles.formGrid}>
                  <div><label style={styles.label}>Amount</label><Input placeholder="e.g. 1GB" value={newPackage.amount} onChange={(e) => setNewPackage({ ...newPackage, amount: e.target.value })} /></div>
                  <div><label style={styles.label}>Price</label><Input type="number" placeholder="e.g. 5" value={newPackage.price} onChange={(e) => setNewPackage({ ...newPackage, price: e.target.value })} /></div>
                  <div><label style={styles.label}>Delivery</label><Input placeholder="e.g. 5-10 mins" value={newPackage.delivery} onChange={(e) => setNewPackage({ ...newPackage, delivery: e.target.value })} /></div>
                </div>
                <Button onClick={handleAddPackage} style={styles.addButton}><Plus size={18} style={{ marginRight: "8px" }} /> Add</Button>
              </CardContent>
            </Card>
            <Card style={styles.card}>
              <CardContent>
                <div style={styles.tableWrapper}>
                  <table style={styles.table}>
                    <thead>
                      <tr style={styles.tableHeader}>
                        <th style={styles.tableCell}>Amount</th>
                        <th style={styles.tableCell}>Price</th>
                        <th style={styles.tableCell}>Delivery</th>
                        <th style={styles.tableCell}>Status</th>
                        <th style={styles.tableCell}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {packages.map((pkg) => (
                        <tr key={pkg.id} style={styles.tableRow}>
                          <td style={styles.tableCell}>{pkg.dataAmount}</td>
                          <td style={styles.tableCell}>GH₵{pkg.price}</td>
                          <td style={styles.tableCell}>{pkg.deliveryTime}</td>
                          <td style={styles.tableCell}>
                            <button onClick={() => handleTogglePackage(pkg.id)} style={{ ...styles.statusButton, backgroundColor: pkg.isEnabled ? "#28a745" : "#dc3545" }}>
                              {pkg.isEnabled ? "Enabled" : "Disabled"}
                            </button>
                          </td>
                          <td style={styles.tableCell}>
                            <button onClick={() => handleDeletePackage(pkg.id)} style={styles.deleteButton}><Trash2 size={16} /></button>
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

        {activeTab === "settings" && (
          <div style={styles.dashboardGrid}>
            {/* Supplier Management */}
            <Card style={styles.card}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <SettingsIcon size={20} />
                  Supplier Management
                </CardTitle>
                <CardDescription>Select active supplier for order fulfillment</CardDescription>
              </CardHeader>
              <CardContent>
                <div style={styles.supplierGrid}>
                  {["dataxpress", "hubnet", "dakazina"].map((supplier) => (
                    <div 
                      key={supplier}
                      onClick={() => handleSupplierChange(supplier as Supplier)}
                      style={{
                        ...styles.supplierCard,
                        borderColor: activeSupplier === supplier ? "#007bff" : "#ddd",
                        backgroundColor: activeSupplier === supplier ? "#f0f7ff" : "white",
                      }}
                    >
                      <div style={styles.supplierHeader}>
                        <span style={styles.supplierName}>{supplier.charAt(0).toUpperCase() + supplier.slice(1)}</span>
                        {activeSupplier === supplier && <span style={styles.activeBadge}>ACTIVE</span>}
                      </div>
                      <div style={styles.balanceInfo}>
                        <span>Balance:</span>
                        <span style={styles.balanceValue}>
                          {walletBalances[supplier as Supplier].currency} {walletBalances[supplier as Supplier].balance}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Transaction Charge Settings */}
            <Card style={styles.card}>
              <CardHeader>
                <CardTitle>Transaction Settings</CardTitle>
              </CardHeader>
              <CardContent>
                <div style={styles.settingsForm}>
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
                  <Button onClick={handleSaveSettings} style={styles.saveButton}>
                    Save Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}

const styles: any = {
  body: { fontFamily: "'Segoe UI', sans-serif", backgroundColor: "#f0f4f8", minHeight: "100vh", color: "#333" },
  header: { backgroundColor: "white", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", position: "sticky", top: 0, zIndex: 40 },
  headerContent: { maxWidth: "1400px", margin: "0 auto", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" },
  h1: { fontSize: "1.5em", fontWeight: "bold", color: "#007bff", margin: 0 },
  activeSupplierBadge: { backgroundColor: "#e6f7ff", color: "#007bff", padding: "4px 12px", borderRadius: "20px", fontSize: "0.85em", fontWeight: "bold", border: "1px solid #b3e0ff" },
  main: { maxWidth: "1400px", margin: "0 auto", padding: "32px 20px" },
  message: { padding: "16px", borderRadius: "8px", marginBottom: "20px", fontWeight: "bold" },
  tabs: { display: "flex", gap: "20px", marginBottom: "24px", borderBottom: "2px solid #ddd" },
  tab: { padding: "12px 20px", backgroundColor: "transparent", border: "none", cursor: "pointer", fontSize: "1em", transition: "all 0.3s" },
  dashboardGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "20px", marginBottom: "30px" },
  statCard: { borderRadius: "8px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" },
  statContent: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px" },
  statLabel: { color: "#666", fontSize: "0.9em" },
  statValue: { fontSize: "1.8em", fontWeight: "bold", color: "#333" },
  card: { marginBottom: "24px", borderRadius: "8px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" },
  filterSection: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", alignItems: "flex-end" },
  filterGroup: { display: "flex", flexDirection: "column", gap: "8px" },
  label: { fontSize: "0.875em", fontWeight: "bold" },
  select: { padding: "8px", border: "1px solid #ddd", borderRadius: "4px" },
  bulkButton: { backgroundColor: "#007bff", color: "white", fontWeight: "bold" },
  tableWrapper: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse" },
  tableHeader: { backgroundColor: "#f9f9f9", borderBottom: "2px solid #ddd" },
  tableRow: { borderBottom: "1px solid #ddd" },
  tableCell: { padding: "12px", textAlign: "left" },
  statusSelect: { padding: "6px 12px", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "0.875em", fontWeight: "bold" },
  statusButton: { padding: "6px 12px", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "0.875em", fontWeight: "bold" },
  deleteButton: { padding: "6px 12px", backgroundColor: "#dc3545", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" },
  actionButton: { padding: "6px 12px", backgroundColor: "#28a745", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "16px", marginBottom: "16px" },
  addButton: { backgroundColor: "#007bff", color: "white", fontWeight: "bold" },
  supplierGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "20px" },
  supplierCard: { padding: "20px", borderRadius: "8px", border: "2px solid #ddd", cursor: "pointer", transition: "all 0.2s" },
  supplierHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" },
  supplierName: { fontSize: "1.2em", fontWeight: "bold", color: "#333" },
  activeBadge: { backgroundColor: "#28a745", color: "white", padding: "4px 8px", borderRadius: "4px", fontSize: "0.75em", fontWeight: "bold" },
  balanceInfo: { display: "flex", justifyContent: "space-between", alignItems: "center", color: "#666" },
  balanceValue: { fontWeight: "bold", color: "#333", fontSize: "1.1em" },
  settingsForm: { display: "flex", flexDirection: "column", gap: "16px" },
  saveButton: { backgroundColor: "#007bff", color: "white", fontWeight: "bold", width: "fit-content" },
};
