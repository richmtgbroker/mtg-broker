/**
 * mtg-broker-contact-edit — Cloudflare Worker
 * =========================================================
 * Handles magic link self-edit flow for contacts:
 *   POST /api/contact-edit/request  → send magic link email via Resend
 *   POST /api/contact-edit/verify   → check if edit token is valid
 *   POST /api/contact-edit/save     → save self-edits (pending review)
 *
 * REQUIRED SECRETS (set in Cloudflare dashboard → Workers → Settings → Variables):
 *   SUPABASE_SERVICE_KEY — Supabase service role key
 *   RESEND_API_KEY       — Resend API key for sending emails
 *
 * DEPLOY:
 *   wrangler deploy workers/mtg-broker-contact-edit.js \
 *     --name mtg-broker-contact-edit \
 *     --compatibility-date 2024-01-01
 * =========================================================
 */

const SUPABASE_URL = 'https://tcmahfwhdknxhhdvqpum.supabase.co';
const APP_URL = 'https://mtg.broker';
const TOKEN_EXPIRY_HOURS = 48;
const FROM_EMAIL = 'noreply@mtg.broker';
const ADMIN_EMAIL = 'rich@prestonlending.com';

// CORS headers
function corsHeaders(request) {
  return {
    'Access-Control-Allow-Origin': request.headers.get('Origin') || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function jsonResponse(data, status, request) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(request) },
  });
}

// Generate a secure random token
function generateToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

// Supabase helper — query contacts by slug
async function getContactBySlug(slug, serviceKey) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/contacts?slug=eq.${encodeURIComponent(slug)}&limit=1`,
    {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.length > 0 ? data[0] : null;
}

// Supabase helper — update contact by id
async function updateContact(id, fields, serviceKey) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/contacts?id=eq.${id}`,
    {
      method: 'PATCH',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(fields),
    }
  );
  return res.ok;
}

// Send email via Resend
async function sendEmail(to, subject, html, resendKey) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `mtg.broker <${FROM_EMAIL}>`,
      to: [to],
      subject,
      html,
    }),
  });
  return res.ok;
}

// Send admin notification
async function notifyAdmin(contactName, contactSlug, resendKey) {
  const detailUrl = `${APP_URL}/app/contacts/${contactSlug}`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto;">
      <h2 style="color: #0F172A;">Contact Update Pending Review</h2>
      <p><strong>${contactName}</strong> has submitted changes to their contact information.</p>
      <p><a href="${detailUrl}" style="display: inline-block; padding: 10px 20px; background: #2563EB; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 600;">Review Changes</a></p>
    </div>
  `;
  await sendEmail(ADMIN_EMAIL, `Contact Update: ${contactName}`, html, resendKey);
}


// ============================================================
// ROUTE HANDLERS
// ============================================================

/**
 * POST /api/contact-edit/request
 * Body: { email, slug }
 * Sends a magic link if the email matches the contact's email.
 */
async function handleRequest(body, env, request) {
  const { email, slug } = body;
  if (!email || !slug) {
    return jsonResponse({ error: 'Email and slug are required.' }, 400, request);
  }

  const contact = await getContactBySlug(slug, env.SUPABASE_SERVICE_KEY);
  if (!contact) {
    return jsonResponse({ error: 'Contact not found.' }, 404, request);
  }

  // Check email matches (case-insensitive)
  if (!contact.email || contact.email.toLowerCase() !== email.toLowerCase()) {
    // Don't reveal whether the email matches — just say "sent" for security
    // But actually don't send anything
    return jsonResponse({ success: true, message: 'If the email matches, you will receive an edit link.' }, 200, request);
  }

  // Generate token and save to Supabase
  const token = generateToken();
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000).toISOString();

  const updated = await updateContact(contact.id, {
    edit_token: token,
    edit_token_expires_at: expiresAt,
  }, env.SUPABASE_SERVICE_KEY);

  if (!updated) {
    return jsonResponse({ error: 'Failed to generate edit link.' }, 500, request);
  }

  // Build magic link
  const editUrl = `${APP_URL}/app/contacts/${slug}?edit_token=${token}`;

  // Send email
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #0F172A; font-size: 22px; margin: 0 0 4px 0;">Update Your Contact Info</h1>
        <p style="color: #64748B; font-size: 14px; margin: 0;">mtg.broker Contact Directory</p>
      </div>

      <p style="color: #334155; font-size: 14px; line-height: 1.6;">
        Hi ${contact.preferred_name || contact.name},
      </p>
      <p style="color: #334155; font-size: 14px; line-height: 1.6;">
        You requested to update your contact information. Click the button below to edit your profile:
      </p>

      <div style="text-align: center; margin: 28px 0;">
        <a href="${editUrl}" style="display: inline-block; padding: 12px 32px; background: #2563EB; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">
          Edit My Information
        </a>
      </div>

      <p style="color: #94A3B8; font-size: 12px; line-height: 1.5;">
        This link expires in ${TOKEN_EXPIRY_HOURS} hours. If you didn't request this, you can safely ignore this email.
      </p>

      <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 24px 0;" />
      <p style="color: #CBD5E1; font-size: 11px; text-align: center;">
        mtg.broker — Mortgage Broker SaaS Platform
      </p>
    </div>
  `;

  const sent = await sendEmail(contact.email, 'Edit your contact info — mtg.broker', html, env.RESEND_API_KEY);

  if (!sent) {
    return jsonResponse({ error: 'Failed to send email. Please try again.' }, 500, request);
  }

  return jsonResponse({ success: true, message: 'Edit link sent to your email.' }, 200, request);
}

