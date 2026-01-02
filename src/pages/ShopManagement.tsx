import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  ArrowLeft, Store, Users, Wallet, CheckCircle, XCircle, 
  Clock, ExternalLink, Search, Ban, Check, DollarSign, UserPlus, Shield, TrendingUp
} from "lucide-react";

interface Shop {
  id: number;
  userId: number;
  shopName: string;
  slug: string;
  description: string | null;
  status: string;
  totalEarnings: number;
  availableBalance: number;
  createdAt: string;
  canRegisterNewShops?: boolean;
  registeredBy?: number | null;
  registeredByName?: string | null;
}

interface ShopWithUser extends Shop {
  owner: {
    id: number;
    email: string;
    name: string;
    phone: string;
  } | null;
  stats?: {
    totalOrders: number;
    totalEarnings: number;
  };
}

interface Withdrawal {
  id: number;
  shopId: number;
  shop_id?: number;
  amount: number;
  fee: number;
  netAmount: number;
  net_amount?: number;
  bankName: string;
  bank_name?: string;
  accountNumber: string;
  account_number?: string;
  accountName: string;
  account_name?: string;
  network?: string;
  status: string;
  createdAt: string;
  created_at?: string;
  processedAt: string | null;
  processed_at?: string | null;
  shop?: {
    shopName: string;
    shop_name?: string;
  };
}

interface ShopSettings {
  minWithdrawalAmount: number;
  withdrawalFee: number;
  shopRegistrationOpen: boolean;
  shopOwnerCanRegister: boolean;
  maxRegistrationsPerOwner: number;
}

