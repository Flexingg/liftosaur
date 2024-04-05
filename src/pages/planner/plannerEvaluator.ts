import { IPlannerProgram, ISettings, IDayData } from "../../types";
import { parser as plannerExerciseParser } from "./plannerExerciseParser";
import {
  IPlannerEvalFullResult,
  IPlannerEvalResult,
  PlannerExerciseEvaluator,
  PlannerSyntaxError,
} from "./plannerExerciseEvaluator";
import {
  IPlannerProgramExercise,
  IPlannerProgramExerciseDescription,
  IPlannerProgramProperty,
  IPlannerProgramExerciseWarmupSet,
} from "./models/types";
import { PlannerKey } from "./plannerKey";
import { ObjectUtils } from "../../utils/object";
import { Weight } from "../../models/weight";
import { PlannerProgram } from "./models/plannerProgram";
import { PP } from "../../models/pp";

export type IByExercise<T> = Record<string, T>;
export type IByExerciseWeekDay<T> = Record<string, Record<number, Record<number, T>>>;
export type IByWeekDayExercise<T> = Record<number, Record<number, Record<string, T>>>;

interface IPlannerEvalMetadata {
  byExerciseWeekDay: IByExerciseWeekDay<IPlannerProgramExercise>;
  byWeekDayExercise: IByWeekDayExercise<IPlannerProgramExercise>;
  fullNames: Set<string>;
  notused: Set<string>;
  skipProgresses: IByExercise<IPlannerProgramExercise["skipProgress"]>;
  properties: {
    progress: IByExercise<{ property: IPlannerProgramProperty; dayData: Required<IDayData> }>;
    update: IByExercise<{ property: IPlannerProgramProperty; dayData: Required<IDayData> }>;
    warmup: IByExercise<{ warmupSets: IPlannerProgramExerciseWarmupSet[]; dayData: Required<IDayData> }>;
  };
}

export class PlannerEvaluator {
  private static fillInMetadata(
    exercise: IPlannerProgramExercise,
    metadata: IPlannerEvalMetadata,
    weekIndex: number,
    dayIndex: number,
    dayInWeekIndex: number
  ): void {
    if (metadata.byWeekDayExercise[weekIndex]?.[dayInWeekIndex]?.[exercise.key] != null) {
      throw PlannerSyntaxError.fromPoint(
        `Exercise ${exercise.key} is already used in this day. Combine them together, or add a label to separate out.`,
        exercise.points.fullName
      );
    }
    for (const propertyName of ["progress", "update"] as const) {
      const property = exercise.properties.find((p) => p.name === propertyName);
      if (property != null) {
        const existingProperty = metadata.properties[propertyName][exercise.key];
        if (
          existingProperty != null &&
          property.fnName !== "none" &&
          !PlannerExerciseEvaluator.isEqualProperty(property, existingProperty.property)
        ) {
          throw PlannerSyntaxError.fromPoint(
            `Same property '${propertyName}' is specified with different arguments in multiple weeks/days for exercise '${exercise.name}': both in ` +
              `week ${existingProperty.dayData.week + 1}, day ${existingProperty.dayData.dayInWeek + 1} ` +
              `and week ${weekIndex + 1}, day ${dayInWeekIndex + 1}`,
            (propertyName === "progress" ? exercise.points.progressPoint : exercise.points.updatePoint) ||
              exercise.points.fullName
          );
        }
        if (propertyName === "progress" && property.fnName === "none") {
          metadata.skipProgresses[exercise.key] = metadata.skipProgresses[exercise.key] || [];
          metadata.skipProgresses[exercise.key].push({ week: weekIndex + 1, day: dayInWeekIndex + 1 });
        } else {
          metadata.properties[propertyName][exercise.key] = {
            property: property,
            dayData: { week: weekIndex, dayInWeek: dayInWeekIndex, day: dayIndex },
          };
        }
      }
    }
    if (exercise.notused) {
      metadata.notused.add(exercise.key);
    }
    if (exercise.warmupSets != null) {
      const scheme = JSON.stringify(exercise.warmupSets);
      const ws = metadata.properties.warmup[exercise.key];
      if (ws != null && JSON.stringify(ws.warmupSets) !== scheme) {
        throw PlannerSyntaxError.fromPoint(
          `Different warmup sets are specified in multiple weeks/days for exercise '${exercise.name}': both in ` +
            `week ${ws.dayData.week + 1}, day ${ws.dayData.dayInWeek + 1} ` +
            `and week ${weekIndex + 1}, day ${dayInWeekIndex + 1}`,
          exercise.points.warmupPoint || exercise.points.fullName
        );
      }
      metadata.properties.warmup[exercise.key] = {
        warmupSets: exercise.warmupSets,
        dayData: { week: weekIndex, dayInWeek: dayInWeekIndex, day: dayIndex },
      };
    }
    this.setByWeekDayExercise(metadata.byWeekDayExercise, exercise.key, weekIndex, dayInWeekIndex, exercise);
    this.setByExerciseWeekDay(metadata.byExerciseWeekDay, exercise.key, weekIndex, dayInWeekIndex, exercise);
    metadata.fullNames.add(exercise.fullName);
  }

