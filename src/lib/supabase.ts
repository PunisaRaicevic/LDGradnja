import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function getStorageUrl(bucket: string, filePath: string): Promise<string | null> {
  const { data } = await supabase.storage.from(bucket).createSignedUrl(filePath, 3600);
  return data?.signedUrl || null;
}
