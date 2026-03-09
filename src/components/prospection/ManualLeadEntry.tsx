import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Loader2, UserPlus } from 'lucide-react';
import { useLeads } from '@/hooks/useLeads';
import { toast } from 'sonner';

export function ManualLeadEntry() {
  const { addLead } = useLeads();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    companyName: '',
    contactName: '',
    phone: '',
    email: '',
    city: 'Málaga',
    address: '',
    website: '',
    notes: '',
    segment: 'pyme',
    source: 'manual',
  });

  const handleChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.companyName.trim()) {
      toast.error('El nombre de la empresa es obligatorio');
      return;
    }

    setIsSubmitting(true);
    try {
      addLead({
        companyName: form.companyName,
        contactName: form.contactName || undefined,
        phone: form.phone || undefined,
        email: form.email || undefined,
        city: form.city || 'Málaga',
        address: form.address || undefined,
        website: form.website || undefined,
        notes: form.notes || undefined,
        segment: form.segment as any,
        source: form.source,
        status: 'nuevo',
      } as any);

      toast.success(`Lead "${form.companyName}" creado correctamente`);
      setForm({
        companyName: '',
        contactName: '',
        phone: '',
        email: '',
        city: 'Málaga',
        address: '',
        website: '',
        notes: '',
        segment: 'pyme',
        source: 'manual',
      });
    } catch {
      toast.error('Error al crear el lead');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <UserPlus className="w-5 h-5" />
            Añadir Lead Manualmente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Empresa *</Label>
                <Input
                  value={form.companyName}
                  onChange={e => handleChange('companyName', e.target.value)}
                  placeholder="Nombre de la empresa"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Contacto</Label>
                <Input
                  value={form.contactName}
                  onChange={e => handleChange('contactName', e.target.value)}
                  placeholder="Nombre del contacto"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Teléfono</Label>
                <Input
                  value={form.phone}
                  onChange={e => handleChange('phone', e.target.value)}
                  placeholder="+34 612 345 678"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={e => handleChange('email', e.target.value)}
                  placeholder="info@empresa.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Ciudad</Label>
                <Input
                  value={form.city}
                  onChange={e => handleChange('city', e.target.value)}
                  placeholder="Málaga"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Dirección</Label>
                <Input
                  value={form.address}
                  onChange={e => handleChange('address', e.target.value)}
                  placeholder="Calle, número..."
                />
              </div>
              <div className="space-y-1.5">
                <Label>Web</Label>
                <Input
                  value={form.website}
                  onChange={e => handleChange('website', e.target.value)}
                  placeholder="www.empresa.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Segmento</Label>
                <Select value={form.segment} onValueChange={v => handleChange('segment', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pyme">PYME</SelectItem>
                    <SelectItem value="autonomo">Autónomo</SelectItem>
                    <SelectItem value="corporativo">Corporativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Fuente</Label>
                <Select value={form.source} onValueChange={v => handleChange('source', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="referido">Referido</SelectItem>
                    <SelectItem value="web">Web</SelectItem>
                    <SelectItem value="llamada">Llamada</SelectItem>
                    <SelectItem value="red_social">Red social</SelectItem>
                    <SelectItem value="evento">Evento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notas</Label>
              <Textarea
                value={form.notes}
                onChange={e => handleChange('notes', e.target.value)}
                placeholder="Notas adicionales sobre el lead..."
                rows={3}
              />
            </div>
            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              Crear Lead
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