  private static getPerDayEvaluatedWeeks(
    plannerProgram: IPlannerProgram,
    settings: ISettings
  ): {
    evaluatedWeeks: IPlannerEvalResult[][];
    metadata: IPlannerEvalMetadata;
  } {
    let dayIndex = 0;
    const metadata: IPlannerEvalMetadata = {
      byExerciseWeekDay: {},
      byWeekDayExercise: {},
      fullNames: new Set(),
      notused: new Set(),
      skipProgresses: {},
      properties: { progress: {}, update: {}, warmup: {} },
    };
    const evaluatedWeeks: IPlannerEvalResult[][] = plannerProgram.weeks.map((week, weekIndex) => {
      return week.days.map((day, dayInWeekIndex) => {
        const tree = plannerExerciseParser.parse(day.exerciseText);
        const evaluator = new PlannerExerciseEvaluator(day.exerciseText, settings, "perday", {
          day: dayIndex + 1,
          dayInWeek: dayInWeekIndex + 1,
          week: weekIndex + 1,
        });
        const result = evaluator.evaluate(tree.topNode);
        dayIndex += 1;
        if (result.success) {
          const exercises = result.data[0]?.days[0]?.exercises || [];
          for (const exercise of exercises) {
            try {
              this.fillInMetadata(exercise, metadata, weekIndex, dayIndex, dayInWeekIndex);
            } catch (e) {
              if (e instanceof PlannerSyntaxError) {
                return { success: false, error: e };
              } else {
                throw e;
              }
            }
          }
          return { success: true, data: exercises };
        } else {
          return result;
        }
      });
    });
    return { evaluatedWeeks, metadata };
  }

  private static getFullEvaluatedWeeks(
    fullProgramText: string,
    settings: ISettings
  ): {
    evaluatedWeeks: IPlannerEvalFullResult;
    metadata: IPlannerEvalMetadata;
  } {
    let dayIndex = 0;
    const metadata: IPlannerEvalMetadata = {
      byExerciseWeekDay: {},
      byWeekDayExercise: {},
      fullNames: new Set(),
      notused: new Set(),
      skipProgresses: {},
      properties: { progress: {}, update: {}, warmup: {} },
    };
    const evaluator = new PlannerExerciseEvaluator(fullProgramText, settings, "full");
    const tree = plannerExerciseParser.parse(fullProgramText);
    const result = evaluator.evaluate(tree.topNode);
    if (result.success) {
      try {
        for (let weekIndex = 0; weekIndex < result.data.length; weekIndex += 1) {
          const week = result.data[weekIndex];
          for (let dayInWeekIndex = 0; dayInWeekIndex < week.days.length; dayInWeekIndex += 1) {
            const day = week.days[dayInWeekIndex];
            const exercises = day.exercises;
            for (const exercise of exercises) {
              this.fillInMetadata(exercise, metadata, weekIndex, dayIndex, dayInWeekIndex);
            }
            dayIndex += 1;
          }
        }
      } catch (e) {
        if (e instanceof PlannerSyntaxError) {
          return { evaluatedWeeks: { success: false, error: e }, metadata };
        } else {
          throw e;
        }
      }
      return { evaluatedWeeks: result, metadata };
    } else {
      return { evaluatedWeeks: result, metadata };
    }
  }

