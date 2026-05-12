import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  // Allow both authenticated user calls and scheduled automation calls
  let authed = false;
  try {
    const user = await base44.auth.me();
    if (user) authed = true;
  } catch (_) {}

  const { accessToken } = await base44.asServiceRole.connectors.getConnection('outlook');

  // Fetch last 100 inbox emails
  const inboxRes = await fetch(
    `https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$top=100&$orderby=receivedDateTime desc&$select=id,subject,from,receivedDateTime,isRead,isDraft,bodyPreview,conversationId,toRecipients`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const inboxData = await inboxRes.json();
  const inboxEmails = inboxData.value || [];

  // Fetch last 100 sent emails
  const sentRes = await fetch(
    `https://graph.microsoft.com/v1.0/me/mailFolders/sentitems/messages?$top=100&$orderby=sentDateTime desc&$select=id,subject,toRecipients,sentDateTime,conversationId`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const sentData = await sentRes.json();
  const sentEmails = sentData.value || [];

  // Build a set of conversation IDs that the user has replied to
  const repliedConversationIds = new Set(sentEmails.map((e) => e.conversationId).filter(Boolean));

  // Also fetch sent items that are explicit replies (have inReplyTo) for extra accuracy
  const repliedSentRes = await fetch(
    `https://graph.microsoft.com/v1.0/me/mailFolders/sentitems/messages?$top=200&$orderby=sentDateTime desc&$select=id,conversationId,subject&$filter=isDraft eq false`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const repliedSentData = await repliedSentRes.json();
  const allSentConversationIds = new Set(
    (repliedSentData.value || []).map((e) => e.conversationId).filter(Boolean)
  );
  // Merge both sets
  for (const id of allSentConversationIds) repliedConversationIds.add(id);

  // Prepare email summaries for AI — exclude emails where user has already replied
  const emailSummaries = inboxEmails.map((e) => ({
    subject: e.subject || '(no subject)',
    from: e.from?.emailAddress?.name || e.from?.emailAddress?.address || 'Unknown',
    receivedDateTime: e.receivedDateTime,
    isRead: e.isRead,
    bodyPreview: (e.bodyPreview || '').slice(0, 200),
    hasReplied: repliedConversationIds.has(e.conversationId),
  }));

  const today = new Date().toISOString().split('T')[0];

  const prompt = `You are an executive assistant helping analyze emails. Today is ${today}.

Here are the last 100 inbox emails (most recent first). Each has: subject, from, receivedDateTime, isRead (whether user opened it), bodyPreview, hasReplied (whether user sent a reply in same conversation thread).

Emails:
${JSON.stringify(emailSummaries, null, 2)}

Analyze these emails and return a JSON with exactly 4 arrays of action items. Each item is a short, actionable bullet point (max 15 words). Be specific — include sender name and subject context.

Rules:
- "focus_today": Emails that urgently need attention today (recent, important senders, deadlines, requests, time-sensitive). Only include if hasReplied is false.
- "need_to_reply": Emails where a reply is clearly expected AND hasReplied is STRICTLY false. NEVER include any email where hasReplied is true.
- "need_to_read": Emails that are unread (isRead=false) and seem important enough to read. Only include if hasReplied is false.
- "opened_not_replied": Emails where isRead=true AND hasReplied is STRICTLY false and a response seems warranted. NEVER include any email where hasReplied is true.

CRITICAL: hasReplied=true means the user has already sent a reply in that conversation thread. Do NOT include those in any category.
Avoid overlap between categories. Return max 8 items per category. Be concise and direct.`;

  const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt,
    response_json_schema: {
      type: 'object',
      properties: {
        focus_today: { type: 'array', items: { type: 'string' } },
        need_to_reply: { type: 'array', items: { type: 'string' } },
        need_to_read: { type: 'array', items: { type: 'string' } },
        opened_not_replied: { type: 'array', items: { type: 'string' } },
      },
    },
  });

  const scanned_at = new Date().toISOString();

  // Store result in entity (delete old ones first, keep only latest)
  const existing = await base44.asServiceRole.entities.EmailIntelResult.list('-created_date', 10);
  await Promise.all(existing.map((r) => base44.asServiceRole.entities.EmailIntelResult.delete(r.id)));
  await base44.asServiceRole.entities.EmailIntelResult.create({ ...result, scanned_at });

  return Response.json({ ...result, scanned_at });
});