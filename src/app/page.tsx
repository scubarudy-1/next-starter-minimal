import Game from "./game";
import { getDailyWord } from "@/lib/dailyWord";

export default function Page() {
  const dailyWord = getDailyWord();
  return <Game dailyWord={dailyWord} />;
}