  private static fillRepeats(
    exercise: IPlannerProgramExercise,
    evaluatedWeeks: IPlannerEvalResult[][],
    dayIndex: number,
    byExerciseWeekDay: IByExerciseWeekDay<IPlannerProgramExercise>
  ): void {
    for (const repeatWeek of exercise.repeat ?? []) {
      const repeatWeekIndex = repeatWeek - 1;
      if (byExerciseWeekDay[exercise.key]?.[repeatWeekIndex]?.[dayIndex] == null) {
        const repeatedExercise: IPlannerProgramExercise = {
          ...ObjectUtils.clone(exercise),
          repeat: [],
          isRepeat: true,
        };
        this.setByExerciseWeekDay(byExerciseWeekDay, exercise.key, repeatWeekIndex, dayIndex, repeatedExercise);
        const day = evaluatedWeeks[repeatWeekIndex]?.[dayIndex];
        if (day?.success) {
          day.data.push(repeatedExercise);
        }
      }
    }
  }

  private static fillSetReuses(
    exercise: IPlannerProgramExercise,
    evaluatedWeeks: IPlannerEvalResult[][],
    weekIndex: number,
    settings: ISettings
  ): void {
    if (exercise.reuse && exercise.points.reuseSetPoint) {
      const reuse = exercise.reuse;
      const originalExercises = this.findOriginalExercisesAtWeekDay(
        settings,
        reuse.fullName,
        evaluatedWeeks,
        reuse.week ?? weekIndex + 1 ?? 1,
        reuse.day
      );
      if (originalExercises.length > 1) {
        throw PlannerSyntaxError.fromPoint(
          `There're several exercises matching, please be more specific with [week:day] syntax`,
          exercise.points.reuseSetPoint
        );
      }
      const originalExercise = originalExercises[0];
      if (!originalExercise) {
        throw PlannerSyntaxError.fromPoint(
          `No such exercise ${reuse.fullName} at week: ${reuse.week ?? weekIndex + 1}${
            reuse.day != null ? `, day: ${reuse.day}` : ""
          }`,
          exercise.points.reuseSetPoint
        );
      }
      if (originalExercise.exercise.reuse?.fullName != null) {
        throw PlannerSyntaxError.fromPoint(
          `Original exercise cannot reuse another exercise's sets x reps`,
          exercise.points.reuseSetPoint
        );
      }
      if (originalExercise.exercise.setVariations.length > 1) {
        throw PlannerSyntaxError.fromPoint(
          `Original exercise cannot have mutliple set variations`,
          exercise.points.reuseSetPoint
        );
      }
      exercise.reuse.exercise = originalExercise.exercise;
      exercise.reuse.exerciseWeek = originalExercise.dayData.week;
      exercise.reuse.exerciseDayInWeek = originalExercise.dayData.dayInWeek;
      exercise.reuse.exerciseDay = originalExercise.dayData.day;
    }
  }

  private static fillDescriptions(
    exercise: IPlannerProgramExercise,
    evaluatedWeeks: IPlannerEvalResult[][],
    weekIndex: number,
    dayIndex: number
  ): void {
    if (exercise.descriptions == null || exercise.descriptions.length === 0) {
      const lastWeekExercise = this.findLastWeekExercise(
        evaluatedWeeks,
        weekIndex,
        dayIndex,
        exercise,
        (ex) => ex.descriptions != null
      );
      exercise.descriptions = lastWeekExercise?.descriptions || [];
    }
  }

