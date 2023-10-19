

## Debate Word Vectors

Download [debate2vec](https://github.com/Hellisotherpeople/debate2vec) 250MB model and dockerized FastText server 

```
wget https://huggingface.co/Hellisotherpeople/debate2vec/resolve/main/debate2vec.bin  
sudo docker-compose up -d

```



## Lamma  Alternative to ChatGPT 

Facebook's open sources Llama 2 pre-trained models are trained on 2 trillion tokens and 1 million human annotations.


```
git clone https://github.com/ggerganov/llama.cpp
cd lamma.cpp
make -j

ipull https://huggingface.co/TheBloke/Llama-2-7b-Chat-GGUF/resolve/main/llama-2-7b-chat.Q4_K_M.gguf

./main -m llama-2-7b-chat.Q4_K_M.gguf -p "what are the key steps to building a website?" -n 400 -e

```

## Similar Words Nearest Embeddings

Search Autocomplete for Debate - helps researchers discover related keywords to search for in the literature base

```

http://localhost:8000/similar?word=ontology&count=30



{"word":"alterity","similar":"['otherness', 'subjectivity', 'levinas', 'self', 'levinas’s', 'irreducible', 'undecidability', 'singularity', 'ontological', 'transcendence', 'derrida', 'levinasian', 'relationality', 'identity', 'exteriority', 'modernity', 'ethics', 'selfhood', 'transgression', 'poetics', 'seduction', 'finitude', 'ontology', 'dialectics', 'binaries', 'postmodern', 'transcendent', 'blackness', 'subjectivities', 'deconstruction', \"lovecraft's\", \"derrida's\", 'hybridity', 'baudrillard’s', 'negation', 'hostis', 'transcendental', 'stranger', 'oneself', 'constitutive', 'phenomenological', 'radical', 'historicity', 'ethical', 'indigeneity', 'difference', 'post-structuralist', 'nihilism', 'aporia', 'essentialised']"}

{"word":"counterplan","similar":"['counterplans', 'resolutional', 'affirmative', 'kritiks', 'kritik', 'affirmative’s', 'non-topical', 'in-round', 'fiat', 'topicality', 'permutation', 'affs', 'nontopical', 'argument', 'solvency', 'guesstimate', 'conditionality', 'eb-7', 'reviewability', 'competition.”', 'inherency', 'topical', 'paraontology', 'disad', '1ac', 'advocacies', 'arguments', 'affirmatives', 'deontological', 'cybermad', 'rule-consequentialism', 'consequentialism', 'actor”', 'testing”', 'one-voice', '2ac', 'negative’s', 'tournament', 'solt', 'grisez', 'germaneness', 'politeia', 'interjurisdictional', 'purusha', 'disadvantages', 'textually', 'neg', '“laboratory”', 'incapacitates', 'consequentialist', 'weakens', 'aff', 'fsia', '“backpack', 'corporate-tax', 'cispa', '“predictions', 'disadvantage', 'critique’s', 'lre', 'competitive', 'textual', 'nullification', 'harman’s', 'sunnah', 'hatab', 'debater', 'contractarian', 'prong', 'correlationist', '7/9/2018', 'eliminates', 'morales-santana', 'credibility.¶', 'experimentalism', \"rule's\", 'defensible', 'benjamin’s', 'catchphrases', 'evasion', 'debaters', 'fg', 'argument—that', 'statutory', 'pascal’s', 'nuclearmad', 'morality', 'competitors', '9-0', 'reasoned', 'neo-isolationism', 'debate', 'it', 'advan', 'vagueness', 'outweigh', 'proposal', 'text', 'prevention’s', 'lipitor']"}

```

### Sentence Vectorization for Label Classification

```
http://localhost:8000/tag?tag=US%20leadership%20is%20key%20to%20solve%20nuclear%20war

{"tag":"US leadership is key to solve nuclear war","vector":"[-5.04156016e-02 -4.51882258e-02  6.15538582e-02 -3.25404033e-02\n -3.95872295e-02  1.49529381e-03 -2.22511422e-02 -1.28549131e-04\n -1.69664230e-02  1.46853570e-02  5.47307637e-03  3.09228189e-02\n  6.31309524e-02   ........]"}

```



## DebateAI CARDS API Specification

Docx to CARDS Parser converts docx debate file to JSON with CARDS metadata and content: html with u b i p mark


```
 {
    "tag": "Structural violence outweighs and causes more death than war",
    "author": "Webb",
    "year": 19,
    "fullcite": "<b>Webb</b>, Professor and Chair of Pastoral Theology University of Saint Mary of the Lake, <b>2019</p><p></b>[Raymond J., “Addressing structural violence: Reforming our perspectives,” International Academy of Practical Theology, 2019, https://iapt-cs.org/ojs/index.php/iaptcs/article/view/53/52, accessed July 1, 2023, GDS-LL]",
    "url": "https://iapt-cs.org/ojs/index.php/iaptcs/article/view/53/52",
    "highlighted": "as a result of structural violence life is shortened One lives fewer years and in a diminished state of development of potential ......",
    "content": "Galtung points out that, <u>as a result of structural violence</u>, <u>life is shortened </u>from what it would have been had one had the world’s average amount of resourc- es. <u>One lives fewer years and in a diminished state of development of potential</u>. <u>Avoidable pre-mature death is a type of violence</u>. As Farmer et al. (2006) put it, <u>structural violence describes “social arrange- ments that put individuals and populations in harm’s way.”</u> <u>Harmful social structures, supported by stable institutions and regular experience can be invisible.</u> ......",
    "researcher": "debater@gmail.com"
    "created": "2023-01-09T14:11:31.931Z",
    "updated": "2023-01-09T14:11:31.931Z",
    "words": 254,
    "hash": "20d3a21b03033cbeee5fab5595f1eeb8",
    "vectors": [8945.796,293739.612,277374.958,813574.215,260427.771,277374.958,813574.215,2.876],
    "type": "AFF",
    "doc": "Structural UBI---Aff",
    "block": "2AC---Framing Ext.",
    "index": 17
}

```

## debate2vec Model Statistics 

- 107555 Word Vectors showing up more than 10 times
- Philosophy and Politics academic publications scraped in 2020 from opencaselist.com research by debate students
- 222485 unique documents larger than 200 words totalling 101 million words
- 300 dimensions, trained for 100 epochs with lr set to 0.10 using FastText
- No uppercase, subword, or conjugations



## Permutation Tree of Thought Prompting 

- [Tree of Thought Prompting Tips ](https://www.promptingguide.ai/techniques/tot)
- [Tree of Thought LLM](https://github.com/princeton-nlp/tree-of-thought-llm)


**Prompt:** Imagine three different experts are answering this question. All experts will write down 1 step of their thinking, then share it with the group. Then all experts will go on to the next step,  trying to solve it step by step, and make sure the result is correct and avoid penalty. Expert 1 answers affirmatively, Expert 2 disagrees, and Expert 3 reaches a permutation combining the best arguments from both sides.

- climate change causes poverty.
- the plan solves oil dependence.
- the plan will harm economy and cause job loss.
- oil dependence is the root cause of climate change.

Is the plan a good idea to solve poverty?

**CHATGPT:** Expert 1 (Affirmative):

Climate change causes poverty.
This is true as climate change can lead to various environmental issues, such as natural disasters and resource scarcity, which can contribute to poverty.

Expert 2 (Disagrees):

Climate change causes poverty.
While climate change can exacerbate poverty in certain regions, it is not the sole or primary cause of poverty. Poverty has many complex factors, and climate change is just one of them.

Expert 3 (Combines Arguments):
1. The plan solves oil dependence.

If the plan involves transitioning to renewable energy sources and reducing reliance on oil, it could help solve oil dependence, which is an important step in mitigating climate change.
The plan will harm the economy and cause job loss.

This is a valid concern as rapid shifts away from certain industries (e.g., fossil fuels) can lead to economic challenges and job displacement in affected sectors.
Oil dependence is the root cause of climate change.

While oil dependence is a significant contributor to greenhouse gas emissions and thus a factor in climate change, it's not the sole root cause. Climate change is a complex issue influenced by various factors, including deforestation, industrial processes, and more.
So, is the plan a good idea to solve poverty?

Expert 1 argues that addressing climate change can alleviate poverty.
Expert 2 is skeptical of the direct link between the plan and poverty reduction.
Expert 3 concludes that the plan may help reduce poverty indirectly by addressing oil dependence and climate change, but it must be implemented carefully to avoid harming the economy and causing job losses. The effectiveness of the plan in reducing poverty will depend on various factors and the specific details of the plan.

