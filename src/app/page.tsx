import Game from "./game";
import { getDailyWord } from "../utils/dailyWord";

export default function Page() {
  const dailyWord = getDailyWord();

  return <Game dailyWord={dailyWord.toUpperCase()} />;
}
