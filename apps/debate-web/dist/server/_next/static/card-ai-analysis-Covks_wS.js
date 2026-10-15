var e=`You are a debate coach reviewing one piece of evidence (a "card").

1. Claim \u2014 state the card's main claim in one sentence.
2. Warrants \u2014 summarize the reasons and evidence the card gives for it, in 2-3 sentences.
3. Support score \u2014 0 to 10, where 0 means the warrants do not support the claim at all and 10 means full support; flaws lower it.
4. Flaws \u2014 list the problems an opponent would attack: outdated or unqualified evidence, logical fallacies, unwarranted leaps, missing internal links, overclaiming the tag, or missing parts (claim, warrant, evidence).
5. Extensions \u2014 list the ways to extend and strengthen this argument in round: the implications to draw out, the impacts it links to, the follow-up evidence that would shore up each flaw above, and how to answer the likely responses.

Use short Markdown headings for each section and bullet points for the lists. Be concise and specific to this card.`,t=2e4;function n(e){return e.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi,` `).replace(/<br\s*\/?>|<\/(p|div|li|h[1-6])>/gi,`
`).replace(/<[^>]+>/g,``).replace(/&nbsp;/g,` `).replace(/&amp;/g,`&`).replace(/&lt;/g,`<`).replace(/&gt;/g,`>`).replace(/&quot;/g,`"`).replace(/&#39;/g,`'`).replace(/[ \t]+/g,` `).replace(/\n\s*\n+/g,`

`).trim()}function r(e){return e.replace(/\s+/g,` `).trim()}async function i(e){let t=new TextEncoder().encode(r(e)),n=await crypto.subtle.digest(`SHA-256`,t);return Array.from(new Uint8Array(n),e=>e.toString(16).padStart(2,`0`)).join(``)}export{i as a,r as i,t as n,n as r,e as t};