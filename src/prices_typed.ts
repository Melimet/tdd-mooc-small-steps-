import "./polyfills";
import express from "express";
import { Database, Holiday } from "./database";
import { Temporal } from "@js-temporal/polyfill"

// Refactor the following code to get rid of the legacy Date class.
// Use Temporal.PlainDate instead. See /test/date_conversion.spec.mjs for examples.

function createApp(database: Database) {
  const app = express();

  app.put("/prices", (req, res) => {
    const type = req.query.type as string;
    const cost = parseInt(req.query.cost as string);
    database.setBasePrice(type, cost);
    res.json();
  });

  app.get("/prices", (req, res) => {
    const age = req.query.age ? parseInt(req.query.age as string) : undefined;
    const type = req.query.type as string;
    const baseCost = database.findBasePriceByType(type)!.cost;
    const temporalDate = parseDate(req.query.date as string)
    const cost = calculateCost(age, type, undefined, baseCost, temporalDate);
    res.json({ cost });
  });


  function parseDate(dateString?: string) { return dateString ? Temporal.PlainDate.from(dateString) : undefined }

  function calculateCost(age: number | undefined, type: string, date: Date | undefined, baseCost: number, temporalDate?: Temporal.PlainDate) {
    if (type === "night") {
      return calculateCostForNightTicket(age, baseCost);
    } else {
      return calculateCostForDayTicket(age, date, baseCost, temporalDate);
    }
  }

  function calculateCostForNightTicket(age: number | undefined, baseCost: number) {
    if (age === undefined) {
      return 0;
    }
    if (age < 6) {
      return 0;
    }
    if (age > 64) {
      return Math.ceil(baseCost * 0.4);
    }
    return baseCost;
  }

  function calculateCostForDayTicket(age: number | undefined, date: Date | undefined, baseCost: number, temporalDate?: Temporal.PlainDate) {
    let reduction = calculateReduction(date, temporalDate);
    if (age === undefined) {
      return Math.ceil(baseCost * (1 - reduction / 100));
    }
    if (age < 6) {
      return 0;
    }
    if (age < 15) {
      return Math.ceil(baseCost * 0.7);
    }
    if (age > 64) {
      return Math.ceil(baseCost * 0.75 * (1 - reduction / 100));
    }
    return Math.ceil(baseCost * (1 - reduction / 100));
  }

  function calculateReduction(date: Date | undefined, temporalDate?: Temporal.PlainDate) {
    if ( temporalDate && isMonday(temporalDate) && !isTemporalHoliday(temporalDate)) {
      return 35
    }
    return 0;
  }

  const isMonday = (date: Temporal.PlainDate) => date ? date.dayOfWeek === 1: false;


  const isTemporalHoliday = (date: Temporal.PlainDate): boolean => {
    const holidays: Holiday[]  = database.getHolidays();
    return !!(holidays.find((holiday: Holiday) => {
        const holidate = Temporal.PlainDate.from(holiday.holiday)
        return (Temporal.PlainDate.compare(holidate, date) === 0)
      }
    ));
  }

  function isHoliday(date: Date | undefined) {
    const holidays = database.getHolidays();
    for (let row of holidays) {
      let holiday = new Date(row.holiday);
      if (
        date &&
        date.getFullYear() === holiday.getFullYear() &&
        date.getMonth() === holiday.getMonth() &&
        date.getDate() === holiday.getDate()
      ) {
        return true;
      }
    }
    return false;
  }

  return app;
}

export { createApp };
