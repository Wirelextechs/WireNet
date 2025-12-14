import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://fvpapjdflprmkrqxkzkl.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2cGFwamRmbHBybWtycXhremtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2NjIwNjEsImV4cCI6MjA4MTIzODA2MX0.Ps5MdzORDDZCeC1OlTZ0kpj0x_TOINn6x3JfEi0-vFc'

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
    const { data, error } = await supabase.from('packages').select('*').eq('category', category).eq('enabled', true).order('data_amount', { ascending: true })
    if (error) throw error
    return data
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
