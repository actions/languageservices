import cronstrue from 'cronstrue';

import {
  MONTH_RANGE,
  HOUR_RANGE,
  MINUTE_RANGE,
  DOM_RANGE,
  DOW_RANGE
} from './cron-constants'

type Range = {
  min: number
  max: number
  names?: Record<string, number>
}

type Schedule = {
  minutes?: number[]
  hours?: number[]
  dom?: number[]
  months?: number[]
  dow?: number[]
}

export function isValidCron(cron: string): boolean {
  // https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#schedule

  const parts = cron.split(/ +/)
  if (parts.length != 5) {
    return false
  }
  const [minutes, hours, dom, months, dow] = parts

  return (
    validateCronPart(minutes, MINUTE_RANGE) &&
    validateCronPart(hours, HOUR_RANGE) &&
    validateCronPart(dom, DOM_RANGE) &&
    validateCronPart(months, MONTH_RANGE) &&
    validateCronPart(dow, DOW_RANGE)
  )
}

export function getCronDescription(cronspec: string): string | undefined {
  const schedule = getSchedule(cronspec)
  if (!schedule) {
    return
  }

  let desc = ''
  try {
    desc = cronstrue.toString(cronspec, {
      dayOfWeekStartIndexZero: true,
      monthStartIndexZero: false,
      use24HourTimeFormat: true,
      // cronstrue sets the description as the error if throwExceptionOnParseError is false
      // so we need to distinguish between an error and a valid description
      throwExceptionOnParseError: true,
    })
  } catch (err) {
    return
  }

  // Make first character lowercase
  let result = "Runs " + desc.charAt(0).toLowerCase() + desc.slice(1)
  result += "\n\nActions schedules run at most every 5 minutes." +
    " [Learn more](https://docs.github.com/actions/using-workflows/workflow-syntax-for-github-actions#onschedule)";
  return result
}

function parseCronPart(part: string, range: Range): number[] | undefined {
  const values: number[] = []

  if (part === "*") {
    return undefined
  }

  if (part.includes(",")) {
    part.split(",").forEach((v) => {
      const value = parseCronPart(v, range)
      if (value) {
        values.push(...value)
      }
    })
  }

  if (part.includes("/")) {
    const [stepRange, step] = part.split("/")
    const stepNumber = +step
    let startNumber, endNumber
    if (stepRange.includes("-")) {
      const [start, end] = stepRange.split("-")
      startNumber = convertToNumber(start, range.names)
      endNumber = convertToNumber(end, range.names)
    }
    else {
      if (stepRange === "*") {
        startNumber = range.min
      }
      else {
        startNumber = convertToNumber(stepRange, range.names)
      }
      endNumber = range.max
    }
    for (let i = startNumber; i <= endNumber; i += stepNumber) {
      values.push(i)
    }
  }

  if (part.includes("-")) {
    const [start, end] = part.split("-")
    const startNumber = convertToNumber(start, range.names)
    const endNumber = convertToNumber(end, range.names)
    for (let i = startNumber; i <= endNumber; i++) {
      values.push(i)
    }
  }

  const number = convertToNumber(part, range.names)
  if (!isNaN(number)) {
    values.push(number)
  }

  return values.sort((a, b) => a - b)
}

function validateCronPart(
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
    return value.split(",").every((v) => v && validateCronPart(v, range))
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
      validateCronPart(start, range) && validateCronPart(step, range, false)
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
    const startNumber = convertToNumber(start, range.names)
    const endNumber = convertToNumber(end, range.names)
    return (
      validateCronPart(start, range, false) && validateCronPart(end, range, false) && endNumber >= startNumber
    )
  }

  const number = +value
  return !isNaN(number) && number >= range.min && number <= range.max
}

export function getSchedule(cron: string): Schedule | undefined {
  if (!isValidCron(cron)) {
    return
  }

  const [minutes, hours, dom, months, dow] = cron.split(/ +/)
  return {
    minutes: parseCronPart(minutes, MINUTE_RANGE),
    hours: parseCronPart(hours, HOUR_RANGE),
    dom: parseCronPart(dom, DOM_RANGE),
    months: parseCronPart(months, MONTH_RANGE),
    dow: parseCronPart(dow, DOW_RANGE)
  }
}

// Converts a string integer or a short name to a number
function convertToNumber(value: string, names?: Record<string, number>): number {
  if (names && names[value.toLowerCase()] !== undefined) {
    return +names[value.toLowerCase()]
  }
  else {
    return +value
  }
}