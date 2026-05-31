'use client';

import { useState, useEffect } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { Locale } from '@/lib/utils/i18n';

interface APU {
  id: string;
  code: string;
  description: string;
  unit: string;
  selling_price: number;
  category: string | null;
  is_library: boolean | null;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  budgetId: string;
  userId: string;
  language?: Locale;
  onSuccess: () => void;
}

export default function APULibraryModal({ isOpen, onClose, projectId, budgetId, userId, language = "es", onSuccess }: Props) {
  const supabase = createClient();
  const [apus, setApus] = useState<APU[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [importing, setImporting] = useState<string | null>(null);
  const [sections, setSections] = useState<string[]>([]);
  const [selectedSection, setSelectedSection] = useState<string>('');
  const [newSection, setNewSection] = useState('');
  const [useNewSection, setUseNewSection] = useState(false);

  const isEs = language === "es";

  // Fetch all APUs accessible to this user: current project + global library
  useEffect(() => {
    if (!userId) return;
    async function load() {
      setLoading(true);
      setFetchError(null);
      const [apuRes, secRes] = await Promise.all([
        supabase
          .from('apu_items')
          .select('id, code, description, unit, selling_price, category, is_library')
          .or(`project_id.eq.${projectId},and(is_library.eq.true,user_id.eq.${userId})`)
          .order('code', { ascending: true }),
        supabase
          .from('budget_rows')
          .select('section')
          .eq('project_id', projectId)
          .eq('is_chapter', true),
      ]);
      if (apuRes.error) {
        console.error('[IMPORT MODAL] Fetch error:', apuRes.error);
        setFetchError(apuRes.error.message);
        setApus([]);
      } else {
        // Deduplicate by id (an APU in the current project that's also library)
        const seen = new Set<string>();
        const unique: APU[] = [];
        for (const apu of (apuRes.data as APU[]) || []) {
          if (!seen.has(apu.id)) { seen.add(apu.id); unique.push(apu); }
        }
        setApus(unique);
      }
      const uniqueSections = Array.from(new Set(
        (secRes.data ?? []).map((r: { section: string }) => r.section).filter(Boolean)
      )) as string[];
      setSections(uniqueSections);
      if (uniqueSections.length > 0) setSelectedSection(uniqueSections[0]);
      setLoading(false);
    }
    load();
  }, [userId, projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = apus.filter(a =>
    a.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Group by category
  const grouped = new Map<string, APU[]>();
  for (const apu of filtered) {
    const cat = apu.category || (isEs ? "Sin categoría" : "Uncategorized");
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(apu);
  }
  const sortedCategories = Array.from(grouped.keys()).sort((a, b) => a.localeCompare(b));

  const effectiveSection = useNewSection ? newSection.trim() : selectedSection;

  const handleImport = async (apu: APU) => {
    if (!effectiveSection) {
      alert(isEs ? 'Selecciona o crea un capítulo primero.' : 'Select or create a chapter first.');
      return;
    }
    if (!projectId) {
      alert('Error: no project ID');
      return;
    }

    setImporting(apu.id);

    // Get highest sort_order
    const { data: lastRow } = await supabase
      .from('budget_rows')
      .select('sort_order')
      .eq('project_id', projectId)
      .order('sort_order', { ascending: false })
      .limit(1);
    let nextSortOrder = ((lastRow?.[0]?.sort_order ?? 0) as number) + 1;

    // If using a new section that doesn't exist, create chapter header first
    if (useNewSection && !sections.includes(effectiveSection)) {
      const { error: chErr } = await supabase.from('budget_rows').insert({
        project_id: projectId,
        section: effectiveSection,
        description: effectiveSection,
        is_chapter: true,
        code: null,
        quantity: 0,
        unit_price: 0,
        sort_order: nextSortOrder,
        status: 'pending',
      });
      if (chErr) {
        console.error('[APU Library] Chapter insert error:', chErr);
        alert(`Error: ${chErr.message}`);
        setImporting(null);
        return;
      }
      nextSortOrder += 1;
    }

    const { data, error } = await supabase
      .from('budget_rows')
      .insert({
        project_id: projectId,
        budget_id: budgetId || null,
        apu_item_id: apu.id,
        section: effectiveSection,
        description: apu.description,
        code: apu.code,
        unit: apu.unit,
        quantity: 0,
        unit_price: apu.selling_price || 0,
        original_quantity: 0,
        sort_order: nextSortOrder,
        status: 'pending',
        is_chapter: false,
      })
      .select()
      .single();

    setImporting(null);

    if (error) {
      console.error('[APU Library] Insert error:', error);
      alert((isEs ? 'Error al insertar APU: ' : 'Error inserting APU: ') + error.message);
    } else if (data) {
      onSuccess();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full flex flex-col"
        style={{
          maxWidth: 640,
          maxHeight: "85vh",
          background: "var(--cs-surface)",
          border: "1px solid var(--cs-border)",
          borderRadius: 16,
          overflow: "hidden",
          boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: "1px solid var(--cs-border)" }}>
          <div>
            <span className="font-syne font-bold text-base" style={{ color: "var(--cs-text)" }}>
              {isEs ? "Importar desde APU" : "Import from APU"}
            </span>
            {!loading && apus.length > 0 && (
              <span className="ml-2 text-xs font-dm-sans" style={{ color: "var(--cs-muted)" }}>
                ({apus.length} {isEs ? "disponibles" : "available"})
              </span>
            )}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--cs-muted)" }}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Chapter selector */}
        <div className="px-5 py-3 shrink-0" style={{ borderBottom: "1px solid var(--cs-border)" }}>
          <label className="text-xs font-semibold font-dm-sans uppercase tracking-wider block mb-1.5" style={{ color: "var(--cs-muted)" }}>
            {isEs ? "Insertar en capítulo:" : "Insert into chapter:"}
          </label>
          {useNewSection ? (
            <div className="flex gap-2 items-center">
              <input
                value={newSection}
                onChange={(e) => setNewSection(e.target.value)}
                placeholder={isEs ? "ej. 01 · TRABAJOS PRELIMINARES" : "e.g. 01 · PRELIMINARY WORKS"}
                autoFocus
                className="flex-1 text-sm font-dm-sans rounded-lg px-3 py-2"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--cs-border)", color: "var(--cs-text)", outline: "none" }}
              />
              {sections.length > 0 && (
                <button
                  onClick={() => { setUseNewSection(false); setNewSection(''); }}
                  className="text-xs font-dm-sans"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--cs-accent)", whiteSpace: "nowrap" }}
                >
                  ← {isEs ? "volver" : "back"}
                </button>
              )}
            </div>
          ) : (
            <select
              value={selectedSection}
              onChange={(e) => {
                if (e.target.value === "__new__") setUseNewSection(true);
                else setSelectedSection(e.target.value);
              }}
              className="w-full text-sm font-dm-sans rounded-lg px-3 py-2"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--cs-border)", color: "var(--cs-text)", cursor: "pointer" }}
            >
              {sections.map((s) => <option key={s} value={s}>{s}</option>)}
              <option value="__new__">{isEs ? "+ Nuevo capítulo..." : "+ New chapter..."}</option>
            </select>
          )}
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 px-4 py-2.5 shrink-0" style={{ borderBottom: "1px solid var(--cs-border)", background: "rgba(255,255,255,0.02)" }}>
          <Search className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--cs-muted)" }} />
          <input
            type="text"
            placeholder={isEs ? "Buscar por descripción, código o categoría..." : "Search by description, code or category..."}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 bg-transparent text-sm font-dm-sans outline-none"
            style={{ color: "var(--cs-text)" }}
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--cs-muted)" }}>
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* APU list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--cs-muted)" }} />
              <span className="text-xs font-dm-sans" style={{ color: "var(--cs-muted)" }}>
                {isEs ? "Cargando APUs..." : "Loading APUs..."}
              </span>
            </div>
          ) : fetchError ? (
            <div className="text-center py-12 px-5">
              <p className="text-sm font-dm-sans font-medium" style={{ color: "#ef4444" }}>
                {isEs ? "Error al cargar APUs" : "Error loading APUs"}
              </p>
              <p className="text-xs font-dm-sans mt-1" style={{ color: "var(--cs-muted)" }}>{fetchError}</p>
            </div>
          ) : apus.length === 0 ? (
            <div className="text-center py-12 px-5">
              <p className="text-sm font-dm-sans" style={{ color: "var(--cs-muted)" }}>
                {isEs
                  ? "No hay APUs en este proyecto. Crea uno primero en la pestaña APU."
                  : "No APUs in this project. Create one first in the APU tab."}
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center py-12 text-sm font-dm-sans" style={{ color: "var(--cs-muted)" }}>
              {isEs ? `Sin resultados para "${searchTerm}"` : `No results for "${searchTerm}"`}
            </p>
          ) : (
            <div className="flex flex-col">
              {sortedCategories.map(cat => (
                <div key={cat}>
                  {/* Category header */}
                  <div className="px-5 py-1.5 sticky top-0" style={{ background: "var(--cs-surface)", borderBottom: "1px solid var(--cs-border)" }}>
                    <span className="text-[10px] font-dm-sans font-bold uppercase tracking-wider" style={{ color: "var(--cs-muted)" }}>
                      {cat}
                    </span>
                    <span className="ml-1.5 text-[10px] font-dm-sans" style={{ color: "var(--cs-muted)" }}>
                      ({grouped.get(cat)!.length})
                    </span>
                  </div>
                  {grouped.get(cat)!.map(apu => (
                    <button
                      key={apu.id}
                      type="button"
                      onClick={() => handleImport(apu)}
                      disabled={importing === apu.id}
                      className="flex items-center justify-between px-5 py-2.5 text-left w-full"
                      style={{
                        background: "transparent",
                        border: "none",
                        borderBottom: "1px solid var(--cs-border)",
                        cursor: importing === apu.id ? "wait" : "pointer",
                        opacity: importing === apu.id ? 0.6 : 1,
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(249,115,22,0.04)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div className="flex items-center gap-2">
                          <code className="text-xs font-bold shrink-0" style={{ color: "var(--cs-accent)" }}>{apu.code}</code>
                          <span className="font-dm-sans text-sm font-medium truncate" style={{ color: "var(--cs-text)" }}>
                            {importing === apu.id ? (
                              <span className="flex items-center gap-1.5" style={{ color: "var(--cs-accent)" }}>
                                <Loader2 className="h-3 w-3 animate-spin" />
                                {isEs ? "Insertando..." : "Inserting..."}
                              </span>
                            ) : (
                              apu.description
                            )}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-dm-sans text-xs" style={{ color: "var(--cs-muted)" }}>{apu.unit}</span>
                          {apu.is_library && (
                            <span className="text-[9px] font-dm-sans font-semibold rounded-full px-1.5 py-px"
                              style={{ background: "rgba(249,115,22,0.1)", color: "var(--cs-accent)", border: "1px solid rgba(249,115,22,0.2)" }}>
                              {isEs ? "Biblioteca" : "Library"}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="font-dm-sans text-sm font-semibold shrink-0 ml-4" style={{ color: "var(--cs-accent)" }}>
                        ${apu.selling_price?.toLocaleString("es-MX", { minimumFractionDigits: 2 }) ?? "0.00"}
                      </div>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2.5 text-xs font-dm-sans shrink-0" style={{ color: "var(--cs-muted)", borderTop: "1px solid var(--cs-border)", background: "rgba(255,255,255,0.02)" }}>
          {isEs ? "Haz clic en un APU para insertarlo en el presupuesto." : "Click an APU to insert it into the budget."}
        </div>
      </div>
    </div>
  );
}
