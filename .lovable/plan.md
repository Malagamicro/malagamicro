

# Fix: Llamadas - Audio/Video no llega + Notificaciones en movil

## Problemas identificados

### 1. No se escucha ni se ve al otro usuario
Hay varios fallos en la logica WebRTC actual:

- **Ofertas sin reintento**: El peer "impolite" envia una sola oferta SDP. Si el mensaje broadcast se pierde (cosa comun en Supabase Realtime), no hay mecanismo de reintento. Antes ambos peers enviaban ofertas, asi que al menos una llegaba.
- **`createPeerConnection` con cache problematica**: Si ya existe un PC para un peer, devuelve el viejo sin verificar su estado. Si ese PC esta en estado `'new'` o `'failed'`, no se recrea.
- **Sin verificacion de conexion exitosa**: No hay logica que detecte "llevo X segundos sin conectar" y reintente la negociacion.

### 2. En movil no llega la notificacion de llamada entrante
- `useActiveCalls` usa `postgres_changes` que depende de un WebSocket activo. En movil, si la app esta en segundo plano o la pantalla apagada, el WebSocket se desconecta.
- El `checkExistingCalls` solo se ejecuta al montar el componente, no cuando la app vuelve al primer plano (visibility change).

---

## Plan de implementacion

### Paso 1: Arreglar VideoCallModal - Negociacion WebRTC robusta

**Archivo**: `src/components/internal-chat/VideoCallModal.tsx`

Cambios en `createPeerConnection`:
- Eliminar el cache que devuelve PCs viejos. Si ya existe un PC para un peer, cerrarlo y crear uno nuevo (salvo si esta `connected`).
- Anadir un handler `onnegotiationneeded` para renegociacion automatica.

Cambios en el handler `peer-join`:
- Eliminar la logica de "polite/impolite" que impide que ambos peers negocien. En su lugar, usar un enfoque mas simple: **ambos peers crean un PC al ver al otro, pero solo el que tenga el peerId mas bajo envia la oferta inicial** con logica de reintento.
- Si despues de 5 segundos no hay `ontrack` (no llego stream remoto), reenviar la oferta SDP.

Cambios en el handler `sdp-offer`:
- Si llega una oferta y ya tenemos un PC en estado `stable` con streams, ignorarla (ya estamos conectados).
- Si llega y no tenemos stream remoto, aceptarla normalmente.

Anadir temporizador de reconexion:
- Si despues de 8 segundos `remotePeers` sigue vacio, forzar un nuevo ciclo de anuncio + oferta limpiando el PC anterior.

### Paso 2: Arreglar notificaciones de llamada en movil

**Archivo**: `src/hooks/useActiveCalls.tsx`

- Anadir un listener de `visibilitychange`: cuando el documento vuelve a ser visible, re-ejecutar `checkExistingCalls` para detectar llamadas perdidas mientras la pantalla estaba apagada.
- Anadir un intervalo de polling cada 5 segundos como backup: si hay llamadas en estado `ringing` donde el usuario es participante y no es el caller, mostrar la notificacion.
- Limpiar el polling cuando el componente se desmonte.

### Paso 3: Mejorar GlobalCallListener para movil

**Archivo**: `src/components/internal-chat/GlobalCallListener.tsx`

- Anadir vibracion continua cuando hay `incomingCall` activa (como backup al IncomingCallDialog que puede no mostrarse en movil).

---

## Detalles tecnicos

### Flujo WebRTC corregido

```text
Caller                          Receiver
  |                                |
  |--- peer-join (broadcast) ----->|
  |                                |
  |     (receiver accepts call)    |
  |                                |
  |<--- peer-join (broadcast) ----|
  |                                |
  | (ambos crean PC, solo el de   |
  |  peerId mas bajo envia offer) |
  |                                |
  |--- sdp-offer ----------------->|
  |<-- sdp-answer -----------------|
  |<-> ice-candidates <---------->|
  |                                |
  | [5s timeout: no ontrack?]     |
  | [-> cerrar PC, recrear,       |
  |    reenviar offer]            |
```

### Polling de llamadas movil

```text
Cada 5 segundos:
  1. SELECT * FROM active_calls WHERE status = 'ringing' AND created_at > now() - 30s
  2. Para cada llamada, verificar si el usuario es participante
  3. Si hay llamada pendiente y no se esta mostrando, mostrarla
  4. Al volver de background (visibilitychange), ejecutar inmediatamente
```

### Archivos a modificar
- `src/components/internal-chat/VideoCallModal.tsx` - Logica WebRTC robusta con reintentos
- `src/hooks/useActiveCalls.tsx` - Polling + visibilitychange para movil
- `src/components/internal-chat/GlobalCallListener.tsx` - Vibracion backup en movil

