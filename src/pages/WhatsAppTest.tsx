import { WhatsAppSimpleForm } from "@/components/whatsapp/WhatsAppSimpleForm";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function WhatsAppTest() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-md mx-auto space-y-6">
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver
        </Button>

        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-foreground">
            Prueba de WhatsApp
          </h1>
          <p className="text-muted-foreground mt-2">
            Envía un mensaje de prueba para verificar la conexión con Evolution API
          </p>
        </div>

        <WhatsAppSimpleForm />

        <div className="text-center text-sm text-muted-foreground mt-6 p-4 bg-muted rounded-lg">
          <p className="font-medium mb-2">💡 Instrucciones:</p>
          <ol className="text-left space-y-1">
            <li>1. Asegúrate de que Evolution API esté configurada correctamente</li>
            <li>2. Introduce tu número con código de país (ej: 34612345678)</li>
            <li>3. Escribe un mensaje de prueba</li>
            <li>4. Haz clic en "Enviar WhatsApp"</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
