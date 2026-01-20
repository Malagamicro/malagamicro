import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageCircle, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function WhatsAppSimpleForm() {
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!phone.trim() || !message.trim()) {
      toast.error("Por favor completa todos los campos");
      return;
    }

    setIsSending(true);

    try {
      const cleanPhone = phone.replace(/\D/g, "");
      
      const response = await fetch("http://localhost:3000/api/sendText", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": "123456",
        },
        body: JSON.stringify({
          chatId: `${cleanPhone}@c.us`,
          text: message,
          session: "default",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Error HTTP: ${response.status}`);
      }

      toast.success("Mensaje de WhatsApp enviado correctamente");
      setPhone("");
      setMessage("");
    } catch (error: any) {
      console.error("Error sending WhatsApp:", error);
      
      if (error.name === "TypeError" && error.message.includes("fetch")) {
        toast.error("No se pudo conectar con el servidor WAHA. Verifica que esté corriendo en localhost:3000");
      } else {
        toast.error(error.message || "Error al enviar el mensaje de WhatsApp");
      }
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <MessageCircle className="h-5 w-5 text-primary" />
          Enviar WhatsApp
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phone">Teléfono</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="Ej: 34612345678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={isSending}
            />
            <p className="text-xs text-muted-foreground">
              Incluye el código de país sin el símbolo +
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Mensaje</Label>
            <Textarea
              id="message"
              placeholder="Escribe tu mensaje aquí..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={isSending}
              rows={4}
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isSending || !phone.trim() || !message.trim()}
          >
            {isSending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Enviar WhatsApp
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
