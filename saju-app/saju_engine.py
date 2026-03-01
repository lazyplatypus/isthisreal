"""
Deterministic Saju (사주) Calculation Engine.

Uses sxtwl (C++ backend) for precise Four Pillars calculation based on
astronomical solar term data. Korean lunar calendar for solar-lunar conversion.

NEVER delegates calculation to an LLM — only deterministic math here.
"""

import sxtwl
from korean_lunar_calendar import KoreanLunarCalendar
from models import (
    GanZhi, Pillar, ElementBalance, LuckCycle, SajuChart, BirthInput
)

# ─── Reference Data ──────────────────────────────────────────────────────────

HEAVENLY_STEMS = [
    {"cn": "甲", "kr": "갑", "en": "Jia",  "element": "wood",  "element_kr": "목", "yin_yang": "yang", "yin_yang_kr": "양"},
    {"cn": "乙", "kr": "을", "en": "Yi",   "element": "wood",  "element_kr": "목", "yin_yang": "yin",  "yin_yang_kr": "음"},
    {"cn": "丙", "kr": "병", "en": "Bing", "element": "fire",  "element_kr": "화", "yin_yang": "yang", "yin_yang_kr": "양"},
    {"cn": "丁", "kr": "정", "en": "Ding", "element": "fire",  "element_kr": "화", "yin_yang": "yin",  "yin_yang_kr": "음"},
    {"cn": "戊", "kr": "무", "en": "Wu",   "element": "earth", "element_kr": "토", "yin_yang": "yang", "yin_yang_kr": "양"},
    {"cn": "己", "kr": "기", "en": "Ji",   "element": "earth", "element_kr": "토", "yin_yang": "yin",  "yin_yang_kr": "음"},
    {"cn": "庚", "kr": "경", "en": "Geng", "element": "metal", "element_kr": "금", "yin_yang": "yang", "yin_yang_kr": "양"},
    {"cn": "辛", "kr": "신", "en": "Xin",  "element": "metal", "element_kr": "금", "yin_yang": "yin",  "yin_yang_kr": "음"},
    {"cn": "壬", "kr": "임", "en": "Ren",  "element": "water", "element_kr": "수", "yin_yang": "yang", "yin_yang_kr": "양"},
    {"cn": "癸", "kr": "계", "en": "Gui",  "element": "water", "element_kr": "수", "yin_yang": "yin",  "yin_yang_kr": "음"},
]

EARTHLY_BRANCHES = [
    {"cn": "子", "kr": "자", "en": "Zi",   "animal_en": "Rat",     "animal_kr": "쥐",   "element": "water", "element_kr": "수", "yin_yang": "yang", "yin_yang_kr": "양", "hidden": [9]},
    {"cn": "丑", "kr": "축", "en": "Chou", "animal_en": "Ox",      "animal_kr": "소",   "element": "earth", "element_kr": "토", "yin_yang": "yin",  "yin_yang_kr": "음", "hidden": [5, 9, 7]},
    {"cn": "寅", "kr": "인", "en": "Yin",  "animal_en": "Tiger",   "animal_kr": "호랑이","element": "wood",  "element_kr": "목", "yin_yang": "yang", "yin_yang_kr": "양", "hidden": [0, 2, 4]},
    {"cn": "卯", "kr": "묘", "en": "Mao",  "animal_en": "Rabbit",  "animal_kr": "토끼", "element": "wood",  "element_kr": "목", "yin_yang": "yin",  "yin_yang_kr": "음", "hidden": [1]},
    {"cn": "辰", "kr": "진", "en": "Chen", "animal_en": "Dragon",  "animal_kr": "용",   "element": "earth", "element_kr": "토", "yin_yang": "yang", "yin_yang_kr": "양", "hidden": [4, 1, 9]},
    {"cn": "巳", "kr": "사", "en": "Si",   "animal_en": "Snake",   "animal_kr": "뱀",   "element": "fire",  "element_kr": "화", "yin_yang": "yin",  "yin_yang_kr": "음", "hidden": [2, 4, 6]},
    {"cn": "午", "kr": "오", "en": "Wu",   "animal_en": "Horse",   "animal_kr": "말",   "element": "fire",  "element_kr": "화", "yin_yang": "yang", "yin_yang_kr": "양", "hidden": [3, 5]},
    {"cn": "未", "kr": "미", "en": "Wei",  "animal_en": "Goat",    "animal_kr": "양",   "element": "earth", "element_kr": "토", "yin_yang": "yin",  "yin_yang_kr": "음", "hidden": [5, 3, 1]},
    {"cn": "申", "kr": "신", "en": "Shen", "animal_en": "Monkey",  "animal_kr": "원숭이","element": "metal", "element_kr": "금", "yin_yang": "yang", "yin_yang_kr": "양", "hidden": [6, 8, 4]},
    {"cn": "酉", "kr": "유", "en": "You",  "animal_en": "Rooster", "animal_kr": "닭",   "element": "metal", "element_kr": "금", "yin_yang": "yin",  "yin_yang_kr": "음", "hidden": [7]},
    {"cn": "戌", "kr": "술", "en": "Xu",   "animal_en": "Dog",     "animal_kr": "개",   "element": "earth", "element_kr": "토", "yin_yang": "yang", "yin_yang_kr": "양", "hidden": [4, 7, 3]},
    {"cn": "亥", "kr": "해", "en": "Hai",  "animal_en": "Pig",     "animal_kr": "돼지", "element": "water", "element_kr": "수", "yin_yang": "yin",  "yin_yang_kr": "음", "hidden": [8, 0]},
]

