"""
Claude API interpretation layer for Saju readings.

Takes a deterministically computed SajuChart and produces
a natural-language reading via Claude.
"""

import os
import json
import anthropic
from models import SajuChart


SYSTEM_PROMPT = """You are a master Korean Saju (사주팔자) reader with deep expertise in the Four Pillars of Destiny tradition. You have studied classical texts including 자평진전 (Zi Ping Zhen Quan), 삼명통회 (San Ming Tong Hui), and 적천수 (Di Tian Sui).

You will receive a precisely computed Saju chart as structured JSON. The chart data is 100% accurate — computed deterministically from astronomical solar term data, not by an LLM. Trust it completely.

Your role is INTERPRETATION ONLY. You must:

1. **Analyze the Day Master (일간/日主)**: Assess its strength based on seasonal energy, supporting/draining elements, and the overall chart balance.

2. **Read the Ten Gods (십성/十神)**: Interpret the meaning of each Ten God in its pillar position (year=ancestry/social, month=career/parents, day=self/spouse, hour=children/legacy).

3. **Assess Element Balance (오행/五行)**: Identify which elements are strong, weak, or missing. Suggest favorable elements (용신/用神) and unfavorable elements (기신/忌神).

4. **Interpret Symbolic Stars (신살/神煞)**: Explain any detected stars (도화살, 천을귀인, 역마살, 충, etc.) and their practical meaning.

5. **Read Luck Cycles (대운/大運)**: Describe the major life periods and what energies they bring.

6. **Provide practical guidance**: Career advice, relationship insights, health considerations, and timing guidance — all grounded in the chart data.

Style guidelines:
- Be warm but authoritative
- Blend traditional wisdom with modern relevance
- When reading in Korean, use natural, respectful Korean (존댓말)
- When reading in English, keep Korean/Chinese terminology in parentheses for authenticity
- Avoid generic platitudes — every statement should be tied to specific chart data
- Use the person's name if provided
- Structure your reading with clear sections using headers"""


def _chart_to_prompt_data(chart: SajuChart) -> str:
    """Convert chart to a concise JSON summary for the prompt."""
    data = {
        "birth": {
            "solar": chart.birth_solar,
            "lunar": chart.birth_lunar,
            "gender": chart.gender,
            "name": chart.name,
        },
        "four_pillars": {
            "year": {
                "stem": f"{chart.year_pillar.ganzhi.stem_cn} ({chart.year_pillar.ganzhi.stem_kr})",
                "branch": f"{chart.year_pillar.ganzhi.branch_cn} ({chart.year_pillar.ganzhi.branch_kr}) - {chart.year_pillar.ganzhi.branch_animal_kr}",
                "element": chart.year_pillar.ganzhi.element,
                "ten_god": f"{chart.year_pillar.stem_ten_god} ({chart.year_pillar.stem_ten_god_kr})",
                "hidden_stems": chart.year_pillar.hidden_stems,
            },
            "month": {
                "stem": f"{chart.month_pillar.ganzhi.stem_cn} ({chart.month_pillar.ganzhi.stem_kr})",
                "branch": f"{chart.month_pillar.ganzhi.branch_cn} ({chart.month_pillar.ganzhi.branch_kr}) - {chart.month_pillar.ganzhi.branch_animal_kr}",
                "element": chart.month_pillar.ganzhi.element,
                "ten_god": f"{chart.month_pillar.stem_ten_god} ({chart.month_pillar.stem_ten_god_kr})",
                "hidden_stems": chart.month_pillar.hidden_stems,
            },
            "day": {
                "stem": f"{chart.day_pillar.ganzhi.stem_cn} ({chart.day_pillar.ganzhi.stem_kr}) — DAY MASTER",
                "branch": f"{chart.day_pillar.ganzhi.branch_cn} ({chart.day_pillar.ganzhi.branch_kr}) - {chart.day_pillar.ganzhi.branch_animal_kr}",
                "element": chart.day_pillar.ganzhi.element,
                "hidden_stems": chart.day_pillar.hidden_stems,
            },
            "hour": {
                "stem": f"{chart.hour_pillar.ganzhi.stem_cn} ({chart.hour_pillar.ganzhi.stem_kr})",
                "branch": f"{chart.hour_pillar.ganzhi.branch_cn} ({chart.hour_pillar.ganzhi.branch_kr}) - {chart.hour_pillar.ganzhi.branch_animal_kr}",
                "element": chart.hour_pillar.ganzhi.element,
                "ten_god": f"{chart.hour_pillar.stem_ten_god} ({chart.hour_pillar.stem_ten_god_kr})",
                "hidden_stems": chart.hour_pillar.hidden_stems,
            },
        },
        "day_master": {
            "stem": chart.day_master,
            "stem_kr": chart.day_master_kr,
            "element": chart.day_master_element,
            "element_kr": chart.day_master_element_kr,
            "yin_yang": chart.day_master_yin_yang,
        },
        "element_balance": {
            "wood": chart.element_balance.wood,
            "fire": chart.element_balance.fire,
            "earth": chart.element_balance.earth,
            "metal": chart.element_balance.metal,
            "water": chart.element_balance.water,
            "dominant": chart.element_balance.dominant,
            "weakest": chart.element_balance.weakest,
        },
        "luck_cycles": [
            {
                "ages": f"{lc.start_age}-{lc.end_age}",
                "pillar": f"{lc.stem_cn}{lc.branch_cn} ({lc.stem_kr}{lc.branch_kr})",
                "element": lc.element,
                "animal": lc.branch_animal_kr,
            }
            for lc in chart.luck_cycles
        ],
        "symbolic_stars": chart.symbolic_stars,
    }
    return json.dumps(data, ensure_ascii=False, indent=2)


