export type MaterialCategory = "materials" | "labor" | "equipment";

export interface MaterialEntry {
  id: number;
  name: string;
  unit: string;
  /** Reference price in MXN */
  unit_price: number;
  category: MaterialCategory;
}

// 43 items: 30 materials + 8 labor + 5 equipment
export const MATERIALS_DB: MaterialEntry[] = [
  // ─── Cementos y Agregados ────────────────────────────────
  { id:  1, name: "Cemento Portland tipo I",           unit: "kg",      unit_price:    3.20, category: "materials" },
  { id:  2, name: "Arena fina lavada",                 unit: "m³",      unit_price:  280.00, category: "materials" },
  { id:  3, name: 'Grava triturada 3/4"',              unit: "m³",      unit_price:  350.00, category: "materials" },
  { id:  4, name: "Piedra bola de río",                unit: "m³",      unit_price:  250.00, category: "materials" },
  { id:  5, name: "Mortero premezclado",               unit: "kg",      unit_price:    5.50, category: "materials" },
  // ─── Mampostería ─────────────────────────────────────────
  { id:  6, name: "Block de concreto 15×20×40",        unit: "pza",     unit_price:   18.00, category: "materials" },
  { id:  7, name: "Tabique rojo recocido 7×14×28",     unit: "pza",     unit_price:    8.50, category: "materials" },
  { id:  8, name: "Tabicón de concreto 12×20×40",      unit: "pza",     unit_price:   22.00, category: "materials" },
  // ─── Acero ───────────────────────────────────────────────
  { id:  9, name: 'Varilla corrugada #3 (3/8")',       unit: "kg",      unit_price:   28.00, category: "materials" },
  { id: 10, name: 'Varilla corrugada #4 (1/2")',       unit: "kg",      unit_price:   27.00, category: "materials" },
  { id: 11, name: 'Varilla corrugada #5 (5/8")',       unit: "kg",      unit_price:   26.50, category: "materials" },
  { id: 12, name: "Malla electrosoldada 6×6 10/10",   unit: "m²",      unit_price:   85.00, category: "materials" },
  { id: 13, name: "Alambre recocido #18",              unit: "kg",      unit_price:   32.00, category: "materials" },
  // ─── Acabados Secos ──────────────────────────────────────
  { id: 14, name: 'Panel de yeso 1/2"',                unit: "pza",     unit_price:  195.00, category: "materials" },
  { id: 15, name: "Perfil de acero cal. 25",           unit: "ml",      unit_price:   42.00, category: "materials" },
  { id: 16, name: 'Perfil U canal 3 1/2"',             unit: "ml",      unit_price:   48.00, category: "materials" },
  { id: 17, name: "Pasta para juntas",                 unit: "kg",      unit_price:   12.00, category: "materials" },
  // ─── Acabados Húmedos ─────────────────────────────────────
  { id: 18, name: "Azulejo cerámico 30×30",            unit: "m²",      unit_price:  180.00, category: "materials" },
  { id: 19, name: "Piso cerámico 45×45",               unit: "m²",      unit_price:  220.00, category: "materials" },
  { id: 20, name: "Piso porcelanato 60×60",            unit: "m²",      unit_price:  380.00, category: "materials" },
  // ─── Pintura e Impermeabilización ────────────────────────
  { id: 21, name: "Pintura vinílica interior",         unit: "L",       unit_price:   95.00, category: "materials" },
  { id: 22, name: "Pintura esmalte exterior",          unit: "L",       unit_price:  120.00, category: "materials" },
  { id: 23, name: "Impermeabilizante acrílico",        unit: "L",       unit_price:   85.00, category: "materials" },
  // ─── Madera y Cimbra ─────────────────────────────────────
  { id: 24, name: 'Madera pino cepillada 1×6"',        unit: "ml",      unit_price:   65.00, category: "materials" },
  { id: 25, name: 'Madera pino cepillada 1×4"',        unit: "ml",      unit_price:   42.00, category: "materials" },
  { id: 26, name: "Triplay 18 mm 4×8",                 unit: "pza",     unit_price:  680.00, category: "materials" },
  { id: 27, name: 'Clavo c/cabeza 2 1/2"',             unit: "kg",      unit_price:   42.00, category: "materials" },
  // ─── Instalación Hidráulica ───────────────────────────────
  { id: 28, name: 'Tubo PVC hidráulico 1/2"',          unit: "ml",      unit_price:   28.00, category: "materials" },
  { id: 29, name: 'Tubo PVC hidráulico 3/4"',          unit: "ml",      unit_price:   38.00, category: "materials" },
  { id: 30, name: 'Tubo PVC sanitario 4"',             unit: "ml",      unit_price:   95.00, category: "materials" },
  // ─── Mano de Obra (8) ────────────────────────────────────
  { id: 31, name: "Albañil",                           unit: "jornal",  unit_price:  380.00, category: "labor" },
  { id: 32, name: "Ayudante de albañil",               unit: "jornal",  unit_price:  280.00, category: "labor" },
  { id: 33, name: "Oficial plomero",                   unit: "jornal",  unit_price:  420.00, category: "labor" },
  { id: 34, name: "Oficial electricista",              unit: "jornal",  unit_price:  420.00, category: "labor" },
  { id: 35, name: "Carpintero",                        unit: "jornal",  unit_price:  400.00, category: "labor" },
  { id: 36, name: "Maestro de obras",                  unit: "jornal",  unit_price:  550.00, category: "labor" },
  { id: 37, name: "Fierrero (habilitador)",             unit: "jornal",  unit_price:  400.00, category: "labor" },
  { id: 38, name: "Pintor",                            unit: "jornal",  unit_price:  380.00, category: "labor" },
  // ─── Maquinaria (5) ──────────────────────────────────────
  { id: 39, name: "Mezcladora de concreto 1 saco",    unit: "hr",      unit_price:  320.00, category: "equipment" },
  { id: 40, name: "Vibrador de concreto",              unit: "hr",      unit_price:  180.00, category: "equipment" },
  { id: 41, name: "Compactador pata de cabra",         unit: "hr",      unit_price:  450.00, category: "equipment" },
  { id: 42, name: "Camión volteo 7 m³",               unit: "hr",      unit_price:  950.00, category: "equipment" },
  { id: 43, name: "Retroexcavadora CAT 320",           unit: "hr",      unit_price: 1200.00, category: "equipment" },
];

export const CATEGORY_LABELS: Record<MaterialCategory, { es: string; en: string; color: string }> = {
  materials: { es: "Materiales",  en: "Materials",  color: "#22c55e" },
  labor:     { es: "Mano de Obra", en: "Labor",     color: "#3b82f6" },
  equipment: { es: "Maquinaria",  en: "Equipment",  color: "#a855f7" },
};
