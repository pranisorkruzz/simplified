import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function normalizeEmail(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function userExists(
  adminClient: ReturnType<typeof createClient>,
  email: string,
) {
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      throw error;
    }

    if (data.users.some((user) => user.email?.toLowerCase() === email)) {
      return true;
    }

    if (!data.nextPage || data.users.length === 0) {
      return false;
    }

    page = data.nextPage;
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return json(500, { error: 'Server auth configuration is missing.' });
  }

  const { email: rawEmail, redirectTo: rawRedirectTo } = (await request
    .json()
    .catch(() => ({}))) as {
    email?: unknown;
    redirectTo?: unknown;
  };

  const email = normalizeEmail(rawEmail);

  if (!email) {
    return json(400, { error: 'Email is required.' });
  }

  if (!isValidEmail(email)) {
    return json(400, { error: 'Enter a valid email address.' });
  }

  const redirectTo =
    typeof rawRedirectTo === 'string' && rawRedirectTo.trim().length > 0
      ? rawRedirectTo.trim()
      : undefined;

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    const exists = await userExists(adminClient, email);

    if (!exists) {
      return json(404, { error: 'No account found for that email.' });
    }

    const { error } = await adminClient.auth.resetPasswordForEmail(email, {
      ...(redirectTo ? { redirectTo } : {}),
    });

    if (error) {
      throw error;
    }

    return json(200, {
      success: true,
      message: 'Password reset link sent.',
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to send reset link.';

    return json(500, { error: message });
  }
});