# Element index: wood=0, fire=1, earth=2, metal=3, water=4
ELEMENT_ORDER = ["wood", "fire", "earth", "metal", "water"]
ELEMENT_KR = {"wood": "목", "fire": "화", "earth": "토", "metal": "금", "water": "수"}

# Generating cycle: wood→fire→earth→metal→water→wood
GENERATES = {"wood": "fire", "fire": "earth", "earth": "metal", "metal": "water", "water": "wood"}

# Controlling cycle: wood→earth→water→fire→metal→wood
CONTROLS = {"wood": "earth", "earth": "water", "water": "fire", "fire": "metal", "metal": "wood"}

# Reverse lookups
GENERATED_BY = {v: k for k, v in GENERATES.items()}
CONTROLLED_BY = {v: k for k, v in CONTROLS.items()}

# Ten Gods (십성/十神)
TEN_GODS = {
    "same_yang":   {"en": "Friend",           "kr": "비견", "cn": "比肩"},
    "same_yin":    {"en": "Rob Wealth",        "kr": "겁재", "cn": "劫財"},
    "gen_yang":    {"en": "Eating God",         "kr": "식신", "cn": "食神"},
    "gen_yin":     {"en": "Hurting Officer",    "kr": "상관", "cn": "傷官"},
    "ctrl_yang":   {"en": "Indirect Wealth",    "kr": "편재", "cn": "偏財"},
    "ctrl_yin":    {"en": "Direct Wealth",      "kr": "정재", "cn": "正財"},
    "ctrlby_yang": {"en": "Seven Killings",     "kr": "편관", "cn": "偏官"},
    "ctrlby_yin":  {"en": "Direct Officer",     "kr": "정관", "cn": "正官"},
    "genby_yang":  {"en": "Indirect Seal",      "kr": "편인", "cn": "偏印"},
    "genby_yin":   {"en": "Direct Seal",        "kr": "정인", "cn": "正印"},
}

# Hour to Earthly Branch mapping
HOUR_TO_BRANCH = [
    (23, 1, 0),   # 子 Zi: 23:00-00:59
    (1, 3, 1),    # 丑 Chou: 01:00-02:59
    (3, 5, 2),    # 寅 Yin: 03:00-04:59
    (5, 7, 3),    # 卯 Mao: 05:00-06:59
    (7, 9, 4),    # 辰 Chen: 07:00-08:59
    (9, 11, 5),   # 巳 Si: 09:00-10:59
    (11, 13, 6),  # 午 Wu: 11:00-12:59
    (13, 15, 7),  # 未 Wei: 13:00-14:59
    (15, 17, 8),  # 申 Shen: 15:00-16:59
    (17, 19, 9),  # 酉 You: 17:00-18:59
    (19, 21, 10), # 戌 Xu: 19:00-20:59
    (21, 23, 11), # 亥 Hai: 21:00-22:59
]

# Symbolic Stars (신살) — key ones
# Peach Blossom (도화살/桃花): based on Day Branch
PEACH_BLOSSOM = {
    0: 9, 1: 6, 2: 3, 3: 0, 4: 9, 5: 6,
    6: 3, 7: 0, 8: 9, 9: 6, 10: 3, 11: 0
}

