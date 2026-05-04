import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const body = await req.json().catch(() => ({}));
  const date = body.date || new Date().toISOString().split('T')[0];

  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { accessToken } = await base44.asServiceRole.connectors.getConnection('outlook');

  const startDateTime = `${date}T06:00:00Z`;
  const endDateTime = `${date}T14:00:00Z`;

  const url = `https://graph.microsoft.com/v1.0/me/calendarView?startDateTime=${startDateTime}&endDateTime=${endDateTime}&$orderby=start/dateTime&$select=id,subject,start,end,location,isAllDay&$top=50`;

  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });

  const text = await res.text();
  if (!res.ok) {
    return Response.json({ error: `Graph API error: ${res.status} ${text}` }, { status: 500 });
  }

  const data = JSON.parse(text);
  return Response.json({ events: data.value || [] });
});