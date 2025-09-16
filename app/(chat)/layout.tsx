import Headerbar from "@/components/custom/headerbar";
import Sidebar from "@/components/custom/sidebar";
import { cookies } from "next/headers";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookie = await cookies();
  const userId = cookie.get("app_uid")?.value ?? undefined;

  return (
    <div className="h-full w-full flex overflow-hidden">
      <Sidebar userId={userId} />
      <div className="flex flex-col w-full h-full">
        <Headerbar />
        <div className="p-4 w-full h-full flex flex-col relative">
          {children}
        </div>
      </div>
    </div>
  );
}
