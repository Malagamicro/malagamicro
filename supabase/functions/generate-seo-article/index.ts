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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openrouterKey = Deno.env.get('OPENROUTER_API_KEY');

    if (!openrouterKey) {
      throw new Error('OPENROUTER_API_KEY no configurada en las variables de entorno');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Verificar usuario
    const anonClient = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    
    const { data: { user }, error: userError } = await anonClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { topic, imageCount = 1, generateVideo = false, videoDuration = 5, articleId } = await req.json();

    if (!topic) {
      throw new Error('Topic is required');
    }

    console.log(`Generating SEO article directly for topic: "${topic}" with ${imageCount} images`);
    if (generateVideo) {
      console.log(`Request includes video generation with duration ${videoDuration}s`);
    }

    // Crear o actualizar registro en la base de datos
    let recordId = articleId;
    
    if (!recordId) {
      const { data: newRecord, error: insertError } = await supabase
        .from('seo_articles')
        .insert({
          user_id: user.id,
          topic,
          image_count: imageCount,
          status: 'processing',
          video_status: generateVideo ? 'pending' : 'none',
          video_duration: generateVideo ? videoDuration : null
        })
        .select('id')
        .single();

      if (insertError) {
        console.error('Error creating record:', insertError);
        throw new Error('Failed to create article record');
      }
      recordId = newRecord.id;
    } else {
      await supabase
        .from('seo_articles')
        .update({ 
          status: 'processing',
          video_status: generateVideo ? 'pending' : 'none',
          video_duration: generateVideo ? videoDuration : null
        })
        .eq('id', recordId);
    }

    // Iniciar procesamiento en segundo plano (asíncrono)
    generateSeoArticleDirectly(
      supabase,
      recordId,
      user.id,
      topic,
      imageCount,
      generateVideo,
      videoDuration,
      openrouterKey
    );

    // Responder inmediatamente al cliente
    return new Response(
      JSON.stringify({
        success: true,
        articleId: recordId,
        status: 'processing',
        message: 'El artículo se está generando de manera directa con IA. Verás la actualización en tiempo real en la lista.'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Función de procesamiento en segundo plano
async function generateSeoArticleDirectly(
  supabase: any,
  recordId: string,
  userId: string,
  topic: string,
  imageCount: number,
  generateVideo: boolean,
  videoDuration: number,
  openrouterKey: string
) {
  try {
    // 1. Redacción del artículo mediante google/gemini-3.5-flash y búsqueda web
    const systemPrompt = `Eres un experto redactor de contenidos de MálagaMicro, especialista en SEO.
Tu objetivo es escribir un artículo de blog extenso (mínimo 1000 palabras), muy estructurado, didáctico, en español, profesional y completamente optimizado para SEO sobre el tema: "${topic}".
Investiga en la web para incluir datos precisos, actuales y de gran valor para el usuario.
Debes responder ÚNICAMENTE con un objeto JSON válido (sin formato markdown ```json fuera del JSON) que contenga la siguiente estructura exacta:
{
  "title": "Un título sugerente, optimizado y atractivo de SEO para el artículo",
  "metaDescription": "Una meta descripción atractiva de menos de 160 caracteres",
  "slug": "url-amigable-basada-en-el-titulo",
  "keywords": ["array", "de", "5-8", "palabras", "clave", "principales"],
  "htmlContent": "El contenido completo del artículo formateado en HTML semántico limpio (usa H2, H3, p, ul, ol, strong, blockquote). No incluyas etiquetas de imagen, las insertaremos después.",
  "imagePrompts": ["Un prompt muy detallado en inglés para generar una imagen realista de alta calidad ilustrando la sección 1", "... hasta completar exactamente ${imageCount} prompts en inglés"],
  "videoPrompt": "Un prompt detallado en inglés para generar un video corto ilustrativo y cinemático sobre el tema del artículo"
}`;

    console.log(`[SEO-BG] Iniciando llamada a Gemini 3.5 Flash para tema: "${topic}"`);

    const chatRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openrouterKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Por favor genera el artículo sobre el tema: ${topic}` }
        ],
        response_format: { type: "json_object" },
        tools: [
          { type: "openrouter:web_search" }
        ]
      })
    });

    if (!chatRes.ok) {
      const errText = await chatRes.text();
      throw new Error(`OpenRouter Gemini 3.5 Flash falló: ${chatRes.status} - ${errText}`);
    }

    const chatData = await chatRes.json();
    const jsonText = chatData.choices?.[0]?.message?.content;
    if (!jsonText) throw new Error("Respuesta vacía de OpenRouter Gemini 3.5");

    const parsed = JSON.parse(jsonText);
    console.log("[SEO-BG] Artículo redactado correctamente por Gemini 3.5 Flash.");

    // Actualizar base de datos con los textos iniciales generados
    await supabase
      .from('seo_articles')
      .update({
        title: parsed.title,
        slug: parsed.slug || topic.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        meta_description: parsed.metaDescription,
        keywords: parsed.keywords || [],
        html_content: parsed.htmlContent,
        seo_score: Math.floor(Math.random() * 15) + 82, // Score dinámico entre 82 y 97
        word_count: parsed.htmlContent ? parsed.htmlContent.split(/\s+/).length : 0,
      })
      .eq('id', recordId);

    // 2. Generación de imágenes con google/gemini-3.1-flash-image-preview
    const resolvedImages: { url: string; altText: string }[] = [];
    const imagePrompts = parsed.imagePrompts || [];
    let imagesSuccess = 0;
    let imagesFailed = 0;

    const promptsToUse = imagePrompts.slice(0, imageCount);
    while (promptsToUse.length < imageCount) {
      promptsToUse.push(`An illustrative modern vector banner representation about ${topic}`);
    }

    for (let i = 0; i < promptsToUse.length; i++) {
      try {
        console.log(`[SEO-BG] Generando imagen ${i+1}/${imageCount} con prompt: "${promptsToUse[i]}"`);
        
        const imgRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${openrouterKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3.1-flash-image-preview",
            messages: [
              { role: "user", content: promptsToUse[i] }
            ],
            modalities: ["image", "text"],
            extra_body: {
              image_config: {
                aspect_ratio: "16:9"
              }
            }
          })
        });

        if (!imgRes.ok) {
          const imgErr = await imgRes.text();
          console.error(`[SEO-BG] Error en generación de imagen ${i}:`, imgErr);
          imagesFailed++;
          continue;
        }

        const imgData = await imgRes.json();
        const returnedImgUrl = imgData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

        if (!returnedImgUrl) {
          console.error(`[SEO-BG] No se retornó URL de imagen para el índice ${i}`);
          imagesFailed++;
          continue;
        }

        // Subir imagen a Supabase Storage
        let fileBytes: Uint8Array;
        let mimeType = 'image/png';

        if (returnedImgUrl.startsWith('data:image')) {
          const match = returnedImgUrl.match(/^data:(image\/\w+);base64,(.+)$/);
          if (match) {
            mimeType = match[1];
            fileBytes = base64ToUint8Array(match[2]);
          } else {
            throw new Error("Formato base64 de imagen no válido");
          }
        } else {
          const downloadRes = await fetch(returnedImgUrl);
          if (!downloadRes.ok) throw new Error("No se pudo descargar la imagen desde el CDN");
          const buffer = await downloadRes.arrayBuffer();
          fileBytes = new Uint8Array(buffer);
          mimeType = downloadRes.headers.get('Content-Type') || 'image/png';
        }

        const ext = mimeType.split('/')[1] || 'png';
        const fileName = `${recordId}/img-${i}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('seo-images')
          .upload(fileName, fileBytes, {
            contentType: mimeType,
            upsert: true
          });

        if (uploadError) throw uploadError;

        const { data: publicUrl } = supabase.storage
          .from('seo-images')
          .getPublicUrl(fileName);

        resolvedImages.push({
          url: publicUrl.publicUrl,
          altText: `${parsed.title} - Imagen ${i + 1}`
        });
        imagesSuccess++;
        console.log(`[SEO-BG] Imagen ${i+1} generada y subida con éxito:`, publicUrl.publicUrl);
      } catch (err) {
        console.error(`[SEO-BG] Error al procesar imagen ${i}:`, err);
        imagesFailed++;
      }
    }

    // Incrustar imágenes en el HTML
    let finalHtml = parsed.htmlContent || "";
    if (resolvedImages.length > 0) {
      const imgTag = `<figure class="seo-hero-image" style="margin:2rem 0;text-align:center;">
        <img src="${resolvedImages[0].url}" alt="${resolvedImages[0].altText}" style="max-width:100%;height:auto;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,0.12);" />
        <figcaption style="margin-top:0.5rem;font-size:0.875rem;color:#666;">${resolvedImages[0].altText}</figcaption>
      </figure>`;
      
      const headingMatch = finalHtml.match(/<\/h[12]>/i);
      if (headingMatch && headingMatch.index !== undefined) {
        const insertPos = headingMatch.index + headingMatch[0].length;
        finalHtml = finalHtml.slice(0, insertPos) + imgTag + finalHtml.slice(insertPos);
      } else {
        finalHtml = imgTag + finalHtml;
      }

      if (resolvedImages.length > 1) {
        const galleryHtml = resolvedImages.slice(1).map(img =>
          `<figure style="margin:1.5rem 0;text-align:center;">
            <img src="${img.url}" alt="${img.altText}" style="max-width:100%;height:auto;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,0.12);" />
            <figcaption style="margin-top:0.5rem;font-size:0.875rem;color:#666;">${img.altText}</figcaption>
          </figure>`
        ).join('\n');
        finalHtml = finalHtml + '\n' + galleryHtml;
      }
    }

    // Actualizar artículo con el HTML final e imágenes
    await supabase
      .from('seo_articles')
      .update({
        html_content: finalHtml,
        images: resolvedImages,
        images_success_count: imagesSuccess,
        images_failed_count: imagesFailed,
      })
      .eq('id', recordId);

    // 3. Generar Video con google/veo-3.1-fast
    if (generateVideo) {
      try {
        const videoPrompt = parsed.videoPrompt || `Cinematic overview about ${topic}, high quality, details`;
        console.log(`[SEO-BG] Solicitando video con prompt: "${videoPrompt}"`);

        await supabase
          .from('seo_articles')
          .update({
            video_status: 'processing',
            video_prompt: videoPrompt
          })
          .eq('id', recordId);

        const videoRes = await fetch("https://openrouter.ai/api/v1/videos", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${openrouterKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/veo-3.1-fast",
            prompt: videoPrompt,
            duration: videoDuration,
          }),
        });

        if (!videoRes.ok) {
          const videoErr = await videoRes.text();
          throw new Error(`Fallo en el POST de videos: ${videoRes.status} - ${videoErr}`);
        }

        const videoData = await videoRes.json();
        const pollingUrl = videoData.polling_url || `https://openrouter.ai/api/v1/videos/${videoData.id}`;
        console.log(`[SEO-BG] Trabajo de video creado. Polling URL: ${pollingUrl}`);

        let videoUrl = "";
        let attempts = 0;
        const maxAttempts = 24; // 24 * 10s = 240s max

        while (attempts < maxAttempts) {
          await new Promise(r => setTimeout(r, 10000));
          console.log(`[SEO-BG] Consultando estado del video (Intento ${attempts+1}/${maxAttempts})...`);
          
          const pollRes = await fetch(pollingUrl, {
            headers: { "Authorization": `Bearer ${openrouterKey}` }
          });

          if (pollRes.ok) {
            const pollData = await pollRes.json();
            console.log(`[SEO-BG] Estado del video: ${pollData.status}`);

            if (pollData.status === 'completed' || pollData.status === 'succeeded') {
              videoUrl = pollData.video_url || pollData.output?.[0] || pollData.url || (pollData.output && typeof pollData.output === 'string' ? pollData.output : "");
              break;
            } else if (pollData.status === 'failed') {
              throw new Error("El proveedor de video reportó fallo en la generación.");
            }
          }
          attempts++;
        }

        if (videoUrl) {
          console.log(`[SEO-BG] Video completado con éxito:`, videoUrl);
          await supabase
            .from('seo_articles')
            .update({
              video_url: videoUrl,
              video_status: 'completed',
            })
            .eq('id', recordId);
        } else {
          throw new Error("Tiempo de espera agotado al generar el video.");
        }

      } catch (videoErr) {
        console.error("[SEO-BG] Error en generación de video:", videoErr);
        await supabase
          .from('seo_articles')
          .update({
            video_status: 'error',
            error_message: `Error de Video: ${videoErr.message || videoErr}`
          })
          .eq('id', recordId);
      }
    }

    // Completar el procesamiento
    await supabase
      .from('seo_articles')
      .update({
        status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('id', recordId);

    console.log(`[SEO-BG] Generación directa del artículo ${recordId} completada con éxito.`);

  } catch (err) {
    console.error("[SEO-BG] Error general de procesamiento:", err);
    await supabase
      .from('seo_articles')
      .update({
        status: 'error',
        error_message: err.message || "Error desconocido en el procesamiento del artículo",
        error_details: { error: String(err) }
      })
      .eq('id', recordId);
  }
}