  private static fillDescriptionReuses(
    exercise: IPlannerProgramExercise,
    weekIndex: number,
    byExerciseWeekDay: IByExerciseWeekDay<IPlannerProgramExercise>,
    settings: ISettings
  ): void {
    if (
      exercise.descriptions != null &&
      exercise.descriptions.length === 1 &&
      exercise.descriptions[0].value?.startsWith("...")
    ) {
      const reusingName = exercise.descriptions[0].value.slice(3).trim();
      const descriptions = this.findReusedDescriptions(reusingName, weekIndex, byExerciseWeekDay, settings);
      if (descriptions != null) {
        exercise.descriptions = descriptions;
      }
    }
  }

  private static fillSingleProperties(exercise: IPlannerProgramExercise, metadata: IPlannerEvalMetadata): void {
    if (metadata.notused.has(exercise.key)) {
      exercise.notused = true;
    }

    if (metadata.skipProgresses[exercise.key] != null) {
      exercise.skipProgress = metadata.skipProgresses[exercise.key];
    }

    if (metadata.properties.progress[exercise.key] != null && exercise.properties.every((p) => p.name !== "progress")) {
      exercise.properties.push(metadata.properties.progress[exercise.key].property);
    }

    if (metadata.properties.update[exercise.key] != null && exercise.properties.every((p) => p.name !== "update")) {
      exercise.properties.push(metadata.properties.update[exercise.key].property);
    }

    if (metadata.properties.warmup[exercise.key] != null) {
      exercise.warmupSets = metadata.properties.warmup[exercise.key].warmupSets;
    }
  }

  private static fillProgressReuses(
    exercise: IPlannerProgramExercise,
    settings: ISettings,
    metadata: IPlannerEvalMetadata
  ): void {
    const progress = exercise.properties.find((p) => p.name === "progress");
    if (progress?.fnName === "custom") {
      if (progress.body) {
        const key = PlannerKey.fromFullName(progress.body, settings);
        const point = exercise.points.progressPoint || exercise.points.fullName;
        if (!metadata.byExerciseWeekDay[key] == null) {
          throw PlannerSyntaxError.fromPoint(`No such exercise ${progress.body}`, point);
        }
        const originalProgress = metadata.properties.progress[key]?.property;
        if (!originalProgress) {
          throw PlannerSyntaxError.fromPoint("Original exercise should specify progress", point);
        }
        if (originalProgress.body != null) {
          throw PlannerSyntaxError.fromPoint(`Original exercise cannot reuse another progress`, point);
        }
        if (originalProgress.fnName !== "custom") {
          throw PlannerSyntaxError.fromPoint("Original exercise should specify custom progress", point);
        }
        const fnArgs = progress.fnArgs;
        const originalState = PlannerExerciseEvaluator.fnArgsToStateVars(originalProgress.fnArgs);
        const state = PlannerExerciseEvaluator.fnArgsToStateVars(fnArgs);
        for (const stateKey of ObjectUtils.keys(originalState)) {
          const value = originalState[stateKey];
          if (state[stateKey] == null) {
            throw PlannerSyntaxError.fromPoint(`Missing state variable ${stateKey}`, point);
          }
          if (Weight.type(value) !== Weight.type(state[stateKey])) {
            throw PlannerSyntaxError.fromPoint(`Wrong type of state variable ${stateKey}`, point);
          }
        }
        progress.reuse = originalProgress;
      }
    }
  }

  private static fillUpdateReuses(
    exercise: IPlannerProgramExercise,
    settings: ISettings,
    metadata: IPlannerEvalMetadata
  ): void {
    const update = exercise.properties.find((p) => p.name === "update");
    if (update?.fnName === "custom") {
      if (update.body) {
        const key = PlannerKey.fromFullName(update.body, settings);
        const point = exercise.points.updatePoint || exercise.points.fullName;

        if (!metadata.byExerciseWeekDay[key] == null) {
          throw PlannerSyntaxError.fromPoint(`No such exercise ${update.body}`, point);
        }
        const originalUpdate = metadata.properties.update[key]?.property;
        if (!originalUpdate) {
          throw PlannerSyntaxError.fromPoint("Original exercise should specify update", point);
        }
        if (originalUpdate.body != null) {
          throw PlannerSyntaxError.fromPoint(`Original exercise cannot reuse another update`, point);
        }
        if (originalUpdate.fnName !== "custom") {
          throw PlannerSyntaxError.fromPoint("Original exercise should specify custom update", point);
        }
        update.reuse = originalUpdate;
      }
    }
  }

