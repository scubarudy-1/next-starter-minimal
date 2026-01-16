export const dynamic = "force-dynamic";
export const revalidate = 0;

import Game from "./game";
import { getDailyWord } from "@/lib/dailyWord";

export default function Page() {
  const dailyWord = getDailyWord();
  return <Game dailyWord={dailyWord} />;
}
