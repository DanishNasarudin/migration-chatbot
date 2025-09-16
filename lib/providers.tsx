import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "./providers/theme-provider";
import { UserIdCookieProvider } from "./providers/user-id-provider";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <UserIdCookieProvider>
        {children}
        <Toaster richColors closeButton />
      </UserIdCookieProvider>
    </ThemeProvider>
  );
}
