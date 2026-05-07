import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let query = '';
    try { const body = await req.json(); if (body.query) query = body.query.trim(); } catch (_) {}

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('outlook');
    const select = 'id,subject,from,receivedDateTime,webLink,bodyPreview';
    const url = query
      ? `https://graph.microsoft.com/v1.0/me/messages?$select=${select}&$search="${encodeURIComponent(query)}"&$top=20`
      : `https://graph.microsoft.com/v1.0/me/messages?$select=${select}&$orderby=receivedDateTime%20desc&$top=20`;

    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${accessToken}` } });
    const text = await res.text();
    if (!res.ok) return Response.json({ error: `Graph API error: ${res.status}`, details: text }, { status: 500 });
    const data = JSON.parse(text);
    return Response.json({ emails: data.value || [] });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});
