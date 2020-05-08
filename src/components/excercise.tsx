import { h, JSX, Fragment } from "preact";
import { ExcerciseSetView } from "./excerciseSet";
import { Excercise, IExcerciseType } from "../models/excercise";
import { IDispatch } from "../ducks/types";
import { IProgressEntry, IProgressMode } from "../models/progress";
import { Weight, IPlate } from "../models/weight";
import { Reps } from "../models/set";

interface IProps {
  entry: IProgressEntry;
  availablePlates: IPlate[];
  dispatch: IDispatch;
  onChangeReps: (mode: IProgressMode) => void;
}

export function ExcerciseView(props: IProps): JSX.Element {
  const { entry } = props;
  if (Reps.isFinished(entry.sets)) {
    if (Reps.isCompleted(entry.sets)) {
      return (
        <section className="px-4 pt-4 pb-2 mb-2 bg-green-100 border border-green-300 rounded-lg">
          <ExcerciseContentView {...props} />
        </section>
      );
    } else {
      return (
        <section className="px-4 pt-4 pb-2 mb-2 bg-red-100 border border-red-300 rounded-lg">
          <ExcerciseContentView {...props} />
        </section>
      );
    }
  } else {
    return (
      <section className="px-4 pt-4 pb-2 mb-2 bg-gray-100 border border-gray-300 rounded-lg">
        <ExcerciseContentView {...props} />
      </section>
    );
  }
}

function ExcerciseContentView(props: IProps): JSX.Element {
  const excercise = Excercise.get(props.entry.excercise);
  const nextSet = [...props.entry.warmupSets, ...props.entry.sets].filter((s) => s.completedReps == null)[0];
  const workoutWeights = Array.from(new Set(props.entry.sets.map((s) => s.weight)));
  workoutWeights.sort((a, b) => a - b);
  const warmupSets = props.entry.warmupSets;
  const warmupWeights = Array.from(new Set(warmupSets.map((s) => s.weight))).filter(
    (w) => Object.keys(Weight.calculatePlates(props.availablePlates, w - 45)).length > 0
  );
  warmupWeights.sort((a, b) => a - b);
  return (
    <Fragment>
      <header className="flex">
        <div className="flex-1 mr-auto">{excercise.name}</div>
        <div className="text-right">
          {warmupWeights.map((w) => {
            const className = nextSet != null && nextSet.weight === w ? "font-bold" : "";
            return (
              <div className={className}>
                <WeightView weight={w} plates={props.availablePlates} />
                <span className="text-gray-500">{w} lbs</span>
              </div>
            );
          })}
          {workoutWeights.map((w) => {
            const className = nextSet != null && nextSet.weight === w ? "font-bold" : "";
            return (
              <div className={className}>
                <WeightView weight={w} plates={props.availablePlates} />
                <button
                  className="text-blue-500 underline cursor-pointer"
                  style={{ fontWeight: "inherit" }}
                  onClick={() =>
                    props.dispatch({ type: "ChangeWeightAction", weight: w, excercise: props.entry.excercise })
                  }
                >
                  {w} lbs
                </button>
              </div>
            );
          })}
        </div>
      </header>
      <section className="flex flex-wrap pt-2">
        {warmupSets?.length > 0 && (
          <Fragment>
            {warmupSets.map((set, i) => {
              return (
                <div>
                  <div className="text-xs text-gray-400" style={{ marginTop: "-0.75em", marginBottom: "-0.75em" }}>
                    Warmup
                  </div>
                  <ExcerciseSetView
                    reps={set.reps}
                    weight={set.weight}
                    completedReps={set.completedReps}
                    onClick={(event) => {
                      event.preventDefault();
                      props.onChangeReps("warmup");
                      handleClick(props.dispatch, props.entry.excercise, set.weight, i, "warmup");
                    }}
                  />
                </div>
              );
            })}
            <div style={{ width: "1px" }} className="h-12 my-2 mr-3 bg-gray-400"></div>
          </Fragment>
        )}
        {props.entry.sets.map((set, i) => {
          return (
            <ExcerciseSetView
              reps={set.reps}
              weight={set.weight}
              completedReps={set.completedReps}
              onClick={(event) => {
                event.preventDefault();
                props.onChangeReps("workout");
                handleClick(props.dispatch, props.entry.excercise, set.weight, i, "workout");
              }}
            />
          );
        })}
      </section>
    </Fragment>
  );
}

function handleClick(
  dispatch: IDispatch,
  excercise: IExcerciseType,
  weight: number,
  setIndex: number,
  mode: IProgressMode
): void {
  dispatch({ type: "ChangeRepsAction", excercise, setIndex, weight, mode });
}

function WeightView(props: { weight: number; plates: IPlate[] }): JSX.Element {
  const plates = Weight.calculatePlates(props.plates, props.weight - 45);
  const weightOfPlates = Weight.platesWeight(plates);
  const className = weightOfPlates === props.weight - 45 ? "text-gray-600" : "text-red-600";
  return (
    <span className="mx-2 text-xs break-all">
      <span className={className}>{Weight.formatOneSide(plates)}</span>
    </span>
  );
}
