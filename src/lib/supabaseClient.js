import { createClient } from '@supabase/supabase-js'

// Bu fayl App.jsx orqali doim import qilinadi (Supabase rejimi tanlanmagan
// bo'lsa ham), shuning uchun VITE_SUPABASE_URL bo'lmaganda ham createClient
// xato tashlamasligi uchun placeholder beriladi — bu holatda klient hech qachon
// chaqirilmaydi (App.jsx lokal WebSocket rejimini tanlaydi).
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co',
  import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder'
)
