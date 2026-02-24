import { useState, useMemo } from 'react';
import {
  Home, Search, Settings, User, Users, Mail, MessageSquare, Phone, Video,
  Camera, Image, FileText, File, Folder, FolderOpen, Download, Upload,
  Share2, Link, Globe, Wifi, Cloud, CloudOff, Database, Server,
  Lock, Unlock, Key, Shield, Eye, EyeOff, Bell, BellOff, Clock,
  Calendar, CalendarDays, Star, Heart, Bookmark, Flag, Tag, Hash,
  MapPin, Map, Navigation, Compass, Sun, Moon, Zap, Battery,
  Cpu, Monitor, Smartphone, Tablet, Laptop, Printer, Headphones,
  Music, Play, Pause, SquareIcon, Circle, Triangle, Hexagon, Octagon,
  ArrowUp, ArrowDown, ArrowLeft, ArrowRight, RefreshCw, RotateCcw,
  Plus, Minus, X, Check, AlertTriangle, AlertCircle, Info,
  HelpCircle, MessageCircle, Send, Inbox, Archive, Trash2, Edit,
  Copy, Clipboard, Scissors, PenTool, Paintbrush, Palette, Droplet,
  Layout, Grid, List, Table, BarChart, BarChart3, PieChart, LineChart, TrendingUp,
  Activity, Flame, Target, Award, Gift, ShoppingCart, ShoppingBag,
  CreditCard, DollarSign, Wallet, Building, Building2, Store,
  Truck, Package, Box, Briefcase, GraduationCap, BookOpen, Library,
  Newspaper, Rss, Radio, Tv, Film, Clapperboard, Gamepad2,
  Puzzle, Lightbulb, Wrench, Hammer, Terminal, Code, CodeSquare,
  GitBranch, Github, Chrome, Figma, Slack, Twitter,
  Bot, Sparkles, Wand2, Brain, Rocket, Atom, Microscope,
  Stethoscope, Pill, Thermometer, TreePine, Flower2, Leaf,
  Coffee, UtensilsCrossed, Wine, Cake, Pizza, IceCream,
  Dog, Cat, Fish, Bug, Bird, Megaphone, Ticket, MessagesSquare,
  FileEdit, Receipt, Landmark, Crown, Gem, Swords,
  Anchor, Ship, Plane, Car, Bike, Train,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export const FULL_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Home, Search, Settings, User, Users, Mail, MessageSquare, Phone, Video,
  Camera, Image, FileText, File, Folder, FolderOpen, Download, Upload,
  Share2, Link, Globe, Wifi, Cloud, CloudOff, Database, Server,
  Lock, Unlock, Key, Shield, Eye, EyeOff, Bell, BellOff, Clock,
  Calendar, CalendarDays, Star, Heart, Bookmark, Flag, Tag, Hash,
  MapPin, Map, Navigation, Compass, Sun, Moon, Zap, Battery,
  Cpu, Monitor, Smartphone, Tablet, Laptop, Printer, Headphones,
  Music, Play, Pause, SquareIcon, Circle, Triangle, Hexagon, Octagon,
  ArrowUp, ArrowDown, ArrowLeft, ArrowRight, RefreshCw, RotateCcw,
  Plus, Minus, X, Check, AlertTriangle, AlertCircle, Info,
  HelpCircle, MessageCircle, Send, Inbox, Archive, Trash2, Edit,
  Copy, Clipboard, Scissors, PenTool, Paintbrush, Palette, Droplet,
  Layout, Grid, List, Table, BarChart, BarChart3, PieChart, LineChart, TrendingUp,
  Activity, Flame, Target, Award, Gift, ShoppingCart, ShoppingBag,
  CreditCard, DollarSign, Wallet, Building, Building2, Store,
  Truck, Package, Box, Briefcase, GraduationCap, BookOpen, Library,
  Newspaper, Rss, Radio, Tv, Film, Clapperboard, Gamepad2,
  Puzzle, Lightbulb, Wrench, Hammer, Terminal, Code, CodeSquare,
  GitBranch, Github, Chrome, Figma, Slack, Twitter,
  Bot, Sparkles, Wand2, Brain, Rocket, Atom, Microscope,
  Stethoscope, Pill, Thermometer, TreePine, Flower2, Leaf,
  Coffee, UtensilsCrossed, Wine, Cake, Pizza, IceCream,
  Dog, Cat, Fish, Bug, Bird, Megaphone, Ticket, MessagesSquare,
  FileEdit, Receipt, Landmark, Crown, Gem, Swords,
  Anchor, Ship, Plane, Car, Bike, Train,
};

const ALL_ICON_NAMES = Object.keys(FULL_ICON_MAP);

interface IconPickerProps {
  value: string;
  onChange: (icon: string) => void;
  triggerClassName?: string;
}

export function IconPicker({ value, onChange, triggerClassName }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search) return ALL_ICON_NAMES;
    const q = search.toLowerCase();
    return ALL_ICON_NAMES.filter(n => n.toLowerCase().includes(q));
  }, [search]);

  const CurrentIcon = FULL_ICON_MAP[value] || Cloud;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className={cn(
          'p-1.5 rounded-lg hover:bg-muted border border-border/50 transition-colors',
          triggerClassName
        )}>
          <CurrentIcon className="w-4 h-4 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="start">
        <Input
          placeholder="Buscar icono..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-8 text-xs mb-2"
          autoFocus
        />
        <ScrollArea className="h-52">
          <div className="grid grid-cols-8 gap-1">
            {filtered.map(name => {
              const Icon = FULL_ICON_MAP[name];
              return (
                <button
                  key={name}
                  onClick={() => { onChange(name); setOpen(false); setSearch(''); }}
                  title={name}
                  className={cn(
                    'p-1.5 rounded-md hover:bg-muted transition-colors flex items-center justify-center',
                    value === name && 'bg-primary/20 ring-1 ring-primary'
                  )}
                >
                  <Icon className="w-4 h-4" />
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

export function getIconComponent(name: string) {
  return FULL_ICON_MAP[name] || Cloud;
}
