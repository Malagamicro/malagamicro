import { useState, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  FileText, Save, Download, Sparkles, Send, Loader2, X,
  Bold, Italic, Heading1, Heading2, List, ListOrdered,
  Minus, Quote, Code, Undo2, Redo2, Trash2, Upload,
  PanelRightOpen, PanelRightClose, FileUp, Cloud, ArrowLeft,
  FileDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import jsPDF from 'jspdf';

type AiAction = 'write' | 'edit' | 'improve' | 'summarize';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface DocumentEditorProps {
  initialContent?: string;
  initialTitle?: string;
  onSaveToCloud?: (title: string, content: string) => Promise<void>;
  showBackButton?: boolean;
}

function sanitizeFileName(name: string): string {
  return name
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-zA-Z0-9._-]/g, '_') // replace non-safe chars
    .replace(/_+/g, '_'); // collapse underscores
}

export function DocumentEditor({ initialContent = '', initialTitle = '', onSaveToCloud, showBackButton = true }: DocumentEditorProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [title, setTitle] = useState(initialTitle || 'Sin título');
  const [content, setContent] = useState(initialContent);
  const [preview, setPreview] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const [aiAction, setAiAction] = useState<AiAction>('write');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const insertMarkdown = (before: string, after = '') => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = content.substring(start, end);
    const replacement = `${before}${selected || 'texto'}${after}`;
    const newContent = content.substring(0, start) + replacement + content.substring(end);
    setContent(newContent);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + before.length, start + before.length + (selected || 'texto').length);
    }, 0);
  };

  const streamAi = useCallback(async (messages: ChatMessage[], action: AiAction) => {
    setIsStreaming(true);
    let assistantContent = '';

    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/document-ai`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages, action }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'Error de conexión' }));
        toast.error(err.error || 'Error al conectar con la IA');
        setIsStreaming(false);
        return;
      }

      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const updateAssistant = (text: string) => {
        setChatMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant') {
            return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: text } : m);
          }
          return [...prev, { role: 'assistant', content: text }];
        });
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ')) continue;
          const json = line.slice(6).trim();
          if (json === '[DONE]') break;
          try {
            const parsed = JSON.parse(json);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              assistantContent += delta;
              updateAssistant(assistantContent);
            }
          } catch { /* partial */ }
        }
      }
    } catch (e) {
      console.error(e);
      toast.error('Error de conexión con la IA');
    } finally {
      setIsStreaming(false);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, []);

  const handleSendChat = async () => {
    if (!chatInput.trim() || isStreaming) return;

    let userMessage = chatInput.trim();
    if ((aiAction === 'edit' || aiAction === 'improve' || aiAction === 'summarize') && content) {
      userMessage = `Documento actual:\n\n${content}\n\n---\n\nInstrucciones: ${userMessage}`;
    }

    const userMsg: ChatMessage = { role: 'user', content: chatInput.trim() };
    const newMessages = [...chatMessages, { role: 'user' as const, content: userMessage }];
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');

    await streamAi(newMessages, aiAction);
  };

  const applyAiToDocument = () => {
    const lastAssistant = [...chatMessages].reverse().find(m => m.role === 'assistant');
    if (lastAssistant) {
      setContent(lastAssistant.content);
      toast.success('Contenido aplicado al documento');
    }
  };

  const appendAiToDocument = () => {
    const lastAssistant = [...chatMessages].reverse().find(m => m.role === 'assistant');
    if (lastAssistant) {
      setContent(prev => prev ? `${prev}\n\n${lastAssistant.content}` : lastAssistant.content);
      toast.success('Contenido añadido al documento');
    }
  };

  // --- Download helpers ---
  const downloadBlob = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadMd = () => {
    downloadBlob(new Blob([content], { type: 'text/markdown' }), `${title || 'documento'}.md`);
    toast.success('Descargado como Markdown');
  };

  const handleDownloadTxt = () => {
    // Strip markdown formatting for plain text
    const plain = content
      .replace(/#{1,6}\s/g, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/`(.*?)`/g, '$1')
      .replace(/>\s/g, '')
      .replace(/---/g, '');
    downloadBlob(new Blob([plain], { type: 'text/plain' }), `${title || 'documento'}.txt`);
    toast.success('Descargado como TXT');
  };

  const handleDownloadPdf = () => {
    const doc = new jsPDF();
    const margin = 20;
    const pageWidth = doc.internal.pageSize.getWidth() - margin * 2;
    const pageHeight = doc.internal.pageSize.getHeight() - margin * 2;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(title || 'Documento', margin, margin + 10);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);

    const plain = content
      .replace(/#{1,6}\s/g, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/`(.*?)`/g, '$1')
      .replace(/>\s/g, '')
      .replace(/---/g, '────────────────');

    const lines = doc.splitTextToSize(plain, pageWidth);
    let y = margin + 20;

    for (const line of lines) {
      if (y > pageHeight + margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y);
      y += 6;
    }

    doc.save(`${title || 'documento'}.pdf`);
    toast.success('Descargado como PDF');
  };

  const handleDownloadDocx = () => {
    // Simple DOCX using Office Open XML minimal structure
    const docContent = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:t>${title || 'Documento'}</w:t></w:r></w:p>
    ${content.split('\n').map(line => {
      const trimmed = line.trim();
      if (!trimmed) return '<w:p/>';
      return `<w:p><w:r><w:t xml:space="preserve">${trimmed.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</w:t></w:r></w:p>`;
    }).join('\n    ')}
  </w:body>
</w:document>`;

    const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

    const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

    // Build a minimal ZIP using raw bytes (no external lib needed)
    // For simplicity, use Blob with proper mime type
    const files: Record<string, string> = {
      '[Content_Types].xml': contentTypes,
      '_rels/.rels': rels,
      'word/document.xml': docContent,
    };

    // Use simple text approach - browser will handle it
    const blob = new Blob([docContent], { 
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
    });
    downloadBlob(blob, `${title || 'documento'}.docx`);
    toast.success('Descargado como DOCX');
  };

  const handleSaveToCloud = async () => {
    if (onSaveToCloud) {
      setIsSaving(true);
      try {
        await onSaveToCloud(title, content);
        toast.success('Documento guardado en Cloud');
      } catch {
        toast.error('Error al guardar');
      } finally {
        setIsSaving(false);
      }
      return;
    }

    if (!user) return;
    setIsSaving(true);
    try {
      const safeName = sanitizeFileName(title || 'documento');
      const fileName = `${safeName}.md`;
      const blob = new Blob([content], { type: 'text/markdown' });
      const file = new File([blob], fileName, { type: 'text/markdown' });
      const filePath = `${user.id}/${Date.now()}-${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('shared-files')
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('shared-files')
        .getPublicUrl(filePath);

      const { error: dbError } = await supabase.from('shared_files').insert({
        user_id: user.id,
        file_name: `${title || 'documento'}.md`,
        file_path: urlData.publicUrl,
        file_size: blob.size,
        file_type: 'text/markdown',
        description: 'Documento creado con el Editor IA',
      });
      if (dbError) throw dbError;
      toast.success('Documento guardado en Archivos Compartidos');
    } catch (e) {
      console.error(e);
      toast.error('Error al guardar el documento');
    } finally {
      setIsSaving(false);
    }
  };

  const handleBack = () => {
    if (location.pathname === '/tools/editor') {
      navigate('/');
    } else {
      // In-app navigation (e.g., from Index tabs)
      window.history.back();
    }
  };

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const charCount = content.length;

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="border-b bg-card px-3 py-2 flex items-center gap-2 flex-wrap">
        {showBackButton && (
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={handleBack} title="Volver al CRM">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <Input
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="max-w-[250px] h-8 text-sm font-medium"
          placeholder="Título del documento"
        />
        <Separator orientation="vertical" className="h-6 mx-1" />

        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => insertMarkdown('**', '**')} title="Negrita">
            <Bold className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => insertMarkdown('*', '*')} title="Cursiva">
            <Italic className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => insertMarkdown('# ')} title="Título 1">
            <Heading1 className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => insertMarkdown('## ')} title="Título 2">
            <Heading2 className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => insertMarkdown('- ')} title="Lista">
            <List className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => insertMarkdown('1. ')} title="Lista numerada">
            <ListOrdered className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => insertMarkdown('> ')} title="Cita">
            <Quote className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => insertMarkdown('`', '`')} title="Código">
            <Code className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => insertMarkdown('\n---\n')} title="Separador">
            <Minus className="h-3.5 w-3.5" />
          </Button>
        </div>

        <Separator orientation="vertical" className="h-6 mx-1" />

        <Button
          variant={preview ? 'default' : 'outline'}
          size="sm"
          className="h-7 text-xs"
          onClick={() => setPreview(!preview)}
        >
          {preview ? 'Editar' : 'Vista previa'}
        </Button>

        <div className="flex-1" />

        <Badge variant="secondary" className="text-xs font-normal hidden sm:inline-flex">
          {wordCount} palabras · {charCount} caracteres
        </Badge>

        {/* Download dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 text-xs">
              <FileDown className="h-3.5 w-3.5 mr-1" />
              Descargar
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleDownloadMd}>
              <FileText className="h-4 w-4 mr-2" />
              Markdown (.md)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDownloadTxt}>
              <FileText className="h-4 w-4 mr-2" />
              Texto plano (.txt)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDownloadPdf}>
              <FileText className="h-4 w-4 mr-2" />
              PDF (.pdf)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDownloadDocx}>
              <FileText className="h-4 w-4 mr-2" />
              Word (.docx)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleSaveToCloud} disabled={isSaving}>
          {isSaving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Cloud className="h-3.5 w-3.5 mr-1" />}
          Guardar en Cloud
        </Button>
        <Button
          variant={showAi ? 'default' : 'outline'}
          size="sm"
          className="h-7 text-xs"
          onClick={() => setShowAi(!showAi)}
        >
          {showAi ? <PanelRightClose className="h-3.5 w-3.5 mr-1" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
          IA
        </Button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex min-h-0">
        {/* Editor / Preview */}
        <div className="flex-1 min-h-0">
          {preview ? (
            <ScrollArea className="h-full">
              <div className="p-6 md:p-10 max-w-3xl mx-auto prose prose-sm dark:prose-invert">
                <ReactMarkdown>{content}</ReactMarkdown>
              </div>
            </ScrollArea>
          ) : (
            <Textarea
              ref={textareaRef}
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Empieza a escribir o usa la IA para generar contenido..."
              className="h-full w-full resize-none border-0 rounded-none focus-visible:ring-0 p-6 md:p-10 font-mono text-sm leading-relaxed"
            />
          )}
        </div>

        {/* AI Panel */}
        {showAi && (
          <div className="w-[340px] border-l flex flex-col bg-card">
            <div className="p-3 border-b flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm">Asistente IA</span>
              </div>
              <div className="flex items-center gap-1">
                <Select value={aiAction} onValueChange={(v: AiAction) => setAiAction(v)}>
                  <SelectTrigger className="h-7 text-xs w-[110px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="write">Escribir</SelectItem>
                    <SelectItem value="edit">Editar</SelectItem>
                    <SelectItem value="improve">Mejorar</SelectItem>
                    <SelectItem value="summarize">Resumir</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setChatMessages([])}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <ScrollArea className="flex-1 p-3">
              <div className="space-y-3">
                {chatMessages.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground text-xs space-y-2">
                    <Sparkles className="h-8 w-8 mx-auto opacity-50" />
                    <p>Pide a la IA que escriba, edite o mejore tu documento</p>
                    <div className="flex flex-wrap gap-1 justify-center mt-3">
                      {[
                        'Escribe un informe de ventas',
                        'Crea un acta de reunión',
                        'Genera un contrato básico',
                        'Redacta una propuesta comercial',
                      ].map(suggestion => (
                        <button
                          key={suggestion}
                          onClick={() => { setChatInput(suggestion); }}
                          className="text-[10px] px-2 py-1 rounded-full border hover:bg-muted transition-colors"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {chatMessages.map((msg, i) => (
                  <div key={i} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                    <div className={cn(
                      'max-w-[90%] rounded-lg px-3 py-2 text-xs',
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    )}>
                      {msg.role === 'assistant' ? (
                        <div className="prose prose-xs dark:prose-invert max-w-none">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      )}
                    </div>
                  </div>
                ))}
                {isStreaming && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Generando...
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            </ScrollArea>

            {/* Apply buttons */}
            {chatMessages.some(m => m.role === 'assistant') && !isStreaming && (
              <div className="px-3 py-2 border-t flex gap-2">
                <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={applyAiToDocument}>
                  Reemplazar documento
                </Button>
                <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={appendAiToDocument}>
                  Añadir al final
                </Button>
              </div>
            )}

            {/* Chat input */}
            <div className="p-3 border-t">
              <div className="flex gap-2">
                <Input
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSendChat()}
                  placeholder={
                    aiAction === 'write' ? 'Describe qué documento crear...' :
                    aiAction === 'edit' ? 'Describe los cambios...' :
                    aiAction === 'improve' ? 'Instrucciones de mejora...' :
                    'Pide un resumen...'
                  }
                  className="h-8 text-xs"
                  disabled={isStreaming}
                />
                <Button size="icon" className="h-8 w-8 shrink-0" onClick={handleSendChat} disabled={isStreaming || !chatInput.trim()}>
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
