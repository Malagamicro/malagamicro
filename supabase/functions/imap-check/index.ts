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
    if (first.mailbox && first.host) {
      return { address: `${first.mailbox}@${first.host}`, name: first.name || null };
    }
    return parseAddress(first);
  }
  if (raw.mailbox && raw.host) {
    return { address: `${raw.mailbox}@${raw.host}`, name: raw.name || null };
  }
  return { address: String(raw), name: null };
}

function parseAddressList(raw: any): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map(r => {
      if (r.mailbox && r.host) return `${r.mailbox}@${r.host}`;
      return String(r);
    });
  }
  return [String(raw)];
}

// Decode Uint8Array part data to string, handling different encodings
function decodePartData(part: any): string {
  if (!part || !part.data) return '';
  
  const decoder = new TextDecoder('utf-8', { fatal: false });
  let raw = '';
  
  if (part.data instanceof Uint8Array) {
    raw = decoder.decode(part.data);
  } else if (typeof part.data === 'string') {
    raw = part.data;
  } else {
    return '';
  }

  // Handle quoted-printable encoding
  const encoding = (part.encoding || '').toUpperCase();
  if (encoding === 'QUOTED-PRINTABLE') {
    raw = raw
      .replace(/=\r?\n/g, '') // soft line breaks
      .replace(/=([0-9A-Fa-f]{2})/g, (_m: string, hex: string) => String.fromCharCode(parseInt(hex, 16)));
  } else if (encoding === 'BASE64') {
    try {
      raw = atob(raw.replace(/\s/g, ''));
    } catch { /* keep as-is */ }
  }

  return raw;
}

