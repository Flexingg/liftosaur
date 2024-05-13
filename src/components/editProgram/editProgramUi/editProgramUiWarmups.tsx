import { lb } from "lens-shmens";
import { JSX, h } from "preact";
import { Exercise } from "../../../models/exercise";
import { Weight } from "../../../models/weight";
import { PlannerProgramExercise } from "../../../pages/planner/models/plannerProgramExercise";
import {
  IPlannerProgramExercise,
  IPlannerProgramExerciseWarmupSet,
  IPlannerState,
} from "../../../pages/planner/models/types";
import { ISettings } from "../../../types";
import { ILensDispatch } from "../../../utils/useLensReducer";
import { GroupHeader } from "../../groupHeader";
import { IconTrash } from "../../icons/iconTrash";
import { LinkButton } from "../../linkButton";
import { NumInput, WeightInput } from "./editProgramUiInputs";
import { EditProgramUiHelpers } from "./editProgramUiHelpers";
import { ObjectUtils } from "../../../utils/object";

interface IEditProgramUiWarmupsProps {
  plannerExercise: IPlannerProgramExercise;
  settings: ISettings;
  plannerDispatch: ILensDispatch<IPlannerState>;
}

export function EditProgramUiWarmups(props: IEditProgramUiWarmupsProps): JSX.Element {
  const plannerExercise = props.plannerExercise;
  const warmupSets = PlannerProgramExercise.warmups(plannerExercise);
  const ownWarmups = plannerExercise.warmupSets;
  const reuseWarmups = plannerExercise.reuse?.exercise?.warmupSets;
  const exercise = Exercise.findByName(plannerExercise.name, props.settings.exercises);
  const defaultWarmups = exercise ? PlannerProgramExercise.defaultWarmups(exercise, props.settings) : [];
  const lbProgram = lb<IPlannerState>().p("current").p("program");

  return (
    <div>
      <GroupHeader name="Warmups" />
      <div className="flex gap-4 text-xs">
        <div style={{ flex: 5 }}>Sets</div>
        <div style={{ flex: 5 }}>Reps</div>
        <div style={{ flex: 8 }}>Weight</div>
        <div className="w-8" />
      </div>
      {ownWarmups == null && defaultWarmups.length > 0 ? (
        <div className="mb-1">
          <span className="mr-2 text-xs">{reuseWarmups ? "Reused warmups" : "Default warmups"}</span>
          <LinkButton
            className="text-xs"
            name="customize-warmups"
            onClick={() => {
              props.plannerDispatch(
                lbProgram.recordModify((program) => {
                  return EditProgramUiHelpers.changeFirstInstance(program, plannerExercise, props.settings, (e) => {
                    e.warmupSets = ObjectUtils.clone(reuseWarmups) || defaultWarmups;
                  });
                })
              );
            }}
          >
            {reuseWarmups ? "Override" : "Customize"}
          </LinkButton>
        </div>
      ) : (
        <div className="mb-1">
          <LinkButton
            className="text-xs"
            name="defaultize-warmups"
            onClick={() => {
              props.plannerDispatch(
                lbProgram.recordModify((program) => {
                  return EditProgramUiHelpers.changeFirstInstance(program, plannerExercise, props.settings, (e) => {
                    e.warmupSets = undefined;
                  });
                })
              );
            }}
          >
            Switch to {reuseWarmups ? "reused" : "default"} warmups
          </LinkButton>
        </div>
      )}
      {(warmupSets || defaultWarmups).map((warmupSet, index) => {
        return (
          <WarmupRow
            warmupSet={warmupSet}
            disabled={ownWarmups == null}
            settings={props.settings}
            onUpdate={(newWarmupSet) => {
              props.plannerDispatch(
                lbProgram.recordModify((program) => {
                  return EditProgramUiHelpers.changeFirstInstance(program, plannerExercise, props.settings, (e) => {
                    if (newWarmupSet != null) {
                      e.warmupSets = e.warmupSets || [];
                      e.warmupSets[index] = newWarmupSet;
                    } else {
                      e.warmupSets = e.warmupSets || [];
                      e.warmupSets.splice(index, 1);
                    }
                  });
                })
              );
            }}
          />
        );
      })}
      {warmupSets != null && (
        <div>
          <LinkButton
            className="text-xs"
            name="add-warmup-set"
            onClick={() => {
              props.plannerDispatch(
                lbProgram.recordModify((program) => {
                  return EditProgramUiHelpers.changeFirstInstance(program, plannerExercise, props.settings, (e) => {
                    e.warmupSets = e.warmupSets || [];
                    e.warmupSets.push({
                      numberOfSets: 1,
                      reps: 5,
                      percentage: 50,
                      type: "warmup",
                    });
                  });
                })
              );
            }}
          >
            Add Warmup Set
          </LinkButton>
        </div>
      )}
    </div>
  );
}

interface IWarmupRowProps {
  warmupSet: IPlannerProgramExerciseWarmupSet;
  disabled?: boolean;
  onUpdate: (newWarmupSet: IPlannerProgramExerciseWarmupSet | undefined) => void;
  settings: ISettings;
}

function WarmupRow(props: IWarmupRowProps): JSX.Element {
  const rawWeight = props.warmupSet.percentage || props.warmupSet.weight;
  const weight = typeof rawWeight === "number" ? Weight.buildPct(rawWeight) : rawWeight;

  return (
    <div className="flex items-center gap-1 mb-1">
      <div style={{ flex: 5 }}>
        <NumInput
          disabled={props.disabled}
          value={props.warmupSet.numberOfSets}
          onUpdate={(val) => props.onUpdate({ ...props.warmupSet, numberOfSets: val })}
        />
      </div>
      <div style={{ flex: 5 }}>
        <NumInput
          disabled={props.disabled}
          value={props.warmupSet.reps}
          onUpdate={(val) => props.onUpdate({ ...props.warmupSet, reps: val })}
        />
      </div>
      {weight && (
        <div style={{ flex: 8 }}>
          <WeightInput
            disabled={props.disabled}
            settings={props.settings}
            value={weight}
            onUpdate={(val) => {
              const newWeight = Weight.isPct(val)
                ? { ...props.warmupSet, percentage: val.value }
                : { ...props.warmupSet, weight: val };
              console.log(newWeight);
              props.onUpdate(newWeight);
            }}
          />
        </div>
      )}
      <div className="leading-none">
        <button
          className={`px-1 ${props.disabled ? "opacity-50 cursor-not-allowed" : ""}`}
          onClick={() => {
            if (!props.disabled) {
              props.onUpdate(undefined);
            }
          }}
        >
          <IconTrash width={14} height={18} />
        </button>
      </div>
    </div>
  );
}