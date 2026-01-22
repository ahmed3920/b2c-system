import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TestUser {
  email: string;
  password: string;
  mentorId: string;
  mentorName: string;
  fullName: string;
  teamLeader: string;
  role: "admin" | "team_leader" | "mentor";
}

const testUsers: TestUser[] = [
  {
    email: "admin@ischool.com",
    password: "Admin123!",
    mentorId: "ADM-001",
    mentorName: "System Admin",
    fullName: "System Administrator",
    teamLeader: "N/A",
    role: "admin",
  },
  {
    email: "teamleader@ischool.com",
    password: "Leader123!",
    mentorId: "TL-001",
    mentorName: "Ahmed Hisham",
    fullName: "Ahmed Hisham",
    teamLeader: "Ahmed Hisham",
    role: "team_leader",
  },
  {
    email: "mentor@ischool.com",
    password: "Mentor123!",
    mentorId: "T-1008",
    mentorName: "Andrew Zaky",
    fullName: "Andrew Zaky",
    teamLeader: "Ahmed Hisham",
    role: "mentor",
  },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const createdUsers: { email: string; role: string; created: boolean; error?: string }[] = [];

    for (const user of testUsers) {
      try {
        // Check if user already exists by email
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
        const existingUser = existingUsers?.users?.find((u) => u.email === user.email);

        if (existingUser) {
          console.log(`User ${user.email} already exists, skipping...`);
          createdUsers.push({ email: user.email, role: user.role, created: false, error: "Already exists" });
          continue;
        }

        // Create auth user
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: user.email,
          password: user.password,
          email_confirm: true,
        });

        if (createError) {
          console.error(`Error creating user ${user.email}:`, createError.message);
          createdUsers.push({ email: user.email, role: user.role, created: false, error: createError.message });
          continue;
        }

        // Create profile
        const { error: profileError } = await supabaseAdmin.from("profiles").insert({
          user_id: newUser.user.id,
          mentor_id: user.mentorId,
          mentor_name: user.mentorName,
          full_name: user.fullName,
          email: user.email,
          team_leader: user.teamLeader,
          active_status: true,
        });

        if (profileError) {
          console.error(`Error creating profile for ${user.email}:`, profileError.message);
          await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
          createdUsers.push({ email: user.email, role: user.role, created: false, error: profileError.message });
          continue;
        }

        // Update role if not default mentor
        if (user.role !== "mentor") {
          await supabaseAdmin.from("user_roles").update({ role: user.role }).eq("user_id", newUser.user.id);
        }

        console.log(`Successfully created user ${user.email} with role ${user.role}`);
        createdUsers.push({ email: user.email, role: user.role, created: true });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error(`Error processing user ${user.email}:`, message);
        createdUsers.push({ email: user.email, role: user.role, created: false, error: message });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        users: createdUsers,
        credentials: testUsers.map((u) => ({
          email: u.email,
          password: u.password,
          role: u.role,
        })),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Setup error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
