export type MaterialCategory = "materials" | "labor" | "equipment";

export interface MaterialEntry {
  id: number;
  name: string;
  unit: string;
  /** Reference price in MXN */
  unit_price: number;
  category: MaterialCategory;
}

// 130 items: 90 materials + 26 labor + 14 equipment
export const MATERIALS_DB: MaterialEntry[] = [
  // ─── Cementos y Agregados ────────────────────────────────────────────────────
  { id:  1, name: "Cemento Portland tipo I",           unit: "kg",      unit_price:    3.20, category: "materials" },
  { id:  2, name: "Cemento Portland tipo II",          unit: "kg",      unit_price:    3.40, category: "materials" },
  { id:  3, name: "Cemento blanco",                    unit: "kg",      unit_price:    8.50, category: "materials" },
  { id:  4, name: "Arena fina lavada",                 unit: "m³",      unit_price:  280.00, category: "materials" },
  { id:  5, name: "Arena gruesa de río",               unit: "m³",      unit_price:  260.00, category: "materials" },
  { id:  6, name: 'Grava triturada 3/4"',              unit: "m³",      unit_price:  350.00, category: "materials" },
  { id:  7, name: 'Grava triturada 1"',                unit: "m³",      unit_price:  340.00, category: "materials" },
  { id:  8, name: "Piedra bola de río",                unit: "m³",      unit_price:  250.00, category: "materials" },
  { id:  9, name: "Mortero premezclado",               unit: "kg",      unit_price:    5.50, category: "materials" },
  { id: 10, name: "Concreto premezclado f'c=150",      unit: "m³",      unit_price: 1850.00, category: "materials" },
  { id: 11, name: "Concreto premezclado f'c=200",      unit: "m³",      unit_price: 1950.00, category: "materials" },
  { id: 12, name: "Concreto premezclado f'c=250",      unit: "m³",      unit_price: 2100.00, category: "materials" },
  { id: 13, name: "Concreto premezclado f'c=300",      unit: "m³",      unit_price: 2300.00, category: "materials" },

  // ─── Mampostería ─────────────────────────────────────────────────────────────
  { id: 14, name: "Block de concreto 15×20×40",        unit: "pza",     unit_price:   18.00, category: "materials" },
  { id: 15, name: "Block de concreto 10×20×40",        unit: "pza",     unit_price:   14.00, category: "materials" },
  { id: 16, name: "Block de concreto 20×20×40",        unit: "pza",     unit_price:   22.00, category: "materials" },
  { id: 17, name: "Tabique rojo recocido 7×14×28",     unit: "pza",     unit_price:    8.50, category: "materials" },
  { id: 18, name: "Tabicón de concreto 12×20×40",      unit: "pza",     unit_price:   22.00, category: "materials" },
  { id: 19, name: "Ladrillo hueco 6×12×24",            unit: "pza",     unit_price:   12.00, category: "materials" },
  { id: 20, name: "Block celular autoclavado",          unit: "pza",     unit_price:   35.00, category: "materials" },

  // ─── Acero ───────────────────────────────────────────────────────────────────
  { id: 21, name: 'Varilla corrugada #2 (1/4")',        unit: "kg",      unit_price:   29.00, category: "materials" },
  { id: 22, name: 'Varilla corrugada #3 (3/8")',        unit: "kg",      unit_price:   28.00, category: "materials" },
  { id: 23, name: 'Varilla corrugada #4 (1/2")',        unit: "kg",      unit_price:   27.00, category: "materials" },
  { id: 24, name: 'Varilla corrugada #5 (5/8")',        unit: "kg",      unit_price:   26.50, category: "materials" },
  { id: 25, name: 'Varilla corrugada #6 (3/4")',        unit: "kg",      unit_price:   26.00, category: "materials" },
  { id: 26, name: "Malla electrosoldada 6×6 10/10",    unit: "m²",      unit_price:   85.00, category: "materials" },
  { id: 27, name: "Malla electrosoldada 6×6 6/6",      unit: "m²",      unit_price:  110.00, category: "materials" },
  { id: 28, name: "Alambre recocido #18",               unit: "kg",      unit_price:   32.00, category: "materials" },
  { id: 29, name: "Solera de acero 1×3/16",            unit: "ml",      unit_price:   48.00, category: "materials" },
  { id: 30, name: "Ángulo de acero 2×2×3/16",          unit: "ml",      unit_price:   95.00, category: "materials" },

  // ─── Acabados Secos ───────────────────────────────────────────────────────────
  { id: 31, name: 'Panel de yeso 1/2"',                 unit: "pza",     unit_price:  195.00, category: "materials" },
  { id: 32, name: 'Panel de yeso 5/8"',                 unit: "pza",     unit_price:  230.00, category: "materials" },
  { id: 33, name: "Perfil de acero cal. 25",            unit: "ml",      unit_price:   42.00, category: "materials" },
  { id: 34, name: 'Perfil U canal 3 1/2"',              unit: "ml",      unit_price:   48.00, category: "materials" },
  { id: 35, name: "Pasta para juntas",                  unit: "kg",      unit_price:   12.00, category: "materials" },
  { id: 36, name: "Cinta de papel",                     unit: "ml",      unit_price:    0.80, category: "materials" },
  { id: 37, name: "Tornillo autorroscante #6×1",        unit: "pza",     unit_price:    0.45, category: "materials" },

  // ─── Acabados Húmedos ─────────────────────────────────────────────────────────
  { id: 38, name: "Azulejo cerámico 30×30",             unit: "m²",      unit_price:  180.00, category: "materials" },
  { id: 39, name: "Piso cerámico 45×45",                unit: "m²",      unit_price:  220.00, category: "materials" },
  { id: 40, name: "Piso porcelanato 60×60",             unit: "m²",      unit_price:  380.00, category: "materials" },
  { id: 41, name: "Piso porcelanato 90×90",             unit: "m²",      unit_price:  520.00, category: "materials" },
  { id: 42, name: "Mosaico hidráulico 20×20",           unit: "m²",      unit_price:  280.00, category: "materials" },
  { id: 43, name: "Piedra natural cantera rosa",        unit: "m²",      unit_price:  650.00, category: "materials" },
  { id: 44, name: "Tapajuntas o junteador",             unit: "kg",      unit_price:   28.00, category: "materials" },

  // ─── Pintura e Impermeabilización ─────────────────────────────────────────────
  { id: 45, name: "Pintura vinílica interior",          unit: "L",       unit_price:   95.00, category: "materials" },
  { id: 46, name: "Pintura esmalte exterior",           unit: "L",       unit_price:  120.00, category: "materials" },
  { id: 47, name: "Impermeabilizante acrílico",         unit: "L",       unit_price:   85.00, category: "materials" },
  { id: 48, name: "Pintura epóxica bicomponente",       unit: "L",       unit_price:  220.00, category: "materials" },
  { id: 49, name: "Sellador de base agua",              unit: "L",       unit_price:   75.00, category: "materials" },
  { id: 50, name: "Membrana impermeabilizante",         unit: "m²",      unit_price:  185.00, category: "materials" },
  { id: 51, name: "Estuco acrílico exterior",           unit: "kg",      unit_price:   18.00, category: "materials" },

  // ─── Madera y Cimbra ─────────────────────────────────────────────────────────
  { id: 52, name: 'Madera pino cepillada 1×6"',         unit: "ml",      unit_price:   65.00, category: "materials" },
  { id: 53, name: 'Madera pino cepillada 1×4"',         unit: "ml",      unit_price:   42.00, category: "materials" },
  { id: 54, name: 'Madera pino cepillada 2×4"',         unit: "ml",      unit_price:   85.00, category: "materials" },
  { id: 55, name: "Triplay 18 mm 4×8",                  unit: "pza",     unit_price:  680.00, category: "materials" },
  { id: 56, name: "Triplay 12 mm 4×8",                  unit: "pza",     unit_price:  480.00, category: "materials" },
  { id: 57, name: "MDF 15 mm 4×8",                      unit: "pza",     unit_price:  520.00, category: "materials" },
  { id: 58, name: 'Clavo c/cabeza 2 1/2"',              unit: "kg",      unit_price:   42.00, category: "materials" },
  { id: 59, name: 'Clavo c/cabeza 3"',                  unit: "kg",      unit_price:   40.00, category: "materials" },
  { id: 60, name: "Puntas clavadora neumática 50 mm",   unit: "paq",     unit_price:  120.00, category: "materials" },

  // ─── Instalación Hidráulica ───────────────────────────────────────────────────
  { id: 61, name: 'Tubo PVC hidráulico 1/2"',           unit: "ml",      unit_price:   28.00, category: "materials" },
  { id: 62, name: 'Tubo PVC hidráulico 3/4"',           unit: "ml",      unit_price:   38.00, category: "materials" },
  { id: 63, name: 'Tubo PVC hidráulico 1"',             unit: "ml",      unit_price:   55.00, category: "materials" },
  { id: 64, name: 'Tubo CPVC agua caliente 1/2"',       unit: "ml",      unit_price:   48.00, category: "materials" },
  { id: 65, name: 'Tubo PVC sanitario 4"',              unit: "ml",      unit_price:   95.00, category: "materials" },
  { id: 66, name: 'Tubo PVC sanitario 3"',              unit: "ml",      unit_price:   72.00, category: "materials" },
  { id: 67, name: 'Tubo PVC sanitario 2"',              unit: "ml",      unit_price:   48.00, category: "materials" },
  { id: 68, name: "Llave de paso esférica 1/2",         unit: "pza",     unit_price:   95.00, category: "materials" },
  { id: 69, name: "Tinaco 1100 L Rotoplas",             unit: "pza",     unit_price: 2800.00, category: "materials" },
  { id: 70, name: "Cisterna 5000 L Rotoplas",           unit: "pza",     unit_price: 7500.00, category: "materials" },

  // ─── Instalación Eléctrica ────────────────────────────────────────────────────
  { id: 71, name: 'Tubo conduit rígido 1/2"',           unit: "ml",      unit_price:   22.00, category: "materials" },
  { id: 72, name: 'Tubo conduit rígido 3/4"',           unit: "ml",      unit_price:   32.00, category: "materials" },
  { id: 73, name: 'Cable THW calibre 12 (negro)',        unit: "ml",      unit_price:   16.00, category: "materials" },
  { id: 74, name: 'Cable THW calibre 12 (blanco)',       unit: "ml",      unit_price:   16.00, category: "materials" },
  { id: 75, name: 'Cable THW calibre 10',               unit: "ml",      unit_price:   24.00, category: "materials" },
  { id: 76, name: 'Cable THHW calibre 8',               unit: "ml",      unit_price:   42.00, category: "materials" },
  { id: 77, name: "Centro de carga 8 circuitos",        unit: "pza",     unit_price:  850.00, category: "materials" },
  { id: 78, name: "Interruptor termomagnético 1P 20A",  unit: "pza",     unit_price:  145.00, category: "materials" },
  { id: 79, name: "Contacto doble polarizado",          unit: "pza",     unit_price:   65.00, category: "materials" },
  { id: 80, name: "Apagador sencillo",                  unit: "pza",     unit_price:   55.00, category: "materials" },

  // ─── Carpintería Metálica y Cancelería ───────────────────────────────────────
  { id: 81, name: "Perfil PTR 2×2×2 mm",               unit: "ml",      unit_price:   75.00, category: "materials" },
  { id: 82, name: "Perfil PTR 3×3×2 mm",               unit: "ml",      unit_price:  105.00, category: "materials" },
  { id: 83, name: "Perfil Omega 2 1/2",                 unit: "ml",      unit_price:   58.00, category: "materials" },
  { id: 84, name: 'Lámina galvanizada calibre 22',      unit: "m²",      unit_price:  185.00, category: "materials" },
  { id: 85, name: 'Lámina pintro calibre 24',           unit: "m²",      unit_price:  210.00, category: "materials" },
  { id: 86, name: "Vidrio float 6 mm",                  unit: "m²",      unit_price:  320.00, category: "materials" },
  { id: 87, name: "Vidrio templado 10 mm",              unit: "m²",      unit_price:  680.00, category: "materials" },
  { id: 88, name: "Bisagra de acero 4×4",               unit: "pza",     unit_price:   35.00, category: "materials" },
  { id: 89, name: "Chapa con llave Yale",               unit: "pza",     unit_price:  280.00, category: "materials" },

  // ─── Cubierta y Estructura ────────────────────────────────────────────────────
  { id: 90, name: "Lámina acrílica traslúcida",         unit: "m²",      unit_price:  245.00, category: "materials" },
  { id: 91, name: "Lámina Galvateja teja roja",         unit: "m²",      unit_price:  195.00, category: "materials" },
  { id: 92, name: "Bovedilla de poliestireno",          unit: "pza",     unit_price:   48.00, category: "materials" },
  { id: 93, name: "Vigueta pretensada T6",              unit: "ml",      unit_price:   85.00, category: "materials" },
  { id: 94, name: "Concreto celular para relleno",      unit: "m³",      unit_price: 1650.00, category: "materials" },

  // ─── Mano de Obra (26) ───────────────────────────────────────────────────────
  { id: 95, name: "Albañil",                            unit: "jornal",  unit_price:  380.00, category: "labor" },
  { id: 96, name: "Ayudante de albañil",                unit: "jornal",  unit_price:  280.00, category: "labor" },
  { id: 97, name: "Oficial plomero",                    unit: "jornal",  unit_price:  420.00, category: "labor" },
  { id: 98, name: "Ayudante de plomero",                unit: "jornal",  unit_price:  280.00, category: "labor" },
  { id: 99, name: "Oficial electricista",               unit: "jornal",  unit_price:  420.00, category: "labor" },
  { id:100, name: "Ayudante de electricista",           unit: "jornal",  unit_price:  280.00, category: "labor" },
  { id:101, name: "Carpintero",                         unit: "jornal",  unit_price:  400.00, category: "labor" },
  { id:102, name: "Maestro de obras",                   unit: "jornal",  unit_price:  550.00, category: "labor" },
  { id:103, name: "Fierrero (habilitador)",              unit: "jornal",  unit_price:  400.00, category: "labor" },
  { id:104, name: "Pintor",                             unit: "jornal",  unit_price:  380.00, category: "labor" },
  { id:105, name: "Impermeabilizador",                  unit: "jornal",  unit_price:  350.00, category: "labor" },
  { id:106, name: "Instalador de drywall",              unit: "jornal",  unit_price:  390.00, category: "labor" },
  { id:107, name: "Colocador de pisos y azulejos",      unit: "jornal",  unit_price:  420.00, category: "labor" },
  { id:108, name: "Herrero soldador",                   unit: "jornal",  unit_price:  450.00, category: "labor" },
  { id:109, name: "Oficial de cancelería",              unit: "jornal",  unit_price:  440.00, category: "labor" },
  { id:110, name: "Topógrafo",                          unit: "jornal",  unit_price:  650.00, category: "labor" },
  { id:111, name: "Ayudante de topógrafo",              unit: "jornal",  unit_price:  300.00, category: "labor" },
  { id:112, name: "Peón general",                       unit: "jornal",  unit_price:  260.00, category: "labor" },
  { id:113, name: "Residente de obra",                  unit: "mes",     unit_price:18000.00, category: "labor" },
  { id:114, name: "Supervisor de obra",                 unit: "mes",     unit_price:22000.00, category: "labor" },
  { id:115, name: "Jefe de obra",                       unit: "mes",     unit_price:28000.00, category: "labor" },
  { id:116, name: "Cuadrilla de 4 albañiles",          unit: "jornal",  unit_price: 1400.00, category: "labor" },
  { id:117, name: "Operador de maquinaria",             unit: "jornal",  unit_price:  500.00, category: "labor" },
  { id:118, name: "Chofer operador",                    unit: "jornal",  unit_price:  420.00, category: "labor" },
  { id:119, name: "Velador / Guardián",                 unit: "mes",     unit_price: 8500.00, category: "labor" },
  { id:120, name: "Técnico en instalaciones M/E",       unit: "jornal",  unit_price:  480.00, category: "labor" },

  // ─── Maquinaria y Equipo (14) ────────────────────────────────────────────────
  { id:121, name: "Mezcladora de concreto 1 saco",      unit: "hr",      unit_price:  320.00, category: "equipment" },
  { id:122, name: "Vibrador de concreto",               unit: "hr",      unit_price:  180.00, category: "equipment" },
  { id:123, name: "Compactador pata de cabra",          unit: "hr",      unit_price:  450.00, category: "equipment" },
  { id:124, name: "Compactador de plancha",             unit: "hr",      unit_price:  380.00, category: "equipment" },
  { id:125, name: "Camión volteo 7 m³",                 unit: "hr",      unit_price:  950.00, category: "equipment" },
  { id:126, name: "Camión pipa 10,000 L",               unit: "hr",      unit_price:  800.00, category: "equipment" },
  { id:127, name: "Retroexcavadora CAT 320",            unit: "hr",      unit_price: 1200.00, category: "equipment" },
  { id:128, name: "Mini cargador Bobcat",               unit: "hr",      unit_price:  850.00, category: "equipment" },
  { id:129, name: "Grúa telescópica 50 t",              unit: "hr",      unit_price: 3500.00, category: "equipment" },
  { id:130, name: "Andamio tubular (por período)",      unit: "sem",     unit_price:  180.00, category: "equipment" },
  { id:131, name: "Cimbra metálica (por período)",      unit: "m²/sem",  unit_price:   95.00, category: "equipment" },
  { id:132, name: "Generador eléctrico 25 kVA",        unit: "hr",      unit_price:  420.00, category: "equipment" },
  { id:133, name: "Cortadora de piso (disco)",          unit: "hr",      unit_price:  260.00, category: "equipment" },
  { id:134, name: "Soldadora eléctrica 300A",           unit: "hr",      unit_price:  220.00, category: "equipment" },
];

export const CATEGORY_LABELS: Record<MaterialCategory, { es: string; en: string; color: string }> = {
  materials: { es: "Materiales",  en: "Materials",  color: "#22c55e" },
  labor:     { es: "Mano de Obra", en: "Labor",     color: "#3b82f6" },
  equipment: { es: "Maquinaria",  en: "Equipment",  color: "#a855f7" },
};
