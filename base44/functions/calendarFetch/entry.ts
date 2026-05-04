import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let date = new Date().toISOString().split('T')[0];
    try {
      const body = await req.json();
      if (body.date) date = body.date;
    } catch (_) {}

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('outlook');

    const startDateTime = `${date}T00:00:00Z`;
    const endDateTime = `${date}T23:59:59Z`;

    const url = `https://graph.microsoft.com/v1.0/me/calendarView?startDateTime=${encodeURIComponent(startDateTime)}&endDateTime=${encodeURIComponent(endDateTime)}&$orderby=start/dateTime&$select=id,subject,start,end,location,isAllDay&$top=100`;

    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    const text = await res.text();
    if (!res.ok) {
      return Response.json({ error: `Graph API error: ${res.status}`, details: text }, { status: 500 });
    }

    const data = JSON.parse(text);
    return Response.json({ events: data.value || [] });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});