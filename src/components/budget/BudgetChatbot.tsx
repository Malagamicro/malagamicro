import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Send, Bot, User, X, Plus, Loader2, Mail, Check, FileText, RotateCcw, Pencil } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import ReactMarkdown from 'react-markdown';

interface ChatMessage { id: string; role: 'user' | 'assistant'; content: string; timestamp: Date; }
type ChatStep = 'prompt' | 'emails' | 'products' | 'email_empresa' | 'confirm' | 'done';
interface RequestData { prompt: string; emails: string[]; products: string; email_empresa: string; user_name: string; }

// ── Edit Dialog (extracted) ──
function EditRequestDialog({
  open, onOpenChange, editData, setEditData, onSave,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  editData: RequestData; setEditData: React.Dispatch<React.SetStateAction<RequestData>>;
  onSave: () => void;
}) {
  const [editEmailInput, setEditEmailInput] = useState('');

  const handleAddEmail = () => {
    if (editEmailInput && editEmailInput.includes('@') && !editData.emails.includes(editEmailInput)) {
      setEditData(prev => ({ ...prev, emails: [...prev.emails, editEmailInput] }));
      setEditEmailInput('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Pencil className="h-5 w-5" />Editar Solicitud</DialogTitle>
          <DialogDescription>Revisa y corrige los datos antes de enviar</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="edit-prompt">Descripción</Label>
            <Textarea id="edit-prompt" value={editData.prompt} onChange={(e) => setEditData(prev => ({ ...prev, prompt: e.target.value }))} rows={3} />
          </div>
          <div className="space-y-2">
            <Label>Proveedores</Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {editData.emails.map((email) => (
                <Badge key={email} variant="secondary" className="pl-2 pr-1 py-1">
                  {email}
                  <button onClick={() => setEditData(prev => ({ ...prev, emails: prev.emails.filter(e => e !== email) }))}
                    className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"><X className="h-3 w-3" /></button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input placeholder="Añadir email..." value={editEmailInput} onChange={(e) => setEditEmailInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddEmail())} type="email" />
              <Button variant="secondary" size="icon" onClick={handleAddEmail}><Plus className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-products">Productos/Servicios</Label>
            <Textarea id="edit-products" value={editData.products} onChange={(e) => setEditData(prev => ({ ...prev, products: e.target.value }))} rows={3} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-email-empresa">Email de respuesta</Label>
            <Input id="edit-email-empresa" type="email" value={editData.email_empresa} onChange={(e) => setEditData(prev => ({ ...prev, email_empresa: e.target.value }))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={onSave}><Check className="h-4 w-4 mr-1" />Guardar cambios</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Component ──
export function BudgetChatbot() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [currentStep, setCurrentStep] = useState<ChatStep>('prompt');
  const [requestData, setRequestData] = useState<RequestData>({ prompt: '', emails: [], products: '', email_empresa: 'presupuestos@malagamicro.com', user_name: '' });
  const [tempEmail, setTempEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editData, setEditData] = useState<RequestData>({ prompt: '', emails: [], products: '', email_empresa: '', user_name: '' });
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const userName = profile?.full_name || user?.email?.split('@')[0] || 'Usuario';
    setRequestData(prev => ({ ...prev, user_name: userName }));
    if (messages.length === 0) {
      addBotMessage(`¡Hola ${userName}! 👋\n\nSoy tu asistente de presupuestos. Cuéntame qué necesitas cotizar.\n\n**Ejemplo:**\n- "Necesito cotizar cemento y arena para obra en Málaga"\n- "Quiero presupuesto de 100 sacos de cemento Portland"`);
    }
  }, [profile, user]);

  useEffect(() => {
    if (scrollRef.current) {
      const sc = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (sc) sc.scrollTop = sc.scrollHeight;
    }
  }, [messages]);

  const addBotMessage = (content: string) => setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', content, timestamp: new Date() }]);
  const addUserMessage = (content: string) => setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'user', content, timestamp: new Date() }]);

  const showConfirmation = () => {
    setTimeout(() => {
      addBotMessage(`📋 **Resumen de tu solicitud:**\n\n**Descripción:**\n${requestData.prompt}\n\n**Proveedores (${requestData.emails.length}):**\n${requestData.emails.map(e => `• ${e}`).join('\n')}\n\n**Productos/Servicios:**\n${requestData.products}\n\n**Email de respuesta:**\n${requestData.email_empresa}\n\n¿Quieres **enviar** o **editar** la solicitud?`);
      setCurrentStep('confirm');
    }, 500);
  };

  const handleSend = () => {
    if (!input.trim() && currentStep !== 'confirm') return;
    const userInput = input.trim();
    switch (currentStep) {
      case 'prompt':
        addUserMessage(userInput); setRequestData(prev => ({ ...prev, prompt: userInput })); setInput('');
        setTimeout(() => { addBotMessage("Perfecto. Ahora necesito los **emails de los proveedores** a los que quieres enviar la solicitud.\n\nEscribe los emails separados por coma o añádelos uno a uno con el botón +"); setCurrentStep('emails'); }, 500);
        break;
      case 'emails':
        if (userInput) { addUserMessage(userInput); const ne = userInput.split(',').map(e => e.trim()).filter(e => e.includes('@')); if (ne.length > 0) setRequestData(prev => ({ ...prev, emails: [...prev.emails, ...ne] })); setInput(''); }
        break;
      case 'products':
        addUserMessage(userInput); setRequestData(prev => ({ ...prev, products: userInput })); setInput('');
        setTimeout(() => { addBotMessage(`¿Qué **email de respuesta** quieres usar?\n\nActualmente: **${requestData.email_empresa}**\n\nEscribe un nuevo email o pulsa "Usar este" para continuar.`); setCurrentStep('email_empresa'); }, 500);
        break;
      case 'email_empresa':
        if (userInput && userInput.includes('@')) { addUserMessage(userInput); setRequestData(prev => ({ ...prev, email_empresa: userInput })); } else if (userInput) addUserMessage("Usar el email por defecto");
        setInput(''); showConfirmation();
        break;
      case 'confirm': break;
    }
  };

  const handleEmailsDone = () => {
    if (requestData.emails.length === 0) { toast({ title: "Error", description: "Añade al menos un email de proveedor", variant: "destructive" }); return; }
    addBotMessage(`Proveedores añadidos: **${requestData.emails.length}**\n\n${requestData.emails.map(e => `• ${e}`).join('\n')}\n\nAhora indica los **productos o servicios** que necesitas cotizar (texto libre).`);
    setCurrentStep('products');
  };

  const handleEdit = () => { setEditData({ ...requestData }); setIsEditOpen(true); };
  const handleSaveEdit = () => {
    setRequestData({ ...editData }); setIsEditOpen(false); addUserMessage("✏️ He editado la solicitud");
    setTimeout(() => { addBotMessage(`📋 **Solicitud actualizada:**\n\n**Descripción:**\n${editData.prompt}\n\n**Proveedores (${editData.emails.length}):**\n${editData.emails.map(e => `• ${e}`).join('\n')}\n\n**Productos/Servicios:**\n${editData.products}\n\n**Email de respuesta:**\n${editData.email_empresa}\n\n¿Ahora sí **enviar** o seguir **editando**?`); }, 300);
  };

  const handleConfirm = async () => {
    setSubmitting(true); addUserMessage("✅ Sí, enviar solicitud");
    try {
      const { data: session } = await supabase.auth.getSession();
      const response = await supabase.functions.invoke('budget-request', {
        body: { prompt: requestData.prompt, emails: requestData.emails, products: requestData.products, email_empresa: requestData.email_empresa, user_name: requestData.user_name },
        headers: { Authorization: `Bearer ${session.session?.access_token}` },
      });
      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);
      setTimeout(() => { addBotMessage(`✅ **¡Solicitud enviada correctamente!**\n\n**ID:** \`${response.data?.request_id || 'Generado'}\`\n\nLa solicitud será revisada por **Inma** antes de enviarse a los proveedores. Recibirás una notificación cuando esté procesada.\n\n¿Necesitas crear otra solicitud?`); setCurrentStep('done'); }, 500);
      toast({ title: "Solicitud enviada", description: "Tu solicitud ha sido procesada correctamente" });
    } catch (error) {
      console.error('Error submitting request:', error);
      addBotMessage(`❌ **Error al enviar la solicitud:** ${error instanceof Error ? error.message : 'Error desconocido'}\n\n¿Quieres intentarlo de nuevo?`);
      setCurrentStep('confirm');
    } finally { setSubmitting(false); }
  };

  const handleCancel = () => { addUserMessage("❌ Cancelar"); addBotMessage("De acuerdo, solicitud cancelada. ¿Quieres empezar una nueva?"); setCurrentStep('done'); };

  const handleNewRequest = () => {
    setMessages([]); setRequestData({ prompt: '', emails: [], products: '', email_empresa: 'presupuestos@malagamicro.com', user_name: requestData.user_name }); setCurrentStep('prompt');
    setTimeout(() => addBotMessage(`¡Empecemos de nuevo! 👋\n\nCuéntame qué necesitas cotizar.`), 100);
  };

  const addSingleEmail = () => {
    if (tempEmail && tempEmail.includes('@') && !requestData.emails.includes(tempEmail)) { setRequestData(prev => ({ ...prev, emails: [...prev.emails, tempEmail] })); setTempEmail(''); }
  };

  const removeEmail = (email: string) => setRequestData(prev => ({ ...prev, emails: prev.emails.filter(e => e !== email) }));

  return (
    <>
      <Card className="h-full flex flex-col">
        <CardHeader className="border-b py-3 px-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bot className="h-5 w-5 text-primary" />Solicitar Presupuesto
            {currentStep !== 'prompt' && currentStep !== 'done' && (
              <Button variant="ghost" size="sm" className="ml-auto" onClick={handleNewRequest}><RotateCcw className="h-4 w-4 mr-1" />Reiniciar</Button>
            )}
          </CardTitle>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            <div className="space-y-4 max-w-2xl mx-auto">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0"><Bot className="h-4 w-4 text-primary" /></div>
                  )}
                  <div className={`max-w-[85%] rounded-lg px-4 py-2 ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                    {msg.role === 'assistant' ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:my-1 [&>ul]:my-1"><ReactMarkdown>{msg.content}</ReactMarkdown></div>
                    ) : (<p className="text-sm whitespace-pre-wrap">{msg.content}</p>)}
                  </div>
                  {msg.role === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0"><User className="h-4 w-4" /></div>
                  )}
                </div>
              ))}
              {submitting && (
                <div className="flex gap-3 justify-start">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center"><Bot className="h-4 w-4 text-primary" /></div>
                  <div className="bg-muted rounded-lg px-4 py-3"><div className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /><span className="text-sm text-muted-foreground">Enviando solicitud...</span></div></div>
                </div>
              )}
            </div>
          </ScrollArea>

          {currentStep === 'emails' && requestData.emails.length > 0 && (
            <div className="px-4 py-2 border-t bg-muted/50">
              <div className="flex items-center gap-2 mb-2"><Mail className="h-4 w-4 text-muted-foreground" /><span className="text-sm font-medium">Proveedores añadidos:</span></div>
              <div className="flex flex-wrap gap-2">
                {requestData.emails.map((email) => (
                  <Badge key={email} variant="secondary" className="pl-2 pr-1 py-1">
                    {email}<button onClick={() => removeEmail(email)} className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"><X className="h-3 w-3" /></button>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="border-t p-4 space-y-3">
            {currentStep === 'emails' && (
              <div className="flex gap-2">
                <div className="flex-1 flex gap-2">
                  <Input placeholder="proveedor@empresa.com" value={tempEmail} onChange={(e) => setTempEmail(e.target.value)}
                    onKeyPress={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSingleEmail(); } }} type="email" />
                  <Button variant="secondary" size="icon" onClick={addSingleEmail}><Plus className="h-4 w-4" /></Button>
                </div>
                <Button onClick={handleEmailsDone} disabled={requestData.emails.length === 0}><Check className="h-4 w-4 mr-1" />Continuar</Button>
              </div>
            )}
            {currentStep === 'confirm' && (
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleCancel} disabled={submitting}>Cancelar</Button>
                <Button variant="secondary" onClick={handleEdit} disabled={submitting}><Pencil className="h-4 w-4 mr-1" />Editar</Button>
                <Button className="flex-1" onClick={handleConfirm} disabled={submitting}>
                  {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Enviando...</> : <><Send className="h-4 w-4 mr-2" />Enviar</>}
                </Button>
              </div>
            )}
            {currentStep === 'done' && (<Button className="w-full" onClick={handleNewRequest}><FileText className="h-4 w-4 mr-2" />Nueva Solicitud</Button>)}
            {(currentStep === 'prompt' || currentStep === 'products' || currentStep === 'email_empresa') && (
              <div className="flex gap-2">
                <Input placeholder={currentStep === 'prompt' ? "Escribe qué necesitas cotizar..." : currentStep === 'products' ? "Lista de productos o servicios..." : "Email de respuesta..."}
                  value={input} onChange={(e) => setInput(e.target.value)} onKeyPress={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }} disabled={submitting} />
                <Button onClick={handleSend} disabled={!input.trim() || submitting}><Send className="h-4 w-4" /></Button>
              </div>
            )}
            {currentStep === 'email_empresa' && (
              <Button variant="outline" size="sm" className="w-full" onClick={() => { addUserMessage(`Usar: ${requestData.email_empresa}`); setInput(''); showConfirmation(); }}>
                Usar {requestData.email_empresa}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <EditRequestDialog open={isEditOpen} onOpenChange={setIsEditOpen} editData={editData} setEditData={setEditData} onSave={handleSaveEdit} />
    </>
  );
}

export default BudgetChatbot;
