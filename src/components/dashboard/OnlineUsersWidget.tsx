import { useUserPresence } from '@/hooks/useUserPresence';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Monitor, Smartphone, Tablet, Wifi } from 'lucide-react';

const deviceIcon = (type: string) => {
  switch (type) {
    case 'mobile': return <Smartphone className="h-3 w-3" />;
    case 'tablet': return <Tablet className="h-3 w-3" />;
    default: return <Monitor className="h-3 w-3" />;
  }
};

const deviceLabel = (type: string) => {
  switch (type) {
    case 'mobile': return 'Móvil';
    case 'tablet': return 'Tablet';
    default: return 'Escritorio';
  }
};

export function OnlineUsersWidget() {
  const { onlineUsers } = useUserPresence();

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Wifi className="h-4 w-4 text-success" />
          Usuarios Online
          <Badge variant="secondary" className="ml-auto text-xs">
            {onlineUsers.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {onlineUsers.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            No hay usuarios conectados
          </p>
        ) : (
          onlineUsers.map((u) => (
            <div key={u.user_id} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-muted/50 transition-colors">
              <div className="relative">
                <Avatar className="h-8 w-8">
                  {u.profile?.avatar_url && <AvatarImage src={u.profile.avatar_url} />}
                  <AvatarFallback className="text-xs">
                    {(u.profile?.full_name || 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-success border-2 border-background" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {u.profile?.full_name || 'Usuario'}
                </p>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  {deviceIcon(u.device_type)}
                  <span>{deviceLabel(u.device_type)}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
