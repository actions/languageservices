import {Dictionary} from "../data/dictionary";
import {ExpressionData, Kind, Pair} from "../data/expressiondata";

export type DescriptionPair = Pair & {description?: string};

export function isDescriptionDictionary(x: ExpressionData): x is DescriptionDictionary {
  return x.kind === Kind.Dictionary && x instanceof DescriptionDictionary;
}

export class DescriptionDictionary extends Dictionary {
  private readonly descriptions = new Map<string, string>();
  public complete: boolean = true;

  constructor(...pairs: DescriptionPair[]) {
    super();

    for (const p of pairs) {
      this.add(p.key, p.value, p.description);
    }
  }

  override add(key: string, value: ExpressionData, description?: string): void {
    if (this.get(key) !== undefined) {
      // Key already added, ignore
      return;
    }

    super.add(key, value);
    if (description) {
      this.descriptions.set(key, description);
    }
  }

  override pairs(): DescriptionPair[] {
    const pairs = super.pairs();
    return pairs.map(p => ({...p, description: this.descriptions.get(p.key)}));
  }

  getDescription(key: string): string | undefined {
    return this.descriptions.get(key);
  }
}
