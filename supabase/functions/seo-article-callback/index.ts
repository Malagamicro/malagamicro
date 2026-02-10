import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function uploadBase64Image(
  supabase: any,
  base64DataUrl: string,
  articleId: string
): Promise<string | null> {
  try {
    const match = base64DataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!match) {
      console.error('Invalid base64 data URL format');
      return null;
    }

    const mimeType = match[1];
    const base64Data = match[2];
    const ext = mimeType.split('/')[1] || 'png';
    const fileName = `${articleId}/hero.${ext}`;

    const bytes = base64ToUint8Array(base64Data);

    const { error } = await supabase.storage
      .from('seo-images')
      .upload(fileName, bytes, {
        contentType: mimeType,
        upsert: true,
      });

    if (error) {
      console.error('Storage upload error:', error);
      return null;
    }

    const { data: publicUrl } = supabase.storage
      .from('seo-images')
      .getPublicUrl(fileName);

    console.log('Image uploaded successfully:', publicUrl.publicUrl);
    return publicUrl.publicUrl;
  } catch (e) {
    console.error('Error uploading base64 image:', e);
    return null;
  }
}

function buildHtmlWithImage(title: string, htmlBody: string, imageUrl: string, altText: string): string {
  const imgTag = `<figure class="seo-hero-image" style="margin:2rem 0;text-align:center;">
    <img src="${imageUrl}" alt="${altText}" style="max-width:100%;height:auto;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,0.12);" />
    <figcaption style="margin-top:0.5rem;font-size:0.875rem;color:#666;">${altText}</figcaption>
  </figure>`;

  // If there's existing HTML, embed image after first heading
  if (htmlBody && htmlBody.trim()) {
    const headingMatch = htmlBody.match(/<\/h[12]>/i);
    if (headingMatch && headingMatch.index !== undefined) {
      const insertPos = headingMatch.index + headingMatch[0].length;
      return htmlBody.slice(0, insertPos) + imgTag + htmlBody.slice(insertPos);
    }
    return imgTag + htmlBody;
  }

  // If no HTML body, create a minimal article wrapper with just the title and image
  return `<article>
    <h1>${title || 'Artículo SEO'}</h1>
    ${imgTag}
  </article>`;
}

// Normalize the n8n payload into a common structure
function normalizePayload(payload: any, urlArticleId: string | null) {
  // Format A (new n8n format): { seo, images, html, articleid/articleId }
  if (payload.seo) {
    console.log('Detected n8n format: seo/images/html');
    return {
      articleId: payload.articleId || payload.articleid || urlArticleId,
      success: true,
      title: payload.seo.title,
      metaDescription: payload.seo.description,
      slug: payload.seo.slug,
      keywords: typeof payload.seo.keywords === 'string'
        ? payload.seo.keywords.split(',').map((k: string) => k.trim()).filter(Boolean)
        : payload.seo.keywords || [],
      htmlContent: payload.html || '',
      images: payload.images || [],
    };
  }

  // Format B (legacy): { articleId, success, article, images, metrics, ... }
  console.log('Detected legacy callback format');
  return {
    articleId: payload.articleId || urlArticleId,
    success: payload.success !== false,
    title: payload.article?.title,
    metaDescription: payload.article?.metaDescription,
    slug: payload.article?.slug,
    keywords: payload.article?.keywords || [],
    htmlContent: payload.article?.htmlContent || payload.html || '',
    images: payload.images || [],
    research: payload.research,
    metrics: payload.metrics,
    optimizations: payload.optimizations,
    workflowId: payload.workflowId,
    error: payload.error,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Accept articleId from query params as fallback
    const url = new URL(req.url);
    const urlArticleId = url.searchParams.get('articleId');

    const payload = await req.json();
    console.log('Received callback payload:', JSON.stringify(payload).substring(0, 500));

    const normalized = normalizePayload(payload, urlArticleId);

    if (!normalized.articleId) {
      throw new Error('articleId is required (send in body or as ?articleId= query param)');
    }

    const articleId = normalized.articleId;

    if (!normalized.success) {
      console.log(`Recording error for article ${articleId}`);
      await supabase
        .from('seo_articles')
        .update({
          status: 'error',
          error_message: normalized.error?.message || normalized.error?.userMessage || 'Error generating article',
          error_details: normalized.error || payload,
        })
        .eq('id', articleId);

      return new Response(
        JSON.stringify({ success: false, message: 'Error recorded' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process images - find base64 or regular URLs
    let finalImageUrl: string | null = null;
    const images = normalized.images;

    if (Array.isArray(images) && images.length > 0) {
      const firstImage = images[0];
      const imageUrl = typeof firstImage === 'string' ? firstImage : firstImage?.url;

      if (imageUrl) {
        if (imageUrl.startsWith('data:image')) {
          finalImageUrl = await uploadBase64Image(supabase, imageUrl, articleId);
        } else {
          finalImageUrl = imageUrl;
        }
      }
    } else if (typeof images === 'string' && images.startsWith('data:image')) {
      finalImageUrl = await uploadBase64Image(supabase, images, articleId);
    }

    // Build final HTML with embedded image
    const altText = normalized.title || 'Imagen del artículo SEO';
    let finalHtml = normalized.htmlContent;

    if (finalImageUrl) {
      finalHtml = buildHtmlWithImage(normalized.title || '', finalHtml, finalImageUrl, altText);
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      status: 'completed',
      title: normalized.title,
      slug: normalized.slug,
      meta_description: normalized.metaDescription,
      keywords: normalized.keywords,
      html_content: finalHtml,
      workflow_id: normalized.workflowId || null,
    };

    if (finalImageUrl) {
      updateData.images = [{ url: finalImageUrl, altText }];
      updateData.images_success_count = 1;
      updateData.images_failed_count = 0;
    }

    if (normalized.research) {
      updateData.research_summary = normalized.research.summary;
    }

    if (normalized.metrics) {
      updateData.seo_score = normalized.metrics.seoScore;
      updateData.word_count = normalized.metrics.wordCount;
      updateData.security_score = normalized.metrics.securityScore;
    }

    if (normalized.optimizations) {
      updateData.optimizations = normalized.optimizations.applied || [];
      updateData.suggested_links = normalized.optimizations.suggestedLinks || [];
    }

    const { error: updateError } = await supabase
      .from('seo_articles')
      .update(updateData)
      .eq('id', articleId);

    if (updateError) {
      console.error('Error updating article:', updateError);
      throw new Error('Failed to update article');
    }

    console.log(`Article ${articleId} updated successfully with image: ${finalImageUrl}`);

    return new Response(
      JSON.stringify({ success: true, message: 'Article updated', imageUrl: finalImageUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Callback error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