  public static postProcess(
    evaluatedWeeks: IPlannerEvalResult[][],
    settings: ISettings,
    metadata: IPlannerEvalMetadata
  ): void {
    this.iterateOverExercises(evaluatedWeeks, (weekIndex, dayIndex, exerciseIndex, exercise) => {
      this.fillDescriptions(exercise, evaluatedWeeks, weekIndex, dayIndex);
      this.fillRepeats(exercise, evaluatedWeeks, dayIndex, metadata.byExerciseWeekDay);
      this.fillSingleProperties(exercise, metadata);
    });

    this.iterateOverExercises(evaluatedWeeks, (weekIndex, dayIndex, exerciseIndex, exercise) => {
      this.fillSetReuses(exercise, evaluatedWeeks, weekIndex, settings);
      this.fillDescriptionReuses(exercise, weekIndex, metadata.byExerciseWeekDay, settings);
      this.fillProgressReuses(exercise, settings, metadata);
      this.fillUpdateReuses(exercise, settings, metadata);
    });
  }

  public static findReusedDescriptions(
    reusingName: string,
    currentWeekIndex: number,
    byExerciseWeekDay: IByExerciseWeekDay<IPlannerProgramExercise>,
    settings: ISettings
  ): IPlannerProgramExerciseDescription[] | undefined {
    const weekDayMatch = reusingName.match(/\[([^]+)\]/);
    let weekIndex: number | undefined;
    let dayIndex: number | undefined;
    if (weekDayMatch != null) {
      const [dayOrWeekStr, dayStr] = weekDayMatch[1].split(":");
      if (dayStr != null) {
        weekIndex = parseInt(dayOrWeekStr, 10);
        weekIndex = isNaN(weekIndex) ? undefined : weekIndex - 1;
        dayIndex = parseInt(dayStr, 10);
        dayIndex = isNaN(dayIndex) ? undefined : dayIndex - 1;
      } else {
        dayIndex = parseInt(dayOrWeekStr, 10);
        dayIndex = isNaN(dayIndex) ? undefined : dayIndex - 1;
      }
    }
    reusingName = reusingName.replace(/\[([^]+)\]/, "").trim();
    const key = PlannerKey.fromFullName(reusingName, settings);
    const weekExercises = ObjectUtils.values(byExerciseWeekDay[key]?.[weekIndex ?? currentWeekIndex] || []);
    const weekDescriptions = weekExercises.map((d) => d.descriptions);
    if (dayIndex != null) {
      return weekDescriptions[dayIndex];
    } else {
      return weekDescriptions[0];
    }
  }

  public static findOriginalExercisesAtWeekDay(
    settings: ISettings,
    fullName: string,
    program: IPlannerEvalResult[][],
    atWeek: number,
    atDay?: number
  ): { exercise: IPlannerProgramExercise; dayData: Required<IDayData> }[] {
    const originalExercises: { exercise: IPlannerProgramExercise; dayData: Required<IDayData> }[] = [];
    PP.iterate(program, (exercise, weekIndex, dayInWeekIndex, dayIndex, exerciseIndex) => {
      if (weekIndex === atWeek - 1 && (atDay == null || atDay === dayInWeekIndex + 1)) {
        const reusingKey = PlannerKey.fromPlannerExercise(exercise, settings);
        const originalKey = PlannerKey.fromFullName(fullName, settings);
        if (reusingKey === originalKey) {
          originalExercises.push({
            exercise,
            dayData: {
              week: atWeek,
              dayInWeek: dayInWeekIndex + 1,
              day: dayIndex + 1,
            },
          });
        }
      }
    });
    return originalExercises;
  }

