import { readdirSync, statSync } from "fs";
import { join, basename } from "path";

function printDirectoryStructure(dirPath, indent = "") {
  const items = readdirSync(dirPath);

  items.forEach((item, index) => {
    const fullPath = join(dirPath, item);
    const isLast = index === items.length - 1;
    const prefix = isLast ? "└── " : "├── ";
    const stat = statSync(fullPath);

    console.log(indent + prefix + item);

    if (stat.isDirectory()) {
      const newIndent = indent + (isLast ? "    " : "│   ");
      printDirectoryStructure(fullPath, newIndent);
    }
  });
}

// Set the directory to print (can be "." for current directory)
const rootDir = process.argv[2] || ".";

console.log(basename(rootDir));
printDirectoryStructure(rootDir);
