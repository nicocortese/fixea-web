import Link from 'next/link';

export default function ReportesPage() {
  return (
    <div className="min-h-screen bg-[var(--Negro-fondo-1,#0B0C10)] text-white p-8 pl-72">
      <Link href="/" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#15161D] border border-gray-800 text-sm hover:border-[#00E5FF] transition-all mb-6">
        → Volver al Dashboard
      </Link>
      <h1 className="text-2xl font-bold mb-2">Reportes Exportables</h1>
      <p className="text-gray-400 text-sm">Generación de resúmenes en PDF/CSV para clientes.</p>
    </div>
  );
}
