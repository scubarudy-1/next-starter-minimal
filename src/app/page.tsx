import Game from "./Game";
import { getDailyWord } from "@/utils/dailyWord";

export default function Page() {
  const dailyWord = getDailyWord().toUpperCase();

  return <Game dailyWord={dailyWord} />;
}
