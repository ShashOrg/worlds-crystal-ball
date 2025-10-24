export type QuestionType = "binary" | "categorical" | "numeric";

export type PickAnswer = string;

export type ProbabilityContext = {
  tournamentSlug: string;
  now: Date;
};
