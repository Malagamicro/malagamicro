import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Lead, LeadStatus } from '@/types/lead';
import { LeadStatusBadge } from './LeadStatusBadge';
import { LeadScoreBadge } from './LeadScoreBadge';
import { Building2, Mail, Phone, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LeadKanbanProps {
  leads: Lead[];
  onViewLead: (id: string) => void;
  onUpdateStatus: (id: string, status: LeadStatus, previousStatus?: LeadStatus) => void;
}

const columns: { id: LeadStatus; title: string; color: string }[] = [
  { id: 'nuevo', title: 'Nuevos', color: 'bg-status-new' },
  { id: 'contactado', title: 'Contactados', color: 'bg-status-contacted' },
  { id: 'interesado', title: 'Interesados', color: 'bg-status-interested' },
  { id: 'cliente', title: 'Clientes', color: 'bg-status-client' },
];

export function LeadKanban({ leads, onViewLead, onUpdateStatus }: LeadKanbanProps) {
  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;

    // Dropped outside any column
    if (!destination) return;

    // Dropped in the same position
    if (destination.droppableId === source.droppableId && destination.index === source.index) {
      return;
    }

    const newStatus = destination.droppableId as LeadStatus;
    const previousStatus = source.droppableId as LeadStatus;

    // Only update if status changed
    if (newStatus !== previousStatus) {
      onUpdateStatus(draggableId, newStatus, previousStatus);
    }
  };

  const getLeadsByStatus = (status: LeadStatus) => {
    return leads
      .filter(lead => lead.status === status)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4 min-h-[calc(100vh-200px)]">
        {columns.map((column) => {
          const columnLeads = getLeadsByStatus(column.id);
          
          return (
            <div
              key={column.id}
              className="flex-shrink-0 w-80 bg-muted/30 rounded-xl border border-border flex flex-col max-h-[calc(100vh-180px)]"
            >
              {/* Column Header */}
              <div className="p-4 border-b border-border flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={cn('w-3 h-3 rounded-full', column.color)} />
                    <h3 className="font-semibold text-foreground">{column.title}</h3>
                  </div>
                  <span className="text-sm text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {columnLeads.length}
                  </span>
                </div>
              </div>

              {/* Droppable Column with scroll */}
              <Droppable droppableId={column.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn(
                      'p-2 min-h-[200px] transition-colors flex-1 overflow-y-auto overflow-x-hidden',
                      snapshot.isDraggingOver && 'bg-primary/5'
                    )}
                    style={{ maxHeight: 'calc(100vh - 280px)' }}
                  >
                    {columnLeads.map((lead, index) => (
                      <Draggable key={lead.id} draggableId={lead.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={cn(
                              'bg-card rounded-lg p-3 mb-2 border border-border shadow-sm',
                              'hover:border-primary/30 transition-all cursor-pointer',
                              snapshot.isDragging && 'shadow-lg ring-2 ring-primary/20'
                            )}
                            onClick={() => onViewLead(lead.id)}
                          >
                            <div className="flex items-start gap-2">
                              {/* Drag Handle */}
                              <div
                                {...provided.dragHandleProps}
                                className="mt-1 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <GripVertical className="w-4 h-4" />
                              </div>

                              {/* Lead Content */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                                      <Building2 className="w-4 h-4 text-primary" />
                                    </div>
                                    <div className="min-w-0">
                                      <h4 className="font-medium text-sm text-foreground truncate">
                                        {lead.companyName}
                                      </h4>
                                      {lead.contactName && (
                                        <p className="text-xs text-muted-foreground truncate">
                                          {lead.contactName}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  <LeadScoreBadge score={lead.score ?? 0} size="sm" />
                                </div>

                                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                  {lead.email && (
                                    <span className="flex items-center gap-1">
                                      <Mail className="w-3 h-3" />
                                    </span>
                                  )}
                                  {lead.phone && (
                                    <span className="flex items-center gap-1">
                                      <Phone className="w-3 h-3" />
                                    </span>
                                  )}
                                  <span className="truncate">{lead.city}</span>
                                </div>

                                {lead.tags && lead.tags.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    {lead.tags.slice(0, 2).map((tag) => (
                                      <span
                                        key={tag}
                                        className="px-1.5 py-0.5 text-[10px] bg-muted text-muted-foreground rounded"
                                      >
                                        {tag}
                                      </span>
                                    ))}
                                    {lead.tags.length > 2 && (
                                      <span className="px-1.5 py-0.5 text-[10px] bg-muted text-muted-foreground rounded">
                                        +{lead.tags.length - 2}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                    
                    {columnLeads.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        Arrastra leads aquí
                      </div>
                    )}
                  </div>
                )}
              </Droppable>
            </div>
          );
        })}
      </div>
    </DragDropContext>
  );
}