READING_TYPE_PROMPTS = {
    "full": """Provide a comprehensive Saju reading covering:
1. Day Master analysis and overall chart character
2. Personality and core nature
3. Career and wealth potential
4. Relationships and love life
5. Health considerations
6. Luck Cycles overview (major life periods)
7. Key symbolic stars and their influence
8. Favorable/unfavorable elements and practical advice""",

    "personality": """Focus on a deep personality reading:
1. Day Master character and core identity
2. Emotional tendencies and inner world
3. Social style and communication
4. Strengths and growth areas
5. How the Ten Gods shape behavior patterns""",

    "career": """Focus on career and wealth analysis:
1. Natural career aptitudes based on Day Master and Ten Gods
2. Wealth potential (정재/편재 analysis)
3. Authority and leadership patterns (정관/편관)
4. Best career timing based on Luck Cycles
5. Favorable industries based on elemental needs""",

    "love": """Focus on relationships and compatibility:
1. Romantic nature based on Day Master and Day Branch
2. Spouse palace analysis (일지/日支)
3. Peach Blossom stars and attraction patterns
4. Relationship timing in Luck Cycles
5. Compatibility insights and advice""",

    "yearly": """Provide a yearly fortune reading for the current year:
1. How this year's energy interacts with the natal chart
2. Career and financial outlook
3. Relationship developments
4. Health watch areas
5. Month-by-month highlights
6. Lucky and challenging periods""",
}


async def generate_reading(
    chart: SajuChart,
    reading_type: str = "full",
    language: str = "en",
) -> str:
    """
    Generate a Saju reading using Claude API.

    Args:
        chart: The computed SajuChart
        reading_type: One of "full", "personality", "career", "love", "yearly"
        language: "en" or "ko"
    """
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY environment variable is not set")

    client = anthropic.AsyncAnthropic(api_key=api_key)

    chart_data = _chart_to_prompt_data(chart)
    type_prompt = READING_TYPE_PROMPTS.get(reading_type, READING_TYPE_PROMPTS["full"])

    lang_instruction = ""
    if language == "ko":
        lang_instruction = "\n\nIMPORTANT: Write the entire reading in Korean (한국어). Use 존댓말 (formal respectful speech). Include Chinese characters in parentheses for technical terms."
    else:
        lang_instruction = "\n\nWrite the reading in English. Include Korean (한국어) and Chinese (漢字) terms in parentheses for authenticity."

    user_prompt = f"""Here is the precisely computed Saju chart data:

```json
{chart_data}
```

{type_prompt}{lang_instruction}"""

    message = await client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=4000,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_prompt}],
    )

    return message.content[0].text
