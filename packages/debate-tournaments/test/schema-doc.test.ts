import { describe, expect, it } from "vitest";
import { applySchemaRules, parseMysqlTables } from "../scripts/lib/mysql-to-sqlite.mjs";
import { renderSchemaDoc } from "../scripts/lib/schema-doc.mjs";

const DUMP = `
CREATE TABLE \`topic\` (
  \`id\` int(11) NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB;
CREATE TABLE \`score\` (
  \`id\` int(11) NOT NULL AUTO_INCREMENT,
  \`value\` float NOT NULL DEFAULT 0,
  \`topic\` varchar(255) DEFAULT NULL,
  \`ballot\` int(11) DEFAULT NULL,
  \`student\` int(11) NOT NULL DEFAULT 0,
  \`topic_id\` int(11) DEFAULT NULL,
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB;
CREATE TABLE \`ballot\` (
  \`id\` int(11) NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB;
CREATE TABLE \`student\` (
  \`id\` int(11) NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB;
`;

const PREVIOUS = `### score

Scores on a ballot.

| Column | Type | Constraints | Purpose |
| --- | --- | --- | --- |
| \`value\` | REAL | NOT NULL DEFAULT 0 | Setting value (short). |
| \`topic\` | TEXT |  | References \`topic.id\`. |
| \`ballot\` | INTEGER |  | The ballot (\`ballot.id\`). |
| \`topic_id\` | INTEGER |  | References \`topic.id\`. |
`;

describe("schema doc", () => {
  const doc = renderSchemaDoc(applySchemaRules(parseMysqlTables(DUMP)), PREVIOUS);
  const row = (column: string) => doc.split("\n").find((l) => l.startsWith(`| \`${column}\` |`));

  it("keeps hand-written prose", () => {
    expect(doc).toContain("Scores on a ballot.");
    expect(row("ballot")).toContain("The ballot (`ballot.id`).");
  });

  it("only labels INTEGER columns named after a table as references", () => {
    expect(row("topic")).toContain("not a `topic.id`");
    expect(row("topic_id")).toMatch(/\| {2}\|$/);
    expect(row("student")).toContain("References `student.id`. NULL when none.");
    expect(row("value")).toContain("The score itself");
  });
});
