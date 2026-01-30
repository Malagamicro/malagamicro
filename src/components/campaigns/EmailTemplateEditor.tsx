import { useState, useCallback } from 'react';
import { sanitizeHtml } from '@/lib/sanitize';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Type,
  Image,
  Square,
  Minus,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Italic,
  Link,
  List,
  ChevronUp,
  ChevronDown,
  Trash2,
  Plus,
  Eye,
  Code,
  Palette,
  GripVertical,
  Mail,
} from 'lucide-react';

export interface EmailBlock {
  id: string;
  type: 'header' | 'text' | 'image' | 'button' | 'divider' | 'spacer' | 'list';
  content: string;
  styles: {
    backgroundColor?: string;
    textColor?: string;
    fontSize?: string;
    fontWeight?: string;
    textAlign?: 'left' | 'center' | 'right';
    padding?: string;
    gradientFrom?: string;
    gradientTo?: string;
    useGradient?: boolean;
    borderRadius?: string;
    imageUrl?: string;
    buttonUrl?: string;
    listItems?: string[];
  };
}

interface EmailTemplateEditorProps {
  initialBlocks?: EmailBlock[];
  onChange?: (blocks: EmailBlock[], html: string) => void;
}

const PRESET_COLORS = [
  '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
  '#22c55e', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6',
  '#1f2937', '#374151', '#6b7280', '#9ca3af', '#ffffff',
];

const defaultBlocks: EmailBlock[] = [
  {
    id: '1',
    type: 'header',
    content: '🎉 ¡Título del Email!',
    styles: {
      useGradient: true,
      gradientFrom: '#6366f1',
      gradientTo: '#a855f7',
      textColor: '#ffffff',
      fontSize: '28px',
      fontWeight: 'bold',
      textAlign: 'center',
      padding: '32px',
      borderRadius: '8px 8px 0 0',
    },
  },
  {
    id: '2',
    type: 'text',
    content: 'Este es un correo de ejemplo enviado desde **Malaga Micro CRM**.\n\nSi estás recibiendo este mensaje, significa que tu configuración está funcionando correctamente.',
    styles: {
      backgroundColor: '#ffffff',
      textColor: '#374151',
      fontSize: '16px',
      textAlign: 'left',
      padding: '24px',
    },
  },
  {
    id: '3',
    type: 'list',
    content: 'Características',
    styles: {
      backgroundColor: '#f0fdf4',
      textColor: '#166534',
      padding: '16px 24px',
      listItems: ['✓ Conexión establecida', '✓ Autenticación correcta', '✓ Email enviado exitosamente'],
    },
  },
  {
    id: '4',
    type: 'text',
    content: 'Fecha de envío: {{fecha}}',
    styles: {
      backgroundColor: '#ffffff',
      textColor: '#6b7280',
      fontSize: '14px',
      textAlign: 'left',
      padding: '16px 24px 24px 24px',
    },
  },
];

function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

