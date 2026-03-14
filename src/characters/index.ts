import type { CharacterDefinition } from "./types";
import victoria from "./victoria";
import hartwell from "./hartwell";
import clara from "./clara";
import price from "./price";
import agnes from "./agnes";

export type { CharacterDefinition } from "./types";

export const characters: CharacterDefinition[] = [
  victoria,
  hartwell,
  clara,
  price,
  agnes,
];

export function getCharacter(id: string): CharacterDefinition | undefined {
  return characters.find((c) => c.id === id);
}

export { victoria, hartwell, clara, price, agnes };
