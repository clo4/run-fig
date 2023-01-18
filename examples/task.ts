import CLI from "../mod.ts";

const getTasks = (): string[] =>
  JSON.parse(localStorage.getItem("tasks") || "[]") as string[];

const setTasks = (tasks: string[]) =>
  localStorage.setItem("tasks", JSON.stringify(tasks));

const spec: CLI.Spec = {
  name: "task",
  description: "An extremely simple to-do list CLI",
  options: [
    CLI.help,
  ],
  requiresSubcommand: true,
  parserDirectives: {
    subcommandsMatchUniquePrefix: true,
  },
  subcommands: [
    {
      name: "add",
      description: "Add a task",
      args: {
        name: "task-description",
      },
      action({ args: [task] }) {
        const tasks = getTasks();
        tasks.push(task);
        setTasks(tasks);
      },
    },
    {
      name: ["list", "ls"],
      description: "List tasks",
      options: [
        { name: "--json", description: "List as JSON" },
      ],
      action({ options }) {
        const json = localStorage.getItem("tasks");
        if (options.has("--json")) {
          console.log(json);
          return;
        }
        const tasks: string[] = json ? JSON.parse(json) : [];
        for (const [index, task] of tasks.entries()) {
          console.log(
            `%c${index + 1}:`,
            "color: green; font-weight: bold",
            task,
          );
        }
      },
    },
    {
      name: ["delete", "rm"],
      description: "Delete a task by its index",
      args: {
        name: "index",
        // Imperative code that provides dynamic suggestions
        generators: {
          custom: () => {
            const tasks = getTasks();
            return tasks.map((task, index) => ({
              name: (index + 1).toString(),
              displayName: task,
              description: "Task",
            }));
          },
        },
      },
      options: [
        { name: "--quiet", description: "No logging" },
      ],
      action({ options, args: [indexArg] }) {
        const index = Number(indexArg) - 1;
        const tasks = getTasks();
        if (!options.has("--quiet")) {
          console.log("%cDeleted:", "color: red", tasks.at(index));
        }
        tasks.splice(index, 1);
        setTasks(tasks);
      },
    },
  ],
};

CLI.run(spec);
