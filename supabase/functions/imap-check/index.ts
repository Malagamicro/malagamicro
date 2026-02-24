import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ImapClient, hasAttachments, findAttachments } from "jsr:@workingdevshero/deno-imap";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function parseAddress(raw: any): { address: string; name: string | null } {
  if (!raw) return { address: 'unknown@unknown.com', name: null };
  if (typeof raw === 'string') {
    const match = raw.match(/<(.+?)>/);
    const address = match ? match[1] : raw.trim();
    const name = raw.replace(/<.+?>/, '').trim() || null;
    return { address, name };
  }
  if (Array.isArray(raw) && raw.length > 0) {
    const first = raw[0];
    if (first.mailbox && first.host) return { address: `${first.mailbox}@${first.host}`, name: first.name || null };
    return parseAddress(first);
  }
  if (raw.mailbox && raw.host) return { address: `${raw.mailbox}@${raw.host}`, name: raw.name || null };
  return { address: String(raw), name: null };
}

function parseAddressList(raw: any): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(r => r.mailbox && r.host ? `${r.mailbox}@${r.host}` : String(r));
  return [String(raw)];
}

function decodePartData(part: any): string {
  if (!part || !part.data) return '';
  const decoder = new TextDecoder('utf-8', { fatal: false });
  let raw = '';
  if (part.data instanceof Uint8Array) raw = decoder.decode(part.data);
  else if (typeof part.data === 'string') raw = part.data;
  else return '';
  const encoding = (part.encoding || '').toUpperCase();
  if (encoding === 'QUOTED-PRINTABLE') {
    raw = raw.replace(/=\r?\n/g, '').replace(/=([0-9A-Fa-f]{2})/g, (_m: string, hex: string) => String.fromCharCode(parseInt(hex, 16)));
  } else if (encoding === 'BASE64') {
    try { raw = atob(raw.replace(/\s/g, '')); } catch { /* keep */ }
  }
  return raw;
}

function findTextParts(bs: any, path = ''): { textSection: string | null; htmlSection: string | null } {
  let textSection: string | null = null;
  let htmlSection: string | null = null;
  if (!bs) return { textSection, htmlSection };
  const type = (bs.type || '').toUpperCase();
  const subtype = (bs.subtype || '').toUpperCase();
  if (type === 'TEXT' && subtype === 'PLAIN') textSection = path || '1';
  else if (type === 'TEXT' && subtype === 'HTML') htmlSection = path || '1';
  if (bs.parts && Array.isArray(bs.parts)) {
    for (let i = 0; i < bs.parts.length; i++) {
      const childPath = path ? `${path}.${i + 1}` : `${i + 1}`;
      const child = findTextParts(bs.parts[i], childPath);
      if (child.textSection && !textSection) textSection = child.textSection;
      if (child.htmlSection && !htmlSection) htmlSection = child.htmlSection;
    }
  }
  return { textSection, htmlSection };
}

