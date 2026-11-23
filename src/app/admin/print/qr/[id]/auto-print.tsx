"use client";
import { useEffect } from "react";

export function AutoPrint() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, []);
  return (
    <button onClick={() => window.print()} className="fixed top-4 right-4 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white print:hidden">Print</button>
  );
}