# Nobleman Star (천을귀인/天乙貴人): based on Day Stem
NOBLEMAN = {
    0: [1, 7],   # 甲 → 丑未
    1: [0, 8],   # 乙 → 子申
    2: [9, 11],  # 丙 → 酉亥
    3: [9, 11],  # 丁 → 酉亥
    4: [1, 7],   # 戊 → 丑未
    5: [0, 8],   # 己 → 子申
    6: [1, 7],   # 庚 → 丑未
    7: [2, 6],   # 辛 → 寅午
    8: [5, 3],   # 壬 → 巳卯
    9: [5, 3],   # 癸 → 巳卯
}

# Sky Horse (역마살/驛馬): based on Year/Day Branch
SKY_HORSE = {
    0: 2, 1: 11, 2: 8, 3: 5, 4: 2, 5: 11,
    6: 8, 7: 5, 8: 2, 9: 11, 10: 8, 11: 5
}


# ─── Helper Functions ────────────────────────────────────────────────────────

def hour_to_branch_idx(hour: int) -> int:
    """Convert hour (0-23) to Earthly Branch index."""
    if hour == 23 or hour == 0:
        return 0  # 子 Zi
    for start, end, idx in HOUR_TO_BRANCH:
        if start <= hour < end:
            return idx
    return 0


def make_ganzhi(stem_idx: int, branch_idx: int) -> GanZhi:
    """Create a GanZhi model from stem and branch indices."""
    stem = HEAVENLY_STEMS[stem_idx]
    branch = EARTHLY_BRANCHES[branch_idx]
    return GanZhi(
        stem_idx=stem_idx,
        branch_idx=branch_idx,
        stem_kr=stem["kr"],
        stem_cn=stem["cn"],
        stem_en=stem["en"],
        branch_kr=branch["kr"],
        branch_cn=branch["cn"],
        branch_en=branch["en"],
        branch_animal_kr=branch["animal_kr"],
        branch_animal_en=branch["animal_en"],
        element=stem["element"],
        element_kr=stem["element_kr"],
        yin_yang=stem["yin_yang"],
        yin_yang_kr=stem["yin_yang_kr"],
    )


def get_ten_god(day_stem_idx: int, other_stem_idx: int) -> tuple[str, str]:
    """
    Determine the Ten God relationship between the Day Master and another stem.
    Returns (english_name, korean_name).
    """
    if day_stem_idx == other_stem_idx:
        god = TEN_GODS["same_yang"]
        return god["en"], god["kr"]

    day_elem = HEAVENLY_STEMS[day_stem_idx]["element"]
    day_yy = HEAVENLY_STEMS[day_stem_idx]["yin_yang"]
    other_elem = HEAVENLY_STEMS[other_stem_idx]["element"]
    other_yy = HEAVENLY_STEMS[other_stem_idx]["yin_yang"]

    same_polarity = day_yy == other_yy
    suffix = "yang" if same_polarity else "yin"

    if day_elem == other_elem:
        key = f"same_{suffix}"
    elif GENERATES.get(day_elem) == other_elem:
        key = f"gen_{suffix}"
    elif CONTROLS.get(day_elem) == other_elem:
        key = f"ctrl_{suffix}"
    elif CONTROLLED_BY.get(day_elem) == other_elem:
        key = f"ctrlby_{suffix}"
    elif GENERATED_BY.get(day_elem) == other_elem:
        key = f"genby_{suffix}"
    else:
        return "Unknown", "미상"

    god = TEN_GODS[key]
    return god["en"], god["kr"]


def compute_element_balance(pillars: list[Pillar]) -> ElementBalance:
    """Count element occurrences across all stems and hidden stems."""
    counts = {"wood": 0, "fire": 0, "earth": 0, "metal": 0, "water": 0}

    for p in pillars:
        # Count the heavenly stem's element
        counts[p.ganzhi.element] += 2  # Main stems weighted more

        # Count the earthly branch's element
        branch = EARTHLY_BRANCHES[p.ganzhi.branch_idx]
        counts[branch["element"]] += 1

        # Count hidden stems
        for hs_idx in branch["hidden"]:
            hs_elem = HEAVENLY_STEMS[hs_idx]["element"]
            counts[hs_elem] += 1

    dominant = max(counts, key=counts.get)
    weakest = min(counts, key=counts.get)

    return ElementBalance(
        wood=counts["wood"],
        fire=counts["fire"],
        earth=counts["earth"],
        metal=counts["metal"],
        water=counts["water"],
        dominant=dominant,
        weakest=weakest,
    )