export function EmailTemplateEditor({ initialBlocks, onChange }: EmailTemplateEditorProps) {
  const [blocks, setBlocks] = useState<EmailBlock[]>(initialBlocks || defaultBlocks);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'edit' | 'preview' | 'code'>('edit');

  const selectedBlock = blocks.find(b => b.id === selectedBlockId);

  const updateBlocks = useCallback((newBlocks: EmailBlock[]) => {
    setBlocks(newBlocks);
    onChange?.(newBlocks, generateHtml(newBlocks));
  }, [onChange]);

  const addBlock = (type: EmailBlock['type']) => {
    const newBlock: EmailBlock = {
      id: generateId(),
      type,
      content: getDefaultContent(type),
      styles: getDefaultStyles(type),
    };
    const newBlocks = [...blocks, newBlock];
    updateBlocks(newBlocks);
    setSelectedBlockId(newBlock.id);
  };

  const updateBlock = (id: string, updates: Partial<EmailBlock>) => {
    const newBlocks = blocks.map(b => 
      b.id === id ? { ...b, ...updates, styles: { ...b.styles, ...(updates.styles || {}) } } : b
    );
    updateBlocks(newBlocks);
  };

  const removeBlock = (id: string) => {
    const newBlocks = blocks.filter(b => b.id !== id);
    updateBlocks(newBlocks);
    if (selectedBlockId === id) setSelectedBlockId(null);
  };

  const moveBlock = (id: string, direction: 'up' | 'down') => {
    const index = blocks.findIndex(b => b.id === id);
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === blocks.length - 1)) return;
    
    const newBlocks = [...blocks];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    [newBlocks[index], newBlocks[newIndex]] = [newBlocks[newIndex], newBlocks[index]];
    updateBlocks(newBlocks);
  };

  const getDefaultContent = (type: EmailBlock['type']): string => {
    switch (type) {
      case 'header': return '✨ Nuevo Encabezado';
      case 'text': return 'Escribe tu texto aquí...';
      case 'button': return 'Haz clic aquí';
      case 'image': return '';
      case 'divider': return '';
      case 'spacer': return '';
      case 'list': return 'Lista';
      default: return '';
    }
  };

  const getDefaultStyles = (type: EmailBlock['type']): EmailBlock['styles'] => {
    switch (type) {
      case 'header':
        return {
          useGradient: true,
          gradientFrom: '#6366f1',
          gradientTo: '#a855f7',
          textColor: '#ffffff',
          fontSize: '24px',
          fontWeight: 'bold',
          textAlign: 'center',
          padding: '24px',
        };
      case 'text':
        return {
          backgroundColor: '#ffffff',
          textColor: '#374151',
          fontSize: '16px',
          textAlign: 'left',
          padding: '16px 24px',
        };
      case 'button':
        return {
          backgroundColor: '#6366f1',
          textColor: '#ffffff',
          fontSize: '16px',
          fontWeight: 'bold',
          textAlign: 'center',
          padding: '12px 32px',
          borderRadius: '8px',
          buttonUrl: 'https://ejemplo.com',
        };
      case 'image':
        return {
          padding: '16px',
          textAlign: 'center',
          imageUrl: 'https://via.placeholder.com/600x200',
        };
      case 'divider':
        return {
          padding: '8px 24px',
          backgroundColor: '#e5e7eb',
        };
      case 'spacer':
        return {
          padding: '24px',
        };
      case 'list':
        return {
          backgroundColor: '#f3f4f6',
          textColor: '#374151',
          padding: '16px 24px',
          listItems: ['Elemento 1', 'Elemento 2', 'Elemento 3'],
        };
      default:
        return {};
    }
  };

  const renderBlockPreview = (block: EmailBlock) => {
    const { styles } = block;
    const bgStyle = styles.useGradient 
      ? { background: `linear-gradient(135deg, ${styles.gradientFrom}, ${styles.gradientTo})` }
      : { backgroundColor: styles.backgroundColor };

    switch (block.type) {
      case 'header':
        return (
          <div 
            style={{
              ...bgStyle,
              color: styles.textColor,
              fontSize: styles.fontSize,
              fontWeight: styles.fontWeight as any,
              textAlign: styles.textAlign,
              padding: styles.padding,
              borderRadius: styles.borderRadius,
            }}
          >
            {block.content}
          </div>
        );
      case 'text':
        return (
          <div 
            style={{
              backgroundColor: styles.backgroundColor,
              color: styles.textColor,
              fontSize: styles.fontSize,
              textAlign: styles.textAlign,
              padding: styles.padding,
              whiteSpace: 'pre-wrap',
            }}
            dangerouslySetInnerHTML={{ __html: block.content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>') }}
          />
        );
      case 'button':
        return (
          <div style={{ padding: '16px 24px', textAlign: styles.textAlign, backgroundColor: '#ffffff' }}>
            <a
              href={styles.buttonUrl}
              style={{
                display: 'inline-block',
                backgroundColor: styles.backgroundColor,
                color: styles.textColor,
                fontSize: styles.fontSize,
                fontWeight: styles.fontWeight as any,
                padding: styles.padding,
                borderRadius: styles.borderRadius,
                textDecoration: 'none',
              }}
            >
              {block.content}
            </a>
          </div>
        );
      case 'image':
        return (
          <div style={{ padding: styles.padding, textAlign: styles.textAlign, backgroundColor: '#ffffff' }}>
            <img 
              src={styles.imageUrl} 
              alt="Email image" 
              style={{ maxWidth: '100%', height: 'auto', borderRadius: '8px' }}
            />
          </div>
        );
      case 'divider':
        return (
          <div style={{ padding: styles.padding, backgroundColor: '#ffffff' }}>
            <hr style={{ border: 'none', height: '1px', backgroundColor: styles.backgroundColor }} />
          </div>
        );
      case 'spacer':
        return <div style={{ padding: styles.padding, backgroundColor: '#ffffff' }} />;
      case 'list':
        return (
          <div 
            style={{
              backgroundColor: styles.backgroundColor,
              color: styles.textColor,
              padding: styles.padding,
            }}
          >
            {styles.listItems?.map((item, i) => (
              <div key={i} style={{ marginBottom: '4px' }}>{item}</div>
            ))}
          </div>
        );
      default:
        return null;
    }
  };

  const generateHtml = (blocksToRender: EmailBlock[]): string => {
    let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
`;

    blocksToRender.forEach(block => {
      const { styles } = block;
      const bgStyle = styles.useGradient 
        ? `background: linear-gradient(135deg, ${styles.gradientFrom}, ${styles.gradientTo});`
        : `background-color: ${styles.backgroundColor || '#ffffff'};`;

      switch (block.type) {
        case 'header':
          html += `    <div style="${bgStyle} color: ${styles.textColor}; font-size: ${styles.fontSize}; font-weight: ${styles.fontWeight}; text-align: ${styles.textAlign}; padding: ${styles.padding}; ${styles.borderRadius ? `border-radius: ${styles.borderRadius};` : ''}">${block.content}</div>\n`;
          break;
        case 'text':
          const formattedText = block.content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>');
          html += `    <div style="background-color: ${styles.backgroundColor}; color: ${styles.textColor}; font-size: ${styles.fontSize}; text-align: ${styles.textAlign}; padding: ${styles.padding};">${formattedText}</div>\n`;
          break;
        case 'button':
          html += `    <div style="padding: 16px 24px; text-align: ${styles.textAlign}; background-color: #ffffff;">
      <a href="${styles.buttonUrl}" style="display: inline-block; background-color: ${styles.backgroundColor}; color: ${styles.textColor}; font-size: ${styles.fontSize}; font-weight: ${styles.fontWeight}; padding: ${styles.padding}; border-radius: ${styles.borderRadius}; text-decoration: none;">${block.content}</a>
    </div>\n`;
          break;
        case 'image':
          html += `    <div style="padding: ${styles.padding}; text-align: ${styles.textAlign}; background-color: #ffffff;">
      <img src="${styles.imageUrl}" alt="Email image" style="max-width: 100%; height: auto; border-radius: 8px;" />
    </div>\n`;
          break;
        case 'divider':
          html += `    <div style="padding: ${styles.padding}; background-color: #ffffff;">
      <hr style="border: none; height: 1px; background-color: ${styles.backgroundColor};" />
    </div>\n`;
          break;
        case 'spacer':
          html += `    <div style="padding: ${styles.padding}; background-color: #ffffff;"></div>\n`;
          break;
        case 'list':
          html += `    <div style="background-color: ${styles.backgroundColor}; color: ${styles.textColor}; padding: ${styles.padding};">
${styles.listItems?.map(item => `      <div style="margin-bottom: 4px;">${item}</div>`).join('\n') || ''}
    </div>\n`;
          break;
      }
    });

    html += `  </div>
</body>
</html>`;

    return html;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[600px]">
      {/* Block palette */}
      <div className="lg:col-span-1 border rounded-lg p-4 bg-muted/30">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Añadir bloque
        </h3>
        <div className="grid grid-cols-2 gap-2 mb-4">
          <Button variant="outline" size="sm" className="justify-start gap-2" onClick={() => addBlock('header')}>
            <Type className="w-4 h-4" /> Cabecera
          </Button>
          <Button variant="outline" size="sm" className="justify-start gap-2" onClick={() => addBlock('text')}>
            <AlignLeft className="w-4 h-4" /> Texto
          </Button>
          <Button variant="outline" size="sm" className="justify-start gap-2" onClick={() => addBlock('image')}>
            <Image className="w-4 h-4" /> Imagen
          </Button>
          <Button variant="outline" size="sm" className="justify-start gap-2" onClick={() => addBlock('button')}>
            <Square className="w-4 h-4" /> Botón
          </Button>
          <Button variant="outline" size="sm" className="justify-start gap-2" onClick={() => addBlock('list')}>
            <List className="w-4 h-4" /> Lista
          </Button>
          <Button variant="outline" size="sm" className="justify-start gap-2" onClick={() => addBlock('divider')}>
            <Minus className="w-4 h-4" /> Divisor
          </Button>
        </div>

        <Separator className="my-4" />

        {/* Block properties */}
        {selectedBlock && (
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Palette className="w-4 h-4" />
              Propiedades
            </h3>
            
            {/* Content */}
            {selectedBlock.type !== 'divider' && selectedBlock.type !== 'spacer' && (
              <div className="space-y-2">
                <Label className="text-xs">Contenido</Label>
                {selectedBlock.type === 'list' ? (
                  <Textarea
                    value={selectedBlock.styles.listItems?.join('\n') || ''}
                    onChange={(e) => updateBlock(selectedBlock.id, { 
                      styles: { listItems: e.target.value.split('\n') } 
                    })}
                    rows={4}
                    placeholder="Un elemento por línea"
                    className="text-sm"
                  />
                ) : (
                  <Textarea
                    value={selectedBlock.content}
                    onChange={(e) => updateBlock(selectedBlock.id, { content: e.target.value })}
                    rows={3}
                    className="text-sm"
                  />
                )}
              </div>
            )}

            {/* Colors */}
            {selectedBlock.type === 'header' && (
              <div className="space-y-2">
                <Label className="text-xs flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    checked={selectedBlock.styles.useGradient} 
                    onChange={(e) => updateBlock(selectedBlock.id, { styles: { useGradient: e.target.checked } })}
                  />
                  Usar degradado
                </Label>
                {selectedBlock.styles.useGradient ? (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Desde</Label>
                      <div className="flex gap-1 flex-wrap mt-1">
                        {PRESET_COLORS.slice(0, 10).map(color => (
                          <button
                            key={color}
                            className="w-5 h-5 rounded border"
                            style={{ backgroundColor: color }}
                            onClick={() => updateBlock(selectedBlock.id, { styles: { gradientFrom: color } })}
                          />
                        ))}
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Hasta</Label>
                      <div className="flex gap-1 flex-wrap mt-1">
                        {PRESET_COLORS.slice(0, 10).map(color => (
                          <button
                            key={color}
                            className="w-5 h-5 rounded border"
                            style={{ backgroundColor: color }}
                            onClick={() => updateBlock(selectedBlock.id, { styles: { gradientTo: color } })}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <Label className="text-xs">Color de fondo</Label>
                    <div className="flex gap-1 flex-wrap mt-1">
                      {PRESET_COLORS.map(color => (
                        <button
                          key={color}
                          className="w-5 h-5 rounded border"
                          style={{ backgroundColor: color }}
                          onClick={() => updateBlock(selectedBlock.id, { styles: { backgroundColor: color } })}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {(selectedBlock.type === 'text' || selectedBlock.type === 'list' || selectedBlock.type === 'button') && (
              <div className="space-y-2">
                <Label className="text-xs">Color de fondo</Label>
                <div className="flex gap-1 flex-wrap">
                  {PRESET_COLORS.map(color => (
                    <button
                      key={color}
                      className="w-5 h-5 rounded border"
                      style={{ backgroundColor: color }}
                      onClick={() => updateBlock(selectedBlock.id, { styles: { backgroundColor: color } })}
                    />
                  ))}
                </div>
              </div>
            )}

            {(selectedBlock.type === 'header' || selectedBlock.type === 'text' || selectedBlock.type === 'list' || selectedBlock.type === 'button') && (
              <div className="space-y-2">
                <Label className="text-xs">Color de texto</Label>
                <div className="flex gap-1 flex-wrap">
                  {PRESET_COLORS.map(color => (
                    <button
                      key={color}
                      className="w-5 h-5 rounded border"
                      style={{ backgroundColor: color }}
                      onClick={() => updateBlock(selectedBlock.id, { styles: { textColor: color } })}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Alignment */}
            {(selectedBlock.type === 'header' || selectedBlock.type === 'text' || selectedBlock.type === 'button') && (
              <div className="space-y-2">
                <Label className="text-xs">Alineación</Label>
                <div className="flex gap-1">
                  <Button 
                    variant={selectedBlock.styles.textAlign === 'left' ? 'default' : 'outline'} 
                    size="icon" 
                    className="h-8 w-8"
                    onClick={() => updateBlock(selectedBlock.id, { styles: { textAlign: 'left' } })}
                  >
                    <AlignLeft className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant={selectedBlock.styles.textAlign === 'center' ? 'default' : 'outline'} 
                    size="icon" 
                    className="h-8 w-8"
                    onClick={() => updateBlock(selectedBlock.id, { styles: { textAlign: 'center' } })}
                  >
                    <AlignCenter className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant={selectedBlock.styles.textAlign === 'right' ? 'default' : 'outline'} 
                    size="icon" 
                    className="h-8 w-8"
                    onClick={() => updateBlock(selectedBlock.id, { styles: { textAlign: 'right' } })}
                  >
                    <AlignRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Image URL */}
            {selectedBlock.type === 'image' && (
              <div className="space-y-2">
                <Label className="text-xs">URL de imagen</Label>
                <Input
                  value={selectedBlock.styles.imageUrl || ''}
                  onChange={(e) => updateBlock(selectedBlock.id, { styles: { imageUrl: e.target.value } })}
                  placeholder="https://..."
                  className="text-sm"
                />
              </div>
            )}

            {/* Button URL */}
            {selectedBlock.type === 'button' && (
              <div className="space-y-2">
                <Label className="text-xs">URL del botón</Label>
                <Input
                  value={selectedBlock.styles.buttonUrl || ''}
                  onChange={(e) => updateBlock(selectedBlock.id, { styles: { buttonUrl: e.target.value } })}
                  placeholder="https://..."
                  className="text-sm"
                />
              </div>
            )}

            {/* Font size */}
            {(selectedBlock.type === 'header' || selectedBlock.type === 'text') && (
              <div className="space-y-2">
                <Label className="text-xs">Tamaño de fuente</Label>
                <Select
                  value={selectedBlock.styles.fontSize}
                  onValueChange={(v) => updateBlock(selectedBlock.id, { styles: { fontSize: v } })}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="12px">Pequeño (12px)</SelectItem>
                    <SelectItem value="14px">Normal (14px)</SelectItem>
                    <SelectItem value="16px">Mediano (16px)</SelectItem>
                    <SelectItem value="20px">Grande (20px)</SelectItem>
                    <SelectItem value="24px">Muy grande (24px)</SelectItem>
                    <SelectItem value="28px">Título (28px)</SelectItem>
                    <SelectItem value="32px">Título grande (32px)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Preview area */}
      <div className="lg:col-span-2 border rounded-lg overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-2 border-b bg-muted/30">
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
            <TabsList className="h-8">
              <TabsTrigger value="edit" className="text-xs h-7 px-3">
                <GripVertical className="w-3 h-3 mr-1" />
                Editar
              </TabsTrigger>
              <TabsTrigger value="preview" className="text-xs h-7 px-3">
                <Eye className="w-3 h-3 mr-1" />
                Vista previa
              </TabsTrigger>
              <TabsTrigger value="code" className="text-xs h-7 px-3">
                <Code className="w-3 h-3 mr-1" />
                HTML
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <ScrollArea className="flex-1 bg-muted/20">
          {viewMode === 'edit' && (
            <div className="p-4">
              <div className="max-w-[600px] mx-auto bg-card rounded-lg shadow-lg overflow-hidden">
                {blocks.length === 0 ? (
                  <div className="p-12 text-center text-muted-foreground">
                    <Mail className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Añade bloques para crear tu plantilla</p>
                  </div>
                ) : (
                  blocks.map((block, index) => (
                    <div
                      key={block.id}
                      className={`relative group cursor-pointer transition-all ${selectedBlockId === block.id ? 'ring-2 ring-primary ring-offset-1' : ''}`}
                      onClick={() => setSelectedBlockId(block.id)}
                    >
                      {renderBlockPreview(block)}
                      
                      {/* Block controls */}
                      <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                        <Button size="icon" variant="secondary" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); moveBlock(block.id, 'up'); }} disabled={index === 0}>
                          <ChevronUp className="w-3 h-3" />
                        </Button>
                        <Button size="icon" variant="secondary" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); moveBlock(block.id, 'down'); }} disabled={index === blocks.length - 1}>
                          <ChevronDown className="w-3 h-3" />
                        </Button>
                        <Button size="icon" variant="destructive" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); removeBlock(block.id); }}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {viewMode === 'preview' && (
            <div className="p-4">
              <div 
                className="max-w-[600px] mx-auto bg-card rounded-lg shadow-lg overflow-hidden"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(generateHtml(blocks).replace(/<!DOCTYPE html>[\s\S]*?<body[^>]*>/, '').replace(/<\/body>[\s\S]*/, '').replace(/<div style="max-width: 600px[^>]*>/, '').replace(/<\/div>\s*$/, '')) }}
              />
            </div>
          )}

          {viewMode === 'code' && (
            <div className="p-4">
              <pre className="text-xs bg-muted p-4 rounded-lg overflow-x-auto whitespace-pre-wrap">
                {generateHtml(blocks)}
              </pre>
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}

export function generateEmailHtml(blocks: EmailBlock[]): string {
  let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
`;

  blocks.forEach(block => {
    const { styles } = block;
    const bgStyle = styles.useGradient 
      ? `background: linear-gradient(135deg, ${styles.gradientFrom}, ${styles.gradientTo});`
      : `background-color: ${styles.backgroundColor || '#ffffff'};`;

    switch (block.type) {
      case 'header':
        html += `    <div style="${bgStyle} color: ${styles.textColor}; font-size: ${styles.fontSize}; font-weight: ${styles.fontWeight}; text-align: ${styles.textAlign}; padding: ${styles.padding}; ${styles.borderRadius ? `border-radius: ${styles.borderRadius};` : ''}">${block.content}</div>\n`;
        break;
      case 'text':
        const formattedText = block.content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>');
        html += `    <div style="background-color: ${styles.backgroundColor}; color: ${styles.textColor}; font-size: ${styles.fontSize}; text-align: ${styles.textAlign}; padding: ${styles.padding};">${formattedText}</div>\n`;
        break;
      case 'button':
        html += `    <div style="padding: 16px 24px; text-align: ${styles.textAlign}; background-color: #ffffff;">
      <a href="${styles.buttonUrl}" style="display: inline-block; background-color: ${styles.backgroundColor}; color: ${styles.textColor}; font-size: ${styles.fontSize}; font-weight: ${styles.fontWeight}; padding: ${styles.padding}; border-radius: ${styles.borderRadius}; text-decoration: none;">${block.content}</a>
    </div>\n`;
        break;
      case 'image':
        html += `    <div style="padding: ${styles.padding}; text-align: ${styles.textAlign}; background-color: #ffffff;">
      <img src="${styles.imageUrl}" alt="Email image" style="max-width: 100%; height: auto; border-radius: 8px;" />
    </div>\n`;
        break;
      case 'divider':
        html += `    <div style="padding: ${styles.padding}; background-color: #ffffff;">
      <hr style="border: none; height: 1px; background-color: ${styles.backgroundColor};" />
    </div>\n`;
        break;
      case 'spacer':
        html += `    <div style="padding: ${styles.padding}; background-color: #ffffff;"></div>\n`;
        break;
      case 'list':
        html += `    <div style="background-color: ${styles.backgroundColor}; color: ${styles.textColor}; padding: ${styles.padding};">
${styles.listItems?.map(item => `      <div style="margin-bottom: 4px;">${item}</div>`).join('\n') || ''}
    </div>\n`;
        break;
    }
  });

  html += `  </div>
</body>
</html>`;

  return html;
}
