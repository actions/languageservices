import { isValidCron } from "./cron"

describe("isValidCron", () => {
  const valid = [
    "0 0 * * *",
    "0 000 001 * *",
    "15 * * * *",
    "2,10 4,5 * * *",
    "30 4-6 * * *",
    "20/15 * * * *",
    "30 5,17 * * *",
    "30 5 * * 1,3",
    "30 5 * * 2,4",
    "28 */4 * * *",
    "28 5,*/4 * * *",
    "28 5,*/4,6 * * *",
    "28 5,*/4,6-8 * * *",
    "0 0 * * SUN",
    "0 0 * * SUN-TUE",
    "0 0 * * SUN-2",
    "0 * * */FEB */TUE",
    "0 2-4/5 * * *",
  ]

  for (const cron of valid) {
    it(`${cron} should be valid`, () => {
      expect(isValidCron(cron)).toBe(true)
    })
  }

  const invalid = [
    "0 0 * *",
    "0 0 * * * * *",
    "0 -1 * * *",
    "0 1- * * *",
    "0 /1 * * *",
    "0 1/ * * *",
    "0 ,1 * * *",
    "0 1, * * *",
    "0 5--5 * * *",
    "0 *//5 * * *",
    "0 ,, * * *",
    "0 ** * * *",
    "0 0 * * BUN",
    "0 0 * SUN JAN",
    "0 0 * * FRI-TUE",
    "0 12-4 * * *",
    "0 */0 * * *",
    "0 2/4-5 * * *",
    "0 2-4-6 * * *",
    "0 2/4/6 * * *",
    "0 2/4/6 * * *",
  ]

  for (const cron of invalid) {
    it(`${cron} should be invalid`, () => {
      expect(isValidCron(cron)).toBe(false)
    })
  }
})