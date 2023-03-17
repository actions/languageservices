import {ExpressionData} from "./data";

export class idxHelper {
  public readonly str: string | undefined;
  public readonly int: number | undefined;

  constructor(public readonly star: boolean, idx: ExpressionData | undefined) {
    if (!idx) {
      return;
    }
    if (!star) {
      if (idx.primitive) {
        this.str = idx.coerceString();
      }

      let f = idx.number();
      if (!isNaN(f) && isFinite(f) && f >= 0) {
        f = Math.floor(f);
        this.int = f;
      }
    }
  }
}
