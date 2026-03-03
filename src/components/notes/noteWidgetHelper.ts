import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { QuickNote } from '@/hooks/useQuickNotes';

export function openNoteWidget(
  note: QuickNote,
  onSave: (id: string, title: string, content: string) => void
): Window | null {
  const width = 380;
  const height = 480;
  const left = window.screen.width - width - 30;

  const popup = window.open(
    '',
    `note-widget-${note.id}`,
    `width=${width},height=${height},left=${left},top=80,resizable=yes,scrollbars=no,toolbar=no,menubar=no,location=no,status=no`
  );

  if (!popup) return null;

  // Detect actual theme from the app
  const isDark = document.documentElement.classList.contains('dark');
  const bgColor = note.color || '#fef3c7';

  // Theme-aware colors
  const colors = isDark
    ? { bg: '#1e1e2e', text: '#e2e8f0', textMuted: '#94a3b8', border: 'rgba(255,255,255,0.1)', btnBg: 'rgba(255,255,255,0.1)', btnHover: 'rgba(255,255,255,0.18)', inputBg: '#2a2a3e', accent: bgColor }
    : { bg: '#ffffff', text: '#1a202c', textMuted: '#64748b', border: 'rgba(0,0,0,0.1)', btnBg: 'rgba(0,0,0,0.06)', btnHover: 'rgba(0,0,0,0.12)', inputBg: '#f8fafc', accent: bgColor };

  const escapedTitle = (note.title || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const escapedContent = note.content.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const dateStr = format(new Date(note.updated_at), "d MMM yyyy, HH:mm", { locale: es });

  popup.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>${note.title || 'Nota'}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: ${colors.bg};
      color: ${colors.text};
      padding: 0;
      height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .accent-bar { height: 4px; background: ${colors.accent}; flex-shrink: 0; }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      border-bottom: 1px solid ${colors.border};
      flex-shrink: 0;
    }
    .header-left { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; }
    .title-display {
      font-weight: 700;
      font-size: 14px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      cursor: pointer;
    }
    .title-display:hover { opacity: 0.7; }
    .title-input {
      font-weight: 700;
      font-size: 14px;
      background: ${colors.inputBg};
      border: 1px solid ${colors.border};
      border-radius: 6px;
      padding: 4px 8px;
      color: ${colors.text};
      width: 100%;
      outline: none;
    }
    .title-input:focus { border-color: ${colors.accent}; }
    .btn {
      background: ${colors.btnBg};
      border: none;
      border-radius: 6px;
      padding: 5px 10px;
      cursor: pointer;
      font-size: 12px;
      color: ${colors.text};
      flex-shrink: 0;
      transition: background 0.15s;
    }
    .btn:hover { background: ${colors.btnHover}; }
    .btn-save {
      background: ${colors.accent};
      color: #1a202c;
      font-weight: 600;
    }
    .btn-save:hover { opacity: 0.85; }
    .toolbar {
      display: flex;
      gap: 6px;
      padding: 8px 16px;
      border-bottom: 1px solid ${colors.border};
      flex-shrink: 0;
    }
    .content-area {
      flex: 1;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .content-display {
      flex: 1;
      overflow-y: auto;
      font-size: 14px;
      line-height: 1.7;
      white-space: pre-wrap;
      word-break: break-word;
      padding: 12px 16px;
      cursor: text;
    }
    .content-display:hover { background: ${colors.btnBg}; }
    .content-edit {
      flex: 1;
      font-size: 14px;
      line-height: 1.7;
      font-family: inherit;
      background: ${colors.inputBg};
      border: none;
      border-top: 2px solid ${colors.accent};
      color: ${colors.text};
      padding: 12px 16px;
      resize: none;
      outline: none;
      width: 100%;
    }
    .footer {
      flex-shrink: 0;
      padding: 8px 16px;
      border-top: 1px solid ${colors.border};
      font-size: 11px;
      color: ${colors.textMuted};
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .status { font-size: 11px; color: ${colors.accent}; font-weight: 600; }
  </style>
</head>
<body>
  <div class="accent-bar"></div>
  <div class="header">
    <div class="header-left">
      <span style="font-size:16px">📝</span>
      <span class="title-display" id="titleDisplay" onclick="startEditTitle()">${escapedTitle || 'Sin título'}</span>
      <input class="title-input" id="titleInput" value="${escapedTitle}" placeholder="Sin título" style="display:none" />
    </div>
    <div style="display:flex;gap:4px">
      <button class="btn" id="editBtn" onclick="toggleEdit()">✏️ Editar</button>
      <button class="btn" onclick="window.close()">✕</button>
    </div>
  </div>
  <div class="content-area">
    <div class="content-display" id="contentDisplay" onclick="toggleEdit()">${escapedContent}</div>
    <textarea class="content-edit" id="contentEdit" style="display:none">${escapedContent}</textarea>
  </div>
  <div class="footer">
    <span id="footerDate">${dateStr}</span>
    <span class="status" id="statusText"></span>
  </div>

  <script>
    let editing = false;
    const noteId = "${note.id}";

    function startEditTitle() {
      document.getElementById('titleDisplay').style.display = 'none';
      const input = document.getElementById('titleInput');
      input.style.display = 'block';
      input.focus();
      input.select();
      if (!editing) toggleEdit();
    }

    function toggleEdit() {
      editing = !editing;
      const display = document.getElementById('contentDisplay');
      const edit = document.getElementById('contentEdit');
      const btn = document.getElementById('editBtn');
      const titleD = document.getElementById('titleDisplay');
      const titleI = document.getElementById('titleInput');

      if (editing) {
        display.style.display = 'none';
        edit.style.display = 'block';
        edit.focus();
        btn.innerHTML = '💾 Guardar';
        btn.className = 'btn btn-save';
        titleD.style.display = 'none';
        titleI.style.display = 'block';
      } else {
        const newTitle = titleI.value;
        const newContent = edit.value;
        display.textContent = newContent;
        display.style.display = 'block';
        edit.style.display = 'none';
        titleD.textContent = newTitle || 'Sin título';
        titleD.style.display = 'block';
        titleI.style.display = 'none';
        btn.innerHTML = '✏️ Editar';
        btn.className = 'btn';
        document.getElementById('statusText').textContent = 'Guardando...';
        document.title = newTitle || 'Nota';

        // Post message to parent to save
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage({
            type: 'NOTE_WIDGET_SAVE',
            noteId: noteId,
            title: newTitle,
            content: newContent
          }, '*');
        }

        setTimeout(() => {
          document.getElementById('statusText').textContent = '✓ Guardado';
          setTimeout(() => { document.getElementById('statusText').textContent = ''; }, 2000);
        }, 500);
      }
    }

    // Ctrl+S to save
    document.addEventListener('keydown', function(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (editing) toggleEdit();
      }
    });
  </script>
</body>
</html>`);
  popup.document.close();

  return popup;
}
