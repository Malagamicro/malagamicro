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
import { Loader2, Plus, FolderOpen } from 'lucide-react';
import { z } from 'zod';
import { useLeadFolders } from '@/hooks/useLeadFolders';

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
  folderId: z.string().nullable().optional(),
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
  const { folders, createFolder, isCreating: isCreatingFolder } = useLeadFolders();
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState('#6366f1');
  
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
    folderId: undefined,
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
        folderId: lead.folderId,
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
        folderId: undefined,
      });
      setTagsInput('');
    }
    setErrors({});
    setShowNewFolderInput(false);
    setNewFolderName('');
  }, [lead, open]);

  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      createFolder(
        { name: newFolderName.trim(), color: newFolderColor },
        {
          onSuccess: () => {
            setNewFolderName('');
            setShowNewFolderInput(false);
          },
        }
      );
    }
  };

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
      // CRITICAL: folderId must be null (not undefined) when no folder is selected
      folderId: formData.folderId === 'none' || !formData.folderId ? null : formData.folderId,
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
        
        <div className="space-y-4">
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

          {/* Folder */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <FolderOpen className="w-4 h-4" />
              Carpeta
            </Label>
            {!showNewFolderInput ? (
              <div className="flex gap-2">
                <Select
                  value={formData.folderId || 'none'}
                  onValueChange={(v) => setFormData(prev => ({ 
                    ...prev, 
                    folderId: v === 'none' ? undefined : v 
                  }))}
                  disabled={isLoading}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Sin carpeta" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin carpeta</SelectItem>
                    {folders.map((folder) => (
                      <SelectItem key={folder.id} value={folder.id}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: folder.color }}
                          />
                          {folder.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowNewFolderInput(true)}
                  disabled={isLoading}
                  title="Crear nueva carpeta"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="Nombre de la carpeta"
                    disabled={isCreatingFolder}
                  />
                  <input
                    type="color"
                    value={newFolderColor}
                    onChange={(e) => setNewFolderColor(e.target.value)}
                    className="w-10 h-10 rounded border cursor-pointer"
                    disabled={isCreatingFolder}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleCreateFolder}
                    disabled={!newFolderName.trim() || isCreatingFolder}
                  >
                    {isCreatingFolder && <Loader2 className="mr-1 w-3 h-3 animate-spin" />}
                    Crear
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowNewFolderInput(false);
                      setNewFolderName('');
                    }}
                    disabled={isCreatingFolder}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
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
        </div>

        <DialogFooter className="mt-4">
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button 
            type="button" 
            onClick={handleSubmit}
            disabled={isLoading}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? 'Guardar Cambios' : 'Crear Lead'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