// Walk bodyStructure recursively to find text parts and their section paths
function findTextParts(bs: any, path = ''): { textSection: string | null; htmlSection: string | null } {
  let textSection: string | null = null;
  let htmlSection: string | null = null;

  if (!bs) return { textSection, htmlSection };

  const type = (bs.type || '').toUpperCase();
  const subtype = (bs.subtype || '').toUpperCase();

  if (type === 'TEXT' && subtype === 'PLAIN') {
    textSection = path || '1';
  } else if (type === 'TEXT' && subtype === 'HTML') {
    htmlSection = path || '1';
  }

  // Check child parts
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    // MODE 1: Real IMAP sync from the app (profile_id provided)
    if (body.profile_id) {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(
          JSON.stringify({ success: false, error: 'Not authenticated' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      const { data: profile, error: profileError } = await supabase
        .from('email_profiles')
        .select('*')
        .eq('id', body.profile_id)
        .single();

      if (profileError || !profile) {
        return new Response(
          JSON.stringify({ success: false, error: 'Profile not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!profile.imap_host || !profile.imap_user || !profile.imap_password) {
        return new Response(
          JSON.stringify({ success: false, error: 'IMAP not configured. Please fill in IMAP host, user, and password.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const isTestOnly = body.action === 'test';

      let client: ImapClient | null = null;
      try {
        const imapHost = profile.imap_host.trim();
        const imapPort = profile.imap_port || 993;
        console.log(`Connecting to IMAP: ${imapHost}:${imapPort}`);
        
        client = new ImapClient({
          host: imapHost,
          port: imapPort,
          tls: profile.imap_secure !== false,
          username: profile.imap_user.trim(),
          password: profile.imap_password,
        });

        await client.connect();
        await client.authenticate();
        console.log('IMAP login successful');

        // Test mode - just verify connection
        if (isTestOnly) {
          await client.disconnect();
          await supabase
            .from('email_profiles')
            .update({ connection_status: 'connected', last_sync_at: new Date().toISOString() })
            .eq('id', body.profile_id);

          return new Response(
            JSON.stringify({ success: true, message: 'IMAP connection verified successfully' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Sync mode - fetch recent emails
        const inbox = await client.selectMailbox('INBOX');
        const totalMessages = inbox.exists || 0;
        console.log(`Mailbox has ${totalMessages} messages`);

        if (totalMessages === 0) {
          await client.disconnect();
          await supabase
            .from('email_profiles')
            .update({ connection_status: 'connected', last_sync_at: new Date().toISOString() })
            .eq('id', body.profile_id);

          return new Response(
            JSON.stringify({ success: true, count: 0, message: 'Mailbox is empty' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Fetch last 50 messages (or fewer if mailbox is smaller)
        const fetchCount = Math.min(totalMessages, 50);
        const startSeq = Math.max(1, totalMessages - fetchCount + 1);
        const fetchRange = `${startSeq}:${totalMessages}`;

        console.log(`Fetching messages ${fetchRange}`);
        
        // First pass: fetch envelope + bodyStructure to get message info and find text parts
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

            // Check if already exists
            if (messageId) {
              const { data: existing } = await supabase
                .from('email_messages')
                .select('id')
                .eq('message_id_header', messageId)
                .eq('profile_id', body.profile_id)
                .maybeSingle();

              if (existing) {
                skippedCount++;
                continue;
              }
            }

            const from = parseAddress(envelope.from);
            const toAddresses = parseAddressList(envelope.to);
            const ccAddresses = parseAddressList(envelope.cc);

            // Determine which body parts to fetch for text/html content
            const { textSection, htmlSection } = findTextParts(msg.bodyStructure);
            const partsToFetch: string[] = [];
            if (textSection) partsToFetch.push(textSection);
            if (htmlSection) partsToFetch.push(htmlSection);
            // Fallback: try common sections
            if (partsToFetch.length === 0) {
              partsToFetch.push('1', '1.1', '1.2');
            }

            // Second fetch: get the actual body parts for this message
            let bodyText = '';
            let bodyHtml = '';

            try {
              const seqStr = `${msg.seq}`;
              const bodyMessages = await client.fetch(seqStr, {
                bodyParts: partsToFetch,
              });

              if (bodyMessages.length > 0) {
                const bm = bodyMessages[0];
                if (bm.parts) {
                  console.log(`Message ${msg.seq} parts keys: ${Object.keys(bm.parts).join(', ')}`);
                  
                  // Try to get content from known sections
                  if (htmlSection && bm.parts[htmlSection]) {
                    bodyHtml = decodePartData(bm.parts[htmlSection]);
                  }
                  if (textSection && bm.parts[textSection]) {
                    bodyText = decodePartData(bm.parts[textSection]);
                  }
                  
                  // Fallback: iterate over all parts and detect content type
                  if (!bodyText && !bodyHtml) {
                    for (const [section, part] of Object.entries(bm.parts)) {
                      const partType = ((part as any).type || '').toLowerCase();
                      const content = decodePartData(part);
                      if (!content) continue;
                      
                      if (partType.includes('html') || content.includes('<html') || content.includes('<div') || content.includes('<p>')) {
                        if (!bodyHtml) bodyHtml = content;
                      } else {
                        if (!bodyText) bodyText = content;
                      }
                    }
                  }
                }
              }
            } catch (fetchErr) {
              console.error(`Error fetching body for msg ${msg.seq}:`, fetchErr);
            }

            const msgHasAttachments = msg.bodyStructure ? hasAttachments(msg.bodyStructure) : false;

            const { data: inserted, error: insertError } = await supabase
              .from('email_messages')
              .insert({
                from_address: from.address,
                from_name: from.name,
                subject: envelope.subject || '(Sin asunto)',
                body_text: bodyText || null,
                body_html: bodyHtml || null,
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
              })
              .select('id')
              .single();

            if (insertError) {
              console.error('Insert error:', insertError.message);
              continue;
            }

            // If message has attachments, try to save them
            if (msgHasAttachments && msg.bodyStructure && inserted) {
              try {
                const attachmentInfos = findAttachments(msg.bodyStructure);
                for (const att of attachmentInfos) {
                  try {
                    const attMessages = await client.fetch(`${msg.seq}`, {
                      bodyParts: [att.section],
                    });
                    
                    if (attMessages.length > 0 && attMessages[0].parts && attMessages[0].parts[att.section]) {
                      const partData = attMessages[0].parts[att.section];
                      const fileData = partData.data;
                      
                      if (fileData && fileData.length > 0) {
                        // Upload to storage
                        const storagePath = `${profile.user_id}/${inserted.id}/${att.filename}`;
                        const { error: uploadError } = await supabase.storage
                          .from('email-attachments')
                          .upload(storagePath, fileData, {
                            contentType: `${att.type.toLowerCase()}/${att.subtype.toLowerCase()}`,
                            upsert: true,
                          });

                        if (!uploadError) {
                          // Save attachment record
                          await supabase.from('email_attachments').insert({
                            message_id: inserted.id,
                            user_id: profile.user_id,
                            file_name: att.filename,
                            file_type: `${att.type.toLowerCase()}/${att.subtype.toLowerCase()}`,
                            file_size: att.size || fileData.length,
                            storage_path: storagePath,
                            is_inline: false,
                          });
                        } else {
                          console.error(`Upload error for ${att.filename}:`, uploadError.message);
                        }
                      }
                    }
                  } catch (attErr) {
                    console.error(`Error fetching attachment ${att.filename}:`, attErr);
                  }
                }
              } catch (attErr) {
                console.error('Error processing attachments:', attErr);
              }
            }

            insertedCount++;
          } catch (msgErr) {
            console.error('Error processing message:', msgErr);
          }
        }

        await client.disconnect();

        // Update profile sync status
        await supabase
          .from('email_profiles')
          .update({ connection_status: 'connected', last_sync_at: new Date().toISOString() })
          .eq('id', body.profile_id);

        console.log(`Sync complete: ${insertedCount} inserted, ${skippedCount} skipped`);

        return new Response(
          JSON.stringify({ 
            success: true, 
            count: insertedCount, 
            skipped: skippedCount,
            total: totalMessages,
            message: `${insertedCount} correos sincronizados, ${skippedCount} ya existían` 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      } catch (imapError: any) {
        console.error('IMAP error:', imapError);
        
        await supabase
          .from('email_profiles')
          .update({ connection_status: 'error' })
          .eq('id', body.profile_id);

        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `IMAP connection failed: ${imapError.message || 'Unknown error'}` 
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // MODE 2: n8n webhook - receive emails (emails array provided) - kept for backward compat
    if (body.emails && Array.isArray(body.emails)) {
      const webhookSecret = Deno.env.get('N8N_WEBHOOK_SECRET');
      const providedSecret = req.headers.get('x-webhook-secret');
      
      if (webhookSecret && providedSecret !== webhookSecret) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      const { emails, user_id } = body;
      const results = [];
      const errors = [];

      for (const email of emails) {
        const { 
          from_address, from_name, subject, body_text, body_html, 
          date, message_id_header, message_uid, profile_id, 
          to_addresses, cc_addresses, has_attachments, folder
        } = email;

        if (message_id_header) {
          const { data: existing } = await supabase
            .from('email_messages')
            .select('id')
            .eq('message_id_header', message_id_header)
            .maybeSingle();

          if (existing) {
            results.push({ id: existing.id, status: 'already_exists' });
            continue;
          }
        }

        const { data: inserted, error: insertError } = await supabase
          .from('email_messages')
          .insert({
            from_address: from_address || 'unknown@unknown.com',
            from_name: from_name || null,
            subject: subject || '(Sin asunto)',
            body_text: body_text || null,
            body_html: body_html || null,
            date: date || new Date().toISOString(),
            message_id_header: message_id_header || null,
            message_uid: message_uid || null,
            profile_id: profile_id,
            user_id: user_id,
            to_addresses: to_addresses || null,
            cc_addresses: cc_addresses || null,
            has_attachments: has_attachments || false,
            folder: folder || 'inbox',
            is_read: false,
          })
          .select('id')
          .single();

        if (insertError) {
          errors.push({ message_id_header, error: insertError.message });
          continue;
        }
        results.push({ id: inserted.id, status: 'inserted' });
      }

      return new Response(
        JSON.stringify({ success: true, processed: results.length, errors: errors.length, results }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid payload: provide profile_id for IMAP sync or emails array for import' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});