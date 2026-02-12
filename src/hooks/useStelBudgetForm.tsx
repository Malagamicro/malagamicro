import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from '@/hooks/use-toast';
import {
  StelClient,
  BudgetProductLine,
  StelBudgetFormData,
  BudgetSubmitPayload,
  WebhookEnv,
  WEBHOOK_URLS,
} from '@/types/stelBudget';

const DRAFT_KEY = 'stel_budget_draft';

const newLine = (): BudgetProductLine => ({
  id: crypto.randomUUID(),
  referencia: '',
  nombre: '',
  descripcion: '',
  precio: 0,
  unidades: 1,
  descuento: 0,
  impuesto: 21,
});

const defaultForm = (): StelBudgetFormData => ({
  referencia_prefijo: 'PRV',
  cliente_id: '',
  cliente_nombre: '',
  forma_pago: '',
  fecha: new Date().toISOString().slice(0, 10),
  titulo: '',
  creado_por: 'ALFREDO LOPEZ PEÑARROYA',
  estado: 'Pendiente',
  agente: 'ALFREDO LOPEZ PEÑARROYA',
  tarifa: 'precio_base_venta',
  sujeto_iva: true,
  sujeto_irpf: false,
  productos: [newLine()],
  descuento_global: 0,
});

export function useStelBudgetForm() {
  const [env, setEnv] = useState<WebhookEnv>('test');
  const [form, setForm] = useState<StelBudgetFormData>(() => {
    try {
      const draft = localStorage.getItem(DRAFT_KEY);
      if (draft) return JSON.parse(draft);
    } catch {}
    return defaultForm();
  });

  const [clients, setClients] = useState<StelClient[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [aiReport, setAiReport] = useState<string | null>(null);

  // Save draft
  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
  }, [form]);

  // Fetch clients
  const fetchClients = useCallback(async () => {
    setLoadingClients(true);
    try {
      const url = WEBHOOK_URLS[env].clientes;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = await res.json();
      // Handle single object, array, or nested response
      let list: any[];
      if (Array.isArray(raw)) {
        list = raw;
      } else if (raw?.clientes || raw?.data) {
        list = raw.clientes || raw.data;
      } else if (raw && typeof raw === 'object' && (raw.name || raw.nombre)) {
        list = [raw];
      } else {
        list = [];
      }
      setClients(
        list
          .filter((c: any) => c && (c.name || c.nombre))
          .map((c: any, idx: number) => ({
            id: String(c.id || c.account_id || c['account-id'] || idx),
            nombre: c.name || c.nombre || c.commercial_name || c['commercial-name'] || '',
            nif: c.nif || c.cif || c['tax-number'] || '',
            email: c.email || '',
            telefono: c.telefono || c.phone || '',
          }))
      );
    } catch (e: any) {
      toast({ title: 'Error cargando clientes', description: e.message, variant: 'destructive' });
    } finally {
      setLoadingClients(false);
    }
  }, [env]);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  // Update helpers
  const updateField = <K extends keyof StelBudgetFormData>(key: K, value: StelBudgetFormData[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const selectClient = (client: StelClient) => {
    setForm(prev => ({ ...prev, cliente_id: client.id, cliente_nombre: client.nombre }));
  };

  const addLine = () => {
    setForm(prev => ({ ...prev, productos: [...prev.productos, newLine()] }));
  };

  const removeLine = (id: string) => {
    setForm(prev => ({ ...prev, productos: prev.productos.filter(p => p.id !== id) }));
  };

  const updateLine = (id: string, field: keyof BudgetProductLine, value: any) => {
    setForm(prev => ({
      ...prev,
      productos: prev.productos.map(p => p.id === id ? { ...p, [field]: value } : p),
    }));
  };

  // Calculations
  const calculations = useMemo(() => {
    let totalBase = 0;
    let totalIva = 0;

    for (const line of form.productos) {
      const sub = line.precio * line.unidades * (1 - line.descuento / 100);
      totalBase += sub;
      if (form.sujeto_iva) {
        totalIva += sub * (line.impuesto / 100);
      }
    }

    const afterGlobalDiscount = totalBase * (1 - form.descuento_global / 100);
    const ivaAfterDiscount = totalIva * (1 - form.descuento_global / 100);

    return {
      totalBase: afterGlobalDiscount,
      totalIva: ivaAfterDiscount,
      totalFinal: afterGlobalDiscount + ivaAfterDiscount,
    };
  }, [form.productos, form.sujeto_iva, form.descuento_global]);

  const lineSubtotal = (line: BudgetProductLine) =>
    line.precio * line.unidades * (1 - line.descuento / 100);

  // Submit
  const submit = async () => {
    if (!form.cliente_id) {
      toast({ title: 'Selecciona un cliente', variant: 'destructive' });
      return false;
    }
    if (form.productos.length === 0 || form.productos.every(p => !p.nombre)) {
      toast({ title: 'Añade al menos un producto', variant: 'destructive' });
      return false;
    }

    setSubmitting(true);
    try {
      const payload: BudgetSubmitPayload = {
        cliente_id: form.cliente_id,
        cliente_nombre: form.cliente_nombre,
        titulo: form.titulo,
        fecha: form.fecha,
        forma_pago_id: form.forma_pago,
        empleado_id: '5',
        agente_id: '5',
        sujeto_iva: form.sujeto_iva,
        sujeto_irpf: form.sujeto_irpf,
        productos: form.productos.map(p => ({
          referencia: p.referencia,
          nombre: p.nombre,
          descripcion: p.descripcion,
          precio: p.precio,
          cantidad: p.unidades,
          descuento: p.descuento,
        })),
      };

      const url = WEBHOOK_URLS[env].crearPresupuesto;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();

      const ref = result?.referencia || result?.reference || result?.id || 'OK';
      toast({ title: '✅ Presupuesto creado', description: `Referencia: ${ref}` });

      if (result?.informe || result?.report || result?.ai_report) {
        setAiReport(result.informe || result.report || result.ai_report);
      }

      // Reset
      localStorage.removeItem(DRAFT_KEY);
      setForm(defaultForm());
      return true;
    } catch (e: any) {
      toast({ title: 'Error al crear presupuesto', description: e.message, variant: 'destructive' });
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    localStorage.removeItem(DRAFT_KEY);
    setForm(defaultForm());
    setAiReport(null);
  };

  return {
    env, setEnv,
    form, updateField,
    clients, loadingClients, fetchClients,
    selectClient,
    addLine, removeLine, updateLine,
    calculations, lineSubtotal,
    submitting, submit, resetForm,
    aiReport, setAiReport,
  };
}
