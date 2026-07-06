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

/**
 * Fetch every row from a Supabase select, paging past PostgREST's default
 * 1000-row cap. `makeQuery` must return a fresh query (with its filters/order
 * applied) each time it is called — this helper appends `.range()` per page.
 */
export async function fetchAllRows<T = any>(makeQuery: () => any): Promise<T[]> {
  const pageSize = 1000;
  let from = 0;
  const all: T[] = [];
  for (;;) {
    const { data, error } = await makeQuery().range(from, from + pageSize - 1);
    if (error) throw error;
    const rows = (data || []) as T[];
    all.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return all;
}
