import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { query = '' } = await req.json().catch(() => ({}));

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('outlook');

    const filter = query
      ? `&$search="subject:${query} OR from:${query}"`
      : '';

    const url = `https://graph.microsoft.com/v1.0/me/messages?$top=20&$orderby=receivedDateTime desc&$select=id,subject,from,receivedDateTime,webLink${filter}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const err = await res.text();
      return Response.json({ error: err }, { status: res.status });
    }

    const data = await res.json();
    return Response.json({ emails: data.value || [] });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});