def compute_luck_cycles(
    year_stem_idx: int,
    month_gz: tuple[int, int],
    gender: str,
    birth_year: int,
    birth_month: int,
    birth_day: int,
) -> list[LuckCycle]:
    """
    Compute 大运 (Luck Cycles / 대운).

    Direction rule:
    - Male + Yang year stem OR Female + Yin year stem → Forward
    - Male + Yin year stem OR Female + Yang year stem → Backward
    """
    year_yy = HEAVENLY_STEMS[year_stem_idx]["yin_yang"]
    forward = (gender == "male" and year_yy == "yang") or \
              (gender == "female" and year_yy == "yin")

    month_stem, month_branch = month_gz
    cycles = []

    # Approximate starting age (simplified — full version counts days to next solar term)
    start_age = 3 if forward else 4

    for i in range(1, 9):  # 8 luck cycles
        if forward:
            new_stem = (month_stem + i) % 10
            new_branch = (month_branch + i) % 12
        else:
            new_stem = (month_stem - i) % 10
            new_branch = (month_branch - i) % 12

        stem = HEAVENLY_STEMS[new_stem]
        branch = EARTHLY_BRANCHES[new_branch]

        cycle_start = start_age + (i - 1) * 10
        cycles.append(LuckCycle(
            start_age=cycle_start,
            end_age=cycle_start + 9,
            stem_kr=stem["kr"],
            stem_cn=stem["cn"],
            branch_kr=branch["kr"],
            branch_cn=branch["cn"],
            branch_animal_kr=branch["animal_kr"],
            element=stem["element"],
            element_kr=stem["element_kr"],
        ))

    return cycles


def detect_symbolic_stars(day_stem_idx: int, day_branch_idx: int, all_branches: list[int]) -> list[dict]:
    """Detect major symbolic stars (신살) in the chart."""
    stars = []

    # Peach Blossom (도화살)
    pb_target = PEACH_BLOSSOM.get(day_branch_idx)
    for i, br in enumerate(all_branches):
        if br == pb_target:
            pillar_names = ["Year", "Month", "Day", "Hour"]
            stars.append({
                "name_en": "Peach Blossom",
                "name_kr": "도화살",
                "name_cn": "桃花",
                "pillar": pillar_names[i],
                "description_en": "Charm and attractiveness; strong romantic appeal",
                "description_kr": "매력과 이성 관계에서의 인기를 나타냄",
            })

    # Nobleman Star (천을귀인)
    nobleman_targets = NOBLEMAN.get(day_stem_idx, [])
    for i, br in enumerate(all_branches):
        if br in nobleman_targets:
            pillar_names = ["Year", "Month", "Day", "Hour"]
            stars.append({
                "name_en": "Nobleman Star",
                "name_kr": "천을귀인",
                "name_cn": "天乙貴人",
                "pillar": pillar_names[i],
                "description_en": "Noble helpers appear in times of need; protection and support",
                "description_kr": "어려울 때 귀인의 도움을 받음",
            })

    # Sky Horse (역마살)
    sh_target = SKY_HORSE.get(day_branch_idx)
    for i, br in enumerate(all_branches):
        if br == sh_target:
            pillar_names = ["Year", "Month", "Day", "Hour"]
            stars.append({
                "name_en": "Sky Horse",
                "name_kr": "역마살",
                "name_cn": "驛馬",
                "pillar": pillar_names[i],
                "description_en": "Travel, movement, and change; dynamic energy",
                "description_kr": "이동, 변화, 활동적인 에너지를 나타냄",
            })

    # Six Clashes (육충) — check for opposing branches
    CLASHES = {0: 6, 1: 7, 2: 8, 3: 9, 4: 10, 5: 11}
    CLASHES.update({v: k for k, v in CLASHES.items()})
    pillar_names = ["Year", "Month", "Day", "Hour"]
    for i in range(len(all_branches)):
        for j in range(i + 1, len(all_branches)):
            if CLASHES.get(all_branches[i]) == all_branches[j]:
                stars.append({
                    "name_en": "Six Clash",
                    "name_kr": "충",
                    "name_cn": "六沖",
                    "pillar": f"{pillar_names[i]}-{pillar_names[j]}",
                    "description_en": f"Clash between {pillar_names[i]} and {pillar_names[j]} pillars — conflict or transformation",
                    "description_kr": f"{pillar_names[i]}주와 {pillar_names[j]}주 사이의 충돌 — 갈등 또는 변화",
                })

    return stars


# ─── Main Calculation ────────────────────────────────────────────────────────