function findInlineParts(bs: any, path = ''): Array<{ section: string; contentId: string; type: string; subtype: string; filename?: string }> {
  const results: Array<{ section: string; contentId: string; type: string; subtype: string; filename?: string }> = [];
  if (!bs) return results;
  const type = (bs.type || '').toUpperCase();
  const disposition = bs.disposition?.type?.toUpperCase();
  const cid = bs.id ? bs.id.replace(/[<>]/g, '') : null;
  
  if (type === 'IMAGE' && cid) {
    results.push({
      section: path || '1',
      contentId: cid,
      type: (bs.type || 'image').toLowerCase(),
      subtype: (bs.subtype || 'png').toLowerCase(),
      filename: bs.disposition?.params?.filename || bs.params?.name || `inline_${cid}`,
    });
  }
  
  if (bs.parts && Array.isArray(bs.parts)) {
    for (let i = 0; i < bs.parts.length; i++) {
      const childPath = path ? `${path}.${i + 1}` : `${i + 1}`;
      results.push(...findInlineParts(bs.parts[i], childPath));
    }
  }
  return results;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();

    if (body.profile_id) {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(JSON.stringify({ success: false, error: 'Not authenticated' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

      const { data: profile, error: profileError } = await supabase
        .from('email_profiles').select('*').eq('id', body.profile_id).single();

      if (profileError || !profile) {
        return new Response(JSON.stringify({ success: false, error: 'Profile not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (!profile.imap_host || !profile.imap_user || !profile.imap_password) {
        return new Response(JSON.stringify({ success: false, error: 'IMAP not configured' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // =============================================
      // ACTION: fetch-body - Fetch body for a single message on-demand
      // =============================================
      if (body.action === 'fetch-body' && body.message_uid) {
        let client: ImapClient | null = null;
        try {
          client = new ImapClient({
            host: profile.imap_host.trim(),
            port: profile.imap_port || 993,
            tls: profile.imap_secure !== false,
            username: profile.imap_user.trim(),
            password: profile.imap_password,
          });
          await client.connect();
          await client.authenticate();

          const inbox = await client.selectMailbox('INBOX');

          // Search for the message by UID
          const searchResults = await client.search(`UID ${body.message_uid}`);
          if (!searchResults || searchResults.length === 0) {
            await client.disconnect();
            return new Response(JSON.stringify({ success: false, error: 'Message not found on server' }),
              { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }

          const seqNum = searchResults[0];

          // Fetch bodyStructure to find text parts
          const structMsgs = await client.fetch(`${seqNum}`, { bodyStructure: true });
          if (!structMsgs.length) {
            await client.disconnect();
            return new Response(JSON.stringify({ success: false, error: 'Could not fetch structure' }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }

          const bs = structMsgs[0].bodyStructure;
          const { textSection, htmlSection } = findTextParts(bs);
          const parts: string[] = [];
          if (textSection) parts.push(textSection);
          if (htmlSection) parts.push(htmlSection);
          if (parts.length === 0) parts.push('1');

          // Fetch body parts
          const bodyMsgs = await client.fetch(`${seqNum}`, { bodyParts: parts });
          let bodyText = '';
          let bodyHtml = '';

          if (bodyMsgs.length > 0 && bodyMsgs[0].parts) {
            for (const [section, part] of Object.entries(bodyMsgs[0].parts)) {
              const content = decodePartData(part);
              if (!content) continue;
              if (section === htmlSection || content.includes('<html') || content.includes('<div') || content.includes('<p>')) {
                if (!bodyHtml) bodyHtml = content;
              } else {
                if (!bodyText) bodyText = content;
              }
            }
          }

          // Handle inline images (cid: references)
          const inlineParts = findInlineParts(bs);
          const cidMap: Record<string, string> = {};
          
          if (inlineParts.length > 0 && body.message_id) {
            for (const ip of inlineParts.slice(0, 10)) {
              try {
                const ipMsgs = await client.fetch(`${seqNum}`, { bodyParts: [ip.section] });
                if (ipMsgs.length > 0 && ipMsgs[0].parts && ipMsgs[0].parts[ip.section]) {
                  const imgData = ipMsgs[0].parts[ip.section].data;
                  if (imgData && imgData.length > 0) {
                    const storagePath = `${profile.user_id}/${body.message_id}/inline_${ip.contentId}`;
                    const contentType = `${ip.type}/${ip.subtype}`;
                    const { error: upErr } = await supabase.storage
                      .from('email-attachments')
                      .upload(storagePath, imgData, { contentType, upsert: true });
                    
                    if (!upErr) {
                      // Create a signed URL for the inline image
                      const { data: signedData } = await supabase.storage
                        .from('email-attachments')
                        .createSignedUrl(storagePath, 60 * 60 * 24 * 7); // 7 days
                      
                      if (signedData?.signedUrl) {
                        cidMap[ip.contentId] = signedData.signedUrl;
                      }
                      
                      // Also save as inline attachment record
                      await supabase.from('email_attachments').insert({
                        message_id: body.message_id,
                        user_id: profile.user_id,
                        file_name: ip.filename || `inline_${ip.contentId}`,
                        file_type: contentType,
                        file_size: imgData.length,
                        storage_path: storagePath,
                        content_id: ip.contentId,
                        is_inline: true,
                      });
                    }
                  }
                }
              } catch (e) { console.error('Inline img:', e); }
            }
            
            // Replace cid: references in HTML body
            if (bodyHtml && Object.keys(cidMap).length > 0) {
              for (const [cid, url] of Object.entries(cidMap)) {
                bodyHtml = bodyHtml.replace(new RegExp(`cid:${cid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi'), url);
              }
            }
          }

          // Update the message in DB
          if (body.message_id) {
            await supabase.from('email_messages').update({
              body_text: bodyText || null,
              body_html: bodyHtml || null,
            }).eq('id', body.message_id);
          }

          // Also fetch and save attachment metadata + files
          const msgHasAttachments = bs ? hasAttachments(bs) : false;
          const savedAttachments: any[] = [];

          if (msgHasAttachments && body.message_id) {
            try {
              const attInfos = findAttachments(bs);
              for (const att of attInfos.slice(0, 5)) {
                // Skip inline images already processed
                const attCid = att.id ? att.id.replace(/[<>]/g, '') : null;
                if (attCid && cidMap[attCid]) continue;
                
                try {
                  const attMsgs = await client.fetch(`${seqNum}`, { bodyParts: [att.section] });
                  if (attMsgs.length > 0 && attMsgs[0].parts && attMsgs[0].parts[att.section]) {
                    const fileData = attMsgs[0].parts[att.section].data;
                    if (fileData && fileData.length > 0) {
                      const storagePath = `${profile.user_id}/${body.message_id}/${att.filename || 'attachment'}`;
                      const contentType = `${(att.type || 'application').toLowerCase()}/${(att.subtype || 'octet-stream').toLowerCase()}`;
                      const { error: upErr } = await supabase.storage
                        .from('email-attachments')
                        .upload(storagePath, fileData, { contentType, upsert: true });

                      if (!upErr) {
                        const { data: attRecord } = await supabase.from('email_attachments').insert({
                          message_id: body.message_id,
                          user_id: profile.user_id,
                          file_name: att.filename || 'attachment',
                          file_type: contentType,
                          file_size: att.size || fileData.length,
                          storage_path: storagePath,
                          is_inline: false,
                        }).select().single();
                        if (attRecord) savedAttachments.push(attRecord);
                      }
                    }
                  }
                } catch (e) { console.error('Att fetch:', e); }
              }
            } catch (e) { console.error('Att process:', e); }
          }

          await client.disconnect();

          return new Response(JSON.stringify({
            success: true,
            body_text: bodyText,
            body_html: bodyHtml,
            attachments: savedAttachments,
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

        } catch (err: any) {
          if (client) try { await client.disconnect(); } catch {}
          return new Response(JSON.stringify({ success: false, error: err.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

      // =============================================
      // ACTION: test - Just verify IMAP connection
      // =============================================
      if (body.action === 'test') {
        let client: ImapClient | null = null;
        try {
          client = new ImapClient({
            host: profile.imap_host.trim(),
            port: profile.imap_port || 993,
            tls: profile.imap_secure !== false,
            username: profile.imap_user.trim(),
            password: profile.imap_password,
          });
          await client.connect();
          await client.authenticate();
          await client.disconnect();
          await supabase.from('email_profiles')
            .update({ connection_status: 'connected', last_sync_at: new Date().toISOString() })
            .eq('id', body.profile_id);
          return new Response(JSON.stringify({ success: true, message: 'IMAP OK' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        } catch (err: any) {
          if (client) try { await client.disconnect(); } catch {}
          return new Response(JSON.stringify({ success: false, error: err.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

      // =============================================
      // ACTION: sync (default) - Sync envelope metadata only (no body)
      // =============================================
      const batchSize = Math.min(body.batch_size || 20, 50);
      const pageOffset = body.page_offset || 0;

      let client: ImapClient | null = null;
      try {
        client = new ImapClient({
          host: profile.imap_host.trim(),
          port: profile.imap_port || 993,
          tls: profile.imap_secure !== false,
          username: profile.imap_user.trim(),
          password: profile.imap_password,
        });
        await client.connect();
        await client.authenticate();
        console.log('IMAP connected');

        const inbox = await client.selectMailbox('INBOX');
        const totalMessages = inbox.exists || 0;

        if (totalMessages === 0) {
          await client.disconnect();
          await supabase.from('email_profiles')
            .update({ connection_status: 'connected', last_sync_at: new Date().toISOString() })
            .eq('id', body.profile_id);
          return new Response(JSON.stringify({ success: true, count: 0, message: 'Empty' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const endSeq = Math.max(1, totalMessages - pageOffset);
        const startSeq = Math.max(1, endSeq - batchSize + 1);
        const fetchRange = `${startSeq}:${endSeq}`;
        console.log(`Fetching envelopes ${fetchRange} of ${totalMessages}`);

        // Only fetch envelope + bodyStructure (lightweight, no body content)
        const messages = await client.fetch(fetchRange, {
          envelope: true,
          bodyStructure: true,
          uid: true,
        });

        let insertedCount = 0;
        let skippedCount = 0;

        for (const msg of messages) {
          try {
            const envelope = msg.envelope;
            if (!envelope) continue;

            const messageId = envelope.messageId || msg.uid?.toString() || null;

            if (messageId) {
              const { data: existing } = await supabase
                .from('email_messages').select('id')
                .eq('message_id_header', messageId)
                .eq('profile_id', body.profile_id).maybeSingle();
              if (existing) { skippedCount++; continue; }
            }

            const from = parseAddress(envelope.from);
            const toAddresses = parseAddressList(envelope.to);
            const ccAddresses = parseAddressList(envelope.cc);
            const msgHasAttachments = msg.bodyStructure ? hasAttachments(msg.bodyStructure) : false;

            await supabase.from('email_messages').insert({
              from_address: from.address,
              from_name: from.name,
              subject: envelope.subject || '(Sin asunto)',
              body_text: null, // Will be fetched on-demand
              body_html: null,
              date: envelope.date ? new Date(envelope.date).toISOString() : new Date().toISOString(),
              message_id_header: messageId,
              message_uid: msg.uid?.toString() || null,
              profile_id: body.profile_id,
              user_id: profile.user_id,
              to_addresses: toAddresses.length > 0 ? toAddresses : null,
              cc_addresses: ccAddresses.length > 0 ? ccAddresses : null,
              has_attachments: msgHasAttachments,
              folder: 'inbox',
              is_read: false,
            });

            insertedCount++;
          } catch (e) { console.error('Msg:', e); }
        }

        await client.disconnect();
        await supabase.from('email_profiles')
          .update({ connection_status: 'connected', last_sync_at: new Date().toISOString() })
          .eq('id', body.profile_id);

        const hasMore = startSeq > 1;
        console.log(`Done: ${insertedCount} new, ${skippedCount} skip`);

        return new Response(JSON.stringify({
          success: true, count: insertedCount, skipped: skippedCount,
          total: totalMessages, has_more: hasMore, next_offset: pageOffset + batchSize,
          message: `${insertedCount} sincronizados, ${skippedCount} existían`
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      } catch (imapError: any) {
        console.error('IMAP error:', imapError);
        if (client) try { await client.disconnect(); } catch {}
        await supabase.from('email_profiles')
          .update({ connection_status: 'error' }).eq('id', body.profile_id);
        return new Response(JSON.stringify({ success: false, error: imapError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // MODE 2: n8n webhook
    if (body.emails && Array.isArray(body.emails)) {
      const webhookSecret = Deno.env.get('N8N_WEBHOOK_SECRET');
      const providedSecret = req.headers.get('x-webhook-secret');
      if (webhookSecret && providedSecret !== webhookSecret) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      const { emails, user_id } = body;
      const results = [];
      for (const email of emails) {
        if (email.message_id_header) {
          const { data: existing } = await supabase.from('email_messages')
            .select('id').eq('message_id_header', email.message_id_header).maybeSingle();
          if (existing) { results.push({ id: existing.id, status: 'exists' }); continue; }
        }
        const { data: inserted, error } = await supabase.from('email_messages').insert({
          from_address: email.from_address || 'unknown@unknown.com',
          from_name: email.from_name || null,
          subject: email.subject || '(Sin asunto)',
          body_text: email.body_text || null,
          body_html: email.body_html || null,
          date: email.date || new Date().toISOString(),
          message_id_header: email.message_id_header || null,
          message_uid: email.message_uid || null,
          profile_id: email.profile_id,
          user_id: user_id,
          to_addresses: email.to_addresses || null,
          cc_addresses: email.cc_addresses || null,
          has_attachments: email.has_attachments || false,
          folder: email.folder || 'inbox',
          is_read: false,
        }).select('id').single();
        results.push(error ? { error: error.message } : { id: inserted?.id, status: 'ok' });
      }
      return new Response(JSON.stringify({ success: true, results }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Invalid payload' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
