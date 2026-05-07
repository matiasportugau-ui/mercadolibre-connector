'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, MessageSquare, Zap, FileText, BarChart2, CreditCard, Settings, Store, LogOut, ShoppingBag, MessageCircle, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

const NAV = [
  { href: '/dashboard', label: 'Resumen', icon: LayoutDashboard },
  { href: '/dashboard/questions', label: 'Preguntas', icon: MessageSquare },
  { href: '/dashboard/messages', label: 'Mensajes', icon: MessageCircle },
  { href: '/dashboard/orders', label: 'Órdenes', icon: ShoppingBag },
  { href: '/dashboard/items', label: 'Publicaciones', icon: Package },
  { href: '/dashboard/rules', label: 'Automatizaciones', icon: Zap },
  { href: '/dashboard/templates', label: 'Plantillas', icon: FileText },
  { href: '/dashboard/analytics', label: 'Analíticas', icon: BarChart2 },
  { href: '/dashboard/accounts', label: 'Cuentas ML', icon: Store },
  { href: '/dashboard/billing', label: 'Plan & Pago', icon: CreditCard },
  { href: '/dashboard/settings', label: 'Configuración', icon: Settings },
];

const PLAN_BADGE: Record<string, string> = {
  free: 'bg-gray-100 text-gray-600',
  starter: 'bg-blue-100 text-blue-700',
  pro: 'bg-purple-100 text-purple-700',
  enterprise: 'bg-yellow-100 text-yellow-800',
  admin: 'bg-ml-yellow text-gray-900',
};

export function SidebarNav({ user, profile }: { user: any; profile: any }) {
  const pathname = usePathname();
  const router = useRouter();
  const isAdmin = profile?.is_admin ?? false;
  const planId = isAdmin ? 'admin' : (profile?.plan_id ?? 'free');

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <aside className="w-60 flex flex-col bg-white border-r border-gray-200 shrink-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-gray-100">
        <span className="flex items-center gap-2">
          <span className="bg-ml-yellow rounded-lg w-8 h-8 flex items-center justify-center text-sm font-black">ML</span>
          <span className="font-bold text-gray-900 text-sm">Automator</span>
        </span>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition',
                active
                  ? 'bg-ml-blue/10 text-ml-blue'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="px-4 py-4 border-t border-gray-100 space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-ml-blue/10 flex items-center justify-center text-xs font-bold text-ml-blue uppercase">
            {(profile?.full_name ?? user.email ?? '?').charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-gray-800 truncate">{profile?.full_name ?? user.email}</p>
            <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded', PLAN_BADGE[planId])}>
              {planId.toUpperCase()}
            </span>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-2 text-xs text-gray-500 hover:text-red-500 transition px-1"
        >
          <LogOut className="w-3.5 h-3.5" /> Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
