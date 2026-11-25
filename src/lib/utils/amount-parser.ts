type Token =
  | { type: "number"; value: number }
  | { type: "op"; value: "+" | "-" | "*" | "/" | "(" | ")" };

function tokenizeArithmeticExpression(expression: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < expression.length) {
    const ch = expression[i];
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }

    if (ch === "+" || ch === "-" || ch === "*" || ch === "/" || ch === "(" || ch === ")") {
      tokens.push({ type: "op", value: ch });
      i += 1;
      continue;
    }

    if (/[0-9.]/.test(ch)) {
      let end = i;
      let dotCount = 0;
      let digitCount = 0;
      while (end < expression.length && /[0-9.]/.test(expression[end])) {
        if (expression[end] === ".") {
          dotCount += 1;
          if (dotCount > 1) throw new Error("Invalid number");
        } else {
          digitCount += 1;
        }
        end += 1;
      }
      if (digitCount === 0) throw new Error("Invalid number");
      const num = Number(expression.slice(i, end));
      if (!Number.isFinite(num)) throw new Error("Invalid number");
      tokens.push({ type: "number", value: num });
      i = end;
      continue;
    }

    throw new Error("Unexpected character");
  }

  return tokens;
}

function evaluateArithmeticExpression(expression: string): number {
  const tokens = tokenizeArithmeticExpression(expression);
  if (tokens.length === 0) throw new Error("Empty expression");

  let pos = 0;

  function peek(): Token | undefined {
    return tokens[pos];
  }

  function consume(): Token {
    const token = tokens[pos];
    pos += 1;
    return token;
  }

  function parseExpression(): number {
    let value = parseTerm();
    while (true) {
      const next = peek();
      if (next?.type === "op" && (next.value === "+" || next.value === "-")) {
        consume();
        const rhs = parseTerm();
        value = next.value === "+" ? value + rhs : value - rhs;
      } else {
        break;
      }
    }
    return value;
  }

  function parseTerm(): number {
    let value = parseUnary();
    while (true) {
      const next = peek();
      if (next?.type === "op" && (next.value === "*" || next.value === "/")) {
        consume();
        const rhs = parseUnary();
        if (next.value === "/") {
          if (rhs === 0) throw new Error("Division by zero");
          value /= rhs;
        } else {
          value *= rhs;
        }
      } else {
        break;
      }
    }
    return value;
  }

  function parseUnary(): number {
    const next = peek();
    if (next?.type === "op" && (next.value === "+" || next.value === "-")) {
      consume();
      const inner = parseUnary();
      return next.value === "-" ? -inner : inner;
    }
    return parsePrimary();
  }

  function parsePrimary(): number {
    const token = peek();
    if (!token) throw new Error("Unexpected end of expression");

    if (token.type === "number") {
      consume();
      return token.value;
    }

    if (token.type === "op" && token.value === "(") {
      consume();
      const inner = parseExpression();
      const closing = consume();
      if (closing?.type !== "op" || closing.value !== ")") {
        throw new Error("Mismatched parentheses");
      }
      return inner;
    }

    throw new Error("Unexpected token");
  }

  const result = parseExpression();
  if (pos !== tokens.length || !Number.isFinite(result)) {
    throw new Error("Invalid expression");
  }
  return result;
}

/**
 * Parses a numeric cost input or spreadsheet-style formula (e.g. `=120+45*2`)
 * without dynamic code evaluation.
 */
export function parseAmountInput(
  value: string,
  messages: { invalidCharacters: string; invalidFormula: string },
) {
  const trimmed = value.trim();
  if (!trimmed) {
    return { value: null as number | null, isValid: false, isFormula: false, message: "" };
  }

  const expression = trimmed.startsWith("=") ? trimmed.slice(1).trim() : trimmed;
  const isFormula = trimmed.startsWith("=") || /[+\-*/()]/.test(expression);

  if (!expression) {
    return { value: null as number | null, isValid: false, isFormula: false, message: "" };
  }

  const numericPattern = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?$/;
  if (numericPattern.test(expression)) {
    const numericValue = Number(expression);
    return {
      value: Number.isFinite(numericValue) ? numericValue : null,
      isValid: Number.isFinite(numericValue),
      isFormula: false,
      message: "",
    };
  }

  if (!/^[0-9+\-*/().\s]+$/.test(expression)) {
    return {
      value: null as number | null,
      isValid: false,
      isFormula: true,
      message: messages.invalidCharacters,
    };
  }

  try {
    const result = evaluateArithmeticExpression(expression);
    return { value: result, isValid: true, isFormula, message: "" };
  } catch {
    return {
      value: null as number | null,
      isValid: false,
      isFormula: true,
      message: messages.invalidFormula,
    };
  }
}
