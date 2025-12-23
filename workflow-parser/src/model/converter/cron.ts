import cronstrue from "cronstrue";

import {MONTH_RANGE, HOUR_RANGE, MINUTE_RANGE, DOM_RANGE, DOW_RANGE} from "./cron-constants.js";

type Range = {
  min: number;
  max: number;
  names?: Record<string, number>;
};

/**
 * Checks if a cron expression specifies an interval shorter than 5 minutes.
 * GitHub Actions schedules run at most every 5 minutes, so intervals < 5 min won't work as expected.
 */
export function hasCronIntervalLessThan5Minutes(cron: string): boolean {
  if (!isValidCron(cron)) {
    return false;
  }

  const parts = cron.split(/ +/);
  const minutePart = parts[0];

  // Parse the minute field to determine the effective interval
  return getMinuteInterval(minutePart) < 5;
}

/**
 * Gets the minimum interval in minutes between cron executions based on the minute field.
 * Returns 60 if there's only one execution per hour, otherwise returns the minimum gap.
 */
function getMinuteInterval(minutePart: string): number {
  // Handle step expressions like */1, */3, 0-59/2
  if (minutePart.includes("/")) {
    const [, step] = minutePart.split("/");
    const stepNum = parseInt(step, 10);
    if (!isNaN(stepNum) && stepNum > 0) {
      return stepNum;
    }
  }

  // Handle comma-separated values like 0,2,4 or 0,1,5,10
  if (minutePart.includes(",")) {
    const values = minutePart
      .split(",")
      .map(v => parseInt(v, 10))
      .filter(n => !isNaN(n))
      .sort((a, b) => a - b);
    if (values.length >= 2) {
      let minGap = 60;
      for (let i = 1; i < values.length; i++) {
        const gap = values[i] - values[i - 1];
        if (gap < minGap) {
          minGap = gap;
        }
      }
      // Check wrap-around gap from last minute to first minute of next hour
      const wrapGap = values[0] + 60 - values[values.length - 1];
      if (wrapGap < minGap) {
        minGap = wrapGap;
      }
      return minGap;
    }
  }

  // Handle range expressions like 0-4 (runs every minute from 0-4)
  if (minutePart.includes("-") && !minutePart.includes("/")) {
    const [start, end] = minutePart.split("-").map(v => parseInt(v, 10));
    if (!isNaN(start) && !isNaN(end) && end > start) {
      // A range without step means every minute in that range
      return 1;
    }
  }

  // * means every minute
  if (minutePart === "*") {
    return 1;
  }

  // Single value or unrecognized pattern - assume hourly (60 min interval)
  return 60;
}

export function isValidCron(cron: string): boolean {
  // https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#schedule

  const parts = cron.split(/ +/);
  if (parts.length != 5) {
    return false;
  }
  const [minutes, hours, dom, months, dow] = parts;

  return (
    validateCronPart(minutes, MINUTE_RANGE) &&
    validateCronPart(hours, HOUR_RANGE) &&
    validateCronPart(dom, DOM_RANGE) &&
    validateCronPart(months, MONTH_RANGE) &&
    validateCronPart(dow, DOW_RANGE)
  );
}

export function getCronDescription(cronspec: string): string | undefined {
  if (!isValidCron(cronspec)) {
    return;
  }

  let desc = "";
  try {
    desc = cronstrue.toString(cronspec, {
      dayOfWeekStartIndexZero: true,
      monthStartIndexZero: false,
      use24HourTimeFormat: true,
      // cronstrue sets the description as the error if throwExceptionOnParseError is false
      // so we need to distinguish between an error and a valid description
      throwExceptionOnParseError: true
    });
  } catch (err) {
    return;
  }

  // Make first character lowercase
  return "Runs " + desc.charAt(0).toLowerCase() + desc.slice(1);
}

function validateCronPart(value: string, range: Range, allowSeparators = true): boolean {
  if (range.names && range.names[value.toLowerCase()] !== undefined) {
    return true;
  }

  if (value === "*") {
    return true;
  }

  // Operator precedence: , > / > -
  if (value.includes(",")) {
    if (!allowSeparators) {
      return false;
    }
    return value.split(",").every(v => v && validateCronPart(v, range));
  }

  if (value.includes("/")) {
    if (!allowSeparators) {
      return false;
    }

    const [start, step, ...rest] = value.split("/");
    const stepNumber = +step;
    if (rest.length > 0 || isNaN(stepNumber) || stepNumber <= 0 || !start || !step) {
      return false;
    }

    // Separators are only allowed in the part before the `/`, e.g. `1-5/2`
    return validateCronPart(start, range) && validateCronPart(step, range, false);
  }

  if (value.includes("-")) {
    if (!allowSeparators) {
      return false;
    }

    const [start, end, ...rest] = value.split("-");
    if (rest.length > 0 || !start || !end) {
      return false;
    }

    // Convert name to integers so we can make sure end >= start
    const startNumber = convertToNumber(start, range.names);
    const endNumber = convertToNumber(end, range.names);
    return validateCronPart(start, range, false) && validateCronPart(end, range, false) && endNumber >= startNumber;
  }

  const number = +value;
  return !isNaN(number) && number >= range.min && number <= range.max;
}

// Converts a string integer or a short name to a number
function convertToNumber(value: string, names?: Record<string, number>): number {
  if (names && names[value.toLowerCase()] !== undefined) {
    return +names[value.toLowerCase()];
  } else {
    return +value;
  }
}