def calculate_saju(birth: BirthInput) -> SajuChart:
    """
    Calculate a complete Saju chart from birth information.

    Uses sxtwl for precise astronomical Four Pillars calculation
    and korean-lunar-calendar for lunar date conversion.
    """
    # Get the day from sxtwl
    day = sxtwl.fromSolar(birth.year, birth.month, birth.day)

    # Get Four Pillars GanZhi from sxtwl
    year_gz = day.getYearGZ()
    month_gz = day.getMonthGZ()
    day_gz = day.getDayGZ()
    hour_gz = sxtwl.getShiGz(day_gz.tg, hour_to_branch_idx(birth.hour))

    # Build GanZhi models
    year_ganzhi = make_ganzhi(year_gz.tg, year_gz.dz)
    month_ganzhi = make_ganzhi(month_gz.tg, month_gz.dz)
    day_ganzhi = make_ganzhi(day_gz.tg, day_gz.dz)
    hour_ganzhi = make_ganzhi(hour_gz.tg, hour_gz.dz)

    # Day Master
    day_stem = HEAVENLY_STEMS[day_gz.tg]
    dm_element = day_stem["element"]
    dm_element_kr = day_stem["element_kr"]
    dm_yy = day_stem["yin_yang"]

    # Ten Gods for each pillar (relative to Day Master)
    def make_pillar(name_en, name_kr, ganzhi, stem_idx):
        ten_god_en, ten_god_kr = get_ten_god(day_gz.tg, stem_idx)
        branch_idx = ganzhi.branch_idx
        branch_data = EARTHLY_BRANCHES[branch_idx]
        hidden = []
        for hs_idx in branch_data["hidden"]:
            hs_god_en, hs_god_kr = get_ten_god(day_gz.tg, hs_idx)
            hidden.append({
                "stem_cn": HEAVENLY_STEMS[hs_idx]["cn"],
                "stem_kr": HEAVENLY_STEMS[hs_idx]["kr"],
                "element": HEAVENLY_STEMS[hs_idx]["element"],
                "element_kr": HEAVENLY_STEMS[hs_idx]["element_kr"],
                "ten_god_en": hs_god_en,
                "ten_god_kr": hs_god_kr,
            })
        return Pillar(
            name_en=name_en,
            name_kr=name_kr,
            ganzhi=ganzhi,
            stem_ten_god=ten_god_en,
            stem_ten_god_kr=ten_god_kr,
            hidden_stems=hidden,
        )

    year_pillar = make_pillar("Year", "년주", year_ganzhi, year_gz.tg)
    month_pillar = make_pillar("Month", "월주", month_ganzhi, month_gz.tg)
    day_pillar = make_pillar("Day", "일주", day_ganzhi, day_gz.tg)
    hour_pillar = make_pillar("Hour", "시주", hour_ganzhi, hour_gz.tg)

    pillars = [year_pillar, month_pillar, day_pillar, hour_pillar]

    # Element balance
    element_balance = compute_element_balance(pillars)

    # Luck cycles
    luck_cycles = compute_luck_cycles(
        year_gz.tg,
        (month_gz.tg, month_gz.dz),
        birth.gender,
        birth.year, birth.month, birth.day,
    )

    # Symbolic stars
    all_branches = [year_gz.dz, month_gz.dz, day_gz.dz, hour_gz.dz]
    symbolic_stars = detect_symbolic_stars(day_gz.tg, day_gz.dz, all_branches)

    # Lunar date conversion
    calendar = KoreanLunarCalendar()
    calendar.setSolarDate(birth.year, birth.month, birth.day)
    lunar_iso = calendar.LunarIsoFormat()

    return SajuChart(
        birth_solar=f"{birth.year}-{birth.month:02d}-{birth.day:02d} {birth.hour:02d}:{birth.minute:02d}",
        birth_lunar=lunar_iso,
        gender=birth.gender,
        gender_kr="남성" if birth.gender == "male" else "여성",
        name=birth.name,
        year_pillar=year_pillar,
        month_pillar=month_pillar,
        day_pillar=day_pillar,
        hour_pillar=hour_pillar,
        day_master=f"{day_stem['cn']} {day_stem['en']}",
        day_master_kr=f"{day_stem['kr']} ({day_stem['cn']})",
        day_master_element=dm_element,
        day_master_element_kr=dm_element_kr,
        day_master_yin_yang=dm_yy,
        element_balance=element_balance,
        luck_cycles=luck_cycles,
        symbolic_stars=symbolic_stars,
    )
