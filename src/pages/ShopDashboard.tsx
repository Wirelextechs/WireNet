import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Store, LogOut, DollarSign, Package, ShoppingCart, TrendingUp,
  Settings, Wallet, Copy, CheckCircle, ExternalLink, Save
} from "lucide-react";

interface Shop {
  id: number;
  shopName: string;
  slug: string;
  description: string | null;
  logo: string | null;
  status: string;
  totalEarnings: number;
  availableBalance: number;
}

interface User {
  id: number;
  email: string;
  name: string;
  phone: string;
}

interface PackageConfig {
  serviceType: string;
  packageId: string;
  packageName: string;
  basePrice: number;
  markupAmount: number;
  isEnabled: boolean;
}

interface Order {
  id: number;
  phoneNumber: string;
  network: string;
  capacity: string;
  price: number;
  status: string;
  createdAt: string;
  shopMarkup: number | null;
  serviceType: string;
}

interface Withdrawal {
  id: number;
  amount: number;
  fee: number;
  netAmount: number;
  bankDetails: string;
  status: string;
  requestedAt: string;
  processedAt: string | null;
}

interface ShopStats {
  totalOrders: number;
  totalRevenue: number;
  totalEarnings: number;
  availableBalance: number;
  pendingWithdrawals: number;
}

