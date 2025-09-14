import Headerbar from "@/components/custom/headerbar";
import Sidebar from "@/components/custom/sidebar";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full w-full flex overflow-hidden">
      <Sidebar />
      <div className="flex flex-col w-full h-full">
        <Headerbar />
        <div className="p-4 w-full h-full">{children}</div>
      </div>
    </div>
  );
}
