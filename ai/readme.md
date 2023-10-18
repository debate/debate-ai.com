

## ChatGPT Argument Research Dataset as a Service (CARDS)

**[ChatGPT 4.0 Plugin](https://platform.openai.com/docs/plugins/introduction)** - vectorized cards API usable via the ChatGPT Plugins platform to make debate research available as a service and to evolve tree-of-thought reasoning. 


Text classification by vectorized tagline summaries creates a knowledge graph where file names and H1 H2 H3 H4 tags serve as labels and able to map any future articles on a topic to the Argument Node label.


ChatGPT hive mind recommends articles for human researchers working alongside AI to develop a summarized topic outline as a public service.


## Install

Download debate2vec 250MB model and dockerized FastText server 

```
wget https://huggingface.co/Hellisotherpeople/debate2vec/resolve/main/debate2vec.bin  
sudo docker-compose up -d

```

## Similar Words Nearest Embeddings

Search Autocomplete for Debate - helps researchers discover related keywords to search for in t

```

http://localhost:8000/similar?word=ontology&count=30



{"word":"alterity","similar":"['otherness', 'subjectivity', 'levinas', 'self', 'levinas’s', 'irreducible', 'undecidability', 'singularity', 'ontological', 'transcendence', 'derrida', 'levinasian', 'relationality', 'identity', 'exteriority', 'modernity', 'ethics', 'selfhood', 'transgression', 'poetics', 'seduction', 'finitude', 'ontology', 'dialectics', 'binaries', 'postmodern', 'transcendent', 'blackness', 'subjectivities', 'deconstruction', \"lovecraft's\", \"derrida's\", 'hybridity', 'baudrillard’s', 'negation', 'hostis', 'transcendental', 'stranger', 'oneself', 'constitutive', 'phenomenological', 'radical', 'historicity', 'ethical', 'indigeneity', 'difference', 'post-structuralist', 'nihilism', 'aporia', 'essentialised']"}

{"word":"counterplan","similar":"['counterplans', 'resolutional', 'affirmative', 'kritiks', 'kritik', 'affirmative’s', 'non-topical', 'in-round', 'fiat', 'topicality', 'permutation', 'affs', 'nontopical', 'argument', 'solvency', 'guesstimate', 'conditionality', 'eb-7', 'reviewability', 'competition.”', 'inherency', 'topical', 'paraontology', 'disad', '1ac', 'advocacies', 'arguments', 'affirmatives', 'deontological', 'cybermad', 'rule-consequentialism', 'consequentialism', 'actor”', 'testing”', 'one-voice', '2ac', 'negative’s', 'tournament', 'solt', 'grisez', 'germaneness', 'politeia', 'interjurisdictional', 'purusha', 'disadvantages', 'textually', 'neg', '“laboratory”', 'incapacitates', 'consequentialist', 'weakens', 'aff', 'fsia', '“backpack', 'corporate-tax', 'cispa', '“predictions', 'disadvantage', 'critique’s', 'lre', 'competitive', 'textual', 'nullification', 'harman’s', 'sunnah', 'hatab', 'debater', 'contractarian', 'prong', 'correlationist', '7/9/2018', 'eliminates', 'morales-santana', 'credibility.¶', 'experimentalism', \"rule's\", 'defensible', 'benjamin’s', 'catchphrases', 'evasion', 'debaters', 'fg', 'argument—that', 'statutory', 'pascal’s', 'nuclearmad', 'morality', 'competitors', '9-0', 'reasoned', 'neo-isolationism', 'debate', 'it', 'advan', 'vagueness', 'outweigh', 'proposal', 'text', 'prevention’s', 'lipitor']"}

{"word":"government","similar":"['federal', 'government’s', 'governments', 'authorities', \"government's\", 'officials', 'agencies', 'government.¶', 'congress', 'state', 'governmental', 'government¶', 'u.s', 'branches', 'branch', 'companies', 'legislature', 'president', 'administration', 'sector', 'private', 'public', 'citizens', 'elected', 'businesses', 'government,”', 'judiciary', 'company', 'private-sector', 'local', 'courts', 'ministries', 'government.”', 'department', 'politicians', 'state-owned', 'foreign', 'government”', 'contractors', 'country', 'subsidies', 'parliament', 'oversight', 'gao', 'firms', '“commandeer”', 'military', 'revenue', 'regulators', 'legislators']"}



```

### Sentence Vectorization for Label Classification

```
http://localhost:8000/tag?tag=US%20leadership%20is%20key%20to%20solve%20nuclear%20war

{"tag":"US leadership is key to solve nuclear war","vector":"[-5.04156016e-02 -4.51882258e-02  6.15538582e-02 -3.25404033e-02\n -3.95872295e-02  1.49529381e-03 -2.22511422e-02 -1.28549131e-04\n -1.69664230e-02  1.46853570e-02  5.47307637e-03  3.09228189e-02\n  6.31309524e-02  3.65858078e-02  4.09929827e-03  3.05035934e-02\n  7.49424323e-02  1.13440035e-02  5.75941289e-03 -2.66412515e-02\n  2.73259152e-02  2.82688383e-02  2.72666402e-02  6.69146189e-03\n  2.35522334e-02 -1.04393903e-02 -2.19721235e-02 -3.43610719e-02\n -2.74175662e-03 -1.62662808e-02 -1.93347223e-02 -2.64913253e-02\n -9.75430384e-03 -1.08995596e-02  4.08687443e-02 -3.64937633e-02\n -1.56447513e-03  1.91920772e-02 ........]"}

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

