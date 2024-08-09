import { h, JSX } from "preact";
import { useRef, useState } from "preact/hooks";
import { Thunk } from "../ducks/thunks";
import { IDispatch } from "../ducks/types";
import { Equipment } from "../models/equipment";
import { equipmentName, Exercise } from "../models/exercise";
import { equipments, exerciseKinds, IExerciseType, IProgram, ISettings, IWeight, screenMuscles } from "../types";
import { CollectionUtils } from "../utils/collection";
import { StringUtils } from "../utils/string";
import { ExerciseImage } from "./exerciseImage";
import { GroupHeader } from "./groupHeader";
import { MenuItemWrapper } from "./menuItem";
import { Multiselect } from "./multiselect";
import { IHistoryRecord } from "../types";
import { Weight } from "../models/weight";
import { IconArrowRight } from "./icons/iconArrowRight";

interface IExercisesListProps {
  dispatch: IDispatch;
  settings: ISettings;
  program: IProgram;
  history: IHistoryRecord[];
}

interface IExercisesListExercise extends IExerciseType {
  name: string;
  rm1: IWeight;
  equipmentName?: string;
  defaultRounding?: number;
}

function buildExercises(exerciseTypes: IExerciseType[], settings: ISettings): IExercisesListExercise[] {
  return exerciseTypes.map((e) => {
    const exercise = Exercise.get(e, settings.exercises);
    return {
      ...e,
      name: Exercise.fullName(exercise, settings),
      rm1: Exercise.onerm(e, settings),
      equipmentName: Equipment.getEquipmentNameForExerciseType(settings, e),
      defaultRounding: Exercise.defaultRounding(e, settings),
    };
  });
}

export function ExercisesList(props: IExercisesListProps): JSX.Element {
  const textInput = useRef<HTMLInputElement>(null);
  const [filter, setFilter] = useState<string>("");
  const [filterTypes, setFilterTypes] = useState<string[]>([]);

  let programExercises = buildExercises(
    CollectionUtils.uniqByExpr(props.program.exercises, (e) => Exercise.toKey(e.exerciseType)).map(
      (e) => e.exerciseType
    ),
    props.settings
  );
  const programExercisesKeys = new Set(programExercises.map((e) => Exercise.toKey(e)));
  let historyExercises = buildExercises(
    CollectionUtils.uniqByExpr(
      props.history
        .flatMap((hr) => hr.entries.map((e) => e.exercise))
        .filter((e) => !programExercisesKeys.has(Exercise.toKey(e))),
      (e) => Exercise.toKey(e)
    ),
    props.settings
  );

  const filterOptions = [
    ...equipments.map((e) => equipmentName(e)),
    ...exerciseKinds.map(StringUtils.capitalize),
    ...screenMuscles.map(StringUtils.capitalize),
  ];

  if (filter) {
    programExercises = Exercise.filterExercises(programExercises, filter);
    historyExercises = Exercise.filterExercises(historyExercises, filter);
  }
  if (filterTypes && filterTypes.length > 0) {
    programExercises = Exercise.filterExercisesByType(programExercises, filterTypes, props.settings);
    historyExercises = Exercise.filterExercisesByType(historyExercises, filterTypes, props.settings);
  }

  programExercises.sort((a, b) => {
    return a.name.localeCompare(b.name);
  });
  historyExercises.sort((a, b) => {
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="pb-8">
      <form data-cy="exercises-list" onSubmit={(e) => e.preventDefault()}>
        <input
          ref={textInput}
          className="block w-full px-4 py-2 mb-2 text-base leading-normal bg-white border border-gray-300 rounded-lg appearance-none focus:outline-none focus:shadow-outline"
          type="text"
          value={filter}
          placeholder="Filter by name"
          onInput={() => {
            setFilter(textInput.current.value.toLowerCase());
          }}
        />
        <Multiselect
          id="filtertypes"
          label=""
          placeholder="Filter by type"
          values={filterOptions}
          initialSelectedValues={new Set()}
          onChange={(ft) => setFilterTypes(Array.from(ft))}
        />
      </form>

      <GroupHeader name="Current program exercises" topPadding={true} />
      {programExercises.map((exercise) => {
        return (
          <ExerciseItem
            key={Exercise.toKey(exercise)}
            dispatch={props.dispatch}
            settings={props.settings}
            exercise={exercise}
          />
        );
      })}
      <GroupHeader name="Exercises from history" topPadding={true} />
      {historyExercises.map((exercise) => {
        return (
          <ExerciseItem
            key={Exercise.toKey(exercise)}
            dispatch={props.dispatch}
            settings={props.settings}
            exercise={exercise}
          />
        );
      })}
    </div>
  );
}

interface IExerciseItemProps {
  dispatch: IDispatch;
  settings: ISettings;
  exercise: IExercisesListExercise;
}

function ExerciseItem(props: IExerciseItemProps): JSX.Element {
  return (
    <MenuItemWrapper
      name={props.exercise.name}
      onClick={() => {
        props.dispatch(Thunk.pushExerciseStatsScreen(props.exercise));
      }}
    >
      <div className="flex items-center">
        <div className="flex items-center justify-center">
          <div style={{ marginTop: "-1px" }}>
            <ExerciseImage settings={props.settings} className="w-8 mr-3" exerciseType={props.exercise} size="small" />
          </div>
        </div>
        <div className="flex-1 pt-3 pb-1 text-left">
          <div>{props.exercise.name}</div>
          <div className="flex text-xs text-grayv2-main">
            <div className="mr-2">
              <strong>1RM:</strong> {Weight.print(props.exercise.rm1)},
            </div>
            {props.exercise.equipmentName ? (
              <div>
                <strong>Equipment:</strong> {props.exercise.equipmentName}
              </div>
            ) : (
              <div>
                <strong>Default rounding:</strong> {props.exercise.defaultRounding}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center py-2 pl-2">
          <IconArrowRight style={{ color: "#a0aec0" }} />
        </div>
      </div>
    </MenuItemWrapper>
  );
}
