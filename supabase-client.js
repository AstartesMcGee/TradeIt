import { createClient } from
  "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = "https://xinpwyppyltzhkudmvvh.supabase.co";
const supabaseKey = "sb_publishable_e3EIbDukeUz4pOLeHPK3oQ_XRWJLV20";

export const supabase = createClient(
  supabaseUrl,
  supabaseKey
);

console.log("Supabase client initialized!");
