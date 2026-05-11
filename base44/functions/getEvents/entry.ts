import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const user = await base44.auth.me();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let date = new Date().toISOString().split('T')[0];
  let timezone = 'Asia/Bahrain';

  try {
    const body = await req.json();
    if (body.date) date = body.date;
    if (body.timezone) timezone = body.timezone;
  } catch (_) {}

  const { accessToken } = await base44.asServiceRole.connectors.getConnection('outlook');

  const start = `${date}T00:00:00`;
  const end = `${date}T23:59:59`;
  const url = `https://graph.microsoft.com/v1.0/me/calendarView?startDateTime=${encodeURIComponent(start)}&endDateTime=${encodeURIComponent(end)}&$orderby=start/dateTime&$select=id,subject,start,end,location,isAllDay,onlineMeeting,onlineMeetingUrl,onlineMeetingProvider,body&$top=100`;

  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Prefer': `outlook.timezone="${timezone}"`,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    return Response.json({ error: `Graph API error: ${res.status}`, details: text }, { status: 500 });
  }

  const data = await res.json();
  return Response.json({ events: data.value || [] });
});