import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    const date = body.date || new Date().toISOString().split('T')[0];

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('outlook');

    const startDateTime = `${date}T06:00:00Z`; // 9am Bahrain = 6am UTC
    const endDateTime = `${date}T14:00:00Z`;   // 5pm Bahrain = 2pm UTC

    const params = new URLSearchParams({
      startDateTime,
      endDateTime,
      '$orderby': 'start/dateTime',
      '$select': 'id,subject,start,end,location,isAllDay',
      '$top': '50',
    });

    const res = await fetch(`https://graph.microsoft.com/v1.0/me/calendarView?${params.toString()}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Graph API error: ${res.status} ${text}`);
    }

    const data = await res.json();
    return Response.json({ events: data?.value || [] });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});