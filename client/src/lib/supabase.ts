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
