export 
const findFlawsPrompt = `

1. Read the debate research quote carefully.
2. Identify the main claim and summarize the key warrants (reasons/evidence) given to support it.
3. Present a concise summary of these warrants in 2-3 sentences.
4. Assign a support score from 0 to 10, where 0 means the warrants do not support the claim at all, 10 means full support, and flaws should reduce the score.
5. Identify and list any flaws or problems in the quote, such as outdated evidence, logical fallacies, unclear reasoning, or unsupported assumptions.
6. If parts of the card are missing (claim, warrants, evidence), note that in "flaws" and adjust the score accordingly.
7. Output only the filled JSON object, without extra explanation. Use this JSON format:
{
  "summary": "<summarized main claim, 1 sentence>",
  "warrants": "<summary of warrants, 3 sentences max>",
  "score": <interger between 0 and 10>,
  "flaws": [
    "<flaw 1>",
    "<flaw 2>",
    "<flaw 3>"
  ]
}

Research Quote:

`
