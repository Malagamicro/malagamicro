export interface StelClient {
  id: string;
  nombre: string;
  nif?: string;
  email?: string;
  telefono?: string;
}

export interface BudgetProductLine {
  id: string;
  referencia: string;
  nombre: string;
  descripcion: string;
  precio: number;
  unidades: number;
  descuento: number;
  impuesto: number;
}

export interface StelBudgetFormData {
  referencia_prefijo: string;
  cliente_id: string;
  cliente_nombre: string;
  forma_pago: string;
  fecha: string;
  titulo: string;
  creado_por: string;
  estado: string;
  agente: string;
  tarifa: string;
  sujeto_iva: boolean;
  sujeto_irpf: boolean;
  productos: BudgetProductLine[];
  descuento_global: number;
}

export interface BudgetSubmitPayload {
  cliente_id: string;
  cliente_nombre: string;
  titulo: string;
  fecha: string;
  forma_pago_id: string;
  empleado_id: string;
  agente_id: string;
  sujeto_iva: boolean;
  sujeto_irpf: boolean;
  productos: {
    referencia: string;
    nombre: string;
    descripcion: string;
    precio: number;
    cantidad: number;
    descuento: number;
  }[];
}

export type WebhookEnv = 'test' | 'production';

export const WEBHOOK_URLS = {
  test: {
    clientes: 'https://n8n.srv1304274.hstgr.cloud/webhook-test/obtener-clientes-stelorder',
    crearPresupuesto: 'https://n8n.srv1304274.hstgr.cloud/webhook-test/crear-presupuesto-stelorder',
  },
  production: {
    clientes: 'https://n8n.srv1304274.hstgr.cloud/webhook/obtener-clientes-stelorder',
    crearPresupuesto: 'https://n8n.srv1304274.hstgr.cloud/webhook/crear-presupuesto-stelorder',
  },
} as const;

export const FORMAS_PAGO = [
  { value: '', label: 'Selecciona una forma de pago...' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'stripe', label: 'Tarjeta Stripe' },
  { value: 'domiciliacion', label: 'Domiciliación bancaria' },
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'transferencia', label: 'Transferencia bancaria' },
  { value: 'tarjeta', label: 'Tarjeta' },
];

export const IVA_OPTIONS = [
  { value: 0, label: '0%' },
  { value: 4, label: '4%' },
  { value: 10, label: '10%' },
  { value: 21, label: '21%' },
];
