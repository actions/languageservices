// Constants for parsing and validating cron expressions

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

export const MINUTE_RANGE = { min: 0, max: 59 }
export const HOUR_RANGE = { min: 0, max: 23 }
export const DOM_RANGE = { min: 1, max: 31 }
export const MONTH_RANGE = { min: 1, max: 12, names: MONTHS }
export const DOW_RANGE = { min: 0, max: 6, names: DAYS }