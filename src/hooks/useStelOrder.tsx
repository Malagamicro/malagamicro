import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface StelBudgetLine {
  concept: string;
  quantity: number;
  price: number;
  taxPercentage: number;
  discount: number;
  total?: number;
}

export interface StelBudget {
  id: number | string;
  number?: string;
  subject?: string;
  clientId?: number;
  client?: { id: number; name: string; email?: string; commercialName?: string };
  lines?: StelBudgetLine[];
  notes?: string;
  validUntil?: string;
  total?: number;
  totalWithTax?: number;
  status?: string;
  createdAt?: string;
  date?: string;
  [key: string]: any;
}

export interface StelClient {
  id: number | string;
  name: string;
  commercialName?: string;
  email?: string;
  phone?: string;
  [key: string]: any;
}

const callStelAction = async (action: string, params?: Record<string, string>, body?: any) => {
  const queryParams = new URLSearchParams({ action, ...params });
  
  const session = (await supabase.auth.getSession()).data.session;
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  
  const response = await fetch(
    `${supabaseUrl}/functions/v1/stelorder?${queryParams.toString()}`,
    {
      method: body ? 'POST' : 'GET',
      headers: {
        'Authorization': `Bearer ${session?.access_token || anonKey}`,
        'apikey': anonKey,
        'Content-Type': 'application/json',
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }
  );

  const result = await response.json();
  
  if (!response.ok) {
    throw new Error(result.error || result?.description || `Error ${response.status}`);
  }
  
  return result;
};

export function useStelOrder() {
  const queryClient = useQueryClient();

  // List budgets
  const useBudgets = (search = '', page = '1') => {
    return useQuery({
      queryKey: ['stel-budgets', search, page],
      queryFn: () => callStelAction('list-budgets', { search, page }),
      staleTime: 30_000,
    });
  };

  // Get single budget
  const useGetBudget = (id: string | null) => {
    return useQuery({
      queryKey: ['stel-budget', id],
      queryFn: () => callStelAction('get-budget', { id: id! }),
      enabled: !!id,
    });
  };

  // List clients
  const useClients = (search = '') => {
    return useQuery({
      queryKey: ['stel-clients', search],
      queryFn: () => callStelAction('list-clients', { search }),
      staleTime: 60_000,
    });
  };

  // Create budget
  const createBudget = useMutation({
    mutationFn: (payload: any) => callStelAction('create-budget', {}, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stel-budgets'] });
      toast.success('Presupuesto creado en STEL Order');
    },
    onError: (err: Error) => {
      toast.error(`Error: ${err.message}`);
    },
  });

  // Update budget
  const updateBudget = useMutation({
    mutationFn: ({ id, ...payload }: any) => callStelAction('update-budget', { id: String(id) }, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stel-budgets'] });
      queryClient.invalidateQueries({ queryKey: ['stel-budget'] });
      toast.success('Presupuesto actualizado');
    },
    onError: (err: Error) => {
      toast.error(`Error: ${err.message}`);
    },
  });

  // Delete budget
  const deleteBudget = useMutation({
    mutationFn: (id: string) => callStelAction('delete-budget', { id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stel-budgets'] });
      toast.success('Presupuesto eliminado');
    },
    onError: (err: Error) => {
      toast.error(`Error: ${err.message}`);
    },
  });

  // Convert to invoice
  const convertToInvoice = useMutation({
    mutationFn: (id: string) => callStelAction('convert-to-invoice', { id }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['stel-budgets'] });
      toast.success(data.message || 'Factura creada');
    },
    onError: (err: Error) => {
      toast.error(`Error: ${err.message}`);
    },
  });

  // Convert to order
  const convertToOrder = useMutation({
    mutationFn: (id: string) => callStelAction('convert-to-order', { id }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['stel-budgets'] });
      toast.success(data.message || 'Pedido creado');
    },
    onError: (err: Error) => {
      toast.error(`Error: ${err.message}`);
    },
  });

  return {
    useBudgets,
    useGetBudget,
    useClients,
    createBudget,
    updateBudget,
    deleteBudget,
    convertToInvoice,
    convertToOrder,
  };
}
