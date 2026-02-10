import { useState } from 'react';
import { Smile, Sticker } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';

const EMOJI_CATEGORIES = [
  {
    name: 'Caras',
    emojis: ['😀','😁','😂','🤣','😃','😄','😅','😆','😉','😊','😋','😎','😍','🥰','😘','😗','😙','😚','🙂','🤗','🤩','🤔','🤨','😐','😑','😶','🙄','😏','😣','😥','😮','🤐','😯','😪','😫','🥱','😴','😌','😛','😜','😝','🤤','😒','😓','😔','😕','🙃','🤑','😲','🙁','😖','😞','😟','😤','😢','😭','😦','😧','😨','😩','🤯','😬','😱','🥵','🥶','😳','🤪','😵','🥴','😠','😡','🤬','😷','🤒','🤕','🤢','🤮','🥺','🥹','😇','🤠','🤡','🤥','🤫','🤭','🧐','🤓'],
  },
  {
    name: 'Manos',
    emojis: ['👋','🤚','🖐','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','💪','🦾','🫶','❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❤️‍🔥','💕','💞','💓','💗','💖','💘','💝'],
  },
  {
    name: 'Objetos',
    emojis: ['🎉','🎊','🎈','🎁','🏆','🥇','🥈','🥉','⚽','🏀','🎯','🎮','🎲','🎪','🎭','🎨','🎬','🎤','🎧','🎵','🎶','💻','📱','⌨️','💡','🔧','🔨','📎','📌','📝','📅','📊','📈','💰','💵','💳','✈️','🚀','⭐','🌟','💫','🔥','💧','🌈','☀️','🌙','⚡','❄️','🌸','🌺','🌻','🍀'],
  },
  {
    name: 'Comida',
    emojis: ['🍕','🍔','🍟','🌭','🍿','🧀','🥩','🍗','🍖','🌮','🌯','🥗','🍝','🍜','🍲','🍣','🍱','🍙','🍚','🍘','🍥','🥮','🍡','🍧','🍨','🍦','🍰','🎂','🧁','🍮','🍭','🍬','🍫','🍩','🍪','☕','🍵','🥤','🍺','🍻','🥂','🍷','🍸','🍹','🧃','🧊'],
  },
];

const STICKERS = [
  '👋😊', '🎉🥳', '👍✨', '❤️🔥', '🤝💪', '🚀⭐',
  '😂🤣', '🙏💫', '🎯🏆', '💡🧠', '📈💰', '☕🍪',
  '🌟👏', '💪🔥', '🤩🎊', '😎✌️', '🥰💕', '🤗🫶',
];

interface EmojiStickerPickerProps {
  onSelect: (value: string) => void;
}

export function EmojiStickerPicker({ onSelect }: EmojiStickerPickerProps) {
  const [open, setOpen] = useState(false);

  const handleSelect = (value: string) => {
    onSelect(value);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9">
          <Smile className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        className="w-80 p-0"
        sideOffset={8}
      >
        <Tabs defaultValue="emojis" className="w-full">
          <TabsList className="w-full grid grid-cols-2 rounded-none border-b">
            <TabsTrigger value="emojis" className="gap-1.5">
              <Smile className="h-4 w-4" />
              Emojis
            </TabsTrigger>
            <TabsTrigger value="stickers" className="gap-1.5">
              <Sticker className="h-4 w-4" />
              Stickers
            </TabsTrigger>
          </TabsList>

          <TabsContent value="emojis" className="mt-0">
            <ScrollArea className="h-64">
              <div className="p-2 space-y-3">
                {EMOJI_CATEGORIES.map((cat) => (
                  <div key={cat.name}>
                    <p className="text-xs font-medium text-muted-foreground px-1 mb-1">
                      {cat.name}
                    </p>
                    <div className="grid grid-cols-8 gap-0.5">
                      {cat.emojis.map((emoji, i) => (
                        <button
                          key={i}
                          onClick={() => handleSelect(emoji)}
                          className="h-8 w-8 flex items-center justify-center rounded hover:bg-muted transition-colors text-lg"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="stickers" className="mt-0">
            <ScrollArea className="h-64">
              <div className="p-3 grid grid-cols-3 gap-2">
                {STICKERS.map((sticker, i) => (
                  <button
                    key={i}
                    onClick={() => handleSelect(sticker)}
                    className="h-16 flex items-center justify-center rounded-xl border bg-muted/30 hover:bg-muted transition-colors text-2xl"
                  >
                    {sticker}
                  </button>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}
