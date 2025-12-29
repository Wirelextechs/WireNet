import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export const ordersAPI = {
  async create(order: any) {
    const { data, error } = await supabase.from('orders').insert([order]).select()
    if (error) throw error
    return data
  },

  async getAll(category?: string) {
    let query = supabase.from('orders').select('*')
    if (category) query = query.eq('category', category)
    const { data, error } = await query.order('created_at', { ascending: false })
    if (error) throw error
    return data
  },

  async updateStatus(id: string, status: string) {
    const { data, error } = await supabase.from('orders').update({ status, updated_at: new Date() }).eq('id', id).select()
    if (error) throw error
    return data
  },
}

export const packagesAPI = {
  async create(pkg: any) {
    const { data, error } = await supabase.from('packages').insert([pkg]).select()
    if (error) throw error
    return data
  },

  async getByCategory(category: string) {
    const { data, error } = await supabase.from('packages').select('*').eq('category', category).eq('enabled', true).order('price', { ascending: true })
    if (error) throw error
    return data?.map((pkg: any) => ({
      id: pkg.id,
      dataAmount: `${pkg.data_amount}GB`,
      price: Number(pkg.price),
      deliveryTime: pkg.delivery_time,
      isEnabled: pkg.enabled,
    }))
  },

  async update(id: string, updates: any) {
    const { data, error } = await supabase.from('packages').update({ ...updates, updated_at: new Date() }).eq('id', id).select()
    if (error) throw error
    return data
  },

  async delete(id: string) {
    const { error } = await supabase.from('packages').delete().eq('id', id)
    if (error) throw error
  },

  async getAll(category: string) {
    const { data, error } = await supabase.from('packages').select('*').eq('category', category).order('price', { ascending: true })
    if (error) throw error
    return data?.map((pkg: any) => ({
      id: pkg.id,
      dataAmount: `${pkg.data_amount}GB`,
      price: Number(pkg.price),
      deliveryTime: pkg.delivery_time,
      isEnabled: pkg.enabled,
    }))
  },

  async toggle(id: string, enabled: boolean) {
    const { data, error } = await supabase.from('packages').update({ enabled, updated_at: new Date() }).eq('id', id).select()
    if (error) throw error
    return data
  },
}

export const settingsAPI = {
  async get(category: string, key: string) {
    const { data, error } = await supabase.from('settings').select('value').eq('category', category).eq('key', key).single()
    if (error && error.code !== 'PGRST116') throw error
    return data?.value
  },

  async set(category: string, key: string, value: any) {
    const { data, error } = await supabase.from('settings').upsert({ category, key, value: JSON.stringify(value), updated_at: new Date() }, { onConflict: 'category,key' }).select()
    if (error) throw error
    return data
  },

  async getAll(category: string) {
    const { data, error } = await supabase.from('settings').select('key,value').eq('category', category)
    if (error) throw error
    return data?.reduce((acc: any, item: any) => { acc[item.key] = JSON.parse(item.value); return acc }, {})
  },
}

// Shop Users API
export const shopUsersAPI = {
  async create(user: { name: string; email: string; phone: string; password_hash: string }) {
    const { data, error } = await supabase.from('shop_users').insert([user]).select()
    if (error) throw error
    return data?.[0]
  },

  async getByEmail(email: string) {
    const { data, error } = await supabase.from('shop_users').select('*').eq('email', email).single()
    if (error && error.code !== 'PGRST116') throw error
    return data
  },

  async getById(id: string) {
    const { data, error } = await supabase.from('shop_users').select('*').eq('id', id).single()
    if (error && error.code !== 'PGRST116') throw error
    return data
  },

  async update(id: string, updates: any) {
    const { data, error } = await supabase.from('shop_users').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select()
    if (error) throw error
    return data?.[0]
  },
}

