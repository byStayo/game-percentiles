import { ReactNode } from "react";
import { Header } from "./Header";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-8 sm:py-12">
        {children}
      </main>
      <footer className="border-t border-border/40 py-8 mt-12">
        <div className="container">
          <p className="text-center text-sm text-muted-foreground">
            Historical data analysis for entertainment purposes only.
          </p>
        </div>
      </footer>
    </div>
  );
}