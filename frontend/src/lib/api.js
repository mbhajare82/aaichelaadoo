import axios from "axios";

export const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const http = axios.create({ baseURL: API, withCredentials: true });

http.interceptors.request.use((config) => {
  const t = localStorage.getItem("al_token");
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

export const rupee = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

export const fmtWeight = (g) => (g >= 1000 ? `${+(g / 1000).toFixed(2)} kg` : `${g} g`);

export function errMsg(e) {
  const d = e?.response?.data?.detail;
  if (!d) return e?.message || "Something went wrong. Please try again.";
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((x) => x?.msg || "").filter(Boolean).join(" ");
  return String(d);
}
