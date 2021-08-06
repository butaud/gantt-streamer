import { execSync } from "child_process";

const chartName = process.argv[2];
[
  `yarn generate-mmc ./${chartName}.gs ./${chartName}.mmd`,
  `npx mmdc -w 1600 -i ./${chartName}.mmd -o ./${chartName}.svg`,
].forEach((command) => {
  execSync(command, {
    stdio: "inherit",
  });
});