// Shops API
export const shopsAPI = {
  async create(shop: { user_id: string; shop_name: string; slug: string; description?: string; logo?: string }) {
    const { data, error } = await supabase.from('shops').insert([shop]).select()
    if (error) throw error
    return data?.[0]
  },

  async getByUserId(userId: string) {
    const { data, error } = await supabase.from('shops').select('*').eq('user_id', userId).single()
    if (error && error.code !== 'PGRST116') throw error
    return data
  },

  async getBySlug(slug: string) {
    const { data, error } = await supabase.from('shops').select('*').eq('slug', slug.toLowerCase()).single()
    if (error && error.code !== 'PGRST116') throw error
    return data
  },

  async getById(id: string) {
    const { data, error } = await supabase.from('shops').select('*').eq('id', id).single()
    if (error && error.code !== 'PGRST116') throw error
    return data
  },

  async getAll() {
    const { data, error } = await supabase.from('shops').select('*').order('created_at', { ascending: false })
    if (error) throw error
    return data || []
  },

  async getByStatus(status: string) {
    const { data, error } = await supabase.from('shops').select('*').eq('status', status).order('created_at', { ascending: false })
    if (error) throw error
    return data || []
  },

  async update(id: string, updates: any) {
    const { data, error } = await supabase.from('shops').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select()
    if (error) throw error
    return data?.[0]
  },

  async updateBalance(shopId: string, markupAmount: number) {
    // First get current balances
    const shop = await this.getById(shopId)
    if (!shop) return null
    
    const newEarnings = (parseFloat(shop.total_earnings) || 0) + markupAmount
    const newBalance = (parseFloat(shop.available_balance) || 0) + markupAmount
    
    const { data, error } = await supabase.from('shops').update({
      total_earnings: newEarnings,
      available_balance: newBalance,
      updated_at: new Date().toISOString()
    }).eq('id', shopId).select()
    if (error) throw error
    return data?.[0]
  },

  async deductBalance(shopId: string, amount: number) {
    const shop = await this.getById(shopId)
    if (!shop) return null
    
    const newBalance = (parseFloat(shop.available_balance) || 0) - amount
    
    const { data, error } = await supabase.from('shops').update({
      available_balance: newBalance,
      updated_at: new Date().toISOString()
    }).eq('id', shopId).select()
    if (error) throw error
    return data?.[0]
  },
}

// Shop Package Config API
export const shopConfigAPI = {
  async getByShopId(shopId: string) {
    const { data, error } = await supabase.from('shop_package_config').select('*').eq('shop_id', shopId)
    if (error) throw error
    return data || []
  },

  async getByShopAndService(shopId: string, serviceType: string) {
    const { data, error } = await supabase.from('shop_package_config').select('*').eq('shop_id', shopId).eq('service_type', serviceType)
    if (error) throw error
    return data || []
  },

  async getOne(shopId: string, serviceType: string, packageId: string) {
    const { data, error } = await supabase.from('shop_package_config')
      .select('*')
      .eq('shop_id', shopId)
      .eq('service_type', serviceType)
      .eq('package_id', packageId)
      .single()
    if (error && error.code !== 'PGRST116') throw error
    return data
  },

  async upsert(config: { shop_id: string; service_type: string; package_id: string; markup_amount: number; is_enabled: boolean }) {
    const { data, error } = await supabase.from('shop_package_config')
      .upsert({
        ...config,
        updated_at: new Date().toISOString()
      }, { onConflict: 'shop_id,service_type,package_id' })
      .select()
    if (error) throw error
    return data?.[0]
  },

  async delete(id: string) {
    const { error } = await supabase.from('shop_package_config').delete().eq('id', id)
    if (error) throw error
  },
}

// Withdrawals API
export const withdrawalsAPI = {
  async create(withdrawal: { shop_id: string; amount: number; fee: number; net_amount: number; bank_name: string; account_number: string; account_name: string }) {
    const { data, error } = await supabase.from('withdrawals').insert([{ ...withdrawal, status: 'pending' }]).select()
    if (error) throw error
    return data?.[0]
  },

  async getByShopId(shopId: string) {
    const { data, error } = await supabase.from('withdrawals').select('*').eq('shop_id', shopId).order('created_at', { ascending: false })
    if (error) throw error
    return data || []
  },

  async getAll() {
    const { data, error } = await supabase.from('withdrawals').select('*').order('created_at', { ascending: false })
    if (error) throw error
    return data || []
  },

  async getByStatus(status: string) {
    const { data, error } = await supabase.from('withdrawals').select('*').eq('status', status).order('created_at', { ascending: false })
    if (error) throw error
    return data || []
  },

  async update(id: string, updates: any) {
    const { data, error } = await supabase.from('withdrawals').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select()
    if (error) throw error
    return data?.[0]
  },
}
