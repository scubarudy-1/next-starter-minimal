import Game from "./game";
import { getDailyWord } from "@/utils/dailyWord";

export default function Page() {
  const dailyWord = getDailyWord();

  return (
    <>
      <p style={{ padding: "1rem", fontFamily: "Arial" }}>
        <em>SERVER dailyWord = {dailyWord}</em>
      </p>
      <Game dailyWord={dailyWord.toUpperCase()} />
    </>
  );
}
