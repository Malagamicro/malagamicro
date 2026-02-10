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
    // Extract mime type and base64 data
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

    const { data, error } = await supabase.storage
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

function embedImageInHtml(htmlContent: string, imageUrl: string, altText: string): string {
  if (!htmlContent) return htmlContent;
  
  const imgTag = `<figure class="seo-hero-image" style="margin:2rem 0;text-align:center;"><img src="${imageUrl}" alt="${altText}" style="max-width:100%;height:auto;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,0.12);" /><figcaption style="margin-top:0.5rem;font-size:0.875rem;color:#666;">${altText}</figcaption></figure>`;
  
  // Insert after first heading (h1 or h2)
  const headingMatch = htmlContent.match(/<\/h[12]>/i);
  if (headingMatch && headingMatch.index !== undefined) {
    const insertPos = headingMatch.index + headingMatch[0].length;
    return htmlContent.slice(0, insertPos) + imgTag + htmlContent.slice(insertPos);
  }
  
  // Fallback: prepend
  return imgTag + htmlContent;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload = await req.json();
    console.log('Received callback from n8n:', JSON.stringify(payload).substring(0, 500));

    const { articleId, success, workflowId, article, research, images, metrics, optimizations, error: n8nError } = payload;

    if (!articleId) {
      throw new Error('articleId is required');
    }

    if (success) {
      console.log(`Updating article ${articleId} with success data`);
      
      const updateData: Record<string, unknown> = {
        status: 'completed',
        workflow_id: workflowId,
      };

      let htmlContent = article?.htmlContent || '';

      if (article) {
        updateData.title = article.title;
        updateData.slug = article.slug;
        updateData.meta_description = article.metaDescription;
        updateData.keywords = article.keywords || [];
        updateData.structured_data = article.structuredData;
        updateData.meta_tags = article.metaTags;
      }

      if (research) {
        updateData.research_summary = research.summary;
      }

      if (metrics) {
        updateData.seo_score = metrics.seoScore;
        updateData.word_count = metrics.wordCount;
        updateData.security_score = metrics.securityScore;
      }

      // Handle images - check for base64 data URLs and upload to storage
      let finalImageUrl: string | null = null;
      
      if (images) {
        // images can be: a base64 string, an object with url/urls, or an array
        let rawImage: string | null = null;

        if (typeof images === 'string' && images.startsWith('data:image')) {
          rawImage = images;
        } else if (images.url && typeof images.url === 'string' && images.url.startsWith('data:image')) {
          rawImage = images.url;
        } else if (Array.isArray(images.urls) && images.urls.length > 0) {
          const first = images.urls[0];
          const firstUrl = typeof first === 'string' ? first : first?.url;
          if (firstUrl && firstUrl.startsWith('data:image')) {
            rawImage = firstUrl;
          } else {
            finalImageUrl = firstUrl || null;
          }
        } else if (Array.isArray(images) && images.length > 0) {
          const first = images[0];
          const firstUrl = typeof first === 'string' ? first : first?.url;
          if (firstUrl && firstUrl.startsWith('data:image')) {
            rawImage = firstUrl;
          } else {
            finalImageUrl = firstUrl || null;
          }
        }

        // Upload base64 to storage
        if (rawImage) {
          finalImageUrl = await uploadBase64Image(supabase, rawImage, articleId);
        }

        if (finalImageUrl) {
          const altText = article?.title || 'Imagen del artículo SEO';
          updateData.images = [{ url: finalImageUrl, altText }];
          updateData.images_success_count = 1;
          updateData.images_failed_count = 0;

          // Embed image into HTML content
          htmlContent = embedImageInHtml(htmlContent, finalImageUrl, altText);
        } else {
          updateData.images = images.urls || images;
          updateData.images_success_count = images.successful || (Array.isArray(images.urls) ? images.urls.length : 0);
          updateData.images_failed_count = images.failed || 0;
        }
      }

      updateData.html_content = htmlContent;

      if (optimizations) {
        updateData.optimizations = optimizations.applied || [];
        updateData.suggested_links = optimizations.suggestedLinks || [];
      }

      const { error: updateError } = await supabase
        .from('seo_articles')
        .update(updateData)
        .eq('id', articleId);

      if (updateError) {
        console.error('Error updating article:', updateError);
        throw new Error('Failed to update article');
      }

      console.log(`Article ${articleId} updated successfully`);
      
      return new Response(
        JSON.stringify({ success: true, message: 'Article updated', imageUrl: finalImageUrl }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      console.log(`Updating article ${articleId} with error status`);
      
      await supabase
        .from('seo_articles')
        .update({
          status: 'error',
          error_message: n8nError?.message || n8nError?.userMessage || 'Error generating article',
          error_details: n8nError || payload
        })
        .eq('id', articleId);

      return new Response(
        JSON.stringify({ success: false, message: 'Error recorded' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('Callback error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
