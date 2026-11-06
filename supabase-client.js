import { createClient } from
  "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = "https://xinpwyppyltzhkudmvvh.supabase.co";
const supabaseKey = "sb_publishable_e3EIbDukeUz4pOLeHPK3oQ_XRWJLV20";

export const supabase = createClient(
  supabaseUrl,
  supabaseKey
);

console.log("Supabase client initialized!");

// Temporary test function
window.testSignup = async function (email, password) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password
  });

  if (error) {
    console.error("Signup failed:", error.message);
    return;
  }

  console.log("Signup request completed:", data);
};
