const MONTHS = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
}

const DAYS = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
}

// TODO: make this parseCron
export function isValidCron(cron: string): boolean {
  // https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#schedule

  const parts = cron.split(" ")
  if (parts.length != 5) {
    return false
  }

  const [minutes, hours, dom, months, dow] = parts

  return (
    validateRange(minutes, { min: 0, max: 59 }) &&
    validateRange(hours, { min: 0, max: 23 }) &&
    validateRange(dom, { min: 1, max: 31 }) &&
    validateRange(months, { min: 1, max: 12, names: MONTHS }) &&
    validateRange(dow, { min: 0, max: 6, names: DAYS })
  )
}

type Range = {
  min: number
  max: number
  names?: Record<string, number>
}

function validateRange(
  value: string,
  range: Range,
  allowSeparators = true
): boolean {
  if (range.names && range.names[value.toLowerCase()] !== undefined) {
    return true
  }

  if (value === "*") {
    return true
  }

  // Operator precedence: , > / > -
  if (value.includes(",")) {
    if (!allowSeparators) {
      return false
    }
    return value.split(",").every((v) => v && validateRange(v, range))
  }

  if (value.includes("/")) {
    if (!allowSeparators) {
      return false
    }

    const [start, step, ...rest] = value.split("/")
    const stepNumber = +step
    if (rest.length > 0 || isNaN(stepNumber) || stepNumber <= 0 || !start || !step) {
      return false
    }

    // Separators are only allowed in the part before the `/`, e.g. `1-5/2`
    return (
      validateRange(start, range) && validateRange(step, range, false)
    )
  }

  if (value.includes("-")) {
    if (!allowSeparators) {
      return false
    }
    const [start, end, ...rest] = value.split("-")
    if (rest.length > 0 || !start || !end) {
      return false
    }

    // Convert name to integers so we can make sure end >= start
    const startNumber = convertToNumber(range, start)
    const endNumber = convertToNumber(range, end)
    return (
      validateRange(start, range, false) && validateRange(end, range, false) && endNumber >= startNumber
    )
  }

  const number = +value
  return !isNaN(number) && number >= range.min && number <= range.max
}

function convertToNumber(range: Range, value: string): number {
  if (range.names && range.names[value.toLowerCase()] !== undefined) {
    return +range.names[value.toLowerCase()]
  }
  else {
    return +value
  }
}