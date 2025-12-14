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
        setOrders(parsed.map((o: any) => ({ ...o, createdAt: new Date(o.createdAt) })).sort((a: any, b: any) => b.createdAt.getTime() - a.createdAt.getTime()));
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
    <div className="min-h-screen bg-gray-100 font-sans text-gray-800">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-5 py-4 flex items-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/admin")}
            className="mr-4"
          >
            <ArrowLeft size={18} className="mr-2" />
            Back
          </Button>
          <h1 className="text-xl font-bold text-yellow-400">DataGod Admin Dashboard</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-5 py-8">
        {message && (
          <div className={`p-4 rounded-lg mb-5 font-bold ${message.includes("✅") ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
            {message}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-5 mb-6 border-b-2 border-gray-200">
          <button
            onClick={() => setActiveTab("orders")}
            className={`py-3 px-5 bg-transparent border-none cursor-pointer text-base transition-all ${activeTab === "orders" ? "border-b-4 border-yellow-400 font-bold text-yellow-500" : "text-gray-600"}`}
          >
            Orders
          </button>
          <button
            onClick={() => setActiveTab("packages")}
            className={`py-3 px-5 bg-transparent border-none cursor-pointer text-base transition-all ${activeTab === "packages" ? "border-b-4 border-yellow-400 font-bold text-yellow-500" : "text-gray-600"}`}
          >
            Packages
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`py-3 px-5 bg-transparent border-none cursor-pointer text-base transition-all ${activeTab === "settings" ? "border-b-4 border-yellow-400 font-bold text-yellow-500" : "text-gray-600"}`}
          >
            Settings
          </button>
        </div>

        {/* Orders Tab */}
        {activeTab === "orders" && (
          <div>
            {/* Filter and Bulk Actions */}
            <Card className="mb-6 rounded-lg shadow-sm">
              <CardHeader>
                <CardTitle>Order Management</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                  <div className="flex flex-col">
                    <label className="text-sm font-bold mb-2">Filter by Status:</label>
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="p-2 border border-gray-300 rounded text-sm"
                    >
                      <option value="ALL">All Orders</option>
                      <option value="PAID">Paid</option>
                      <option value="PROCESSING">Processing</option>
                      <option value="FULFILLED">Fulfilled</option>
                      <option value="CANCELLED">Cancelled</option>
                    </select>
                  </div>

                  <div className="flex flex-col">
                    <label className="text-sm font-bold mb-2">Bulk Status Change:</label>
                    <select
                      value={bulkStatus}
                      onChange={(e) => setBulkStatus(e.target.value)}
                      className="p-2 border border-gray-300 rounded text-sm"
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
                    className="bg-yellow-400 text-gray-900 font-bold hover:bg-yellow-500"
                  >
                    Update ({selectedOrders.size})
                  </Button>

                  <Button
                    onClick={exportOrdersToCSV}
                    className="bg-blue-600 text-white font-bold hover:bg-blue-700"
                  >
                    <Download size={16} className="mr-2" />
                    Export CSV
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Orders Table */}
            <Card className="mb-6 rounded-lg shadow-sm">
              <CardContent className="p-5">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b-2 border-gray-200">
                        <th className="p-3 text-left">
                          <input
                            type="checkbox"
                            checked={selectedOrders.size === filteredOrders.length && filteredOrders.length > 0}
                            onChange={(e) => handleSelectAll(e.target.checked)}
                          />
                        </th>
                        <th className="p-3 text-left">Order ID</th>
                        <th className="p-3 text-left">Phone</th>
                        <th className="p-3 text-left">Package</th>
                        <th className="p-3 text-left">Price</th>
                        <th className="p-3 text-left">Status</th>
                        <th className="p-3 text-left">Date</th>
                        <th className="p-3 text-left">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOrders.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="text-center p-5 text-gray-400">
                            No orders found
                          </td>
                        </tr>
                      ) : (
                        filteredOrders.map((order) => (
                          <tr key={order.id} className="border-b border-gray-200">
                            <td className="p-3 text-left">
                              <input
                                type="checkbox"
                                checked={selectedOrders.has(order.id)}
                                onChange={() => handleToggleOrderSelect(order.id)}
                              />
                            </td>
                            <td className="p-3 text-left">{order.shortId}</td>
                            <td className="p-3 text-left">{order.customerPhone}</td>
                            <td className="p-3 text-left">{order.packageDetails}</td>
                            <td className="p-3 text-left">GH₵{order.packagePrice}</td>
                            <td className="p-3 text-left">
                              <select
                                value={order.status}
                                onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value)}
                                className={`py-1.5 px-3 text-white border-none rounded cursor-pointer text-sm font-bold ${order.status === "FULFILLED" ? "bg-green-600" : order.status === "PROCESSING" ? "bg-yellow-500" : order.status === "PAID" ? "bg-blue-600" : "bg-red-600"}`}
                              >
                                <option value="PAID">Paid</option>
                                <option value="PROCESSING">Processing</option>
                                <option value="FULFILLED">Fulfilled</option>
                                <option value="CANCELLED">Cancelled</option>
                              </select>
                            </td>
                            <td className="p-3 text-left">{order.createdAt.toLocaleDateString()}</td>
                            <td className="p-3 text-left">
                              <button
                                onClick={() => handleUpdateOrderStatus(order.id, "FULFILLED")}
                                className="py-1.5 px-3 bg-green-600 text-white border-none rounded cursor-pointer"
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
        {activeTab === "packages" && (
          <div>
            <Card className="mb-6 rounded-lg shadow-sm">
              <CardHeader>
                <CardTitle>Add New Package</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="text-sm font-bold mb-2 block">Package Name</label>
                    <Input
                      placeholder="e.g., 1GB"
                      value={newPackage.name}
                      onChange={(e) => setNewPackage({ ...newPackage, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-bold mb-2 block">Data (GB)</label>
                    <Input
                      type="number"
                      placeholder="e.g., 1"
                      value={newPackage.gb}
                      onChange={(e) => setNewPackage({ ...newPackage, gb: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-bold mb-2 block">Price (GH₵)</label>
                    <Input
                      type="number"
                      placeholder="e.g., 2.5"
                      value={newPackage.price}
                      onChange={(e) => setNewPackage({ ...newPackage, price: e.target.value })}
                    />
                  </div>
                </div>
                <Button onClick={handleAddPackage} className="bg-yellow-400 text-gray-900 font-bold hover:bg-yellow-500">
                  <Plus size={18} className="mr-2" />
                  Add Package
                </Button>
              </CardContent>
            </Card>

            <Card className="mb-6 rounded-lg shadow-sm">
              <CardHeader>
                <CardTitle>Manage Packages</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b-2 border-gray-200">
                        <th className="p-3 text-left">Package</th>
                        <th className="p-3 text-left">Data (GB)</th>
                        <th className="p-3 text-left">Price (GH₵)</th>
                        <th className="p-3 text-left">Status</th>
                        <th className="p-3 text-left">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {packages.map((pkg) => (
                        <tr key={pkg.id} className="border-b border-gray-200">
                          <td className="p-3 text-left">{pkg.packageName}</td>
                          <td className="p-3 text-left">{pkg.dataValueGB}</td>
                          <td className="p-3 text-left">{pkg.priceGHS}</td>
                          <td className="p-3 text-left">
                            <button
                              onClick={() => handleTogglePackage(pkg.id)}
                              className={`py-1.5 px-3 text-white border-none rounded cursor-pointer text-sm font-bold ${pkg.isEnabled ? "bg-green-600" : "bg-red-600"}`}
                            >
                              {pkg.isEnabled ? "✅ Enabled" : "❌ Disabled"}
                            </button>
                          </td>
                          <td className="p-3 text-left">
                            <button
                              onClick={() => handleDeletePackage(pkg.id)}
                              className="p-1.5 px-3 bg-red-500 text-white border-none rounded cursor-pointer"
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
        {activeTab === "settings" && (
          <Card className="mb-6 rounded-lg shadow-sm">
            <CardHeader>
              <CardTitle>Platform Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4">
                <div>
                  <label className="text-sm font-bold mb-2 block">WhatsApp Link</label>
                  <Input
                    type="url"
                    placeholder="https://wa.link/..."
                    value={settings.whatsAppLink}
                    onChange={(e) => setSettings({ ...settings, whatsAppLink: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-bold mb-2 block">Transaction Charge (%)</label>
                  <Input
                    type="number"
                    placeholder="1.3"
                    value={settings.transactionCharge}
                    onChange={(e) => setSettings({ ...settings, transactionCharge: e.target.value })}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Percentage charge added to each transaction
                  </p>
                </div>
                <Button
                  onClick={() => {
                    const updated = { ...settings };
                    const currentWirenet = JSON.parse(localStorage.getItem("wirenetSettings") || "{}");
                    localStorage.setItem("wirenetSettings", JSON.stringify({
                      ...currentWirenet,
                      whatsappLink: updated.whatsAppLink,
                    }));
                    
                    localStorage.setItem("datagodSettings", JSON.stringify({
                      transactionCharge: updated.transactionCharge,
                    }));
                    
                    setMessage("✅ Settings saved");
                    setTimeout(() => setMessage(""), 2000);
                  }}
                  className="bg-yellow-400 text-gray-900 font-bold hover:bg-yellow-500 w-fit"
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
