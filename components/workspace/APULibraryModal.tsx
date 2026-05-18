'use client';

import { useState, useEffect } from 'react';
import { Search, Plus, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface APU {
  id: string;
  code: string;
  description: string;
  unit: string;
  selling_price: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  budgetId?: string; // deprecated – unused
  userId: string;
  onSuccess: () => void;
}

export default function APULibraryModal({ isOpen, onClose, projectId, userId, onSuccess }: Props) {
  const supabase = createClient();
  const [apus, setApus] = useState<APU[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLibraryAPUs = async () => {
      if (!userId) return;

      setLoading(true);
      const { data, error } = await supabase
        .from('apu_items')
        .select('*')
        .eq('is_library', true)
        .eq('user_id', userId)
        .order('description', { ascending: true });

      if (error) console.error('Error fetching APUs:', error);
      setApus(data || []);
      setLoading(false);
    };

    fetchLibraryAPUs();
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = apus.filter(a =>
    a.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleImport = async (apu: APU) => {
    // Get the highest sort_order in current budget
    const { data: lastRow } = await supabase
      .from('budget_rows')
      .select('sort_order')
      .eq('project_id', projectId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .single();

    const nextSortOrder = (lastRow?.sort_order || 0) + 10;

    const { error } = await supabase
      .from('budget_rows')
      .insert({
        project_id: projectId,
        description: apu.description,
        code: apu.code,
        unit: apu.unit,
        quantity: 1,
        unit_price: apu.selling_price || 0,
        apu_item_id: apu.id,
        sort_order: nextSortOrder,
        section: apu.code ? apu.code.split('.')[0] : 'General',
      });

    if (error) {
      console.error(error);
      alert('Error al insertar APU: ' + error.message);
    } else {
      alert(`✅ "${apu.description}" agregado correctamente al presupuesto`);
      onSuccess();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col">
        <div className="p-6 border-b flex justify-between items-center">
          <h2 className="text-2xl font-semibold flex items-center gap-3">
            📚 Biblioteca de APUs
          </h2>
          <button onClick={onClose} className="text-3xl text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <div className="p-5 border-b">
          <div className="relative">
            <Search className="absolute left-4 top-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar APU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 py-3 bg-gray-100 dark:bg-zinc-800 rounded-xl"
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto p-5">
          {loading ? (
            <p className="text-center py-20">Cargando biblioteca...</p>
          ) : filtered.length === 0 ? (
            <p className="text-center py-20 text-gray-500">No se encontraron APUs</p>
          ) : (
            <div className="space-y-3">
              {filtered.map(apu => (
                <div key={apu.id} className="flex justify-between items-center p-5 border rounded-xl hover:border-orange-500">
                  <div>
                    <div className="font-medium">{apu.description}</div>
                    <div className="text-sm text-gray-500">{apu.code} • {apu.unit}</div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-xl font-semibold text-orange-600">
                      ${apu.selling_price?.toLocaleString()}
                    </div>
                    <button
                      onClick={() => handleImport(apu)}
                      className="bg-orange-600 text-white px-6 py-3 rounded-xl hover:bg-orange-700 flex items-center gap-2"
                    >
                      <Plus size={20} /> Insertar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
