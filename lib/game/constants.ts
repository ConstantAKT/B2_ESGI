import type { RoomSettings } from "@/engine/types";
import { DEFAULT_EVENT_SEQUENCE } from "@/engine/data/events";

export const TRANSITION_DURATION_SECONDS = 30;

export const DEFAULT_ROOM_SETTINGS: RoomSettings = {
  totalTurns: 5,
  turnDurationSeconds: 6 * 60,
  difficulty: "normal",
  showResultsImmediately: true,
  eventIds: DEFAULT_EVENT_SEQUENCE.slice(0, 5),
};

export const MIN_TEAMS_TO_START = 2;
