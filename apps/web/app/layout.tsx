import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { ServiceWorkerRegistrar } from "@/components/pwa/service-worker";
import { TimeZoneProbe } from "@/components/i18n/timezone-probe";
import { Toaster } from "@/components/ui/toaster";
import { I18nProvider } from "@/lib/i18n/client";
import { getPreferences, getT } from "@/lib/i18n/server";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return {
    title: {
      default: `Times — ${t("meta.tagline")}`,
      template: "%s · Times",
    },
    description: t("meta.description"),
    applicationName: "Times",
    appleWebApp: {
      capable: true,
      title: "Times",
      statusBarStyle: "black-translucent",
    },
    icons: {
      icon: "/favicon.png",
      apple: "/icons/apple-touch-icon.png",
    },
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  // Fills the notch area when installed, and follows the active theme.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0f" },
  ],
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale, timeZone } = await getPreferences();
  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={`${inter.variable} font-sans`}>
        <I18nProvider locale={locale} timeZone={timeZone}>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            {children}
            <Toaster />
            <ServiceWorkerRegistrar />
            <TimeZoneProbe current={timeZone} />
          </ThemeProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
