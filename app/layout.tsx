import type { Metadata } from "next";
import { Syne, DM_Sans } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { ToastProvider } from "@/lib/context/ToastContext";
import ToastContainer from "@/components/ui/ToastContainer";
import "./globals.css";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ConstruSheet",
  description: "Gestión de proyectos de construcción: APU, presupuestos y cronogramas",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // suppressHydrationWarning prevents React from warning when next-themes
    // adds the theme class during hydration (expected mismatch).
    <html lang="es" suppressHydrationWarning>
      <body className={`${syne.variable} ${dmSans.variable}`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange={false}
        >
          <ToastProvider>
            {children}
            <ToastContainer />
            {process.env.NEXT_PUBLIC_ENABLE_PRO_LIMITS !== 'true' && (
              <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#f59e0b", color: "#000", textAlign: "center", fontSize: 11, padding: 3, zIndex: 9999, fontFamily: "system-ui" }}>
                DEV MODE — Pro limits disabled (NEXT_PUBLIC_ENABLE_PRO_LIMITS=false)
              </div>
            )}
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
