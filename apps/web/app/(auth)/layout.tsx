export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Athletics Tracker</h1>
          <p className="mt-1 text-sm text-muted-foreground">Le tue prestazioni, in un posto solo.</p>
        </div>
        {children}
      </div>
    </div>
  );
}
