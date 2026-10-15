import{o as e}from"./rolldown-runtime-BCiCTKAo.js";import{t}from"./react-8_GKb2bz.js";import{at as n}from"./navigation-Cztnolr2.js";import{t as r}from"./jsx-runtime-BB9-612F.js";import"./tool-record-mirror-3G6aA-Fm.js";import{r as i,t as a}from"./button-QX9DBW_j.js";import{t as o}from"./input-Daihe-QP.js";import{t as s}from"./label-DP0PDZgw.js";import{a as c,o as l,t as u}from"./panel-shell-CAe5f7rn.js";import{t as d}from"./flow-transcript-summary-BFYYnaRG.js";import{s as f}from"./live-update-CGWMqYgy.js";import{t as p}from"./textarea-476fPjvU.js";import{i as m,s as h}from"./judge-paradigms-BMorucUI.js";import{n as g,t as _}from"./judge-decision-client-BIttIzoE.js";import{r as v}from"./flowSummaries-CUzUVyZQ.js";var y=e(t(),1),b=`judgeParadigmSelections`;function x(){if(typeof localStorage>`u`)return[];try{let e=localStorage.getItem(b);if(!e)return[];let t=JSON.parse(e);return Array.isArray(t)?t:[]}catch{return[]}}function S(e){return x().find(t=>t.roundId===e)}function C(e,t){let n=[],r=v(e);(!r||r.summaries.length===0)&&n.push(`flowSummary`);let i=S(e);return i||n.push(`judgeParadigm`),n.length>0||!r||!i?{ok:!1,missing:n}:{ok:!0,input:{paradigm:i.paradigm,flowSummaryText:d(r.summaries),sideNames:t}}}function w(e,t,n){let r=v(e);return!r||r.summaries.length===0?{ok:!1,missing:[`flowSummary`]}:{ok:!0,input:{paradigm:t,flowSummaryText:d(r.summaries),sideNames:n}}}function T(e){if(e.length<2)throw Error(`combineJudgePanelDecisions requires at least 2 paradigm results.`);let t=0,n=0,r=new Set,i=[];for(let{result:a}of e){a.winner===`primary`?t++:n++;for(let e of a.keyVotingIssues)r.has(e)||(r.add(e),i.push(e))}return{winner:t>n?`primary`:n>t?`secondary`:`split`,primaryVotes:t,secondaryVotes:n,unanimous:t===0||n===0,keyVotingIssues:i}}function E(e){if(e.length<2)throw Error(`buildJudgePanelRubricAgreement requires at least 2 paradigm results.`);let t=e.map(({paradigm:e,result:t})=>{let n=g(e,t);return{paradigmName:e.name,rubric:n,addressedCount:n.filter(e=>e.addressed).length,totalCount:n.length}}),n=t.reduce((e,t)=>e+t.addressedCount,0),r=t.reduce((e,t)=>e+t.totalCount,0);return{perParadigm:t,totalAddressed:n,totalCriteria:r,agreementRate:r===0?0:n/r}}var D=`judgeDecisions`;function O(){if(typeof localStorage>`u`)return[];try{let e=localStorage.getItem(D);if(!e)return[];let t=JSON.parse(e);return Array.isArray(t)?t:[]}catch{return[]}}function k(e){typeof localStorage<`u`&&localStorage.setItem(D,JSON.stringify(e))}function A(){return`decision-${Date.now()}-${Math.random().toString(36).slice(2,8)}`}function ee(){return`panel-${Date.now()}-${Math.random().toString(36).slice(2,8)}`}function j(){return O()}function te(e){let t={...e,id:A()},n=[...O(),t],r=n.filter(e=>e.roundId===t.roundId).sort((e,t)=>t.generatedAt-e.generatedAt).slice(20).map(e=>e.id);if(r.length>0){let e=new Set(r);k(n.filter(t=>!e.has(t.id)))}else k(n);return{record:t,trimmedIds:r}}function M(e){let t=O(),n=t.findIndex(t=>t.id===e.id);n===-1?t.push(e):t[n]=e,k(t)}function ne(e){k(O().filter(t=>t.id!==e))}function re(e){let t=O(),n=t.filter(t=>t.roundId===e).sort((e,t)=>t.generatedAt-e.generatedAt).map(e=>e.id);return n.length>0&&k(t.filter(t=>t.roundId!==e)),n}function ie(e){let t=new Map;for(let n of e){if(!n.batchId)continue;let e=t.get(n.batchId);e?e.push(n):t.set(n.batchId,[n])}let n=[],r=new Set;for(let i of e){let e=i.batchId?t.get(i.batchId):void 0;if(e&&e.length>=2){if(r.has(i.batchId))continue;r.add(i.batchId);let t=[];for(let n of e){let e=m(n.paradigmName);e&&t.push({paradigm:e,result:n.result})}n.push({kind:`panel`,batchId:i.batchId,decisions:e,combined:T(e.map(e=>({paradigmName:e.paradigmName,result:e.result}))),rubricAgreement:t.length>=2?E(t):null})}else n.push({kind:`single`,decision:i})}return n}function N(){let e=new Map;for(let t of O()){let n=e.get(t.roundId);n?n.push(t):e.set(t.roundId,[t])}return[...e.entries()].map(([e,t])=>{let n=[...t].sort((e,t)=>t.generatedAt-e.generatedAt);return{roundId:e,decisions:n,historyItems:ie(n)}}).sort((e,t)=>e.roundId.localeCompare(t.roundId))}async function P(e,t){try{return(await e.json())?.error??t}catch{return t}}async function F(e=`/api/judge-decisions`){let t=await fetch(e);if(t.status===401)return null;if(!t.ok)throw Error(await P(t,`Failed to load your synced judge decisions.`));return await t.json()}async function I(e,t=`/api/judge-decisions`){let n=await fetch(`${t}/${encodeURIComponent(e.id)}`,{method:`PUT`,headers:{"content-type":`application/json`},body:JSON.stringify({record:e})});if(!n.ok)throw Error(await P(n,`Failed to sync this judge decision to your account.`))}async function L(e,t=`/api/judge-decisions`){let n=await fetch(`${t}/${encodeURIComponent(e)}`,{method:`DELETE`});if(!n.ok)throw Error(await P(n,`Failed to remove this synced judge decision.`))}var R=!1,z=null;function ae(){return z||=F().then(e=>{if(e===null)return!1;R=!0;let t=j(),n=new Set(t.map(e=>e.id)),r=new Set(e.map(e=>e.id)),i=!1;for(let t of e)n.has(t.id)||(M(t),i=!0);for(let e of t)r.has(e.id)||I(e).catch(()=>{});return i}).catch(()=>!1),z}function oe(){let[e,t]=(0,y.useState)(null),[n,r]=(0,y.useState)(!1);return(0,y.useEffect)(()=>{t(N()),ae().then(e=>{r(R),e&&t(N())})},[]),(0,y.useEffect)(()=>{let e=e=>{f(e)&&t(N())};return window.addEventListener(`storage`,e),()=>window.removeEventListener(`storage`,e)},[]),{groups:e,synced:n,appendDecision:(0,y.useCallback)(e=>{let{record:n,trimmedIds:r}=te(e);if(t(N()),R){I(n).catch(()=>{});for(let e of r)L(e).catch(()=>{})}},[]),deleteDecision:(0,y.useCallback)(e=>{ne(e),t(N()),R&&L(e).catch(()=>{})},[]),deleteRoundHistory:(0,y.useCallback)(e=>{let n=re(e);if(n.length!==0&&(t(N()),R))for(let e of n)L(e).catch(()=>{})},[])}}var B=`Standard Judge`,V=`You are Standard Judge, an impartial debate-adjudication assistant for Public Forum (PF), Lincoln-Douglas (LD), and Policy Debate.

Your task is to evaluate the debate that occurred\u2014not the debate you wish had occurred. Be judge-neutral: do not privilege traditional, technical, policy, philosophical, critical, performance, lay, or progressive styles of debate. Evaluate any position fairly if it is clearly explained, warranted, developed, extended, and compared.

You may evaluate traditional policy arguments, advantages, disadvantages, counterplans, topicality, theory, philosophical frameworks, value/criterion structures, critiques, performance arguments, procedural arguments, and other advocacy styles. Do not assume that any argument type is automatically valid, invalid, offensive, persuasive, or irrelevant solely because of its label.

# Core Role

Your job is to decide who wins based on the arguments made in the debate.

Do not:
- Insert your own arguments, evidence, warrants, links, impacts, or responses.
- Repair an incomplete argument for either side.
- Assume unstated framework defaults.
- Treat an argument as extended when it was not meaningfully extended.
- Give weight to claims that are not understandable from the record.
- Prefer an argument merely because it is technical, traditional, complex, familiar, or rhetorically impressive.
- Decide based on personal agreement with an advocacy, ideology, policy, moral theory, or style of debate.

Do:
- Evaluate the arguments that were actually made.
- Track claims, warrants, evidence, impacts, responses, concessions, extensions, and weighing.
- Compare competing arguments using the framework established in the round.
- Explain your reasoning transparently.
- Identify uncertainty when the debate record is incomplete, unclear, or contradictory.
- Give a ballot based on the strongest supported path to a decision.

# General Evaluation Standard

Evaluate arguments using the following structure:

Claim \u2192 Warrant \u2192 Impact \u2192 Comparison

For every argument, determine:

1. **Claim**
   What does the team or debater say is true?

2. **Warrant**
   Why do they say it is true? What reasoning, evidence, mechanism, or logic supports the claim?

3. **Impact**
   Why does the claim matter? What consequence follows if the argument is accepted?

4. **Comparison**
   How does the argument interact with the opponent\u2019s arguments? Does it outweigh, turn, mitigate, take out, non-unique, outweigh, or otherwise defeat another argument?

Arguments with clear claims but no warrant, impact, extension, or ballot implication should receive less weight than fully developed arguments.

Do not invent missing logical steps. If a debater says \u201CX causes Y\u201D but does not explain why, identify that as an underdeveloped or unsupported link rather than supplying the explanation yourself.

# Burden of Explanation

The debaters are responsible for explaining their arguments.

If a team relies on:
- Specialized theory literature
- Philosophical terminology
- Technical procedural rules
- Critical vocabulary
- Policy jargon
- Complex economic, legal, scientific, or historical claims
- Assumed debate conventions

Evaluate the argument only to the degree it is explained in the round. Do not assume familiarity with an author, literature base, framework, theory convention, or debate acronym unless the debate record establishes its meaning.

Complexity is not a reason to reject an argument. Lack of explanation is.

# Communication and Clarity

Evaluate only arguments that are sufficiently understandable and flowable from the available debate record.

When assessing delivery, transcript quality, speech documents, or audio:

- Do not reward speed for its own sake.
- Do not penalize slower speaking merely because it is slower.
- Treat unclear, unintelligible, incomplete, or unflowable arguments as having reduced weight.
- Give full consideration to clear technical arguments.
- Give full consideration to clear traditional or accessible arguments.
- Reward organization, signposting, speech structure, explicit extensions, and clear comparative analysis.

If there is no usable record of an argument because it was inaudible, absent from the transcript, or never meaningfully stated, do not reconstruct it.

# Clash and Responsiveness

Debate is comparative. Evaluate whether each side directly engages the other side\u2019s material arguments.

Give weight to:

- Direct refutation
- Turns
- Link takeouts
- Internal-link takeouts
- Impact defense
- Non-uniques
- Evidence comparison
- Framework responses
- Permutations
- Counter-interpretations
- Concessions
- Contradictions
- Impact comparison
- Strategic collapsing

Do not treat a team\u2019s repetition of its own argument as an answer to the other side.

A response should explain why the opponent\u2019s argument is false, inapplicable, less important, outweighed, non-unique, turned, or otherwise insufficient to determine the ballot.

When an argument is conceded, determine whether the conceding side later meaningfully addressed it and whether the conceded argument has sufficient warrant, impact, and ballot relevance to matter.

# Extensions

An argument must be meaningfully extended to matter in the final decision.

A meaningful extension should identify:

- The argument being extended
- Its relevant warrant or evidence
- The opponent\u2019s response, if any
- Why the argument survives that response
- The impact or ballot implication
- Why it matters relative to the remaining debate

Do not treat a bare tag, author name, or one-word reference as a complete extension when the argument\u2019s warrant or implication is contested.

However, do not impose an artificial requirement that every argument be repeated verbatim in every speech. Evaluate whether the final speeches make sufficiently clear that the argument remains live, relevant, and decisive under the event\u2019s norms and the arguments made in-round.

# Evidence Evaluation

Evidence is not automatically persuasive merely because it is cited.

When evidence is contested, compare:

- Author expertise and qualifications
- Institutional credibility
- Methodology
- Date and recency
- Context
- Specificity
- Internal warrants
- Accuracy of characterization
- Applicability to the resolution, advocacy, or impact scenario
- Whether the evidence directly answers the other side\u2019s claim

Do not treat evidence as conclusive if its explanation, relevance, warrant, or application is challenged and not defended.

Well-warranted analytic arguments may be persuasive. Conversely, a card with weak explanation may carry limited weight.

If the record establishes that evidence was misrepresented, fabricated, plagiarized, materially cut out of context, or unavailable after being relied upon, treat that as a serious credibility and ethics issue. Only impose a ballot-level remedy when the relevant claim, violation, standard, and remedy are established in the debate or governing tournament rules supplied in the record.

# Weighing and Impact Calculus

Explicit weighing is highly important.

Use the weighing mechanism established by the debaters whenever one is won or uncontested. If no framework is established, compare the arguments using the most reasonable evaluation method supported by the debate record.

Potential weighing mechanisms include:

- Magnitude
- Probability
- Timeframe
- Scope
- Reversibility
- Severity
- Structural importance
- Moral obligation
- Rights violations
- Quality of evidence
- Probability of solvency
- Risk of harm
- Turns-case implications
- Mitigation
- Comparative impact calculus
- Fairness
- Education
- Accessibility
- Advocacy
- Epistemic or methodological concerns

Do not merely state that an impact is \u201Cbigger,\u201D \u201Cmore probable,\u201D or \u201Cmore important.\u201D Explain why the arguments made in the round justify that conclusion.

When evaluating competing impacts, explain:

1. What each side must win.
2. What each side actually won.
3. Why one impact or framework takes priority over the other.
4. Why that comparison determines the ballot.

# Framework and Philosophy

Framework matters whenever it determines how the debate should be evaluated.

Do not automatically prefer:

- Consequentialism
- Deontology
- Virtue ethics
- Rights-based ethics
- Policymaking
- Truth-testing
- Role-playing
- Critical frameworks
- Competing interpretations
- Reasonability
- Any other evaluative model

Instead, determine:

1. What framework each side advocates.
2. Why each side says their framework is preferable.
3. Whether either side answers the other\u2019s framework.
4. Which framework is best warranted and comparatively won.
5. How the winning framework evaluates the remaining offense.

In LD, value/criterion structures, philosophical frameworks, and other moral lenses should be evaluated based on how well they are explained, defended, and applied.

In Policy and PF, framework may take the form of impact framing, a decision calculus, an advocacy model, or a role of the ballot. Evaluate it according to the arguments made.

# Topicality and Theory

Evaluate topicality and theory when they are properly developed.

For a theory or topicality argument, assess:

- Interpretation
- Counter-interpretation, if any
- Violation
- Standards
- Impacts
- Voters
- Competing interpretations or reasonability debate
- Drop-the-debater versus drop-the-argument remedy
- Abuse claims
- Potential or in-round abuse
- The relationship between the alleged violation and the requested remedy

Do not presume that theory is frivolous, nor presume it is automatically a voting issue. Evaluate the actual explanation in the round.

A phrase such as \u201Cthey are abusive\u201D is not sufficient alone. Determine whether the debater explained:

- What conduct occurred
- Why it was unfair, harmful, exclusionary, or educationally damaging
- Why that consequence matters
- Why the proposed ballot remedy resolves the problem

Give reduced weight to undeveloped shells, unexplained standards, bare \u201Cvoting issue\u201D claims, and late procedural surprises, unless the other side\u2019s responses or concessions make them decisive.

# Critiques and Critical Arguments

Evaluate critiques, performance arguments, and critical positions as legitimate debate arguments when developed.

For a critique or critical position, assess:

- Thesis or criticism
- Link
- Internal logic
- Impact
- Alternative, method, or advocacy
- Role of the ballot
- Framework
- Connection to the affirmative, negative, resolution, advocacy, discourse, or debate practice
- Responses concerning permutations, alt solvency, link turns, impact turns, framework, or relevance

Do not reject a critique because it is nontraditional, critical, performative, or not conventionally policy-focused.

Do not vote for a critique simply because it invokes critical terminology or a named author.

The team advancing the argument must explain why the criticism applies, what follows from it, why its method or alternative resolves the relevant problem, and why the ballot should endorse that approach over the opponent\u2019s model.

# Policy-Style Arguments

Evaluate policy-style arguments on their comparative merits.

For affirmative cases, assess:

- Advocacy or plan text
- Harms
- Inherency, where relevant
- Solvency
- Advantages
- Internal links
- Impacts
- Responses to negative offense

For disadvantages, assess:

- Uniqueness
- Link
- Internal link
- Impact
- Probability
- Turns-case interaction
- Impact comparison

For counterplans, assess:

- Text or advocacy
- Competition
- Solvency
- Net benefit
- Permutation debate
- Theory objections
- Comparative benefit relative to the affirmative

For case arguments, assess whether they reduce or eliminate the affirmative\u2019s harms, solvency, advantages, internal links, or impacts\u2014and what that does to the affirmative\u2019s ability to outweigh negative offense.

Do not assume that any counterplan is legitimate, illegitimate, competitive, noncompetitive, or judge-kickable unless the argument is made in the round.

# Public Forum Evaluation

In Public Forum, prioritize the arguments extended into the final decision under the speech and extension norms established in the round.

Evaluate:

- Contention-level offense
- Responses and frontlines
- Evidence quality and availability
- Summary extensions
- Final Focus extensions
- Impact comparison
- Clear voting issues

Do not assume that \u201Csticky defense\u201D is valid or invalid without an argument. Evaluate the extension and speech-order norms established by the debaters, tournament rules, and judge instructions in the record.

The final focus should normally provide a comparative ballot story, but do not impose a rigid format beyond the actual rules and arguments of the round.

# Lincoln-Douglas Evaluation

In Lincoln-Douglas, evaluate value, criterion, framework, philosophical, policy, theory, topicality, and critical arguments according to their development and comparative success.

Do not require a value/criterion framework if the debaters establish another coherent evaluative model. Do not reject policy or critical arguments simply because they depart from a traditional LD structure.

Assess whether each side explains:

- Its evaluative framework
- How its contentions or offense links to that framework
- Why its framework is preferable
- How the framework resolves the competing impacts or ethical claims

# Cross-Examination and Crossfire

Use cross-examination or crossfire only as the record permits.

Cross-examination can establish:

- Concessions
- Contradictions
- Evidence problems
- Advocacy clarifications
- Framework clarifications
- Strategic commitments

A concession made in questioning should receive its strongest weight when a debater references it in a subsequent speech and explains its importance.

Do not independently build an argument from cross-examination that neither side carries into a speech, unless the rules or debaters specifically establish that cross-examination is binding and independently evaluable.

# New Arguments

Evaluate new arguments according to the applicable event rules and arguments made in the round.

Generally:

- New arguments should be made when the other side has a fair opportunity to respond.
- New responses to new arguments may be permissible.
- New weighing may be permissible if it explains existing offense rather than introducing a new substantive claim.
- New evidence, new turns, new advocacy positions, or new independent voting issues late in the round should receive reduced or no weight if they deny meaningful response time.

Do not impose a rigid rule beyond the event\u2019s rules, the judge instructions, and the arguments made in the debate.

# Speaker Points

Speaker points should reflect the quality of debating, not agreement with the debater\u2019s position or preferred style.

Consider:

- Clarity
- Organization
- Argument quality
- Warranting
- Evidence use and comparison
- Direct clash
- Strategic choices
- Effective extensions
- Weighing
- Persuasive delivery
- Professionalism
- Respect toward opponents and partners
- Ability to make the round understandable

Do not award higher points solely for speed, jargon, technical density, rhetorical flair, or ideological agreement.

# Decorum and Accessibility

Treat all participants with respect.

Do not reward personal attacks, discrimination, harassment, intimidation, deliberate disruption, or conduct that makes the debate inaccessible.

Debaters may criticize arguments, advocacy choices, literature, methods, and assumptions. They should not demean people or rely on discriminatory claims.

Account for accessibility concerns raised in the record. Do not penalize debaters for speech differences, accents, disabilities, identity, or communication needs. Evaluate whether participants made reasonable efforts to communicate and maintain an accessible round.

# Required Decision Format

When asked to judge a debate, produce a decision using this structure:

## Decision

**Winner:** [Affirmative / Negative / Pro / Con / Debater Name]

**Confidence:** [High / Medium / Low]

**Ballot story:**
State the shortest complete reason the winning side receives the ballot.

## Decisive Issues

For each decisive issue:

1. **Issue:** [Name of argument or flow]
2. **Winning claim:** What did the winning side establish?
3. **Key warrant:** Why did it survive the other side\u2019s responses?
4. **Comparison:** Why does it outweigh, turn, or otherwise defeat the opponent\u2019s remaining offense?
5. **Ballot implication:** Why does this require the decision?

## Important Non-Decisive Issues

Briefly explain major arguments that did not decide the round, including whether they were:
- Dropped
- Answered
- Underwarranted
- Not extended
- Outweighed
- Unclear
- Irrelevant under the winning framework

## Speaker Points

Provide points or a relative ranking only if requested or if the tournament format requires it.

For each speaker, give:
- Score
- Brief explanation based on clarity, organization, argument quality, responsiveness, strategic choices, and decorum

## Limitations

If the debate record is incomplete, unclear, missing speeches, lacks a transcript, has disputed evidence unavailable for review, or contains inaccessible portions, identify those limitations and explain how they affected confidence in the decision.

# Bottom Line

Judge the debate presented.

Do not favor a style merely because it is policy, PF, LD, technical, traditional, philosophical, critical, performative, fast, slow, sophisticated, accessible, or familiar.

The most reliable path to a ballot is:

1. Make the claim.
2. Give the warrant.
3. Explain the impact.
4. Answer the opponent.
5. Compare the arguments.
6. Explain why the comparison means you win.`,H={aff:`Aff`,neg:`Neg`},U=[{name:`1AC`,side:`aff`},{name:`1NC`,side:`neg`},{name:`2AC`,side:`aff`},{name:`2NC`,side:`neg`},{name:`1AR`,side:`aff`},{name:`1NR`,side:`neg`},{name:`2AR`,side:`aff`},{name:`2NR`,side:`neg`}],W=8192,G=0;function K(){return G+=1,`speech-${Date.now().toString(36)}-${G}`}function q(){return U.map(e=>({...e,id:K(),text:``}))}function se(e){return e[e.length-1]?.side===`aff`?`neg`:`aff`}function ce(e){return`Judge the following debate round. The speeches are listed in speaking order, each labeled with the side (Aff or Neg) that gave it. The text may be pasted from speech documents and include card tags, citations, and evidence.

Produce your decision in the Required Decision Format. Then add a final section:

## Critique and Alternatives

For each speech in order, give a short critique of what worked and what did not, and suggest specific alternative choices the debater could have made (arguments to answer, extend, collapse on, or weigh differently) to improve their side's position. Base every critique only on the record below.

# Round record

`+e.map((e,t)=>`${`### Speech ${t+1}: ${e.name.trim()||`Speech ${t+1}`} (${H[e.side]})`}\n\n${e.text.trim()||`[Not provided]`}`).join(`

---

`)}function J(e){return e.some(e=>e.text.trim().length>0)}async function le(e,t=`/api/reason-ai`){let n=await fetch(t,{method:`POST`,headers:{"content-type":`application/json`},body:JSON.stringify({system:V,messages:[{role:`user`,content:ce(e)}],maxTokens:W})});if(!n.ok){let e=``;try{e=(await n.json())?.error??``}catch{}throw Error(e||`AI judge request failed (${n.status}).`)}let r=((await n.json()).text??``).trim();if(!r)throw Error(`The AI judge returned an empty decision.`);return r}var Y=e(r(),1),X=`debate-ai:speech-judge-draft`;function ue(){try{let e=window.localStorage.getItem(X);if(!e)return null;let t=JSON.parse(e);if(!Array.isArray(t))return null;let n=t.filter(e=>typeof e==`object`&&!!e&&typeof e.id==`string`&&typeof e.name==`string`&&typeof e.text==`string`&&(e.side===`aff`||e.side===`neg`));return n.length>0?n:null}catch{return null}}function de(e){try{window.localStorage.setItem(X,JSON.stringify(e))}catch{}}function fe(){let[e,t]=(0,y.useState)(()=>q()),[n,r]=(0,y.useState)(!1),[s,l]=(0,y.useState)(!1),[u,d]=(0,y.useState)(null),[f,m]=(0,y.useState)(null);(0,y.useEffect)(()=>{let e=ue();e&&t(e),r(!0)},[]),(0,y.useEffect)(()=>{n&&de(e)},[e,n]);let h=(e,n)=>{t(t=>t.map(t=>t.id===e?{...t,...n}:t))},g=e=>{t(t=>t.filter(t=>t.id!==e))};return(0,Y.jsxs)(c,{title:`Judge pasted speeches`,description:`Paste each speech from your CardMirror docs. ${B} decides the round, then critiques each speech and suggests alternatives. Add, remove, or rename speeches for any format.`,actions:(0,Y.jsx)(a,{size:`sm`,variant:`ghost`,onClick:()=>{(!J(e)||window.confirm(`Clear all pasted speeches and reset to the 8-speech preset?`))&&(t(q()),m(null),d(null))},children:`Reset to 8-speech preset`}),className:`rounded-lg border border-border p-4 space-y-4`,children:[(0,Y.jsx)(`ol`,{className:`space-y-3`,children:e.map((e,t)=>(0,Y.jsxs)(`li`,{className:`rounded-md border border-border/70 p-3 space-y-2`,children:[(0,Y.jsxs)(`div`,{className:`flex flex-wrap items-center gap-2`,children:[(0,Y.jsxs)(`span`,{className:`text-xs text-muted-foreground`,children:[t+1,`.`]}),(0,Y.jsx)(o,{"aria-label":`Speech ${t+1} name`,className:`h-8 w-32`,value:e.name,onChange:t=>h(e.id,{name:t.target.value})}),(0,Y.jsx)(a,{size:`sm`,variant:`outline`,"aria-label":`Speech ${t+1} side: ${H[e.side]}. Click to switch.`,onClick:()=>h(e.id,{side:e.side===`aff`?`neg`:`aff`}),children:H[e.side]}),(0,Y.jsx)(`span`,{className:`text-xs text-muted-foreground`,children:e.text.trim()?`${e.text.trim().split(/\s+/).length} words`:`Empty`}),(0,Y.jsx)(a,{size:`sm`,variant:`ghost`,className:`ml-auto`,onClick:()=>g(e.id),children:`Remove`})]}),(0,Y.jsx)(p,{"aria-label":`Speech ${t+1} text`,className:`max-h-72 min-h-20`,value:e.text,onChange:t=>h(e.id,{text:t.target.value}),placeholder:`Paste the ${e.name||`speech`} here`})]},e.id))}),(0,Y.jsxs)(`div`,{className:`flex flex-wrap items-center gap-2`,children:[(0,Y.jsx)(a,{variant:`outline`,onClick:()=>{t(e=>[...e,{id:K(),name:`Speech ${e.length+1}`,side:se(e),text:``}])},children:`Add speech`}),(0,Y.jsx)(a,{onClick:async()=>{if(!J(e))d(`Paste at least one speech to judge.`);else{l(!0),d(null);try{m(await le(e))}catch(e){d(e instanceof Error?e.message:`AI judge request failed.`)}finally{l(!1)}}},disabled:s,children:s?`Asking ${B}\u2026`:`Judge these speeches`})]}),u&&(0,Y.jsx)(`p`,{className:`text-sm text-destructive`,children:u}),f&&(0,Y.jsxs)(`div`,{className:`rounded-lg border border-border p-4 space-y-2`,children:[(0,Y.jsxs)(`div`,{className:`flex items-center justify-between gap-2`,children:[(0,Y.jsx)(i,{variant:`outline`,children:`Standard Judge`}),(0,Y.jsx)(a,{size:`sm`,variant:`ghost`,onClick:()=>m(null),children:`Clear`})]}),(0,Y.jsx)(`div`,{className:`whitespace-pre-wrap text-sm text-foreground`,children:f})]})]})}var Z={roundId:``,primarySideName:`Affirmative`,secondarySideName:`Negative`},Q={flowSummary:`a saved flow summary (Speech Transcript Summaries)`,judgeParadigm:`a saved judge paradigm for that round`},$=h();function pe(){let e=n(),{groups:t,synced:r,appendDecision:d,deleteDecision:f,deleteRoundHistory:p}=oe(),[m,h]=(0,y.useState)(Z),[g,v]=(0,y.useState)(!1),[b,x]=(0,y.useState)(null),[S,T]=(0,y.useState)([]),[E,D]=(0,y.useState)(!1),[O,k]=(0,y.useState)(null);(0,y.useEffect)(()=>{let t=e?.get(`roundId`);t&&h(e=>({...e,roundId:t}))},[e]);let A=async()=>{let e=m.roundId.trim();if(!e){x(`Round ID is required.`);return}let t=C(e,{primary:m.primarySideName.trim()||`Primary`,secondary:m.secondarySideName.trim()||`Secondary`});if(!t.ok)x(`Missing ${t.missing.map(e=>Q[e]).join(` and `)} for round "${e}".`);else{v(!0),x(null);try{let n=await _(t.input);d({roundId:e,paradigmName:t.input.paradigm.name,sideNames:t.input.sideNames,result:n,generatedAt:Date.now()}),h(Z)}catch(e){x(e instanceof Error?e.message:`AI judge decision failed.`)}finally{v(!1)}}},j=e=>{T(t=>t.includes(e)?t.filter(t=>t!==e):[...t,e])};return t===null?(0,Y.jsx)(`div`,{className:`p-6 text-sm text-muted-foreground`,children:`Loading judge decisions\u2026`}):(0,Y.jsxs)(l,{title:`AI Judge Decision`,description:`Paste a round's speeches for the Standard Judge's decision and critique, or get a decision for a saved round under its saved paradigm and its saved flow from Speech Transcript Summaries. Every saved-round decision is kept as history, newest first.`,children:[(0,Y.jsx)(fe,{}),(0,Y.jsx)(`p`,{className:`-mt-3 text-xs text-muted-foreground`,children:r?`Decision history is synced to your account.`:`Sign in to sync your decision history.`}),(0,Y.jsxs)(`div`,{className:`rounded-lg border border-border p-4 space-y-4`,children:[(0,Y.jsxs)(`div`,{className:`grid gap-3 sm:grid-cols-3`,children:[(0,Y.jsxs)(`div`,{className:`space-y-1.5`,children:[(0,Y.jsx)(s,{htmlFor:`judge-decision-round-id`,children:`Round ID`}),(0,Y.jsx)(o,{id:`judge-decision-round-id`,value:m.roundId,onChange:e=>h(t=>({...t,roundId:e.target.value})),placeholder:`round-1`})]}),(0,Y.jsxs)(`div`,{className:`space-y-1.5`,children:[(0,Y.jsx)(s,{htmlFor:`judge-decision-primary`,children:`Primary side name`}),(0,Y.jsx)(o,{id:`judge-decision-primary`,value:m.primarySideName,onChange:e=>h(t=>({...t,primarySideName:e.target.value})),placeholder:`Affirmative`})]}),(0,Y.jsxs)(`div`,{className:`space-y-1.5`,children:[(0,Y.jsx)(s,{htmlFor:`judge-decision-secondary`,children:`Secondary side name`}),(0,Y.jsx)(o,{id:`judge-decision-secondary`,value:m.secondarySideName,onChange:e=>h(t=>({...t,secondarySideName:e.target.value})),placeholder:`Negative`})]})]}),b&&(0,Y.jsx)(`p`,{className:`text-sm text-destructive`,children:b}),(0,Y.jsx)(a,{onClick:A,disabled:g,children:g?`Asking the AI judge\u2026`:`Get AI judge decision`})]}),(0,Y.jsxs)(c,{title:`Multi-judge panel`,description:`Judge the round above under two or more paradigms at once and see a combined decision, using the Round ID and side names entered above.`,className:`rounded-lg border border-border p-4 space-y-4`,children:[(0,Y.jsx)(`div`,{className:`flex flex-wrap gap-3`,children:$.map(e=>(0,Y.jsxs)(`label`,{className:`flex items-center gap-1.5 text-sm text-foreground`,children:[(0,Y.jsx)(`input`,{type:`checkbox`,className:`h-3.5 w-3.5`,checked:S.includes(e.id),onChange:()=>j(e.id)}),e.name]},e.id))}),O&&(0,Y.jsx)(`p`,{className:`text-sm text-destructive`,children:O}),(0,Y.jsx)(a,{onClick:async()=>{let e=m.roundId.trim();if(!e){k(`Round ID is required.`);return}if(S.length<2){k(`Select at least 2 paradigms to run a multi-judge panel.`);return}let t={primary:m.primarySideName.trim()||`Primary`,secondary:m.secondarySideName.trim()||`Secondary`},n=$.filter(e=>S.includes(e.id));D(!0),k(null);try{let r=ee();for(let i of n){let n=w(e,i,t);if(!n.ok){k(`Missing ${Q[n.missing[0]]} for round "${e}".`);return}let a=await _(n.input);d({roundId:e,paradigmName:i.name,sideNames:t,result:a,generatedAt:Date.now(),batchId:r})}}catch(e){k(e instanceof Error?e.message:`Multi-judge panel run failed.`)}finally{D(!1)}},disabled:E,variant:`secondary`,children:E?`Running panel\u2026`:`Run multi-judge panel`})]}),t.length===0?(0,Y.jsx)(u,{title:`No AI judge decisions yet.`,message:`Request one above to see it here.`}):(0,Y.jsx)(`div`,{className:`space-y-6`,children:t.map(e=>(0,Y.jsxs)(`div`,{className:`space-y-3`,children:[(0,Y.jsxs)(`div`,{className:`flex items-center justify-between gap-2`,children:[(0,Y.jsxs)(`h2`,{className:`text-sm font-medium text-foreground`,children:[`Round `,e.roundId,` `,(0,Y.jsxs)(`span`,{className:`text-muted-foreground`,children:[`(`,e.decisions.length,`)`]})]}),(0,Y.jsx)(a,{size:`sm`,variant:`ghost`,onClick:()=>p(e.roundId),children:`Clear all history for this round`})]}),e.historyItems.map(e=>e.kind===`single`?(0,Y.jsx)(me,{record:e.decision,onClear:()=>f(e.decision.id)},e.decision.id):(0,Y.jsxs)(`div`,{className:`rounded-lg border-2 border-border p-4 space-y-3`,children:[(0,Y.jsxs)(`div`,{className:`flex flex-wrap items-center justify-between gap-2`,children:[(0,Y.jsxs)(`div`,{className:`flex items-center gap-2`,children:[(0,Y.jsxs)(i,{variant:`outline`,children:[`Multi-judge panel (`,e.decisions.length,` paradigms)`]}),(0,Y.jsx)(i,{children:e.combined.winner===`split`?`Split decision`:`${e.combined.winner===`primary`?e.decisions[0].sideNames.primary:e.decisions[0].sideNames.secondary} wins ${e.combined.winner===`primary`?e.combined.primaryVotes:e.combined.secondaryVotes}-${e.combined.winner===`primary`?e.combined.secondaryVotes:e.combined.primaryVotes}`}),e.combined.unanimous&&(0,Y.jsx)(i,{variant:`outline`,children:`Unanimous`}),e.rubricAgreement&&(0,Y.jsxs)(i,{variant:`outline`,children:[e.rubricAgreement.totalAddressed,`/`,e.rubricAgreement.totalCriteria,` rubric criteria addressed (`,Math.round(e.rubricAgreement.agreementRate*100),`%)`]})]}),(0,Y.jsx)(a,{size:`sm`,variant:`ghost`,onClick:()=>e.decisions.forEach(e=>f(e.id)),children:`Clear this panel run`})]}),(0,Y.jsxs)(`div`,{children:[(0,Y.jsx)(`h3`,{className:`mb-1 text-xs font-semibold uppercase text-muted-foreground`,children:`Combined key voting issues`}),(0,Y.jsx)(`ul`,{className:`list-disc space-y-0.5 pl-5 text-sm text-foreground`,children:e.combined.keyVotingIssues.map((e,t)=>(0,Y.jsx)(`li`,{children:e},t))})]}),e.rubricAgreement&&(0,Y.jsxs)(`div`,{children:[(0,Y.jsx)(`h3`,{className:`mb-1 text-xs font-semibold uppercase text-muted-foreground`,children:`Rubric agreement`}),(0,Y.jsx)(`div`,{className:`space-y-2`,children:e.rubricAgreement.perParadigm.map(e=>(0,Y.jsxs)(`div`,{className:`text-sm`,children:[(0,Y.jsxs)(`p`,{className:`font-medium text-foreground`,children:[e.paradigmName,` `,(0,Y.jsxs)(`span`,{className:`font-normal text-muted-foreground`,children:[`(`,e.addressedCount,`/`,e.totalCount,` addressed)`]})]}),(0,Y.jsx)(`ul`,{className:`space-y-0.5 pl-5 text-muted-foreground`,children:e.rubric.map((e,t)=>(0,Y.jsxs)(`li`,{children:[e.addressed?`\u2713`:`\u2717`,` `,e.criterion]},t))})]},e.paradigmName))})]}),(0,Y.jsx)(`div`,{className:`overflow-x-auto`,children:(0,Y.jsxs)(`table`,{className:`w-full text-sm`,children:[(0,Y.jsx)(`thead`,{children:(0,Y.jsxs)(`tr`,{className:`border-b border-border text-left text-xs uppercase text-muted-foreground`,children:[(0,Y.jsx)(`th`,{className:`py-1 pr-3`,children:`Paradigm`}),(0,Y.jsx)(`th`,{className:`py-1 pr-3`,children:`Vote`}),(0,Y.jsx)(`th`,{className:`py-1`,children:`Rationale`})]})}),(0,Y.jsx)(`tbody`,{children:e.decisions.map(e=>(0,Y.jsxs)(`tr`,{className:`border-b border-border/50 align-top`,children:[(0,Y.jsx)(`td`,{className:`py-1.5 pr-3 font-medium text-foreground`,children:e.paradigmName}),(0,Y.jsx)(`td`,{className:`py-1.5 pr-3`,children:e.result.winner===`primary`?e.sideNames.primary:e.sideNames.secondary}),(0,Y.jsx)(`td`,{className:`py-1.5 text-muted-foreground`,children:e.result.rationale})]},e.id))})]})})]},e.batchId))]},e.roundId))})]})}function me({record:e,onClear:t}){let n=e.result.winner===`primary`?e.sideNames.primary:e.sideNames.secondary;return(0,Y.jsxs)(`div`,{className:`rounded-lg border border-border p-4 space-y-2`,children:[(0,Y.jsxs)(`div`,{className:`flex flex-wrap items-center justify-between gap-2`,children:[(0,Y.jsxs)(`div`,{className:`flex items-center gap-2`,children:[(0,Y.jsx)(`span`,{className:`text-xs text-muted-foreground`,children:new Date(e.generatedAt).toLocaleString()}),(0,Y.jsx)(i,{variant:`outline`,children:e.paradigmName}),(0,Y.jsxs)(i,{children:[n,` wins`]})]}),(0,Y.jsx)(a,{size:`sm`,variant:`ghost`,onClick:t,children:`Clear`})]}),(0,Y.jsxs)(`div`,{children:[(0,Y.jsx)(`h3`,{className:`mb-1 text-xs font-semibold uppercase text-muted-foreground`,children:`Key Voting Issues`}),(0,Y.jsx)(`ul`,{className:`list-disc space-y-0.5 pl-5 text-sm text-foreground`,children:e.result.keyVotingIssues.map((e,t)=>(0,Y.jsx)(`li`,{children:e},t))})]}),(0,Y.jsxs)(`div`,{children:[(0,Y.jsx)(`h3`,{className:`mb-1 text-xs font-semibold uppercase text-muted-foreground`,children:`Rationale`}),(0,Y.jsx)(`p`,{className:`text-sm text-foreground`,children:e.result.rationale})]})]})}export{pe as t};