export default function ShopDashboard() {
  const [, navigate] = useLocation();
  const [shop, setShop] = useState<Shop | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<ShopStats | null>(null);
  const [packages, setPackages] = useState<PackageConfig[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "packages" | "orders" | "withdrawals" | "settings">("overview");
  
  // Withdrawal form
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [bankDetails, setBankDetails] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState("");
  const [withdrawSuccess, setWithdrawSuccess] = useState("");
  
  // Package editing
  const [editedPackages, setEditedPackages] = useState<Record<string, { markupAmount: number; isEnabled: boolean }>>({});
  const [savingPackages, setSavingPackages] = useState(false);
  
  // Settings
  const [shopDescription, setShopDescription] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);

  // Shop settings from admin
  const [minWithdrawal, setMinWithdrawal] = useState(10);
  const [withdrawalFee, setWithdrawalFee] = useState(0);

  const [copied, setCopied] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch("/api/user/me", { credentials: "include" });
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        setShop(data.shop);
        setShopDescription(data.shop.description || "");
        
        // Load all data
        await Promise.all([
          loadStats(),
          loadPackages(),
          loadOrders(),
          loadWithdrawals(),
          loadShopSettings()
        ]);
      } else {
        navigate("/login");
      }
    } catch (error) {
      console.error("Auth check failed:", error);
      navigate("/login");
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch("/api/shop/stats", { credentials: "include" });
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Failed to load stats:", error);
    }
  };

  const loadPackages = async () => {
    try {
      const response = await fetch("/api/shop/packages", { credentials: "include" });
      if (response.ok) {
        const data = await response.json();
        setPackages(data);
      }
    } catch (error) {
      console.error("Failed to load packages:", error);
    }
  };

  const loadOrders = async () => {
    try {
      const response = await fetch("/api/shop/orders", { credentials: "include" });
      if (response.ok) {
        const data = await response.json();
        setOrders(data);
      }
    } catch (error) {
      console.error("Failed to load orders:", error);
    }
  };

  const loadWithdrawals = async () => {
    try {
      const response = await fetch("/api/withdrawals", { credentials: "include" });
      if (response.ok) {
        const data = await response.json();
        setWithdrawals(data);
      }
    } catch (error) {
      console.error("Failed to load withdrawals:", error);
    }
  };

  const loadShopSettings = async () => {
    try {
      const response = await fetch("/api/admin/shop-settings");
      if (response.ok) {
        const data = await response.json();
        setMinWithdrawal(data.minWithdrawalAmount || 10);
        setWithdrawalFee(data.withdrawalFee || 0);
      }
    } catch (error) {
      console.error("Failed to load shop settings:", error);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/user/logout", { method: "POST", credentials: "include" });
    sessionStorage.removeItem("shopUser");
    sessionStorage.removeItem("shop");
    navigate("/login");
  };

  const copyShopLink = () => {
    if (shop) {
      navigator.clipboard.writeText(`https://wirenet.top/shop/${shop.slug}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handlePackageChange = (key: string, field: "markupAmount" | "isEnabled", value: number | boolean) => {
    setEditedPackages(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        markupAmount: prev[key]?.markupAmount ?? packages.find(p => `${p.serviceType}-${p.packageId}` === key)?.markupAmount ?? 0,
        isEnabled: prev[key]?.isEnabled ?? packages.find(p => `${p.serviceType}-${p.packageId}` === key)?.isEnabled ?? true,
        [field]: value
      }
    }));
  };

  const savePackages = async () => {
    setSavingPackages(true);
    try {
      const updates = packages.map(pkg => {
        const key = `${pkg.serviceType}-${pkg.packageId}`;
        const edited = editedPackages[key];
        return {
          serviceType: pkg.serviceType,
          packageId: pkg.packageId,
          markupAmount: edited?.markupAmount ?? pkg.markupAmount,
          isEnabled: edited?.isEnabled ?? pkg.isEnabled
        };
      });

      const response = await fetch("/api/shop/packages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ packages: updates })
      });

      if (response.ok) {
        await loadPackages();
        setEditedPackages({});
      }
    } catch (error) {
      console.error("Failed to save packages:", error);
    } finally {
      setSavingPackages(false);
    }
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      const response = await fetch("/api/shop/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ description: shopDescription })
      });

      if (response.ok) {
        const data = await response.json();
        setShop(data.shop);
      }
    } catch (error) {
      console.error("Failed to save settings:", error);
    } finally {
      setSavingSettings(false);
    }
  };

  const requestWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    setWithdrawError("");
    setWithdrawSuccess("");
    
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount < minWithdrawal) {
      setWithdrawError(`Minimum withdrawal is GHS ${minWithdrawal}`);
      return;
    }
    if (stats && amount > stats.availableBalance) {
      setWithdrawError("Insufficient balance");
      return;
    }
    if (!bankDetails.trim()) {
      setWithdrawError("Please provide bank/MoMo details");
      return;
    }

    setWithdrawing(true);
    try {
      const response = await fetch("/api/withdrawals/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ amount, bankDetails })
      });

      if (response.ok) {
        setWithdrawSuccess(`Withdrawal request submitted! You will receive GHS ${(amount - withdrawalFee).toFixed(2)} after processing.`);
        setWithdrawAmount("");
        setBankDetails("");
        await Promise.all([loadStats(), loadWithdrawals()]);
      } else {
        const data = await response.json();
        setWithdrawError(data.message || "Failed to request withdrawal");
      }
    } catch (error) {
      setWithdrawError("An error occurred");
    } finally {
      setWithdrawing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 via-purple-50 to-fuchsia-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!shop || !user) {
    // Redirect to login if not authenticated
    navigate("/login");
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 via-purple-50 to-fuchsia-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800",
      approved: "bg-green-100 text-green-800",
      completed: "bg-green-100 text-green-800",
      banned: "bg-red-100 text-red-800",
      rejected: "bg-red-100 text-red-800",
      failed: "bg-red-100 text-red-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  // Group packages by service type
  const packagesByService = packages.reduce((acc, pkg) => {
    if (!acc[pkg.serviceType]) acc[pkg.serviceType] = [];
    acc[pkg.serviceType].push(pkg);
    return acc;
  }, {} as Record<string, PackageConfig[]>);

  const serviceNames: Record<string, string> = {
    fastnet: "FastNet (MTN)",
    datagod: "DataGod (MTN)",
    at: "AT (AirtelTigo)",
    telecel: "Telecel"
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-purple-50 to-fuchsia-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg">
              <Store className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-xl">{shop.shopName}</h1>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span className={`px-2 py-0.5 rounded text-xs ${getStatusBadge(shop.status)}`}>
                  {shop.status}
                </span>
                <button onClick={copyShopLink} className="flex items-center gap-1 hover:text-violet-600">
                  wirenet.top/shop/{shop.slug}
                  {copied ? <CheckCircle size={14} className="text-green-500" /> : <Copy size={14} />}
                </button>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <a 
              href={`/shop/${shop.slug}`} 
              target="_blank"
              className="text-sm text-violet-600 hover:underline flex items-center gap-1"
            >
              View Shop <ExternalLink size={14} />
            </a>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut size={18} className="mr-1" /> Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex gap-2 border-b mb-6">
          {[
            { id: "overview", label: "Overview", icon: TrendingUp },
            { id: "packages", label: "Packages & Pricing", icon: Package },
            { id: "orders", label: "Orders", icon: ShoppingCart },
            { id: "withdrawals", label: "Withdrawals", icon: Wallet },
            { id: "settings", label: "Settings", icon: Settings },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-violet-600 text-violet-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === "overview" && stats && (
          <div className="space-y-6">
            {shop.status === "pending" && (
              <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                <h3 className="font-semibold text-yellow-800 mb-1">Shop Pending Approval</h3>
                <p className="text-sm text-yellow-700">
                  Your shop is currently under review. You'll be notified once it's approved.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-100 rounded-lg">
                      <ShoppingCart className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Total Orders</p>
                      <p className="text-2xl font-bold">{stats.totalOrders}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-green-100 rounded-lg">
                      <DollarSign className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Total Revenue</p>
                      <p className="text-2xl font-bold">GHS {stats.totalRevenue.toFixed(2)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-violet-100 rounded-lg">
                      <TrendingUp className="h-6 w-6 text-violet-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Total Earnings</p>
                      <p className="text-2xl font-bold">GHS {stats.totalEarnings.toFixed(2)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-amber-100 rounded-lg">
                      <Wallet className="h-6 w-6 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Available Balance</p>
                      <p className="text-2xl font-bold">GHS {stats.availableBalance.toFixed(2)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Orders */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Orders</CardTitle>
              </CardHeader>
              <CardContent>
                {orders.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No orders yet</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-2">Date</th>
                          <th className="text-left py-2 px-2">Phone</th>
                          <th className="text-left py-2 px-2">Package</th>
                          <th className="text-left py-2 px-2">Price</th>
                          <th className="text-left py-2 px-2">Your Markup</th>
                          <th className="text-left py-2 px-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orders.slice(0, 10).map((order) => (
                          <tr key={`${order.serviceType}-${order.id}`} className="border-b">
                            <td className="py-2 px-2">{new Date(order.createdAt).toLocaleDateString()}</td>
                            <td className="py-2 px-2">{order.phoneNumber}</td>
                            <td className="py-2 px-2">{order.capacity} ({order.network})</td>
                            <td className="py-2 px-2">GHS {order.price.toFixed(2)}</td>
                            <td className="py-2 px-2 text-green-600">+GHS {(order.shopMarkup || 0).toFixed(2)}</td>
                            <td className="py-2 px-2">
                              <span className={`px-2 py-0.5 rounded text-xs ${getStatusBadge(order.status)}`}>
                                {order.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Packages Tab */}
        {activeTab === "packages" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">Package Pricing</h2>
                <p className="text-sm text-gray-500">Set your markup amounts and enable/disable packages</p>
              </div>
              <Button onClick={savePackages} disabled={savingPackages || Object.keys(editedPackages).length === 0}>
                <Save size={18} className="mr-2" />
                {savingPackages ? "Saving..." : "Save Changes"}
              </Button>
            </div>

            {Object.entries(packagesByService).map(([serviceType, pkgs]) => (
              <Card key={serviceType}>
                <CardHeader>
                  <CardTitle>{serviceNames[serviceType] || serviceType}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-2">Package</th>
                          <th className="text-left py-2 px-2">Base Price</th>
                          <th className="text-left py-2 px-2">Your Markup (GHS)</th>
                          <th className="text-left py-2 px-2">Final Price</th>
                          <th className="text-left py-2 px-2">Enabled</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pkgs.map((pkg) => {
                          const key = `${pkg.serviceType}-${pkg.packageId}`;
                          const edited = editedPackages[key];
                          const markup = edited?.markupAmount ?? pkg.markupAmount;
                          const enabled = edited?.isEnabled ?? pkg.isEnabled;
                          
                          return (
                            <tr key={key} className="border-b">
                              <td className="py-2 px-2">{pkg.packageName}</td>
                              <td className="py-2 px-2">GHS {pkg.basePrice.toFixed(2)}</td>
                              <td className="py-2 px-2">
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.1"
                                  value={markup}
                                  onChange={(e) => handlePackageChange(key, "markupAmount", parseFloat(e.target.value) || 0)}
                                  className="w-24"
                                />
                              </td>
                              <td className="py-2 px-2 font-semibold">
                                GHS {(pkg.basePrice + markup).toFixed(2)}
                              </td>
                              <td className="py-2 px-2">
                                <button
                                  onClick={() => handlePackageChange(key, "isEnabled", !enabled)}
                                  className={`w-12 h-6 rounded-full transition-colors ${
                                    enabled ? "bg-green-500" : "bg-gray-300"
                                  }`}
                                >
                                  <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${
                                    enabled ? "translate-x-6" : "translate-x-0.5"
                                  }`} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Orders Tab */}
        {activeTab === "orders" && (
          <Card>
            <CardHeader>
              <CardTitle>All Orders</CardTitle>
              <CardDescription>Orders placed through your shop</CardDescription>
            </CardHeader>
            <CardContent>
              {orders.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No orders yet</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-2">Date</th>
                        <th className="text-left py-2 px-2">Service</th>
                        <th className="text-left py-2 px-2">Phone</th>
                        <th className="text-left py-2 px-2">Package</th>
                        <th className="text-left py-2 px-2">Price</th>
                        <th className="text-left py-2 px-2">Your Markup</th>
                        <th className="text-left py-2 px-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((order) => (
                        <tr key={`${order.serviceType}-${order.id}`} className="border-b">
                          <td className="py-2 px-2">{new Date(order.createdAt).toLocaleString()}</td>
                          <td className="py-2 px-2 capitalize">{order.serviceType}</td>
                          <td className="py-2 px-2">{order.phoneNumber}</td>
                          <td className="py-2 px-2">{order.capacity}</td>
                          <td className="py-2 px-2">GHS {order.price.toFixed(2)}</td>
                          <td className="py-2 px-2 text-green-600">+GHS {(order.shopMarkup || 0).toFixed(2)}</td>
                          <td className="py-2 px-2">
                            <span className={`px-2 py-0.5 rounded text-xs ${getStatusBadge(order.status)}`}>
                              {order.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Withdrawals Tab */}
        {activeTab === "withdrawals" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="md:col-span-1">
              <CardHeader>
                <CardTitle>Request Withdrawal</CardTitle>
                <CardDescription>
                  Min: GHS {minWithdrawal} | Fee: GHS {withdrawalFee}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={requestWithdrawal} className="space-y-4">
                  {withdrawError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
                      {withdrawError}
                    </div>
                  )}
                  {withdrawSuccess && (
                    <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded text-sm">
                      {withdrawSuccess}
                    </div>
                  )}
                  
                  <div>
                    <label className="text-sm font-medium">Available Balance</label>
                    <p className="text-2xl font-bold text-green-600">GHS {stats?.availableBalance.toFixed(2)}</p>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Amount (GHS)</label>
                    <Input
                      type="number"
                      min={minWithdrawal}
                      step="0.01"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      placeholder={`Min: ${minWithdrawal}`}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Bank/MoMo Details</label>
                    <textarea
                      value={bankDetails}
                      onChange={(e) => setBankDetails(e.target.value)}
                      placeholder="e.g., MTN MoMo - 0244123456 - John Doe"
                      className="w-full px-3 py-2 border rounded-md text-sm"
                      rows={3}
                    />
                  </div>
                  
                  {withdrawAmount && parseFloat(withdrawAmount) >= minWithdrawal && (
                    <div className="bg-gray-50 p-3 rounded text-sm">
                      <div className="flex justify-between">
                        <span>Amount:</span>
                        <span>GHS {parseFloat(withdrawAmount).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Fee:</span>
                        <span>-GHS {withdrawalFee.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-bold border-t pt-1 mt-1">
                        <span>You'll receive:</span>
                        <span>GHS {(parseFloat(withdrawAmount) - withdrawalFee).toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                  
                  <Button type="submit" className="w-full" disabled={withdrawing}>
                    {withdrawing ? "Processing..." : "Request Withdrawal"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Withdrawal History</CardTitle>
              </CardHeader>
              <CardContent>
                {withdrawals.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No withdrawals yet</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-2">Date</th>
                          <th className="text-left py-2 px-2">Amount</th>
                          <th className="text-left py-2 px-2">Fee</th>
                          <th className="text-left py-2 px-2">Net</th>
                          <th className="text-left py-2 px-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {withdrawals.map((w) => (
                          <tr key={w.id} className="border-b">
                            <td className="py-2 px-2">{new Date(w.requestedAt).toLocaleDateString()}</td>
                            <td className="py-2 px-2">GHS {w.amount.toFixed(2)}</td>
                            <td className="py-2 px-2">GHS {w.fee.toFixed(2)}</td>
                            <td className="py-2 px-2 font-semibold">GHS {w.netAmount.toFixed(2)}</td>
                            <td className="py-2 px-2">
                              <span className={`px-2 py-0.5 rounded text-xs ${getStatusBadge(w.status)}`}>
                                {w.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === "settings" && (
          <Card>
            <CardHeader>
              <CardTitle>Shop Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium">Shop Name</label>
                <Input value={shop.shopName} disabled />
                <p className="text-xs text-gray-500">Contact support to change your shop name</p>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Shop URL</label>
                <Input value={`wirenet.top/shop/${shop.slug}`} disabled />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Shop Description</label>
                <textarea
                  value={shopDescription}
                  onChange={(e) => setShopDescription(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                  rows={4}
                  placeholder="Describe your shop..."
                />
              </div>
              
              <Button onClick={saveSettings} disabled={savingSettings}>
                {savingSettings ? "Saving..." : "Save Settings"}
              </Button>
              
              <div className="border-t pt-6 mt-6">
                <h3 className="font-semibold mb-4">Account Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Name:</span>
                    <p className="font-medium">{user.name}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Email:</span>
                    <p className="font-medium">{user.email}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Phone:</span>
                    <p className="font-medium">{user.phone}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Account Status:</span>
                    <p>
                      <span className={`px-2 py-0.5 rounded text-xs ${getStatusBadge(shop.status)}`}>
                        {shop.status}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
