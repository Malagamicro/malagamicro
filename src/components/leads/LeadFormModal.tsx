import { useState, useEffect } from 'react';
import { Lead, LeadStatus, LeadSegment, LeadSource } from '@/types/lead';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { z } from 'zod';

const leadSchema = z.object({
  companyName: z.string().min(1, 'El nombre de empresa es obligatorio'),
  contactName: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().optional(),
  website: z.string().optional(),
  address: z.string().optional(),
  city: z.string().min(1, 'La ciudad es obligatoria'),
  status: z.enum(['nuevo', 'contactado', 'interesado', 'cliente']),
  segment: z.enum(['franquicia', 'pyme']),
  source: z.enum(['google_maps', 'web_scraping', 'referido', 'manual']),
  equipmentCount: z.number().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

type LeadFormData = z.infer<typeof leadSchema>;

interface LeadFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead?: Lead | null;
  onSubmit: (data: LeadFormData) => void;
  isLoading?: boolean;
}

export function LeadFormModal({ 
  open, 
  onOpenChange, 
  lead, 
  onSubmit,
  isLoading = false 
}: LeadFormModalProps) {
  const isEditing = !!lead;
  
  const [formData, setFormData] = useState<LeadFormData>({
    companyName: '',
    contactName: '',
    email: '',
    phone: '',
    website: '',
    address: '',
    city: 'Málaga',
    status: 'nuevo',
    segment: 'pyme',
    source: 'manual',
    equipmentCount: undefined,
    notes: '',
    tags: [],
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [tagsInput, setTagsInput] = useState('');

  useEffect(() => {
    if (lead) {
      setFormData({
        companyName: lead.companyName,
        contactName: lead.contactName || '',
        email: lead.email || '',
        phone: lead.phone || '',
        website: lead.website || '',
        address: lead.address || '',
        city: lead.city,
        status: lead.status,
        segment: lead.segment,
        source: lead.source,
        equipmentCount: lead.equipmentCount,
        notes: lead.notes || '',
        tags: lead.tags || [],
      });
      setTagsInput(lead.tags?.join(', ') || '');
    } else {
      setFormData({
        companyName: '',
        contactName: '',
        email: '',
        phone: '',
        website: '',
        address: '',
        city: 'Málaga',
        status: 'nuevo',
        segment: 'pyme',
        source: 'manual',
        equipmentCount: undefined,
        notes: '',
        tags: [],
      });
      setTagsInput('');
    }
    setErrors({});
  }, [lead, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Parse tags from input
    const tags = tagsInput
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);
    
    const dataToValidate = {
      ...formData,
      tags,
      email: formData.email || undefined,
    };

    try {
      leadSchema.parse(dataToValidate);
      setErrors({});
      onSubmit({ ...dataToValidate, tags });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0].toString()] = err.message;
          }
        });
        setErrors(fieldErrors);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar Lead' : 'Nuevo Lead'}
          </DialogTitle>
          <DialogDescription>
            {isEditing 
              ? 'Actualiza la información del lead.' 
              : 'Añade un nuevo lead a tu base de datos.'}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Company Name */}
          <div className="space-y-2">
            <Label htmlFor="companyName">Nombre de Empresa *</Label>
            <Input
              id="companyName"
              value={formData.companyName}
              onChange={(e) => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
              placeholder="Empresa S.L."
              disabled={isLoading}
            />
            {errors.companyName && (
              <p className="text-sm text-destructive">{errors.companyName}</p>
            )}
          </div>

          {/* Contact Name & Email */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contactName">Nombre de Contacto</Label>
              <Input
                id="contactName"
                value={formData.contactName}
                onChange={(e) => setFormData(prev => ({ ...prev, contactName: e.target.value }))}
                placeholder="Juan García"
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="contacto@empresa.com"
                disabled={isLoading}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email}</p>
              )}
            </div>
          </div>

          {/* Phone & Website */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="+34 600 000 000"
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="website">Web</Label>
              <Input
                id="website"
                value={formData.website}
                onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
                placeholder="www.empresa.com"
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Address & City */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="address">Dirección</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                placeholder="Calle Principal 123"
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">Ciudad *</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                placeholder="Málaga"
                disabled={isLoading}
              />
              {errors.city && (
                <p className="text-sm text-destructive">{errors.city}</p>
              )}
            </div>
          </div>

          {/* Status, Segment & Source */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select
                value={formData.status}
                onValueChange={(v) => setFormData(prev => ({ ...prev, status: v as LeadStatus }))}
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nuevo">Nuevo</SelectItem>
                  <SelectItem value="contactado">Contactado</SelectItem>
                  <SelectItem value="interesado">Interesado</SelectItem>
                  <SelectItem value="cliente">Cliente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Segmento</Label>
              <Select
                value={formData.segment}
                onValueChange={(v) => setFormData(prev => ({ ...prev, segment: v as LeadSegment }))}
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pyme">PYME</SelectItem>
                  <SelectItem value="franquicia">Franquicia</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fuente</Label>
              <Select
                value={formData.source}
                onValueChange={(v) => setFormData(prev => ({ ...prev, source: v as LeadSource }))}
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="google_maps">Google Maps</SelectItem>
                  <SelectItem value="web_scraping">Web</SelectItem>
                  <SelectItem value="referido">Referido</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Equipment Count */}
          <div className="space-y-2">
            <Label htmlFor="equipmentCount">Número de Equipos</Label>
            <Input
              id="equipmentCount"
              type="number"
              min={0}
              value={formData.equipmentCount || ''}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                equipmentCount: e.target.value ? parseInt(e.target.value) : undefined 
              }))}
              placeholder="0"
              disabled={isLoading}
            />
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label htmlFor="tags">Etiquetas</Label>
            <Input
              id="tags"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="hostelería, urgente, servidor (separadas por coma)"
              disabled={isLoading}
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notas</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Notas adicionales sobre el lead..."
              rows={3}
              disabled={isLoading}
            />
          </div>

          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? 'Guardar Cambios' : 'Crear Lead'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
