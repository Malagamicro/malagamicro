import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runTests() {
  console.log('Iniciando tests de notificaciones...');

  // Get a user to send notifications to
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('user_id, full_name')
    .limit(1);

  if (profileError || !profiles || profiles.length === 0) {
    console.error('Error fetching profile or no profiles found:', profileError);
    process.exit(1);
  }

  const userId = profiles[0].user_id;
  console.log(`Enviando notificaciones al usuario: ${profiles[0].full_name} (${userId})`);

  try {
    // Test 1: Custom Notification (Info)
    console.log('\n1. Test: Custom Notification (Info)');
    await supabase.from('custom_notifications').insert({
      user_id: userId,
      title: 'Test Sistema',
      message: 'Esto es una notificación custom de prueba 🚀',
      type: 'info',
      source: 'test',
      icon: '🧪',
      is_popup: true
    });
    console.log('✅ Custom notification enviada. Revisa tu pantalla (debería sonar y salir popup).');
    
    // Wait a bit
    await new Promise(r => setTimeout(r, 4000));

    // Test 2: Custom Notification (Warning)
    console.log('\n2. Test: Custom Notification (Warning)');
    await supabase.from('custom_notifications').insert({
      user_id: userId,
      title: '¡Alerta de prueba!',
      message: 'Esta es una advertencia de prueba para ver los colores',
      type: 'warning',
      source: 'test',
      icon: '⚠️',
      is_popup: true
    });
    console.log('✅ Custom notification de advertencia enviada.');
    
    await new Promise(r => setTimeout(r, 4000));

    // Test 3: WhatsApp Simulator
    // Instead of messing with real tables that might trigger webhooks, we can just insert a custom notification simulating WhatsApp
    // Since our realtime listener listens to waha_messages, let's try inserting a dummy message if possible, or just a custom one.
    // Let's insert a dummy waha_message
    console.log('\n3. Test: WhatsApp Message');
    const { error: wahaError } = await supabase.from('waha_messages').insert({
      user_id: userId,
      chat_id: '123456789@c.us',
      content: '¡Hola! Este es un WhatsApp simulado de prueba 💬',
      from_me: false,
      timestamp: new Date().toISOString(),
      status: 'received',
      type: 'text',
      message_id: `test-${Date.now()}`
    });
    
    if (wahaError) {
       console.log('No se pudo insertar en waha_messages (probablemente RLS o schema):', wahaError.message);
       console.log('Simulando a través de custom_notifications...');
       await supabase.from('custom_notifications').insert({
         user_id: userId,
         title: '📱 WhatsApp Test',
         message: '¡Hola! Este es un WhatsApp simulado de prueba 💬',
         type: 'info',
         source: 'whatsapp',
         icon: '📱',
         is_popup: true
       });
    } else {
       console.log('✅ Mensaje de WhatsApp falso insertado.');
    }

    console.log('\n🎉 Tests enviados. Revisa tu navegador (y el NotificationCenter en el sidebar).');
    
  } catch (err) {
    console.error('Error during tests:', err);
  }
}

runTests();
