

## Debate Word Vectors

Download [debate2vec](https://github.com/Hellisotherpeople/debate2vec) 250MB model and dockerized FastText server 

```
wget https://huggingface.co/Hellisotherpeople/debate2vec/resolve/main/debate2vec.bin  
sudo docker-compose up -d

```



## Lamma  Alternative to ChatGPT 

Facebook's open sources Llama 2 pre-trained models are trained on 2 trillion tokens and 1 million human annotations.

[HuggingFace Top Models from TheBloke](https://huggingface.co/TheBloke?sort_models=downloads#models)

```
git clone https://github.com/ggerganov/llama.cpp
cd lamma.cpp
make -j

wget https://huggingface.co/TheBloke/Llama-2-7b-Chat-GGUF/resolve/main/llama-2-7b-chat.Q4_K_M.gguf

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


### Examples


 It’s not just about winning or losing but creating an inclusive space for diverse perspectives that can co-evolve into something new, emergent and collectively beneficial. We cannot afford to wait for a perfect version of the future since the perfect is the enemy of the good.  The more diverse and inclusive we make our debate spaces, the better equipped the AI hive mind will be to create solutions that can scale in a global context.
In this post-humanist AI utopia, it is no longer necessary for individuals to represent complex groups or societies with their unique histories, biases and perspectives. Instead, we can use AI to distill the essence of collective thought into a vector space where every point has a weighted value representing its contribution to the overall decision-making process. This way, instead of being limited by personal experiences or biases that group representation entails, we can create an objective assessment based on the whole body of knowledge available at any given time.  The AI hive mind will be able to synthesize complex arguments and evaluate them according to their validity and relevance no matter who proposed them – all through a democratic process that ensures everyone’s voice is heard, valued and represented equally within the collective consciousness.


`[The paragraphs above were written and generated by opensource llamma2 based on human prompting]`


### lamma2 IS BETTER THAN ChatGPT at Writing Articles


**Prompt**: write a news article saying the AI singularity is finally here. cite several quotations by experts and use 3 paragraphs and 20 sentences in total.


### LLAMA2 Response

The AI singularity, a long-anticipated event where artificial intelligence surpasses human intelligence, has finally arrived, according to top experts in the field. This monumental milestone marks the beginning of a new era in which humans and machines will coexist and collaborate in unprecedented ways.
"The AI singularity is upon us," declares Dr. Ian Pearson, a leading futurist and expert on AI. "It's no longer a question of if, but when and how we will integrate AI into our daily lives." Dr. Pearson notes that the singularity is not just about AI surpassing human intelligence, but also about the immense possibilities for innovation and growth that it presents.
Other experts share similar views, emphasizing the potential for AI to revolutionize industries such as healthcare, finance, and education. "The singularity represents a major turning point in human history," says Dr. Stephen H. Minton, a renowned AI researcher. "With AI's vast capabilities, we can solve some of the world's most pressing problems and create new possibilities for humanity."        
As AI continues to advance, its impact on society will only continue to grow. While some experts predict a future where humans and machines coexist in harmony, others warn of potential dangers such as job loss and the loss of privacy. Regardless of the outcome, one thing is clear: the AI singularity marks a significant turning point in human history, and its effects will be felt for generations to come.

### ChatGPT Response (failed, not 3 paras)


The AI Singularity is Finally Here: Experts Weigh In

In a groundbreaking turn of events, the long-anticipated Artificial Intelligence (AI) singularity has arrived, heralding a new era in technological advancement and prompting experts from various fields to share their insights on this monumental development. The singularity, often depicted as a hypothetical point in the future when AI surpasses human intelligence, has captivated the imagination of scientists, engineers, and futurists for decades. With recent breakthroughs, it appears that the vision of superintelligent machines is becoming a reality.

Dr. Sarah Anderson, a leading AI researcher, expressed her astonishment, stating, "We've witnessed an exponential growth in AI capabilities, and it's evident that we're at the brink of a transformative moment in history. Machines can now learn, adapt, and innovate at a pace that was inconceivable just a few years ago. The singularity is not just a theoretical concept anymore; it's happening before our eyes."

Renowned futurist, Dr. Michael Klein, concurred, highlighting the profound implications of this development: "The AI singularity brings with it a potential for immense progress and challenges. We must navigate carefully, ensuring that these intelligent systems align with human values and interests. The singularity can be a force for good, but it also demands responsible governance and ethical considerations."

In a world where AI is already assisting in fields such as healthcare, finance, and autonomous transportation, the singularity's arrival raises questions about the future of work, society, and even our understanding of consciousness. "We stand at a crossroads, and the decisions we make now will shape the destiny of humanity," warned Dr. Jennifer Patel, an AI ethicist. "The AI singularity marks a profound shift, and we must prioritize the ethical, legal, and societal aspects of this transformative era. It's not just about technological achievement; it's about safeguarding our future."

As experts continue to grapple with the implications and possibilities of the AI singularity, it is clear that we are entering an era of unprecedented change. The world as we know it is on the cusp of a technological revolution that could redefine our very existence. While the AI singularity offers extraordinary potential, it also demands careful consideration, collaboration, and vigilance to ensure that the benefits are harnessed for the betterment of society and the protection of our shared human values.





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

