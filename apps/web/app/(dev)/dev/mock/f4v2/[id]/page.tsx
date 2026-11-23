import { cookies } from "next/headers";
import { THEME_COOKIE, parseTheme } from "@/lib/theme";
import { MockView } from "../mocks";

export default async function MockF4V2State({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <div data-mock={id}>
      <MockView id={id} theme={theme} />
    </div>
  );
}
