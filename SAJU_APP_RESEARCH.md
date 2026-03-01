# Saju (사주) Reading App — Research & Options

## What is Saju?

**Saju (사주)**, formally **사주팔자 (Saju Palja)**, is the Korean adaptation of the Chinese **Four Pillars of Destiny (八字 / BaZi)** system. It analyzes a person's fate and personality based on the cosmic energies present at their exact moment of birth.

### Core Concepts

| Concept | Korean | Chinese | Description |
|---------|--------|---------|-------------|
| Four Pillars | 사주 (Saju) | 四柱 (Sì Zhù) | Year, Month, Day, Hour pillars |
| Eight Characters | 팔자 (Palja) | 八字 (BāZì) | Each pillar has a Heavenly Stem + Earthly Branch |
| Heavenly Stems | 천간 (Cheongan) | 天干 (Tiāngān) | 10 stems (甲乙丙丁戊己庚辛壬癸) |
| Earthly Branches | 지지 (Jiji) | 地支 (Dìzhī) | 12 branches (子丑寅卯辰巳午未申酉戌亥) |
| Five Elements | 오행 (Ohaeng) | 五行 (Wǔxíng) | Wood, Fire, Earth, Metal, Water |
| Ten Gods | 십성 (Sipseong) | 十神 (Shí Shén) | Relationship between stems |
| Symbolic Stars | 신살 (Sinsal) | 神煞 (Shén Shà) | Special star indicators |
| Sexagenary Cycle | 육십갑자 | 六十甲子 | 60-year cycle of stem-branch pairs |
| Day Master | 일간 (Ilgan) | 日主 (Rì Zhǔ) | The stem of the Day pillar — represents "you" |

### How a Reading Works

1. **Input**: Birth year, month, day, hour (solar calendar), and gender
2. **Convert** to lunar/solar terms calendar → determine the Four Pillars
3. **Analyze** element balance, Ten Gods relationships, symbolic stars
4. **Interpret** personality, career, relationships, luck cycles (대운/大運)

---

## Does Claude Have Built-in Saju Knowledge?

### What Claude CAN Do
- Claude has general knowledge of saju/bazi concepts, terminology, and interpretive frameworks
- It can explain the Five Elements theory, Ten Gods, and symbolic stars
- It can generate natural-language interpretations given a pre-computed chart
- It excels at nuanced, culturally sensitive Korean-language readings

### What Claude CANNOT Reliably Do
- **Accurate pillar calculations** — LLMs fundamentally cannot perform manseryeok (만세력) calendar computations reliably. They pattern-match rather than compute.
- **Solar term edge cases** — e.g., Lichun (입춘) on Feb 4, 2024 transitions at exactly 4:27 PM. Someone born that morning vs. evening falls in different years. LLMs get this wrong.
- **Zi hour (자시) ambiguity** — The 11 PM–1 AM window spans two calendar days; which day to assign depends on the school of thought.
- **60-cycle calculations** — Claude may appear correct probabilistically but doesn't actually compute the sexagenary cycle.

### Bottom Line

> **Use a deterministic calculation engine for the math. Use Claude for the interpretation.**