/**
 * POST /api/contact-edit/verify
 * Body: { token, slug }
 * Returns { valid: true/false }
 */
async function handleVerify(body, env, request) {
  const { token, slug } = body;
  if (!token || !slug) {
    return jsonResponse({ valid: false }, 200, request);
  }

  const contact = await getContactBySlug(slug, env.SUPABASE_SERVICE_KEY);
  if (!contact) {
    return jsonResponse({ valid: false }, 200, request);
  }

  // Check token matches and hasn't expired
  if (
    contact.edit_token !== token ||
    !contact.edit_token_expires_at ||
    new Date(contact.edit_token_expires_at) < new Date()
  ) {
    return jsonResponse({ valid: false }, 200, request);
  }

  return jsonResponse({ valid: true }, 200, request);
}

/**
 * POST /api/contact-edit/save
 * Body: { token, slug, changes: { preferred_name, job_title, ... } }
 * Saves changes as pending_changes and flags for review.
 */
async function handleSave(body, env, request) {
  const { token, slug, changes } = body;
  if (!token || !slug || !changes) {
    return jsonResponse({ error: 'Missing required fields.' }, 400, request);
  }

  const contact = await getContactBySlug(slug, env.SUPABASE_SERVICE_KEY);
  if (!contact) {
    return jsonResponse({ error: 'Contact not found.' }, 404, request);
  }

  // Verify token
  if (
    contact.edit_token !== token ||
    !contact.edit_token_expires_at ||
    new Date(contact.edit_token_expires_at) < new Date()
  ) {
    return jsonResponse({ error: 'Edit link expired or invalid.' }, 403, request);
  }

  // Whitelist of editable fields
  const allowedFields = [
    'preferred_name', 'job_title', 'mobile', 'office', 'extension',
    'linkedin', 'zoom_room', 'bio', 'nmls', 'territory_states',
  ];

  const sanitizedChanges = {};
  for (const field of allowedFields) {
    if (changes[field] !== undefined) {
      sanitizedChanges[field] = changes[field];
    }
  }

  // Save changes and flag for review
  const updated = await updateContact(contact.id, {
    pending_changes: sanitizedChanges,
    pending_review: true,
    last_self_edit_at: new Date().toISOString(),
    // Invalidate the token after use (one-time use)
    edit_token: null,
    edit_token_expires_at: null,
  }, env.SUPABASE_SERVICE_KEY);

  if (!updated) {
    return jsonResponse({ error: 'Failed to save changes.' }, 500, request);
  }

  // Notify admin
  try {
    await notifyAdmin(contact.preferred_name || contact.name, slug, env.RESEND_API_KEY);
  } catch {
    // Non-critical — changes are saved even if notification fails
  }

  return jsonResponse({ success: true, message: 'Changes submitted for review.' }, 200, request);
}


// ============================================================
// WORKER ENTRY POINT
// ============================================================
export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405, request);
    }

    const url = new URL(request.url);
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400, request);
    }

    // Route to handler
    if (url.pathname.endsWith('/request')) {
      return handleRequest(body, env, request);
    }
    if (url.pathname.endsWith('/verify')) {
      return handleVerify(body, env, request);
    }
    if (url.pathname.endsWith('/save')) {
      return handleSave(body, env, request);
    }

    return jsonResponse({ error: 'Not found' }, 404, request);
  },
};
