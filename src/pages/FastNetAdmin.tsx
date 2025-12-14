import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Plus, Trash2, ShoppingCart, Package as PackageIcon, Clock, CheckCircle2, Settings as SettingsIcon } from "lucide-react";
import { packagesAPI } from "@/lib/supabase";

interface Order {
  id: string;
  shortId: string;
  customerPhone: string;
  packageDetails: string;
  packagePrice: number;
  status: "PAID" | "PROCESSING" | "FULFILLED" | "CANCELLED";
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

    setMessage(`Active supplier changed to ${supplier.toUpperCase()}`);
    setTimeout(() => setMessage(""), 3000);
  };

  const handleSaveSettings = () => {
    const currentSettings = JSON.parse(localStorage.getItem("fastnetSettings") || "{}");
    localStorage.setItem("fastnetSettings", JSON.stringify({
      ...currentSettings,
      transactionCharge: settings.transactionCharge,
    }));
    setMessage("Settings saved");
    setTimeout(() => setMessage(""), 2000);
  };

  const totalRevenue = orders.reduce((sum, o) => sum + (o.packagePrice || 0), 0);
  const pendingCount = orders.filter(o => o.status === "PROCESSING" || o.status === "PAID").length;
  const completedCount = orders.filter(o => o.status === "FULFILLED").length;

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
      setMessage(`${selectedOrders.size} orders updated`);
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      console.error("Error updating orders:", error);
      setMessage("Failed to update orders");
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
        setMessage("Order status updated");
      } else {
        setMessage("Failed to update order");
      }
      setTimeout(() => setMessage(""), 2000);
    } catch (error) {
      console.error("Error updating order:", error);
      setMessage("Failed to update order");
      setTimeout(() => setMessage(""), 2000);
    }
  };

  const handleAddPackage = async () => {
    if (!newPackage.amount || !newPackage.price || !newPackage.delivery) {
      setMessage("Please fill all fields");
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
      setMessage("Package added");
      setTimeout(() => setMessage(""), 2000);
    } catch (error) {
      console.error("Error adding package:", error);
      setMessage("Failed to add package");
      setTimeout(() => setMessage(""), 2000);
    }
  };

  const handleDeletePackage = async (id: string) => {
    try {
      await packagesAPI.delete(id);
      await loadPackages();
      setMessage("Package deleted");
      setTimeout(() => setMessage(""), 2000);
    } catch (error) {
      console.error("Error deleting package:", error);
      setMessage("Failed to delete package");
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
      setMessage("Failed to update package");
      setTimeout(() => setMessage(""), 2000);
    }
  };

  const filteredOrders = getFilteredOrders();

  return (
    <div className="min-h-screen bg-gray-100 font-sans text-gray-800">
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-5 py-4 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate("/admin")} className="mr-4">
            <ArrowLeft size={18} className="mr-2" /> Back
          </Button>
          <h1 className="text-xl font-bold text-blue-600">FastNet Admin Dashboard</h1>
          <div className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-sm font-bold border border-blue-200">
            Active: {activeSupplier.toUpperCase()}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 py-8">
        {message && (
          <div className={`p-4 rounded-lg mb-5 font-bold ${message.includes("Failed") || message.includes("Please") ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}`}>
            {message}
          </div>
        )}

        <div className="flex gap-5 mb-6 border-b-2 border-gray-200">
          {["dashboard", "orders", "packages", "settings"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-5 py-3 bg-transparent border-none cursor-pointer transition-all ${
                activeTab === tab 
                  ? "border-b-4 border-blue-500 font-bold text-blue-500" 
                  : "text-gray-600"
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {activeTab === "dashboard" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
            <Card className="rounded-lg shadow-sm">
              <CardContent className="flex justify-between items-center p-5">
                <div>
                  <p className="text-gray-600 text-sm">Total Orders</p>
                  <p className="text-3xl font-bold text-gray-800">{orders.length}</p>
                </div>
                <ShoppingCart size={24} className="text-blue-500" />
              </CardContent>
            </Card>
            <Card className="rounded-lg shadow-sm">
              <CardContent className="flex justify-between items-center p-5">
                <div>
                  <p className="text-gray-600 text-sm">Total Revenue</p>
                  <p className="text-3xl font-bold text-gray-800">GH₵{totalRevenue.toFixed(2)}</p>
                </div>
                <PackageIcon size={24} className="text-green-500" />
              </CardContent>
            </Card>
            <Card className="rounded-lg shadow-sm">
              <CardContent className="flex justify-between items-center p-5">
                <div>
                  <p className="text-gray-600 text-sm">Pending</p>
                  <p className="text-3xl font-bold text-gray-800">{pendingCount}</p>
                </div>
                <Clock size={24} className="text-yellow-500" />
              </CardContent>
            </Card>
            <Card className="rounded-lg shadow-sm">
              <CardContent className="flex justify-between items-center p-5">
                <div>
                  <p className="text-gray-600 text-sm">Completed</p>
                  <p className="text-3xl font-bold text-gray-800">{completedCount}</p>
                </div>
                <CheckCircle2 size={24} className="text-green-500" />
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "orders" && (
          <div>
            <Card className="mb-6 rounded-lg shadow-sm">
              <CardHeader><CardTitle>Order Management</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold">Filter Status:</label>
                    <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="p-2 border border-gray-300 rounded">
                      <option value="ALL">All</option>
                      <option value="PAID">Paid</option>
                      <option value="PROCESSING">Processing</option>
                      <option value="FULFILLED">Fulfilled</option>
                      <option value="CANCELLED">Cancelled</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold">Bulk Action:</label>
                    <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)} className="p-2 border border-gray-300 rounded">
                      <option value="">Select Status</option>
                      <option value="PAID">Paid</option>
                      <option value="PROCESSING">Processing</option>
                      <option value="FULFILLED">Fulfilled</option>
                      <option value="CANCELLED">Cancelled</option>
                    </select>
                  </div>
                  <Button onClick={handleBulkStatusChange} className="bg-blue-500 hover:bg-blue-600 text-white font-bold">
                    Update ({selectedOrders.size})
                  </Button>
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-lg shadow-sm">
              <CardContent className="p-5">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b-2 border-gray-200">
                        <th className="p-3 text-left"><input type="checkbox" checked={selectedOrders.size === filteredOrders.length && filteredOrders.length > 0} onChange={(e) => handleSelectAll(e.target.checked)} /></th>
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
                      {filteredOrders.map((order) => (
                        <tr key={order.id} className="border-b border-gray-200">
                          <td className="p-3"><input type="checkbox" checked={selectedOrders.has(order.id)} onChange={() => handleToggleOrderSelect(order.id)} /></td>
                          <td className="p-3">{order.shortId}</td>
                          <td className="p-3">{order.customerPhone}</td>
                          <td className="p-3">{order.packageDetails}</td>
                          <td className="p-3">GH₵{order.packagePrice}</td>
                          <td className="p-3">
                            <select 
                              value={order.status} 
                              onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value)} 
                              className={`p-1.5 px-3 text-white border-none rounded cursor-pointer text-sm font-bold ${
                                order.status === "FULFILLED" ? "bg-green-500" : 
                                order.status === "PROCESSING" ? "bg-yellow-500" : "bg-blue-500"
                              }`}
                            >
                              <option value="PAID">Paid</option>
                              <option value="PROCESSING">Processing</option>
                              <option value="FULFILLED">Fulfilled</option>
                              <option value="CANCELLED">Cancelled</option>
                            </select>
                          </td>
                          <td className="p-3">{order.createdAt.toLocaleDateString()}</td>
                          <td className="p-3">
                            <button onClick={() => handleUpdateOrderStatus(order.id, "FULFILLED")} className="p-1.5 px-3 bg-green-500 text-white border-none rounded cursor-pointer">
                              ✓
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

        {activeTab === "packages" && (
          <div>
            <Card className="mb-6 rounded-lg shadow-sm">
              <CardHeader><CardTitle>Add Package</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="text-sm font-bold block mb-2">Amount</label>
                    <Input placeholder="e.g. 1GB" value={newPackage.amount} onChange={(e) => setNewPackage({ ...newPackage, amount: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-sm font-bold block mb-2">Price</label>
                    <Input type="number" placeholder="e.g. 5" value={newPackage.price} onChange={(e) => setNewPackage({ ...newPackage, price: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-sm font-bold block mb-2">Delivery</label>
                    <Input placeholder="e.g. 5-10 mins" value={newPackage.delivery} onChange={(e) => setNewPackage({ ...newPackage, delivery: e.target.value })} />
                  </div>
                </div>
                <Button onClick={handleAddPackage} className="bg-blue-500 hover:bg-blue-600 text-white font-bold">
                  <Plus size={18} className="mr-2" /> Add
                </Button>
              </CardContent>
            </Card>
            <Card className="rounded-lg shadow-sm">
              <CardContent className="p-5">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b-2 border-gray-200">
                        <th className="p-3 text-left">Amount</th>
                        <th className="p-3 text-left">Price</th>
                        <th className="p-3 text-left">Delivery</th>
                        <th className="p-3 text-left">Status</th>
                        <th className="p-3 text-left">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {packages.map((pkg) => (
                        <tr key={pkg.id} className="border-b border-gray-200">
                          <td className="p-3">{pkg.dataAmount}</td>
                          <td className="p-3">GH₵{pkg.price}</td>
                          <td className="p-3">{pkg.deliveryTime}</td>
                          <td className="p-3">
                            <button 
                              onClick={() => handleTogglePackage(pkg.id)} 
                              className={`p-1.5 px-3 text-white border-none rounded cursor-pointer text-sm font-bold ${pkg.isEnabled ? "bg-green-500" : "bg-red-500"}`}
                            >
                              {pkg.isEnabled ? "Enabled" : "Disabled"}
                            </button>
                          </td>
                          <td className="p-3">
                            <button onClick={() => handleDeletePackage(pkg.id)} className="p-1.5 px-3 bg-red-500 text-white border-none rounded cursor-pointer">
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

        {activeTab === "settings" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card className="rounded-lg shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <SettingsIcon size={20} />
                  Supplier Management
                </CardTitle>
                <CardDescription>Select active supplier for order fulfillment</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-4">
                  {["dataxpress", "hubnet", "dakazina"].map((supplier) => (
                    <div 
                      key={supplier}
                      onClick={() => handleSupplierChange(supplier as Supplier)}
                      className={`p-5 rounded-lg border-2 cursor-pointer transition-all ${
                        activeSupplier === supplier 
                          ? "border-blue-500 bg-blue-50" 
                          : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                    >
                      <div className="flex justify-between items-center mb-4">
                        <span className="text-lg font-bold text-gray-800">{supplier.charAt(0).toUpperCase() + supplier.slice(1)}</span>
                        {activeSupplier === supplier && (
                          <span className="bg-green-500 text-white px-2 py-1 rounded text-xs font-bold">ACTIVE</span>
                        )}
                      </div>
                      <div className="flex justify-between items-center text-gray-600">
                        <span>Balance:</span>
                        <span className="font-bold text-gray-800 text-lg">
                          {walletBalances[supplier as Supplier].currency} {walletBalances[supplier as Supplier].balance}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-lg shadow-sm">
              <CardHeader>
                <CardTitle>Transaction Settings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-4">
                  <div>
                    <label className="text-sm font-bold block mb-2">Transaction Charge (%)</label>
                    <Input
                      type="number"
                      placeholder="1.3"
                      value={settings.transactionCharge}
                      onChange={(e) => setSettings({ ...settings, transactionCharge: e.target.value })}
                    />
                    <p className="text-sm text-gray-600 mt-1">
                      Percentage charge added to each transaction
                    </p>
                  </div>
                  <Button onClick={handleSaveSettings} className="bg-blue-500 hover:bg-blue-600 text-white font-bold w-fit">
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
