import { ReactNode } from "react";
import { Header } from "./Header";
import { BottomNav } from "./BottomNav";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container px-4 sm:px-6 py-4 sm:py-8 pb-24 md:pb-8">
        {children}
      </main>
      <footer className="hidden md:block border-t border-border/40 py-8 mt-12">
        <div className="container">
          <p className="text-center text-sm text-muted-foreground">
            Historical data analysis for entertainment purposes only.
          </p>
        </div>
      </footer>
      <BottomNav />
    </div>
  );
}