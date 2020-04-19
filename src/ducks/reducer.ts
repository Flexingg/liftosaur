import { Reducer } from "preact/hooks";
import { Program, IProgramId } from "../models/program";
import { IHistoryRecord } from "../models/history";
import { IProgress, Progress, IProgressMode } from "../models/progress";
import { IExcerciseType } from "../models/excercise";
import { StateError } from "./stateError";
import { History } from "../models/history";
import { Screen } from "../models/screen";
import { IStats } from "../models/stats";
import { IWeight, IPlate } from "../models/weight";
import deepmerge from "deepmerge";
import { CollectionUtils } from "../utils/collection";

export type IEnv = {
  client: Window["fetch"];
  googleAuth?: gapi.auth2.GoogleAuth;
};

export type IScreen = "main" | "settings" | "account";

export interface IState {
  storage: IStorage;
  webpushr?: IWebpushr;
  screenStack: IScreen[];
  progress?: IProgress;
}

export interface IStorage {
  id?: number;
  stats: IStats;
  history: IHistoryRecord[];
  settings: ISettings;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  programStates: Record<string, any>;
  currentProgramId?: IProgramId;
}

export interface ISettings {
  timers: {
    warmup: number;
    workout: number;
  };
  plates: IPlate[];
}

export interface IWebpushr {
  sid: number;
}

export function getInitialState(): IState {
  const rawStorage = window.localStorage.getItem("liftosaur");
  let storage: IStorage | undefined;
  if (rawStorage != null) {
    try {
      storage = JSON.parse(rawStorage);
    } catch (e) {
      storage = undefined;
    }
  }
  if (storage != null) {
    return { storage, screenStack: ["main"] };
  } else {
    return {
      screenStack: ["main"],
      storage: {
        stats: {
          excercises: {}
        },
        programStates: {},
        settings: {
          plates: [
            { weight: 45, num: 4 },
            { weight: 25, num: 4 },
            { weight: 10, num: 4 },
            { weight: 5, num: 4 },
            { weight: 2.5, num: 4 }
          ],
          timers: {
            warmup: 90000,
            workout: 180000
          }
        },
        history: []
      }
    };
  }
}

export type IChangeProgramAction = {
  type: "ChangeProgramAction";
  name: IProgramId;
};

export type IChangeDate = {
  type: "ChangeDate";
  date: string;
};

export type IConfirmDate = {
  type: "ConfirmDate";
  date?: string;
};

export type ISyncStorage = {
  type: "SyncStorage";
  storage: IStorage;
};

export type IPushScreen = {
  type: "PushScreen";
  screen: IScreen;
};

export type IPullScreen = {
  type: "PullScreen";
};

export type ICancelProgress = {
  type: "CancelProgress";
};

export type IDeleteProgress = {
  type: "DeleteProgress";
};

export type IChangeRepsAction = {
  type: "ChangeRepsAction";
  excercise: IExcerciseType;
  setIndex: number;
  weight: number;
  mode: IProgressMode;
};

export type IFinishProgramDayAction = {
  type: "FinishProgramDayAction";
};

export type IStartProgramDayAction = {
  type: "StartProgramDayAction";
};

export type IChangeAMRAPAction = {
  type: "ChangeAMRAPAction";
  value?: number;
};

export type IChangeWeightAction = {
  type: "ChangeWeightAction";
  weight: number;
  excercise: IExcerciseType;
};

export type IConfirmWeightAction = {
  type: "ConfirmWeightAction";
  weight?: IWeight;
};

export type IStoreWebpushrSidAction = {
  type: "StoreWebpushrSidAction";
  sid: number;
};

export type IEditHistoryRecord = {
  type: "EditHistoryRecord";
  historyRecord: IHistoryRecord;
};

export type IAction =
  | IChangeRepsAction
  | IStartProgramDayAction
  | IChangeProgramAction
  | IFinishProgramDayAction
  | IChangeWeightAction
  | IChangeAMRAPAction
  | IConfirmWeightAction
  | IEditHistoryRecord
  | ICancelProgress
  | IDeleteProgress
  | IPushScreen
  | IPullScreen
  | ISyncStorage
  | IChangeDate
  | IConfirmDate
  | IStoreWebpushrSidAction;

export const reducerWrapper: Reducer<IState, IAction> = (state, action) => {
  const newState = reducer(state, action);
  console.log(newState);
  if (state.storage !== newState.storage) {
    newState.storage = { ...newState.storage, id: (newState.storage.id || 0) + 1 };
  }
  window.localStorage.setItem("liftosaur", JSON.stringify(newState.storage));
  return newState;
};

