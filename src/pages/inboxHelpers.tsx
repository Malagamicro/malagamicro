import React from 'react';
import { Check, CheckCheck, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// Pending message for optimistic UI
export interface PendingMessage {
  id: string;
  content: string;
  timestamp: Date;
  status: 'sending' | 'sent' | 'error';
}

// Function to detect and convert URLs to links
export function linkifyText(text: string): React.ReactNode[] {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);

  return parts.map((part, index) => {
    if (urlRegex.test(part)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:opacity-80"
        >
          {part}
        </a>
      );
    }
    return part;
  });
}

export const formatTime = (date: Date) => {
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return format(date, 'HH:mm');
  } else if (diffDays === 1) {
    return 'Ayer';
  } else if (diffDays < 7) {
    return format(date, 'EEEE', { locale: es });
  } else {
    return format(date, 'dd/MM/yy');
  }
};

export const getPhoneDisplay = (phone: string) => {
  if (phone.startsWith('34')) {
    return `+34 ${phone.slice(2, 5)} ${phone.slice(5, 8)} ${phone.slice(8)}`;
  }
  return `+${phone}`;
};

export const getAckIcon = (ackStatus: string | null | undefined) => {
  switch (ackStatus) {
    case 'pending':
      return <Clock className="w-3 h-3 opacity-70" />;
    case 'sent':
      return <Check className="w-3 h-3" />;
    case 'delivered':
      return <CheckCheck className="w-3 h-3" />;
    case 'read':
    case 'played':
      return <CheckCheck className="w-3 h-3 text-sky-400" />;
    default:
      return <CheckCheck className="w-3 h-3" />;
  }
};
