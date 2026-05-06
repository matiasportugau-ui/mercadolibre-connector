'use client';
import { useState } from 'react';
import { Check } from 'lucide-react';

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition shrink-0"
    >
      {copied ? <><Check className="w-3.5 h-3.5 text-green-500" /> Copiado</> : 'Copiar'}
    </button>
  );
}
