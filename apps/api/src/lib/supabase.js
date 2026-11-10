import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env.js";

if (!env.supabaseUrl || !env.serviceRoleKey) {
  console.warn("[Seren AI] Supabase credentials are not configured; database routes will be unavailable.");
}

export const supabase = env.supabaseUrl && env.serviceRoleKey
  ? createClient(env.supabaseUrl, env.serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
      db: { schema: "public" },
    })
  : null;

export async function fetchAll(schemaName, tableName, columns = "*", pageSize = 1000) {
  if (!supabase) {
    const error = new Error("Supabase is not configured on the API.");
    error.status = 503;
    throw error;
  }

  const rows = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .schema(schemaName)
      .from(tableName)
      .select(columns)
      .range(offset, offset + pageSize - 1);

    if (error) {
      const wrapped = new Error(
        `Could not read ${schemaName}.${tableName}: ${error.message}. Check the exposed schemas and grants in Supabase.`
      );
      wrapped.status = 503;
      wrapped.code = error.code;
      throw wrapped;
    }

    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}
