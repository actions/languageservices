import * as data from "./data";

export function falsy(d: data.ExpressionData): boolean {
  switch (d.kind) {
    case data.Kind.Null:
      return true;

    case data.Kind.Boolean:
      return !d.value;

    case data.Kind.Number:
      const dv = d.value;
      return dv === 0 || isNaN(dv);

    case data.Kind.String:
      return d.value.length === 0;
  }

  return false;
}

export function truthy(d: data.ExpressionData): boolean {
  return !falsy(d);
}

// Similar to the Javascript abstract equality comparison algorithm http://www.ecma-international.org/ecma-262/5.1/#sec-11.9.3.
// Except objects are not coerced to primitives.
export function coerceTypes(
  li: data.ExpressionData,
  ri: data.ExpressionData
): [data.ExpressionData, data.ExpressionData] {
  let lv = li;
  let rv = ri;

  // Do nothing, same kind
  if (li.kind === ri.kind) {
    return [lv, rv];
  }

  switch (li.kind) {
    // Number, String
    case data.Kind.Number:
      if (ri.kind === data.Kind.String) {
        rv = new data.NumberData(ri.number());
        return [lv, rv];
      }

      break;

    // String, Number
    case data.Kind.String:
      if (ri.kind === data.Kind.Number) {
        lv = new data.NumberData(li.number());
        return [lv, rv];
      }

      break;

    // Boolean|Null, Any
    case data.Kind.Null:
    case data.Kind.Boolean:
      lv = new data.NumberData(li.number());
      return coerceTypes(lv, rv);
  }

  // Any, Boolean|Null
  switch (ri.kind) {
    case data.Kind.Null:
    case data.Kind.Boolean:
      rv = new data.NumberData(ri.number());
      return coerceTypes(lv, rv);
  }

  return [lv, rv];
}

// Similar to the Javascript abstract equality comparison algorithm http://www.ecma-international.org/ecma-262/5.1/#sec-11.9.3.
// Except string comparison is OrdinalIgnoreCase, and objects are not coerced to primitives.
export function equals(
  lhs: data.ExpressionData,
  rhs: data.ExpressionData
): boolean {
  let [lv, rv] = coerceTypes(lhs, rhs);

  if (lv.kind != rv.kind) {
    return false;
  }

  switch (lv.kind) {
    // Null, Null
    case data.Kind.Null:
      return true;

    // Number, Number
    case data.Kind.Number:
      const ld = lv.value;
      const rd = (rv as data.NumberData).value;
      if (isNaN(ld) || isNaN(rd)) {
        return false;
      }

      return ld == rd;

    // String, String
    case data.Kind.String:
      const ls = lv.value;
      const rs = (rv as data.StringData).value;
      return toUpperSpecial(ls) === toUpperSpecial(rs);

    // Boolean, Boolean
    case data.Kind.Boolean:
      const lb = lv.value;
      const rb = (rv as data.BooleanData).value;
      return lb == rb;

    // Object, Object
    case data.Kind.Dictionary:
    case data.Kind.Array:
      // Check reference equality
      return lv === rv;
  }

  return false;
}

// Similar to the Javascript abstract equality comparison algorithm http://www.ecma-international.org/ecma-262/5.1/#sec-11.9.3.
// Except string comparison is OrdinalIgnoreCase, and objects are not coerced to primitives.
export function greaterThan(
  lhs: data.ExpressionData,
  rhs: data.ExpressionData
): boolean {
  const [lv, rv] = coerceTypes(lhs, rhs);

  if (lv.kind != rv.kind) {
    return false;
  }

  switch (lv.kind) {
    // Number, Number
    case data.Kind.Number:
      const lf = lv.value;
      const rf = (rv as data.NumberData).value;
      if (isNaN(lf) || isNaN(rf)) {
        return false;
      }

      return lf > rf;

    // String, String
    case data.Kind.String:
      let ls = lv.value;
      let rs = (rv as data.StringData).value;
      ls = toUpperSpecial(ls);
      rs = toUpperSpecial(rs);
      return ls > rs;

    // Boolean, Boolean
    case data.Kind.Boolean:
      const lb = (lv as data.BooleanData).value;
      const rb = (rv as data.BooleanData).value;
      return lb && !rb;
  }

  return false;
}

// Similar to the Javascript abstract equality comparison algorithm http://www.ecma-international.org/ecma-262/5.1/#sec-11.9.3.
// Except string comparison is OrdinalIgnoreCase, and objects are not coerced to primitives.
export function lessThan(
  lhs: data.ExpressionData,
  rhs: data.ExpressionData
): boolean {
  const [lv, rv] = coerceTypes(lhs, rhs);

  if (lv.kind != rv.kind) {
    return false;
  }

  switch (lv.kind) {
    // Number, Number
    case data.Kind.Number:
      const lf = lv.value;
      const rf = (rv as data.NumberData).value;
      if (isNaN(lf) || isNaN(rf)) {
        return false;
      }

      return lf < rf;

    // String, String
    case data.Kind.String:
      let ls = lv.value;
      let rs = (rv as data.StringData).value;
      ls = toUpperSpecial(ls);
      rs = toUpperSpecial(rs);
      return ls < rs;

    // Boolean, Boolean
    case data.Kind.Boolean:
      const lb = lv.value;
      const rb = (rv as data.BooleanData).value;
      return !lb && rb;
  }

  return false;
}

// Do not toUpper the small-dotless-ı
export function toUpperSpecial(s: string): string {
  const sb: string[] = [];
  let i = 0;
  let len = s.length;
  let found = s.indexOf("ı");
  while (i < len) {
    if (i < found) {
      sb.push(s.substring(i, found).toUpperCase()); // Append upper segment
      i = found;
    } else if (i == found) {
      sb.push(s.substring(i, i + 1));
      i += 1;
      found = s.indexOf("ı", i);
    } else {
      sb.push(s.substring(i).toUpperCase()); // Append upper remaining
      break;
    }
  }

  return sb.join("");
}
