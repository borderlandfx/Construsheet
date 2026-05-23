import { useCallback } from "react";

export type Locale = "en" | "es";

// ─── Translation table ────────────────────────────────────────────────────────

const translations = {
  en: {
    // ── Nav ──────────────────────────────────────────────────────────────────
    projects:        "Projects",
    settings:        "Settings",
    logout:          "Log out",
    dashboard:       "Dashboard",
    // ── Auth ─────────────────────────────────────────────────────────────────
    login:           "Log in",
    signup:          "Sign up",
    email:           "Email",
    password:        "Password",
    confirmPassword: "Confirm password",
    fullName:        "Full name",
    forgotPassword:  "Forgot password?",
    noAccount:       "Don't have an account?",
    haveAccount:     "Already have an account?",
    // ── Landing – Hero ───────────────────────────────────────────────────────
    heroHeadline:    "Construction management, built for Latin America",
    heroSub:         "Unit price analysis, budgets, and Gantt schedules — all in one platform. Works in Spanish and English.",
    heroCta:         "Start for free",
    heroDemo:        "See live demo",
    // ── Landing – Features ───────────────────────────────────────────────────
    featuresTitle:   "Everything you need on one screen",
    featuresSub:     "ConstruSheet replaces scattered spreadsheets with a single, connected workspace.",
    featureAPU:      "Unit Price Analysis (APU)",
    featureAPUDesc:  "Build detailed cost breakdowns with materials, labour, and equipment. AI auto-fills realistic prices.",
    featureBudget:   "Live Budget",
    featureBudgetDesc: "Import APU items into a structured budget. Track status, assignees, and totals in real time.",
    featureGantt:    "Gantt Schedule",
    featureGanttDesc: "Drag-and-drop timeline. Resize bars, cycle statuses, and export to CSV or PDF.",
    featureAI:       "AI Price Assistant",
    featureAIDesc:   "Describe any construction activity and receive a complete APU with market-accurate prices in seconds.",
    // ── Landing – Pricing ────────────────────────────────────────────────────
    pricingTitle:    "Simple, transparent pricing",
    pricingSub:      "Start free. Upgrade when you need more.",
    pricingFreeTitle:"Free",
    pricingFreeDesc: "For individuals and small projects",
    pricingFreePrice:"$0",
    pricingFreePerMonth: "/month",
    pricingProTitle: "Pro",
    pricingProDesc:  "For professionals and growing teams",
    pricingProPrice: "$19",
    pricingEntTitle: "Enterprise",
    pricingEntDesc:  "For large construction firms",
    pricingEntPrice: "Custom",
    pricingCta:      "Get started",
    pricingContactUs:"Contact us",
    pricingMostPop:  "Most popular",
    // ── Landing – Footer ─────────────────────────────────────────────────────
    footerTagline:   "The construction management platform for Latin America.",
    footerProduct:   "Product",
    footerCompany:   "Company",
    footerLegal:     "Legal",
    footerFeatures:  "Features",
    footerPricing:   "Pricing",
    footerChangelog: "Changelog",
    footerAbout:     "About",
    footerBlog:      "Blog",
    footerCareers:   "Careers",
    footerPrivacy:   "Privacy Policy",
    footerTerms:     "Terms of Service",
    footerCopyright: "© {year} ConstruSheet. All rights reserved.",
    // ── Dashboard ────────────────────────────────────────────────────────────
    myProjects:           "My Projects",
    createProject:        "New Project",
    noProjects:           "No projects yet. Create your first one!",
    noProjectsTitle:      "Create your first project",
    noProjectsDesc:       "Track budgets, unit prices, and timelines all in one place.",
    invite:               "Invite",
    // ── Project form ─────────────────────────────────────────────────────────
    projectName:          "Project Name",
    projectNamePlaceholder:"e.g. López Residence",
    location:             "Location",
    locationPlaceholder:  "e.g. Monterrey, N.L.",
    description:          "Description",
    descriptionPlaceholder:"Optional project description…",
    currency:             "Currency",
    newProject:           "New Project",
    // ── Project card ─────────────────────────────────────────────────────────
    lastUpdated:          "Last updated",
    createdOn:            "Created",
    budgetItems:          "items",
    totalBudget:          "Total",
    openProject:          "Open",
    cardBudget:           "Budget",
    cardApproved:         "Approved",
    cardApus:             "APUs",
    cardPartidas:         "Items",
    cardApprovedPct:      "approved",
    cardDaysAgo:          "{n} days ago",
    cardToday:            "Today",
    cardYesterday:        "Yesterday",
    // ── Status labels ─────────────────────────────────────────────────────────
    statusActive:         "Active",
    statusCompleted:      "Completed",
    statusArchived:       "Archived",
    statusApproved:       "Approved",
    statusReview:         "Review",
    statusPending:        "Pending",
    // ── Workspace tabs ────────────────────────────────────────────────────────
    apu:       "APU",
    budget:    "Budget",
    gantt:     "Gantt",
    exportPdf: "Export PDF",
    // ── APU ──────────────────────────────────────────────────────────────────
    apuTitle:          "Unit Price Analysis",
    apuEmpty:          "No APU items yet. Add your first item to get started.",
    addItem:           "Add Item",
    generateWithAI:    "Generate with AI",
    materialsLibrary:  "Materials Library",
    code:              "Code",
    itemDescription:   "Description",
    unit:              "Unit",
    quantity:          "Quantity",
    unitPrice:         "Unit Price",
    total:             "Total",
    category:          "Category",
    noCategory:        "No category",
    allCategories:     "All categories",
    filterByCategory:  "Filter by category",
    // APU cost components
    materials:         "Materials",
    labor:             "Labour",
    equipment:         "Equipment & Tools",
    directCost:        "Direct Cost",
    overhead:          "Overheads (GG)",
    profit:            "Profit (U)",
    sellingPrice:      "Selling Price",
    overheadPct:       "Overhead %",
    profitPct:         "Profit %",
    // ── Budget ───────────────────────────────────────────────────────────────
    budgetTitle:       "Budget",
    budgetEmpty:       "No budget rows yet. Add a row or import from APU.",
    addRow:            "Add Row",
    importFromAPU:     "Import from APU",
    section:           "Section",
    chapter:           "Chapter",
    item:              "Item",
    assignee:          "Assignee",
    grandTotal:        "Grand Total",
    // ── Gantt ────────────────────────────────────────────────────────────────
    ganttTitle:        "Gantt Chart",
    ganttEmpty:        "No tasks yet. Add your first activity.",
    addTask:           "Add Task",
    taskName:          "Task Name",
    startDate:         "Start Date",
    startWeek:         "Start Week",
    duration:          "Duration (weeks)",
    endDate:           "End Date",
    progress:          "Progress",
    color:             "Color",
    week:              "Week",
    weeks:             "weeks",
    // ── Actions ───────────────────────────────────────────────────────────────
    save:              "Save",
    cancel:            "Cancel",
    delete:            "Delete",
    edit:              "Edit",
    add:               "Add",
    confirm:           "Confirm",
    creating:          "Creating…",
    saving:            "Saving…",
    deleting:          "Deleting…",
    // ── Messages ──────────────────────────────────────────────────────────────
    saved:             "Saved successfully",
    error:             "An error occurred",
    loading:           "Loading…",
    generatingAI:      "Analysing construction activity…",
    authFailed:        "Authentication failed. Please try again.",
  },

  es: {
    // ── Nav ──────────────────────────────────────────────────────────────────
    projects:        "Proyectos",
    settings:        "Configuración",
    logout:          "Cerrar sesión",
    dashboard:       "Inicio",
    // ── Auth ─────────────────────────────────────────────────────────────────
    login:           "Iniciar sesión",
    signup:          "Registrarse",
    email:           "Correo electrónico",
    password:        "Contraseña",
    confirmPassword: "Confirmar contraseña",
    fullName:        "Nombre completo",
    forgotPassword:  "¿Olvidaste tu contraseña?",
    noAccount:       "¿No tienes cuenta?",
    haveAccount:     "¿Ya tienes cuenta?",
    // ── Landing – Hero ───────────────────────────────────────────────────────
    heroHeadline:    "Gestión de obra diseñada para Latinoamérica",
    heroSub:         "APU, presupuesto y cronograma en una sola plataforma. Funciona en español e inglés.",
    heroCta:         "Empieza gratis",
    heroDemo:        "Ver demo en vivo",
    // ── Landing – Features ───────────────────────────────────────────────────
    featuresTitle:   "Todo lo que necesitas en una sola pantalla",
    featuresSub:     "ConstruSheet reemplaza tus hojas de cálculo dispersas con un espacio de trabajo conectado.",
    featureAPU:      "Análisis de Precio Unitario",
    featureAPUDesc:  "Construye desgloses de costos con materiales, mano de obra y equipo. La IA llena precios realistas automáticamente.",
    featureBudget:   "Presupuesto en tiempo real",
    featureBudgetDesc: "Importa ítems de APU a un presupuesto estructurado. Controla estatus, responsables y totales al instante.",
    featureGantt:    "Cronograma Gantt",
    featureGanttDesc: "Línea de tiempo con arrastre. Redimensiona barras, cambia estatus y exporta a CSV o PDF.",
    featureAI:       "Asistente de Precios con IA",
    featureAIDesc:   "Describe cualquier concepto de obra y recibe un APU completo con precios de mercado en segundos.",
    // ── Landing – Pricing ────────────────────────────────────────────────────
    pricingTitle:    "Precios simples y transparentes",
    pricingSub:      "Comienza gratis. Actualiza cuando necesites más.",
    pricingFreeTitle:"Gratuito",
    pricingFreeDesc: "Para individuos y proyectos pequeños",
    pricingFreePrice:"$0",
    pricingFreePerMonth: "/mes",
    pricingProTitle: "Pro",
    pricingProDesc:  "Para profesionales y equipos en crecimiento",
    pricingProPrice: "$19",
    pricingEntTitle: "Empresarial",
    pricingEntDesc:  "Para grandes constructoras",
    pricingEntPrice: "A consultar",
    pricingCta:      "Comenzar",
    pricingContactUs:"Contáctanos",
    pricingMostPop:  "Más popular",
    // ── Landing – Footer ─────────────────────────────────────────────────────
    footerTagline:   "La plataforma de gestión de obra para Latinoamérica.",
    footerProduct:   "Producto",
    footerCompany:   "Empresa",
    footerLegal:     "Legal",
    footerFeatures:  "Funcionalidades",
    footerPricing:   "Precios",
    footerChangelog: "Novedades",
    footerAbout:     "Nosotros",
    footerBlog:      "Blog",
    footerCareers:   "Trabaja con nosotros",
    footerPrivacy:   "Política de privacidad",
    footerTerms:     "Términos de servicio",
    footerCopyright: "© {year} ConstruSheet. Todos los derechos reservados.",
    // ── Dashboard ────────────────────────────────────────────────────────────
    myProjects:           "Mis Proyectos",
    createProject:        "Nuevo Proyecto",
    noProjects:           "Aún no hay proyectos. ¡Crea el primero!",
    noProjectsTitle:      "Crea tu primer proyecto",
    noProjectsDesc:       "Gestiona presupuestos, análisis de precios y cronogramas en un solo lugar.",
    invite:               "Invitar",
    // ── Project form ─────────────────────────────────────────────────────────
    projectName:          "Nombre del Proyecto",
    projectNamePlaceholder:"Ej. Residencia López",
    location:             "Ubicación",
    locationPlaceholder:  "Ej. Monterrey, N.L.",
    description:          "Descripción",
    descriptionPlaceholder:"Descripción opcional del proyecto…",
    currency:             "Moneda",
    newProject:           "Nuevo Proyecto",
    // ── Project card ─────────────────────────────────────────────────────────
    lastUpdated:          "Actualizado",
    createdOn:            "Creado",
    budgetItems:          "partidas",
    totalBudget:          "Total",
    openProject:          "Abrir",
    cardBudget:           "Presupuesto",
    cardApproved:         "Aprobado",
    cardApus:             "APUs",
    cardPartidas:         "Partidas",
    cardApprovedPct:      "aprobado",
    cardDaysAgo:          "hace {n} días",
    cardToday:            "Hoy",
    cardYesterday:        "Ayer",
    // ── Status labels ─────────────────────────────────────────────────────────
    statusActive:         "Activo",
    statusCompleted:      "Completado",
    statusArchived:       "Archivado",
    statusApproved:       "Aprobado",
    statusReview:         "Revisión",
    statusPending:        "Pendiente",
    // ── Workspace tabs ────────────────────────────────────────────────────────
    apu:       "APU",
    budget:    "Presupuesto",
    gantt:     "Gantt",
    exportPdf: "Exportar PDF",
    // ── APU ──────────────────────────────────────────────────────────────────
    apuTitle:          "Análisis de Precio Unitario",
    apuEmpty:          "Aún no hay ítems APU. Agrega tu primer ítem para comenzar.",
    addItem:           "Agregar Ítem",
    generateWithAI:    "Generar con IA",
    materialsLibrary:  "Biblioteca de Materiales",
    code:              "Código",
    itemDescription:   "Descripción",
    unit:              "Unidad",
    quantity:          "Cantidad",
    unitPrice:         "Precio Unitario",
    total:             "Total",
    category:          "Categoría",
    noCategory:        "Sin categoría",
    allCategories:     "Todas las categorías",
    filterByCategory:  "Filtrar por categoría",
    // APU cost components
    materials:         "Materiales",
    labor:             "Mano de Obra",
    equipment:         "Equipo y Herramienta",
    directCost:        "Costo Directo",
    overhead:          "Gastos Generales (GG)",
    profit:            "Utilidad (U)",
    sellingPrice:      "Precio de Venta",
    overheadPct:       "GG %",
    profitPct:         "Utilidad %",
    // ── Budget ───────────────────────────────────────────────────────────────
    budgetTitle:       "Presupuesto",
    budgetEmpty:       "Aún no hay filas. Agrega una fila o importa del APU.",
    addRow:            "Agregar Fila",
    importFromAPU:     "Importar del APU",
    section:           "Sección",
    chapter:           "Capítulo",
    item:              "Ítem",
    assignee:          "Responsable",
    grandTotal:        "Total General",
    // ── Gantt ────────────────────────────────────────────────────────────────
    ganttTitle:        "Diagrama de Gantt",
    ganttEmpty:        "Aún no hay actividades. Agrega la primera.",
    addTask:           "Agregar Tarea",
    taskName:          "Nombre de Tarea",
    startDate:         "Fecha de Inicio",
    startWeek:         "Semana de Inicio",
    duration:          "Duración (semanas)",
    endDate:           "Fecha de Fin",
    progress:          "Avance",
    color:             "Color",
    week:              "Semana",
    weeks:             "semanas",
    // ── Actions ───────────────────────────────────────────────────────────────
    save:              "Guardar",
    cancel:            "Cancelar",
    delete:            "Eliminar",
    edit:              "Editar",
    add:               "Agregar",
    confirm:           "Confirmar",
    creating:          "Creando…",
    saving:            "Guardando…",
    deleting:          "Eliminando…",
    // ── Messages ──────────────────────────────────────────────────────────────
    saved:             "Guardado correctamente",
    error:             "Ocurrió un error",
    loading:           "Cargando…",
    generatingAI:      "Analizando concepto de obra…",
    authFailed:        "No se pudo autenticar. Intenta de nuevo.",
  },
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export type TranslationKey = keyof typeof translations.en;

// ─── Functions ────────────────────────────────────────────────────────────────

/**
 * Translate a key for the given locale.
 * Falls back to EN, then returns the key itself if not found.
 * Accepts a plain string so callers don't need to cast.
 */
export function t(key: string, lang: Locale = "es"): string {
  const table = translations[lang] as Record<string, string>;
  const fallback = translations.en as Record<string, string>;
  return table[key] ?? fallback[key] ?? key;
}

/**
 * React hook — returns a bound `t(key)` function for the given locale.
 * Memoised so it is stable across renders when `lang` doesn't change.
 */
export function useTranslation(lang: Locale) {
  return useCallback((key: string) => t(key, lang), [lang]);
}

/** Detect browser locale, defaulting to "es" for any non-English browser. */
export function getLocaleFromBrowser(): Locale {
  if (typeof navigator === "undefined") return "es";
  const lang = navigator.language.split("-")[0];
  return lang === "en" ? "en" : "es";
}
