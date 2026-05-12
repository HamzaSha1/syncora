import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  try { await base44.auth.me(); } catch (_) {}

  const { accessToken } = await base44.asServiceRole.connectors.getConnection('outlook');

  // Fetch last 100 inbox emails (include webLink)
  const inboxRes = await fetch(
    `https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$top=100&$orderby=receivedDateTime desc&$select=id,subject,from,receivedDateTime,isRead,isDraft,bodyPreview,conversationId,webLink`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const inboxData = await inboxRes.json();
  const inboxEmails = inboxData.value || [];

  // Fetch sent items to detect replied conversations
  const sentRes = await fetch(
    `https://graph.microsoft.com/v1.0/me/mailFolders/sentitems/messages?$top=200&$orderby=sentDateTime desc&$select=id,conversationId&$filter=isDraft eq false`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const sentData = await sentRes.json();
  const repliedConversationIds = new Set(
    (sentData.value || []).map((e) => e.conversationId).filter(Boolean)
  );

  // Build indexed summaries for AI, storing webLink separately
  const emailIndex = inboxEmails.map((e, i) => ({
    index: i,
    subject: e.subject || '(no subject)',
    from: e.from?.emailAddress?.name || e.from?.emailAddress?.address || 'Unknown',
    receivedDateTime: e.receivedDateTime,
    isRead: e.isRead,
    bodyPreview: (e.bodyPreview || '').slice(0, 200),
    hasReplied: repliedConversationIds.has(e.conversationId),
    webLink: e.webLink || null,
  }));

  // Summaries passed to AI (no webLink needed by AI)
  const emailSummaries = emailIndex.map(({ index, subject, from, receivedDateTime, isRead, bodyPreview, hasReplied }) => ({
    index, subject, from, receivedDateTime, isRead, bodyPreview, hasReplied,
  }));

  const today = new Date().toISOString().split('T')[0];

  const prompt = `You are an executive assistant helping analyze emails. Today is ${today}.

Here are the last 100 inbox emails (most recent first). Each has an "index" field, plus: subject, from, receivedDateTime, isRead, bodyPreview, hasReplied.

Emails:
${JSON.stringify(emailSummaries, null, 2)}

Return a JSON with exactly 4 arrays. Each array item must be an object with:
- "label": short actionable description (max 15 words, include sender name and subject context)
- "emailIndex": the index number of the email this refers to

Rules:
- "focus_today": Emails urgently needing attention today (recent, important senders, deadlines, time-sensitive). Only if hasReplied is false.
- "need_to_reply": Emails where a reply is clearly expected AND hasReplied is STRICTLY false. NEVER include hasReplied=true.
- "need_to_read": Unread (isRead=false) important emails. Only if hasReplied is false.
- "opened_not_replied": isRead=true AND hasReplied is STRICTLY false and a response seems warranted. NEVER include hasReplied=true.

CRITICAL: hasReplied=true means already replied — do NOT include in any category.
Avoid overlap. Max 8 items per category.`;

  const itemSchema = {
    type: 'object',
    properties: {
      label: { type: 'string' },
      emailIndex: { type: 'number' },
    },
  };

  const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt,
    response_json_schema: {
      type: 'object',
      properties: {
        focus_today: { type: 'array', items: itemSchema },
        need_to_reply: { type: 'array', items: itemSchema },
        need_to_read: { type: 'array', items: itemSchema },
        opened_not_replied: { type: 'array', items: itemSchema },
      },
    },
  });

  // Enrich each item with the webLink from emailIndex
  for (const key of ['focus_today', 'need_to_reply', 'need_to_read', 'opened_not_replied']) {
    result[key] = (result[key] || []).map((item) => ({
      label: item.label,
      webLink: emailIndex[item.emailIndex]?.webLink || null,
    }));
  }

  const scanned_at = new Date().toISOString();

  // Store result in entity (keep only latest)
  const existing = await base44.asServiceRole.entities.EmailIntelResult.list('-created_date', 10);
  await Promise.all(existing.map((r) => base44.asServiceRole.entities.EmailIntelResult.delete(r.id)));
  await base44.asServiceRole.entities.EmailIntelResult.create({ ...result, scanned_at });

  return Response.json({ ...result, scanned_at });
});