import fs from "fs";

type StreamedWorkTask = {
  id: string;
  name: string;
  duration: number;
  dependencies: string[];
  stream?: string;
  startDate?: string;
};

class MermaidSectionTitle {
  readonly name: string;
  constructor(name: string) {
    this.name = name;
  }

  toString() {
    return `section ${this.name}`;
  }
}

class MermaidGanttTask {
  readonly id?: string;
  readonly name: string;
  dependencies: string[];
  readonly startDate?: string;
  readonly duration: number;
  constructor(
    name: string,
    dependencies: string[],
    duration: number,
    id?: string,
    startDate?: string
  ) {
    this.id = id;
    this.name = name;
    this.dependencies = dependencies;
    this.duration = duration;
    this.startDate = startDate;
  }

  toString() {
    let response = `${this.name}  :`;
    if (this.id) {
      response += `${this.id}, `;
    }
    if (this.dependencies.length > 0) {
      response += ` after ${this.dependencies.join(" ")},`;
    }
    if (this.startDate) {
      response += ` ${this.startDate}, `;
    }
    response += ` ${this.duration}d`;
    return response;
  }
}

/**
 * Each line should have the following format:
 * taskId|task name|4|otherTaskId1 otherTaskId2|bob|2021-08-09
 */
const parseFile = (contents: string): StreamedWorkTask[] =>
  contents
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => {
      const [id, name, duration, dependencies, stream, startDate] =
        line.split("|");
      return {
        id: id.trim(),
        name: name.trim(),
        duration: parseInt(duration.trim()),
        dependencies: dependencies
          .trim()
          .split(new RegExp("\\s+"))
          .filter((dependency) => dependency),
        stream: stream.trim() || undefined,
        startDate: startDate?.trim(),
      };
    });

const UNASSIGNED_STREAM = "unassigned";
const splitByStream = (
  tasks: StreamedWorkTask[]
): Record<string, StreamedWorkTask[]> => {
  const response: Record<string, StreamedWorkTask[]> = {};
  tasks.forEach((task) => {
    const stream = task.stream ?? UNASSIGNED_STREAM;
    if (!response[stream]) {
      response[stream] = [];
    }
    response[stream].push(task);
  });
  return response;
};

const orderStream = (tasks: StreamedWorkTask[]): StreamedWorkTask[] => {
  const satisfiedDependencies: string[] = [];
  const streamTaskIds = tasks.map((task) => task.id);
  const output: StreamedWorkTask[] = [];
  while (output.length < tasks.length) {
    const nextTask = tasks.find(
      (task) =>
        !satisfiedDependencies.includes(task.id) &&
        task.dependencies.every(
          (value) =>
            satisfiedDependencies.includes(value) ||
            !streamTaskIds.includes(value)
        )
    );
    if (nextTask) {
      satisfiedDependencies.push(nextTask.id);
      output.push(nextTask);
    } else {
      throw Error(`Invalid dependency cylce in ${tasks}`);
    }
  }
  return output;
};

const ganttLinesForStream = (
  stream: string,
  tasks: StreamedWorkTask[],
  serialize: boolean
): Array<MermaidGanttTask | MermaidSectionTitle> => {
  const ganttLines: Array<MermaidGanttTask | MermaidSectionTitle> = [
    new MermaidSectionTitle(stream),
  ];
  let previousTaskId: string;
  tasks.forEach((task) => {
    const ganttTask = new MermaidGanttTask(
      task.name,
      task.dependencies,
      task.duration,
      task.id,
      task.startDate
    );
    if (
      serialize &&
      previousTaskId &&
      !task.dependencies.includes(previousTaskId)
    ) {
      ganttTask.dependencies.push(previousTaskId);
    }
    previousTaskId = task.id;
    ganttLines.push(ganttTask);
  });
  return ganttLines;
};

(async () => {
  const inputFn = process.argv[2];

  const contents = fs.readFileSync(inputFn).toString("utf-8");
  const tasks = parseFile(contents);
  const tasksByStream = splitByStream(tasks);
  const orderedTasksByStream: Record<string, StreamedWorkTask[]> = {};
  for (const stream in tasksByStream) {
    orderedTasksByStream[stream] = orderStream(tasksByStream[stream]);
  }

  const outputGanttLines: Array<MermaidGanttTask | MermaidSectionTitle> = [];
  if (UNASSIGNED_STREAM in orderedTasksByStream) {
    outputGanttLines.push(
      ...ganttLinesForStream(
        UNASSIGNED_STREAM,
        orderedTasksByStream[UNASSIGNED_STREAM],
        false
      )
    );
  }
  for (const stream in orderedTasksByStream) {
    if (stream != UNASSIGNED_STREAM) {
      outputGanttLines.push(
        ...ganttLinesForStream(stream, orderedTasksByStream[stream], true)
      );
    }
  }
  const taskDefinitions = outputGanttLines
    .map((line) => line.toString())
    .join("\n");
  const chartDefinition = `
gantt
    title Grid View Execution Plan
    dateFormat  YYYY-MM-DD
    excludes    weekends
    ${taskDefinitions}
      `;
  fs.writeFileSync(process.argv[3], chartDefinition);
})();
