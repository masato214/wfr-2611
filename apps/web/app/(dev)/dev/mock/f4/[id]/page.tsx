import { cookies } from "next/headers";
import { THEME_COOKIE, parseTheme } from "@/lib/theme";
import { MockView } from "../mocks";

// 段 5 の下絵のモックの 1 つの状態（/dev/mock/f4/<id>）
export default async function MockF4State({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <div data-mock={id}>
      <MockView id={id} theme={theme} />
    </div>
  );
}
