import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

async function graphRequest(accessToken, path) {
  const res = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Graph API error: ${res.status} ${text}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('outlook');

    let date = new Date().toISOString().split('T')[0];
    try {
      const body = await req.json();
      if (body.date) date = body.date;
    } catch (_) {}

    // Use full day with timezone offset for Bahrain (UTC+3)
    const startDateTime = `${date}T09:00:00`;
    const endDateTime = `${date}T17:00:00`;

    const params = new URLSearchParams({
      startDateTime,
      endDateTime,
      '$orderby': 'start/dateTime',
      '$select': 'id,subject,start,end,location,isAllDay',
      '$top': '50',
    });

    const data = await graphRequest(accessToken, `/me/calendarView?${params.toString()}`);

    return Response.json({ events: data?.value || [] });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});