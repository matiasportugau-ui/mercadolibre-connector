'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Unlink, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export function DisconnectButton({ accountId }: { accountId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleDisconnect = async () => {
    if (!confirm('¿Desconectar esta cuenta? Las reglas asociadas dejarán de funcionar.')) return;
    setLoading(true);
    const supabase = createClient();
    await supabase.from('ml_accounts').delete().eq('id', accountId);
    router.refresh();
  };

  return (
    <button
      onClick={handleDisconnect}
      disabled={loading}
      title="Desconectar"
      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition disabled:opacity-40"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlink className="w-4 h-4" />}
    </button>
  );
}
