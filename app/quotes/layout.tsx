import Link from "next/link";

export default function QuotesLayout({ children }: LayoutProps<"/quotes">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            Studio Nova
          </Link>
          <Link href="/login" className="text-sm text-slate-500 hover:text-slate-900">
            Вхід для команди
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">{children}</main>
    </div>
  );
}