export const reducer: Reducer<IState, IAction> = (state, action) => {
  if (action.type === "ChangeRepsAction") {
    const progress = state.progress!;
    return {
      ...state,
      progress: Progress.updateRepsInExcercise(progress, action.excercise, action.weight, action.setIndex, action.mode)
    };
  } else if (action.type === "StartProgramDayAction") {
    if (state.progress != null) {
      throw new StateError("Progress is already started");
    } else if (state.storage.currentProgramId != null) {
      const lastHistoryRecord = state.storage.history.find(i => i.programId === state.storage.currentProgramId);
      const program = Program.get(state.storage.currentProgramId);
      const day = Program.nextDay(program, lastHistoryRecord?.day);
      const programState = state.storage.programStates[state.storage.currentProgramId];
      return {
        ...state,
        progress: Progress.create(program, day, state.storage.stats, programState)
      };
    } else {
      return state;
    }
  } else if (action.type === "EditHistoryRecord") {
    return {
      ...state,
      progress: Progress.edit(action.historyRecord)
    };
  } else if (action.type === "FinishProgramDayAction") {
    if (state.progress == null) {
      throw new StateError("FinishProgramDayAction: no progress");
    } else {
      const program = Program.get(state.progress.historyRecord?.programId ?? state.storage.currentProgramId!);
      const historyRecord = History.finishProgramDay(
        state.progress.historyRecord?.programId ?? state.storage.currentProgramId!,
        state.progress
      );
      let newHistory;
      if (state.progress.historyRecord != null) {
        newHistory = state.storage.history.map(h => {
          if (h.id === state.progress?.historyRecord?.id) {
            return historyRecord;
          } else {
            return h;
          }
        });
      } else {
        newHistory = [historyRecord, ...state.storage.history];
      }
      const programState = state.storage.programStates[program.id];
      const { state: newProgramState, stats: newStats } =
        state.progress.historyRecord == null
          ? program.finishDay(state.progress, state.storage.stats, programState)
          : { state: programState, stats: state.storage.stats };
      return {
        ...state,
        storage: {
          ...state.storage,
          stats: newStats,
          history: newHistory,
          programStates: {
            ...state.storage.programStates,
            [program.id]: newProgramState
          }
        },
        progress: undefined
      };
    }
  } else if (action.type === "ChangeProgramAction") {
    return {
      ...state,
      storage: {
        ...state.storage,
        currentProgramId: action.name
      }
    };
  } else if (action.type === "ChangeAMRAPAction") {
    return {
      ...state,
      progress: Progress.updateAmrapRepsInExcercise(state.progress!, action.value)
    };
  } else if (action.type === "ChangeDate") {
    return {
      ...state,
      progress: Progress.showUpdateDate(state.progress!, action.date)
    };
  } else if (action.type === "ConfirmDate") {
    return {
      ...state,
      progress: Progress.changeDate(state.progress!, action.date)
    };
  } else if (action.type === "ChangeWeightAction") {
    return {
      ...state,
      progress: Progress.showUpdateWeightModal(state.progress!, action.excercise, action.weight)
    };
  } else if (action.type === "ConfirmWeightAction") {
    return {
      ...state,
      progress: Progress.updateWeight(state.progress!, action.weight)
    };
  } else if (action.type === "StoreWebpushrSidAction") {
    return {
      ...state,
      webpushr: { sid: action.sid }
    };
  } else if (action.type === "CancelProgress") {
    return { ...state, progress: undefined };
  } else if (action.type === "DeleteProgress") {
    const historyRecord = state.progress?.historyRecord;
    if (historyRecord != null) {
      const history = state.storage.history.filter(h => h.date !== historyRecord.date);
      return {
        ...state,
        storage: { ...state.storage, history },
        progress: undefined
      };
    } else {
      return state;
    }
  } else if (action.type === "PushScreen") {
    return { ...state, screenStack: Screen.push(state.screenStack, action.screen) };
  } else if (action.type === "PullScreen") {
    return { ...state, screenStack: Screen.pull(state.screenStack) };
  } else if (action.type === "SyncStorage") {
    const oldStorage = state.storage;
    const newStorage = action.storage;
    if (newStorage != null) {
      const storage: IStorage = {
        settings: {
          plates: CollectionUtils.concatBy(oldStorage.settings.plates, newStorage.settings.plates, el =>
            el.weight.toString()
          ),
          timers: deepmerge(oldStorage.settings.timers, newStorage.settings.timers)
        },
        programStates: deepmerge(oldStorage.programStates, newStorage.programStates),
        stats: deepmerge(oldStorage.stats, newStorage.stats),
        currentProgramId: oldStorage.currentProgramId,
        history: CollectionUtils.concatBy(oldStorage.history, newStorage.history, el => el.date!)
      };
      return { ...state, storage };
    } else {
      return state;
    }
  } else {
    return state;
  }
};