  public static evaluate(
    plannerProgram: IPlannerProgram,
    settings: ISettings
  ): { evaluatedWeeks: IPlannerEvalResult[][]; exerciseFullNames: string[] } {
    const { evaluatedWeeks, metadata } = this.getPerDayEvaluatedWeeks(plannerProgram, settings);
    this.postProcess(evaluatedWeeks, settings, metadata);
    return { evaluatedWeeks, exerciseFullNames: Array.from(metadata.fullNames) };
  }

  public static evaluateFull(
    fullProgramText: string,
    settings: ISettings
  ): { evaluatedWeeks: IPlannerEvalFullResult; exerciseFullNames: string[] } {
    const { evaluatedWeeks, metadata } = this.getFullEvaluatedWeeks(fullProgramText, settings);
    if (evaluatedWeeks.success) {
      const perDayEvaluatedWeeks = PlannerProgram.fullToWeekEvalResult(evaluatedWeeks);
      this.postProcess(perDayEvaluatedWeeks, settings, metadata);
      for (const week of perDayEvaluatedWeeks) {
        for (const day of week) {
          if (!day.success) {
            return {
              evaluatedWeeks: { success: false, error: day.error },
              exerciseFullNames: Array.from(metadata.fullNames),
            };
          }
        }
      }
    }
    return { evaluatedWeeks, exerciseFullNames: Array.from(metadata.fullNames) };
  }

  private static findLastWeekExercise(
    program: IPlannerEvalResult[][],
    weekIndex: number,
    dayIndex: number,
    exercise: IPlannerProgramExercise,
    cond?: (ex: IPlannerProgramExercise) => boolean
  ): IPlannerProgramExercise | undefined {
    for (
      let i = weekIndex - 1, lastWeekDay = program[i]?.[dayIndex];
      i >= 0 && lastWeekDay != null;
      i -= 1, lastWeekDay = program[i]?.[dayIndex]
    ) {
      if (lastWeekDay.success) {
        const lastWeekExercise = lastWeekDay.data.find((ex) => ex.key === exercise.key);
        if (lastWeekExercise != null && (cond == null || cond(lastWeekExercise))) {
          return lastWeekExercise;
        }
      }
    }
    return undefined;
  }

  private static setByExerciseWeekDay<T, U extends Record<string, Record<number, Record<number, T>>>>(
    coll: U,
    exercise: string,
    weekIndex: number,
    dayIndex: number,
    val: T
  ): void {
    coll[exercise as keyof U] = coll[exercise as keyof U] || {};
    coll[exercise as keyof U][weekIndex] = coll[exercise as keyof U][weekIndex] || {};
    coll[exercise as keyof U][weekIndex][dayIndex] = val;
  }

  private static setByWeekDayExercise<T, U extends Record<number, Record<number, Record<string, T>>>>(
    coll: U,
    exercise: string,
    weekIndex: number,
    dayIndex: number,
    val: T
  ): void {
    coll[weekIndex] = coll[weekIndex] || {};
    coll[weekIndex][dayIndex] = coll[weekIndex][dayIndex] || {};
    coll[weekIndex][dayIndex][exercise] = val;
  }

  private static iterateOverExercises(
    program: IPlannerEvalResult[][],
    cb: (weekIndex: number, dayIndex: number, exerciseIndex: number, exercise: IPlannerProgramExercise) => void
  ): void {
    for (let weekIndex = 0; weekIndex < program.length; weekIndex += 1) {
      const week = program[weekIndex];
      for (let dayIndex = 0; dayIndex < week.length; dayIndex += 1) {
        const day = week[dayIndex];
        try {
          if (day?.success) {
            const exercises = day.data;
            for (let exerciseIndex = 0; exerciseIndex < exercises.length; exerciseIndex += 1) {
              cb(weekIndex, dayIndex, exerciseIndex, exercises[exerciseIndex]);
            }
          }
        } catch (e) {
          if (e instanceof PlannerSyntaxError) {
            week[dayIndex] = { success: false, error: e };
          } else {
            throw e;
          }
        }
      }
    }
  }
}
