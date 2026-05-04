import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

async function graphRequest(accessToken, path) {
  const res = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`Graph API error: ${res.status} ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { data } = await req.json();

    if (!data || !data.value) {
      return Response.json({ ok: true });
    }

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('outlook');

    for (const notification of data.value) {
      const { changeType, resourceData } = notification;
      const eventId = resourceData?.id;
      if (!eventId) continue;

      if (changeType === 'deleted') {
        // Find and delete from our entity
        const existing = await base44.asServiceRole.entities.CalendarEvent.filter({ outlook_id: eventId });
        for (const e of existing) {
          await base44.asServiceRole.entities.CalendarEvent.delete(e.id);
        }
        continue;
      }

      // Fetch full event details
      let event;
      try {
        event = await graphRequest(accessToken, `/me/events/${eventId}?$select=id,subject,start,end,location,isAllDay`);
      } catch (err) {
        console.error('Failed to fetch event:', err.message);
        continue;
      }

      if (!event) continue;

      const eventData = {
        outlook_id: event.id,
        subject: event.subject || '(No title)',
        start_datetime: event.start?.dateTime || event.start?.date,
        end_datetime: event.end?.dateTime || event.end?.date,
        location: event.location?.displayName || '',
        is_all_day: event.isAllDay || false,
        change_type: changeType,
      };

      // Check if already exists
      const existing = await base44.asServiceRole.entities.CalendarEvent.filter({ outlook_id: event.id });

      if (existing && existing.length > 0) {
        await base44.asServiceRole.entities.CalendarEvent.update(existing[0].id, eventData);
      } else {
        await base44.asServiceRole.entities.CalendarEvent.create(eventData);
      }
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error('Webhook error:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
});