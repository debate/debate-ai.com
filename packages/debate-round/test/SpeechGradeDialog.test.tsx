/**
 * Render test for the grading modal's radar chart. Vitest runs in `node`, so
 * this asserts on `react-dom/server` markup (the dialog itself portals).
 */

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { RubricRadar } from "../src/dialogs/SpeechGradeDialog";
import { defaultScores } from "../src/round/speech-rubric";

describe("RubricRadar", () => {
  it("describes every category score for assistive tech", () => {
    const html = renderToStaticMarkup(
      <RubricRadar scores={{ ...defaultScores(), evidence: 5, analysis: 2 }} label="1AC" />,
    );
    expect(html).toContain('role="img"');
    expect(html).toContain("Evidence 5");
    expect(html).toContain("Analysis 2");
  });

  it("draws one labelled spoke per category", () => {
    const html = renderToStaticMarkup(<RubricRadar scores={defaultScores()} label="1AC" />);
    for (const label of ["Organization", "Evidence", "Analysis", "Clash", "Presentation"]) {
      expect(html).toContain(`>${label}</text>`);
    }
  });
});
