import { createClient } from "@supabase/supabase-js";

// Public Supabase credentials — safe to expose, RLS protects data.
const SUPABASE_URL = "https://tsiqczzubjgytlvxxqyp.supabase.co/rest/v1/";
const SUPABASE_ANON_KEY = "sb_publishable_s4rIQktf5PZ_VKOWCG6_Cg_6YGlp0Jl";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