export default function ShopManagement() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<"shops" | "withdrawals" | "settings">("shops");
  const [shops, setShops] = useState<ShopWithUser[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [settings, setSettings] = useState<ShopSettings>({ minWithdrawalAmount: 10, withdrawalFee: 0, shopRegistrationOpen: true, shopOwnerCanRegister: true, maxRegistrationsPerOwner: 10 });
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  
  // Settings editing
  const [editingSettings, setEditingSettings] = useState(false);
  const [tempSettings, setTempSettings] = useState<ShopSettings>({ minWithdrawalAmount: 10, withdrawalFee: 0, shopRegistrationOpen: true, shopOwnerCanRegister: true, maxRegistrationsPerOwner: 10 });
  
  // Bulk selection for registration privilege
  const [selectedShops, setSelectedShops] = useState<Set<number>>(new Set());
  const [bulkUpdating, setBulkUpdating] = useState(false);

  useEffect(() => {
    loadShops();
    loadWithdrawals();
    loadSettings();
  }, []);

  const loadShops = async () => {
    try {
      const response = await fetch("/api/admin/shops", { credentials: "include" });
      if (response.ok) {
        const data = await response.json();
        // API returns { shops: [...] } or just [...]
        setShops(Array.isArray(data) ? data : (data.shops || []));
      } else {
        // Table may not exist yet
        setShops([]);
      }
    } catch (error) {
      console.error("Failed to load shops:", error);
      setShops([]);
    } finally {
      setLoading(false);
    }
  };

  const loadWithdrawals = async () => {
    try {
      const response = await fetch("/api/admin/withdrawals", { credentials: "include" });
      if (response.ok) {
        const data = await response.json();
        setWithdrawals(Array.isArray(data) ? data : (data.withdrawals || []));
      } else {
        setWithdrawals([]);
      }
    } catch (error) {
      console.error("Failed to load withdrawals:", error);
      setWithdrawals([]);
    }
  };

  const loadSettings = async () => {
    try {
      const response = await fetch("/api/admin/shop-settings", { credentials: "include" });
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
        setTempSettings(data);
      }
    } catch (error) {
      console.error("Failed to load settings:", error);
    }
  };

  const approveShop = async (shopId: number) => {
    try {
      const response = await fetch(`/api/admin/shops/${shopId}/approve`, {
        method: "PUT",
        credentials: "include"
      });
      if (response.ok) {
        await loadShops();
      }
    } catch (error) {
      console.error("Failed to approve shop:", error);
    }
  };

  const banShop = async (shopId: number) => {
    if (!confirm("Are you sure you want to ban this shop?")) return;
    try {
      const response = await fetch(`/api/admin/shops/${shopId}/ban`, {
        method: "PUT",
        credentials: "include"
      });
      if (response.ok) {
        await loadShops();
      }
    } catch (error) {
      console.error("Failed to ban shop:", error);
    }
  };

  const processWithdrawal = async (withdrawalId: number, action: "approve" | "reject") => {
    try {
      const response = await fetch(`/api/admin/withdrawals/${withdrawalId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: action === "approve" ? "completed" : "rejected" })
      });
      if (response.ok) {
        await loadWithdrawals();
        await loadShops();
      }
    } catch (error) {
      console.error("Failed to process withdrawal:", error);
    }
  };

  const saveSettings = async () => {
    try {
      const response = await fetch("/api/admin/shop-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(tempSettings)
      });
      if (response.ok) {
        setSettings(tempSettings);
        setEditingSettings(false);
      }
    } catch (error) {
      console.error("Failed to save settings:", error);
    }
  };

  // Toggle registration privilege for a single shop
  const toggleRegistrationPrivilege = async (shopId: number, currentValue: boolean) => {
    try {
      const response = await fetch(`/api/admin/shops/${shopId}/toggle-registration`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ canRegisterNewShops: !currentValue })
      });
      if (response.ok) {
        // Update local state
        setShops(prev => prev.map(s => 
          s.id === shopId ? { ...s, canRegisterNewShops: !currentValue } : s
        ));
      }
    } catch (error) {
      console.error("Failed to toggle registration:", error);
    }
  };

  // Bulk toggle registration privilege
  const bulkToggleRegistration = async (enable: boolean) => {
    if (selectedShops.size === 0) {
      alert("Please select at least one shop");
      return;
    }
    setBulkUpdating(true);
    try {
      const response = await fetch("/api/admin/shops/bulk-toggle-registration", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ 
          shopIds: Array.from(selectedShops), 
          canRegisterNewShops: enable 
        })
      });
      if (response.ok) {
        // Update local state
        setShops(prev => prev.map(s => 
          selectedShops.has(s.id) ? { ...s, canRegisterNewShops: enable } : s
        ));
        setSelectedShops(new Set());
      }
    } catch (error) {
      console.error("Failed to bulk toggle:", error);
    } finally {
      setBulkUpdating(false);
    }
  };

  // Select/deselect all filtered shops
  const toggleSelectAll = () => {
    if (selectedShops.size === filteredShops.length) {
      setSelectedShops(new Set());
    } else {
      setSelectedShops(new Set(filteredShops.map(s => s.id)));
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800",
      approved: "bg-green-100 text-green-800",
      active: "bg-green-100 text-green-800",
      completed: "bg-green-100 text-green-800",
      banned: "bg-red-100 text-red-800",
      rejected: "bg-red-100 text-red-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  const filteredShops = shops.filter(shop => {
    const matchesSearch = 
      shop.shopName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (shop.owner?.email || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (shop.owner?.name || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || shop.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const pendingWithdrawals = withdrawals.filter(w => w.status === "pending");

  const stats = {
    totalShops: shops.length,
    pendingShops: shops.filter(s => s.status === "pending").length,
    activeShops: shops.filter(s => s.status === "approved").length,
    pendingWithdrawals: pendingWithdrawals.length,
    totalPendingAmount: pendingWithdrawals.reduce((sum, w) => sum + w.amount, 0),
    totalAvailableProfits: shops.reduce((sum, s) => sum + (s.availableBalance || 0), 0)
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/admin")}>
              <ArrowLeft size={18} className="mr-1" /> Back to Dashboard
            </Button>
          </div>
          <h1 className="text-xl font-bold">Shop Management</h1>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Store className="h-8 w-8 text-violet-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.totalShops}</p>
                  <p className="text-xs text-gray-500">Total Shops</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Clock className="h-8 w-8 text-yellow-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.pendingShops}</p>
                  <p className="text-xs text-gray-500">Pending Approval</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.activeShops}</p>
                  <p className="text-xs text-gray-500">Active Shops</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Wallet className="h-8 w-8 text-amber-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.pendingWithdrawals}</p>
                  <p className="text-xs text-gray-500">Pending Withdrawals</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <DollarSign className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">GHS {stats.totalPendingAmount.toFixed(0)}</p>
                  <p className="text-xs text-gray-500">Pending Amount</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-8 w-8 text-emerald-500" />
                <div>
                  <p className="text-2xl font-bold">GHS {stats.totalAvailableProfits.toFixed(2)}</p>
                  <p className="text-xs text-gray-500">Total Available Profits</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b mb-6">
          {[
            { id: "shops", label: "Shops", icon: Store },
            { id: "withdrawals", label: `Withdrawals ${stats.pendingWithdrawals > 0 ? `(${stats.pendingWithdrawals})` : ""}`, icon: Wallet },
            { id: "settings", label: "Settings", icon: Users },
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

        {/* Shops Tab */}
        {activeTab === "shops" && (
          <div className="space-y-4">
            {/* Filters and Bulk Actions */}
            <div className="flex flex-wrap gap-4 items-center">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                <Input
                  placeholder="Search by shop name, email, or owner..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border rounded-md"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="banned">Banned</option>
              </select>
              
              {/* Bulk Actions */}
              {selectedShops.size > 0 && (
                <div className="flex items-center gap-2 bg-violet-50 px-3 py-1 rounded-md">
                  <span className="text-sm text-violet-700 font-medium">{selectedShops.size} selected</span>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => bulkToggleRegistration(true)}
                    disabled={bulkUpdating}
                    className="text-green-600 border-green-600 hover:bg-green-50"
                  >
                    <UserPlus size={14} className="mr-1" /> Enable Reg
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => bulkToggleRegistration(false)}
                    disabled={bulkUpdating}
                    className="text-red-600 border-red-600 hover:bg-red-50"
                  >
                    <Ban size={14} className="mr-1" /> Disable Reg
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={() => setSelectedShops(new Set())}
                  >
                    Clear
                  </Button>
                </div>
              )}
            </div>

            {/* Shops Table */}
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="py-3 px-2 w-8">
                          <input
                            type="checkbox"
                            checked={selectedShops.size === filteredShops.length && filteredShops.length > 0}
                            onChange={toggleSelectAll}
                            className="rounded border-gray-300"
                          />
                        </th>
                        <th className="text-left py-3 px-4">Shop</th>
                        <th className="text-left py-3 px-4">Owner</th>
                        <th className="text-left py-3 px-4">Registered By</th>
                        <th className="text-left py-3 px-4">Contact</th>
                        <th className="text-left py-3 px-4">Earnings</th>
                        <th className="text-left py-3 px-4">Can Register</th>
                        <th className="text-left py-3 px-4">Status</th>
                        <th className="text-left py-3 px-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredShops.map((shop) => (
                        <tr key={shop.id} className={`border-b hover:bg-gray-50 ${selectedShops.has(shop.id) ? 'bg-violet-50' : ''}`}>
                          <td className="py-3 px-2">
                            <input
                              type="checkbox"
                              checked={selectedShops.has(shop.id)}
                              onChange={(e) => {
                                const newSelected = new Set(selectedShops);
                                if (e.target.checked) {
                                  newSelected.add(shop.id);
                                } else {
                                  newSelected.delete(shop.id);
                                }
                                setSelectedShops(newSelected);
                              }}
                              className="rounded border-gray-300"
                            />
                          </td>
                          <td className="py-3 px-4">
                            <div>
                              <p className="font-medium">{shop.shopName}</p>
                              <p className="text-xs text-gray-500">/shop/{shop.slug}</p>
                            </div>
                          </td>
                          <td className="py-3 px-4">{shop.owner?.name || "N/A"}</td>
                          <td className="py-3 px-4">
                            {shop.registeredByName ? (
                              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                                {shop.registeredByName}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">Direct</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div>
                              <p className="text-xs">{shop.owner?.email || "N/A"}</p>
                              <p className="text-xs text-gray-500">{shop.owner?.phone || "N/A"}</p>
                            </div>
                          </td>
                          <td className="py-3 px-4">GHS {shop.totalEarnings.toFixed(2)}</td>
                          <td className="py-3 px-4">
                            <button
                              onClick={() => toggleRegistrationPrivilege(shop.id, shop.canRegisterNewShops !== false)}
                              className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                                shop.canRegisterNewShops !== false 
                                  ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                              }`}
                              title={shop.canRegisterNewShops !== false ? "Click to disable" : "Click to enable"}
                            >
                              {shop.canRegisterNewShops !== false ? (
                                <>
                                  <Shield size={12} /> Yes
                                </>
                              ) : (
                                <>
                                  <XCircle size={12} /> No
                                </>
                              )}
                            </button>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-1 rounded text-xs ${getStatusBadge(shop.status)}`}>
                              {shop.status}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex gap-2">
                              {shop.status === "pending" && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => approveShop(shop.id)}
                                  className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                >
                                  <Check size={16} className="mr-1" /> Approve
                                </Button>
                              )}
                              {shop.status !== "banned" && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => banShop(shop.id)}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Ban size={16} className="mr-1" /> Ban
                                </Button>
                              )}
                              <a
                                href={`/shop/${shop.slug}`}
                                target="_blank"
                                className="inline-flex items-center gap-1 px-2 py-1 text-sm text-violet-600 hover:underline"
                              >
                                <ExternalLink size={14} /> View
                              </a>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredShops.length === 0 && (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-gray-500">
                            No shops found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Withdrawals Tab */}
        {activeTab === "withdrawals" && (
          <Card>
            <CardHeader>
              <CardTitle>Withdrawal Requests</CardTitle>
              <CardDescription>Process shop owner withdrawal requests</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left py-3 px-4">Date</th>
                      <th className="text-left py-3 px-4">Shop</th>
                      <th className="text-left py-3 px-4">Amount</th>
                      <th className="text-left py-3 px-4">Fee</th>
                      <th className="text-left py-3 px-4">Net Amount</th>
                      <th className="text-left py-3 px-4">Bank Details</th>
                      <th className="text-left py-3 px-4">Status</th>
                      <th className="text-left py-3 px-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {withdrawals.map((w) => (
                      <tr key={w.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4">{new Date(w.createdAt || w.created_at || Date.now()).toLocaleDateString()}</td>
                        <td className="py-3 px-4">{w.shop?.shopName || w.shop?.shop_name || `Shop #${w.shopId || w.shop_id}`}</td>
                        <td className="py-3 px-4">GHS {(w.amount || 0).toFixed(2)}</td>
                        <td className="py-3 px-4">GHS {(w.fee || 0).toFixed(2)}</td>
                        <td className="py-3 px-4 font-medium">GHS {(w.netAmount || w.net_amount || 0).toFixed(2)}</td>
                        <td className="py-3 px-4">
                          <div className="text-xs">
                            <div className="font-medium">{w.network || 'Mobile Money'}</div>
                            <div>{w.accountNumber || w.account_number || '-'}</div>
                            <div className="text-gray-500">{w.accountName || w.account_name || '-'}</div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded text-xs ${getStatusBadge(w.status)}`}>
                            {w.status}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {w.status === "pending" && (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => processWithdrawal(w.id, "approve")}
                                className="text-green-600 hover:text-green-700 hover:bg-green-50"
                              >
                                <Check size={16} className="mr-1" /> Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => processWithdrawal(w.id, "reject")}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <XCircle size={16} className="mr-1" /> Reject
                              </Button>
                            </div>
                          )}
                          {w.status !== "pending" && (
                            <span className="text-xs text-gray-500">
                              {(w.processedAt || w.processed_at) ? new Date(w.processedAt || w.processed_at!).toLocaleDateString() : "-"}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {withdrawals.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-gray-500">
                          No withdrawal requests
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Settings Tab */}
        {activeTab === "settings" && (
          <Card className="max-w-lg">
            <CardHeader>
              <CardTitle>Shop System Settings</CardTitle>
              <CardDescription>Configure withdrawal limits and fees</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Minimum Withdrawal Amount (GHS)</label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={editingSettings ? tempSettings.minWithdrawalAmount : settings.minWithdrawalAmount}
                  onChange={(e) => setTempSettings(prev => ({ ...prev, minWithdrawalAmount: parseFloat(e.target.value) || 0 }))}
                  disabled={!editingSettings}
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Withdrawal Fee (GHS)</label>
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  value={editingSettings ? tempSettings.withdrawalFee : settings.withdrawalFee}
                  onChange={(e) => setTempSettings(prev => ({ ...prev, withdrawalFee: parseFloat(e.target.value) || 0 }))}
                  disabled={!editingSettings}
                />
              </div>

              <div className="space-y-2 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium">Public Shop Registration</label>
                    <p className="text-xs text-gray-500">Allow new users to register shops directly (changes instantly)</p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      const newValue = !settings.shopRegistrationOpen;
                      try {
                        const response = await fetch("/api/admin/shop-settings", {
                          method: "PUT",
                          headers: { "Content-Type": "application/json" },
                          credentials: "include",
                          body: JSON.stringify({ shopRegistrationOpen: newValue })
                        });
                        if (response.ok) {
                          setSettings(prev => ({ ...prev, shopRegistrationOpen: newValue }));
                          setTempSettings(prev => ({ ...prev, shopRegistrationOpen: newValue }));
                        }
                      } catch (error) {
                        console.error("Failed to toggle registration:", error);
                      }
                    }}
                    style={{
                      width: '56px',
                      height: '28px',
                      borderRadius: '14px',
                      backgroundColor: settings.shopRegistrationOpen ? '#22c55e' : '#d1d5db',
                      position: 'relative',
                      cursor: 'pointer',
                      border: 'none',
                      padding: 0,
                      transition: 'background-color 0.2s'
                    }}
                  >
                    <span
                      style={{
                        position: 'absolute',
                        top: '2px',
                        left: settings.shopRegistrationOpen ? '30px' : '2px',
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        backgroundColor: 'white',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                        transition: 'left 0.2s'
                      }}
                    />
                  </button>
                </div>
                <p className={`text-sm font-medium ${settings.shopRegistrationOpen ? 'text-green-600' : 'text-red-600'}`}>
                  {settings.shopRegistrationOpen ? '✓ Public registration is OPEN' : '✗ Public registration is CLOSED'}
                </p>
              </div>

              {/* Shop Owner Registration Privilege */}
              <div className="space-y-2 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium">Shop Owner Can Register Others</label>
                    <p className="text-xs text-gray-500">Allow existing shop owners to register new vendors/agents (master switch)</p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      const newValue = !settings.shopOwnerCanRegister;
                      try {
                        const response = await fetch("/api/admin/shop-settings", {
                          method: "PUT",
                          headers: { "Content-Type": "application/json" },
                          credentials: "include",
                          body: JSON.stringify({ shopOwnerCanRegister: newValue })
                        });
                        if (response.ok) {
                          setSettings(prev => ({ ...prev, shopOwnerCanRegister: newValue }));
                          setTempSettings(prev => ({ ...prev, shopOwnerCanRegister: newValue }));
                        }
                      } catch (error) {
                        console.error("Failed to toggle owner registration:", error);
                      }
                    }}
                    style={{
                      width: '56px',
                      height: '28px',
                      borderRadius: '14px',
                      backgroundColor: settings.shopOwnerCanRegister ? '#22c55e' : '#d1d5db',
                      position: 'relative',
                      cursor: 'pointer',
                      border: 'none',
                      padding: 0,
                      transition: 'background-color 0.2s'
                    }}
                  >
                    <span
                      style={{
                        position: 'absolute',
                        top: '2px',
                        left: settings.shopOwnerCanRegister ? '30px' : '2px',
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        backgroundColor: 'white',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                        transition: 'left 0.2s'
                      }}
                    />
                  </button>
                </div>
                <p className={`text-sm font-medium ${settings.shopOwnerCanRegister ? 'text-green-600' : 'text-red-600'}`}>
                  {settings.shopOwnerCanRegister ? '✓ Shop owners CAN register new vendors' : '✗ Shop owners CANNOT register new vendors'}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Max Registrations Per Shop Owner</label>
                <p className="text-xs text-gray-500">Maximum number of new shops each owner can register</p>
                <Input
                  type="number"
                  min="1"
                  max="100"
                  step="1"
                  value={editingSettings ? tempSettings.maxRegistrationsPerOwner : settings.maxRegistrationsPerOwner}
                  onChange={(e) => setTempSettings(prev => ({ ...prev, maxRegistrationsPerOwner: parseInt(e.target.value) || 10 }))}
                  disabled={!editingSettings}
                />
              </div>
              
              <div className="flex gap-2 pt-4">
                {editingSettings ? (
                  <>
                    <Button onClick={saveSettings}>Save Settings</Button>
                    <Button variant="ghost" onClick={() => {
                      setEditingSettings(false);
                      setTempSettings(settings);
                    }}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button onClick={() => setEditingSettings(true)}>Edit Settings</Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
