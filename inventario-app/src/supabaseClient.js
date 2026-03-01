import { createClient } from '@supabase/supabase-js'

// Reemplazá estos valores con los tuyos de Supabase → Settings → API
const SUPABASE_URL = 'https://mdfubelvdettmyywhuvl.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1kZnViZWx2ZGV0dG15eXdodXZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzOTI5NjMsImV4cCI6MjA4Nzk2ODk2M30.nBqaBKyS5N-66MLw6oN10i4OIBrXWgvV043aynx1V2Y'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
