import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authorization = req.headers.get("Authorization") || "";

    const callerClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const { data: callerData, error: callerError } = await callerClient.auth.getUser();
    const caller = callerData.user;

    if (callerError || !caller || caller.app_metadata?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Admin access required" }), { status: 403, headers: cors });
    }

    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "list");

    if (action === "list") {
      const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (error) throw error;
      const users = (data.users || [])
        .filter((u) => ["admin", "guest"].includes(String(u.app_metadata?.role || "")))
        .map((u) => ({ id: u.id, email: u.email, role: u.app_metadata?.role || "user", created_at: u.created_at, last_sign_in_at: u.last_sign_in_at }))
        .sort((a, b) => String(a.email || "").localeCompare(String(b.email || "")));
      return new Response(JSON.stringify({ users }), { headers: cors });
    }

    if (action === "invite_guest") {
      const email = String(body?.email || "").trim().toLowerCase();
      const redirectTo = String(body?.redirect_to || "").trim();
      if (!email || !email.includes("@")) return new Response(JSON.stringify({ error: "A valid email is required" }), { status: 400, headers: cors });

      const { data: existingData, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (listError) throw listError;
      let user = (existingData.users || []).find((u) => String(u.email || "").toLowerCase() === email) || null;

      if (!user) {
        const inviteOptions = redirectTo ? { redirectTo } : undefined;
        const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, inviteOptions);
        if (inviteError) throw inviteError;
        user = invited.user;
      }
      if (!user) throw new Error("Unable to create or find guest");

      if (user.app_metadata?.role === "admin") {
        return new Response(JSON.stringify({ ok: true, user: { id: user.id, email: user.email, role: "admin" } }), { headers: cors });
      }

      const { data: updated, error: updateError } = await admin.auth.admin.updateUserById(user.id, {
        app_metadata: { ...(user.app_metadata || {}), role: "guest" },
      });
      if (updateError) throw updateError;
      return new Response(JSON.stringify({ ok: true, user: { id: updated.user.id, email: updated.user.email, role: updated.user.app_metadata?.role } }), { headers: cors });
    }

    if (action === "revoke_guest") {
      const userId = String(body?.user_id || "");
      if (!userId) return new Response(JSON.stringify({ error: "user_id is required" }), { status: 400, headers: cors });
      const { data: target, error: getError } = await admin.auth.admin.getUserById(userId);
      if (getError) throw getError;
      if (!target.user) throw new Error("User not found");
      if (target.user.app_metadata?.role === "admin") return new Response(JSON.stringify({ error: "Admin access cannot be revoked here" }), { status: 400, headers: cors });

      const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
        app_metadata: { ...(target.user.app_metadata || {}), role: "user" },
      });
      if (updateError) throw updateError;
      return new Response(JSON.stringify({ ok: true }), { headers: cors });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: cors });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), { status: 500, headers: cors });
  }
});
