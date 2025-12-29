// Server-side Supabase client for API routes
// Uses fetch() to call Supabase REST API

const getSupabaseConfig = () => {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
  return { url, key };
};

const supabaseFetch = async (endpoint: string, options: RequestInit = {}) => {
  const { url, key } = getSupabaseConfig();
  if (!url || !key) {
    throw new Error('Supabase configuration missing');
  }

  const response = await fetch(`${url}/rest/v1/${endpoint}`, {
    ...options,
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Prefer': options.method === 'POST' ? 'return=representation' : 'return=representation',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Supabase error: ${response.status} - ${error}`);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
};

// Shop Users
export const shopUsersDB = {
  async create(user: { name: string; email: string; phone: string; password_hash: string }) {
    const data = await supabaseFetch('shop_users', {
      method: 'POST',
      body: JSON.stringify(user),
    });
    return data?.[0];
  },

  async getByEmail(email: string) {
    const data = await supabaseFetch(`shop_users?email=eq.${encodeURIComponent(email)}`);
    return data?.[0] || null;
  },

  async getById(id: string) {
    const data = await supabaseFetch(`shop_users?id=eq.${id}`);
    return data?.[0] || null;
  },

  async update(id: string, updates: any) {
    const data = await supabaseFetch(`shop_users?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ ...updates, updated_at: new Date().toISOString() }),
    });
    return data?.[0];
  },
};

// Shops
export const shopsDB = {
  async create(shop: { user_id: string; shop_name: string; slug: string; description?: string; logo?: string }) {
    const data = await supabaseFetch('shops', {
      method: 'POST',
      body: JSON.stringify(shop),
    });
    return data?.[0];
  },

  async getByUserId(userId: string) {
    const data = await supabaseFetch(`shops?user_id=eq.${userId}`);
    return data?.[0] || null;
  },

  async getBySlug(slug: string) {
    const data = await supabaseFetch(`shops?slug=eq.${encodeURIComponent(slug.toLowerCase())}`);
    return data?.[0] || null;
  },

  async getById(id: string) {
    const data = await supabaseFetch(`shops?id=eq.${id}`);
    return data?.[0] || null;
  },

  async getAll() {
    return await supabaseFetch('shops?order=created_at.desc');
  },

  async getByStatus(status: string) {
    return await supabaseFetch(`shops?status=eq.${status}&order=created_at.desc`);
  },

  async update(id: string, updates: any) {
    const data = await supabaseFetch(`shops?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ ...updates, updated_at: new Date().toISOString() }),
    });
    return data?.[0];
  },

  async updateBalance(shopId: string, markupAmount: number) {
    // First get current balances
    const shop = await this.getById(shopId);
    if (!shop) return null;
    
    const newEarnings = (parseFloat(shop.total_earnings) || 0) + markupAmount;
    const newBalance = (parseFloat(shop.available_balance) || 0) + markupAmount;
    
    return await this.update(shopId, {
      total_earnings: newEarnings,
      available_balance: newBalance,
    });
  },

  async deductBalance(shopId: string, amount: number) {
    const shop = await this.getById(shopId);
    if (!shop) return null;
    
    const newBalance = (parseFloat(shop.available_balance) || 0) - amount;
    
    return await this.update(shopId, {
      available_balance: newBalance,
    });
  },
};

// Shop Package Config
export const shopConfigDB = {
  async getByShopId(shopId: string) {
    return await supabaseFetch(`shop_package_config?shop_id=eq.${shopId}`);
  },

  async getByShopAndService(shopId: string, serviceType: string) {
    return await supabaseFetch(`shop_package_config?shop_id=eq.${shopId}&service_type=eq.${serviceType}`);
  },

  async getOne(shopId: string, serviceType: string, packageId: string) {
    const data = await supabaseFetch(
      `shop_package_config?shop_id=eq.${shopId}&service_type=eq.${serviceType}&package_id=eq.${encodeURIComponent(packageId)}`
    );
    return data?.[0] || null;
  },

  async upsert(config: { shop_id: string; service_type: string; package_id: string; markup_amount: number; is_enabled: boolean }) {
    // Try to find existing config
    const existing = await this.getOne(config.shop_id, config.service_type, config.package_id);
    
    if (existing) {
      // Update existing
      const data = await supabaseFetch(`shop_package_config?id=eq.${existing.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          markup_amount: config.markup_amount,
          is_enabled: config.is_enabled,
          updated_at: new Date().toISOString(),
        }),
      });
      return data?.[0];
    } else {
      // Insert new
      const data = await supabaseFetch('shop_package_config', {
        method: 'POST',
        body: JSON.stringify({
          ...config,
          updated_at: new Date().toISOString(),
        }),
      });
      return data?.[0];
    }
  },

  async delete(id: string) {
    await supabaseFetch(`shop_package_config?id=eq.${id}`, {
      method: 'DELETE',
    });
  },
};

// Withdrawals
export const withdrawalsDB = {
  async create(withdrawal: { shop_id: string; amount: number; fee: number; net_amount: number; bank_name: string; account_number: string; account_name: string }) {
    const data = await supabaseFetch('withdrawals', {
      method: 'POST',
      body: JSON.stringify({ ...withdrawal, status: 'pending' }),
    });
    return data?.[0];
  },

  async getByShopId(shopId: string) {
    return await supabaseFetch(`withdrawals?shop_id=eq.${shopId}&order=created_at.desc`);
  },

  async getAll() {
    return await supabaseFetch('withdrawals?order=created_at.desc');
  },

  async getByStatus(status: string) {
    return await supabaseFetch(`withdrawals?status=eq.${status}&order=created_at.desc`);
  },

  async update(id: string, updates: any) {
    const data = await supabaseFetch(`withdrawals?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ ...updates, updated_at: new Date().toISOString() }),
    });
    return data?.[0];
  },
};

// Shop Orders (using existing Supabase orders table)
export const shopOrdersDB = {
  async getByShopId(shopId: string, service?: string) {
    let query = `orders?shop_id=eq.${shopId}&order=created_at.desc`;
    if (service) {
      query += `&category=eq.${service}`;
    }
    return await supabaseFetch(query);
  },

  async getStats(shopId: string) {
    const orders = await this.getByShopId(shopId);
    
    let totalOrders = orders?.length || 0;
    let totalEarnings = 0;
    
    orders?.forEach((order: any) => {
      totalEarnings += parseFloat(order.shop_markup) || 0;
    });
    
    return {
      totalOrders,
      totalEarnings,
    };
  },
};
