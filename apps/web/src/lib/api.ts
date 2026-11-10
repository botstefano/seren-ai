import { supabase } from "./supabase";

const API_URL = (import.meta.env.VITE_API_URL ?? "http://localhost:4000").replace(/\/$/, "");

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { data } = await supabase?.auth.getSession() ?? { data: { session: null } };
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (options.body) headers.set("Content-Type", "application/json");
  if (data.session?.access_token) {
    headers.set("Authorization", `Bearer ${data.session.access_token}`);
  }

  const response = await fetch(`${API_URL}/api${path}`, {
    ...options,
    headers,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(payload.message ?? payload.detail ?? "No se pudo completar la solicitud.", response.status);
  }
  return payload as T;
}

export function formatMoney(value: number, currency = "PEN") {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

export function formatNumber(value: number, digits = 0) {
  return new Intl.NumberFormat("es-PE", { maximumFractionDigits: digits }).format(Number.isFinite(value) ? value : 0);
}

export function formatDate(value?: string | null) {
  if (!value) return "Sin registro";
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? "Sin registro" : new Intl.DateTimeFormat("es-PE", {
    day: "2-digit", month: "short", year: "numeric",
  }).format(date);
}

export function formatMonth(value: string) {
  if (value.length !== 6) return value;
  const date = new Date(Number(value.slice(0, 4)), Number(value.slice(4, 6)) - 1, 1);
  return new Intl.DateTimeFormat("es-PE", { month: "short", year: "2-digit" }).format(date);
}
