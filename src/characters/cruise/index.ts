import type { CharacterDefinition } from "../types";
import vasquez from "./vasquez";
import harrington from "./harrington";
import isabelle from "./isabelle";
import volkov from "./volkov";
import diego from "./diego";
import lydia from "./lydia";
import wells from "./wells";
import sofia from "./sofia";
import romano from "./romano";
import okafor from "./okafor";
import yuki from "./yuki";

export const cruiseCharacters: CharacterDefinition[] = [
  vasquez, harrington, isabelle, volkov, diego, lydia, wells, sofia, romano, okafor, yuki,
];

export function getCruiseCharacter(id: string): CharacterDefinition | undefined {
  return cruiseCharacters.find(c => c.id === id);
}