This is the consensus from developers who have built saju/bazi AI apps. The article ["Why You Shouldn't Let AI Do Your Fortune Telling"](https://dev.to/ji_ai/why-you-shouldnt-let-ai-do-your-fortune-telling-and-how-to-do-it-right-1ec2) documents this clearly.

---

## Knowledge Base & Dataset Options

### Option 1: Open-Source Calculation Libraries

#### Korean-Specific Libraries (Manseryeok / 만세력)

These are **Korean saju-specific** — not just generic BaZi. They use KARI/KASI data and handle Korean lunar calendar nuances:

| Library | Language | Description | Install |
|---------|----------|-------------|---------|
| [manseryeok-js](https://github.com/urstory/manseryeok-js) | TypeScript/JS | KASI data, 절기 (solar terms), four pillars, true solar time correction by longitude (Seoul: -32min, Busan: -24min), 1900–2050 | GitHub |
| [manseryeok](https://github.com/yhj1024/manseryeok) | TypeScript | Full 사주팔자 calculation (년주/월주/일주/시주), solar-lunar conversion, minute-level precision | GitHub |
| [korean-lunar-calendar (JS)](https://github.com/usingsky/korean_lunar_calendar_js) | JavaScript | KARI-sourced Korean solar-lunar conversion, 1000–2050 | GitHub |
| [korean-lunar-calendar (Python)](https://github.com/usingsky/korean_lunar_calendar_py) | Python | KARI-sourced Korean solar-lunar conversion, 1000–2050 | `pip install korean-lunar-calendar` |
| [KoreanLunarCalendar](https://github.com/usingsky/KoreanLunarCalendar) | Java | Same KARI data, Java version | GitHub |
| [go-klc](https://github.com/chunghha/go-klc) | Go | KARI-based Korean lunar calendar, 1391–2050 | GitHub |
| [klc](https://pub.dev/documentation/klc/latest/) | Dart | KARI-based, for Flutter apps | pub.dev |

> **Important**: Korean and Chinese lunar dates can diverge. Always use KARI-sourced libraries for Korean saju.

#### JavaScript / TypeScript (BaZi/General)

| Library | Description | Install |
|---------|-------------|---------|
| [bazi-calculator-by-alvamind](https://github.com/alvamind/bazi-calculator-by-alvamind) | Comprehensive BaZi calculator with Five Elements, Ten Gods, Nobility stars, Peach Blossom | `npm install bazi-calculator-by-alvamind` |
| [@aharris02/bazi-calculator](https://www.npmjs.com/package/@aharris02/bazi-calculator-by-alvamind) | Enhanced fork with timezone-aware processing, Luck Pillars, stem/branch interactions, clashes, harms, punishments | `npm install @aharris02/bazi-calculator-by-alvamind` |
| [Gmuli-Bazi-Calc](https://github.com/Gmuli/Gmuli-Bazi-Calc) | Web-based, handles Heavenly Stems, Earthly Branches, 60 Jiazi cycle | Browser-based |
| [@kurone-kito/dantalion](https://www.npmjs.com/package/@kurone-kito/dantalion-cli) | Four Pillars personality assessment (1873–2050) | `npm install @kurone-kito/dantalion` |

#### Python

| Library | Description | Install |
|---------|-------------|---------|
| [lunar_python](https://pypi.org/project/lunar_python/) | **Most comprehensive.** Full EightChar/BaZi with Four Pillars, Ten Gods (十神), Five Elements, Hidden Stems, Fortune Cycles (大运/流年/小运), Na Yin, reverse BaZi lookup, 24 solar terms. By [6tail](https://github.com/6tail/lunar-python) | `pip install lunar_python` |
| [sxtwl](https://pypi.org/project/sxtwl/) | C++-backed, fast. Gan-Zhi for year/month/day/hour, four-pillar reverse lookup, solar terms. Dates from 722 BC. Python 2.7–3.13 | `pip install sxtwl` |
| [eacal](https://pypi.org/project/eacal/) | Sexagenary cycle IDs (0–59), solar terms via PyEphem. Supports Korean, Chinese, Japanese, Vietnamese, English | `pip install eacal` |
| [purejoy/baziapp](https://github.com/purejoy/baziapp) | Python BaZi chart generator from birth time | Clone from GitHub |
| [lunar-mcp-server](https://github.com/AngusHsu/lunar-mcp-server) | MCP server with BaZi, lunar calendar, Five Elements, compatibility | `pip install lunar-mcp-server` |
| [bach-lunar-mcp](https://github.com/BACH-AI-Tools/lunar_mcp_server) | MCP server with BaZi, Wu Xing analysis, solar terms | `pip install bach-lunar-mcp` |

#### Go

| Library | Description |
|---------|-------------|
| [tommitoan/bazica](https://github.com/tommitoan/bazica) | Solar-to-BaZi chart conversion (1900–2100) |

### Option 2: MCP Server Integration (Best for Claude)

The **[BaZi MCP Server](https://github.com/cantian-ai/bazi-mcp)** is purpose-built for AI integration:
- Returns structured JSON with Four Pillars, Ten Gods, Luck Cycles
- Built on Model Context Protocol — integrates with Claude Desktop, Cursor
- Designed specifically to address LLM calculation inaccuracies
- Provides a factual foundation that Claude can interpret

### Option 3: Existing APIs & Services

| Service | Description |
|---------|-------------|
| [Cantian AI](https://www.cantian.ai/en) | AI-powered BaZi with digitized classical texts (Zi Ping Zhen Quan, San Ming Tong Hui, Di Tian Sui) |
| [saju.com](https://saju.com/en) | Korean Saju reading service |
| [saju-fortune.com](https://saju-fortune.com/en) | Free Saju fortune reading |
| [bazi-calculator.com](https://bazi-calculator.com/) | Online BaZi calculator |

### Option 4: Build Your Own Knowledge Base

Core data structures you'd need to encode:

```
1. 10 Heavenly Stems (천간)
   甲(갑) 乙(을) 丙(병) 丁(정) 戊(무) 己(기) 庚(경) 辛(신) 壬(임) 癸(계)
   + element mapping + yin/yang polarity

2. 12 Earthly Branches (지지)
   子(자) 丑(축) 寅(인) 卯(묘) 辰(진) 巳(사) 午(오) 未(미) 申(신) 酉(유) 戌(술) 亥(해)
   + element mapping + hidden stems + animal zodiac

3. 60 Sexagenary Cycle (육십갑자)
   All 60 stem-branch combinations

4. Solar Terms Table (절기)
   24 solar terms with exact transition times per year (critical for accuracy)

5. Ten Gods Relationships (십성)
   Based on Day Master vs. other stems

6. Symbolic Stars (신살)
   Nobleman (귀인), Intelligence Star (문창), Sky Horse (역마), Peach Blossom (도화), etc.

7. Element Interaction Rules
   생(generating), 극(overcoming), 형(punishment), 충(clash), 합(combination), 해(harm)
```

### Option 5: Classical Texts to Digitize (for RAG)

Cantian AI's approach of digitizing classical texts is a strong RAG strategy:

| Text | Korean | Description |
|------|--------|-------------|
| 자평진전 (Zi Ping Zhen Quan) | 子平眞詮 | Foundational Four Pillars text |
| 삼명통회 (San Ming Tong Hui) | 三命通會 | Comprehensive destiny encyclopedia |
| 적천수 (Di Tian Sui) | 滴天髓 | Classic on reading the Day Master |
| 명리정종 (Myeongni Jeongjong) | 命理正宗 | Korean interpretation tradition |
| 만세력 (Manseryeok) | 萬歲曆 | Ten-thousand year calendar tables |

---

## Recommended Architecture

### Hybrid Approach (Best Practice)

```
┌──────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  User Input  │────▶│  Calculation     │────▶│  Claude API     │
│  (birth info)│     │  Engine          │     │  (Interpretation│
│              │     │  (deterministic) │     │   Layer)        │
└──────────────┘     └──────────────────┘     └─────────────────┘
                            │                         │
                     ┌──────┴──────┐           ┌──────┴──────┐
                     │ Solar terms │           │ RAG: Classic│
                     │ Lunar cal.  │           │ texts &     │
                     │ 60-cycle    │           │ interpret.  │
                     │ Ten Gods    │           │ rules       │
                     └─────────────┘           └─────────────┘
```

**Layer 1 — Deterministic Calculation Engine** (no LLM)
- Convert solar date → lunar date → Four Pillars
- Compute Ten Gods, element balance, symbolic stars
- Handle edge cases (solar term transitions, Zi hour, DST, true solar time by longitude)
- Korean-specific: `manseryeok-js` (TS, KASI data) + `korean-lunar-calendar` (KARI data)
- General BaZi: `bazi-calculator-by-alvamind` (JS) or `lunar_python` (Python, most comprehensive)

**Layer 2 — Claude API for Interpretation**
- Receives the computed chart as structured JSON
- Generates natural-language reading in Korean/English
- Applies cultural nuance specific to Korean saju tradition
- Can use system prompts with saju interpretation guidelines

**Layer 3 — RAG Knowledge Base** (optional but powerful)
- Digitized classical texts for deep, authoritative interpretations
- Structured interpretation rules for Ten Gods combinations
- Yearly/monthly fortune templates based on element cycles

### Multi-Model Routing (Advanced)

Based on developer experience building Korean saju apps:

| Task | Recommended Model | Reason |
|------|-------------------|--------|
| One-line daily fortunes | Gemini Flash / Haiku | Fast, cheap |
| Basic chart analysis | Claude Haiku | Precise instruction following |
| Deep personality reading | Claude Sonnet/Opus | Nuanced interpretation |
| Image generation (부적 talismans) | GPT / DALL-E | Image capabilities |

---

### Claude API Integration Options

**Option A: Tool Use / Function Calling**
```
Claude API Call
  → Tool: calculate_saju(birth_date, birth_time, gender, timezone)
  → Returns: Structured JSON with all pillar data
  → Claude interprets the returned data and generates reading
```

**Option B: MCP Server (Best for prototyping)**
```json
{
  "mcpServers": {
    "Bazi": { "command": "npx", "args": ["bazi-mcp"] }
  }
}
```
Claude Desktop calls the BaZi MCP tool directly, receives structured JSON, and interprets it in one conversation flow.

**Option C: RAG + Claude (Best for deep readings)**
- Index classical texts (자평진전, 삼명통회, 적천수) in a vector DB (Pinecone, Weaviate, pgvector)
- Given a computed chart, retrieve relevant interpretation chunks
- Feed chart JSON + retrieved context to Claude for grounded readings

---

## Critical Edge Cases to Handle

1. **Solar term transition times** — Must be precise to the minute per year. Use astronomical calculations or pre-computed tables.
2. **Zi hour (자시) handling** — Decide which school: early Zi (23:00–23:59) = current day vs. next day.
3. **Korean vs. Chinese lunar dates** — Always use KARI-sourced data for Korean users. They diverge on some dates.
4. **True solar time correction** — Adjust for longitude within Korea (Seoul vs. Busan = ~8 minute difference). `manseryeok-js` handles this.
5. **Leap months (윤달)** — Korean lunar calendar intercalary months must be handled correctly.
6. **Historical date accuracy** — Solar term calculations before 1900 may require different astronomical models.

---

## Quick-Start Recommendation

For the fastest path to a working saju app:

1. **Use `manseryeok-js`** for Korean-specific pillar calculations (KASI data, solar time correction, 절기 precision)
2. **Use `korean-lunar-calendar`** for accurate Korean solar-lunar conversion (KARI data)
3. **Use Claude API (Sonnet)** with a well-crafted system prompt containing saju interpretation rules
4. **Feed the computed chart JSON** into Claude for natural-language reading
5. **Optionally add the BaZi MCP server** for rapid prototyping in Claude Desktop

For a **Python backend**: use `lunar_python` (most comprehensive BaZi engine) + `korean-lunar-calendar` (Korean-specific dates).

This gives you accurate calculations + eloquent, culturally-aware interpretations without needing to build a knowledge base from scratch.

---

## Sources

- [DEV Community - Why You Shouldn't Let AI Do Your Fortune Telling](https://dev.to/ji_ai/why-you-shouldnt-let-ai-do-your-fortune-telling-and-how-to-do-it-right-1ec2)
- [DEV Community - Claude vs GPT vs Gemini for Saju](https://dev.to/ji_ai/claude-vs-gpt-vs-gemini-how-to-cocktail-them-like-a-pro-66k)
- [Skywork AI - BaZi MCP Server Deep Dive](https://skywork.ai/skypage/en/bazi-ai-engineer-code/1981206600771096576)
- [Cantian AI](https://www.cantian.ai/en)
- [Saju.com - Korean Fortune Reading](https://saju.com/en)
- [Creatrip - Guide to Korean Fortune-Telling](https://creatrip.com/en/blog/14459)
- [KCulture - Decoding Saju](https://kculture.com/decoding-saju-a-beginners-guide-to-korean-fortune-telling/)
- [Qiora - From BaZi to K-Saju](https://qiora.app/blog/k-saju-what-korea-did-with-chinas-four-pillars)
- [GitHub - bazi-mcp](https://github.com/cantian-ai/bazi-mcp)
- [GitHub - manseryeok-js](https://github.com/urstory/manseryeok-js)
- [GitHub - korean_lunar_calendar_py](https://github.com/usingsky/korean_lunar_calendar_py)
- [GitHub - bazi-calculator-by-alvamind](https://github.com/alvamind/bazi-calculator-by-alvamind)
- [PyPI - lunar_python](https://pypi.org/project/lunar_python/)
- [PyPI - sxtwl](https://pypi.org/project/sxtwl/)
- [npm - bazi keyword search](https://www.npmjs.com/search?q=keywords:bazi)
- [GitHub - bazi topic](https://github.com/topics/bazi)
