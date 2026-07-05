#!/usr/bin/env python3
"""一亩三分地 community data scraper for skill-builder.

Scrapes immigration boards using Scrapling (JS-aware HTTP client) and writes
clean_community.py-compatible files to raw/community/1p3a/.

If Scrapling is unavailable or --demo is passed, generates realistic synthetic
posts covering both US and Canada immigration topics.

Target boards (real crawl):
  - 美国签证 / OPT & H-1B:  https://www.1point3acres.com/bbs/forum-82-1.html
  - 移民 / 绿卡:             https://www.1point3acres.com/bbs/forum-214-1.html
  - 加拿大签证 & 移民:        https://www.1point3acres.com/bbs/forum-233-1.html

Usage:
    python scripts/scrape_1p3a.py --skill immigration-planning --demo
    python scripts/scrape_1p3a.py --skill immigration-planning --posts 15
    python scripts/scrape_1p3a.py --skill immigration-planning \
        --boards us_visa immigration canada --posts 12
"""

import argparse
import re
import sys
import re
import time
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from utils import get_skill_dir

# ── Board config (real crawl) ────────────────────────────────────────────────
BOARDS = {
    "us_visa": {
        "url": "https://www.1point3acres.com/bbs/forum-82-1.html",
        "label": "美国签证/OPT/H-1B",
        "country": "us",
    },
    "immigration": {
        "url": "https://www.1point3acres.com/bbs/forum-214-1.html",
        "label": "移民/绿卡",
        "country": "us",
    },
    "canada": {
        "url": "https://www.1point3acres.com/bbs/forum-233-1.html",
        "label": "加拿大签证&移民",
        "country": "canada",
    },
    # grad-school-selection boards
    "phd_application": {
        "url": "https://www.1point3acres.com/bbs/forum-198-1.html",
        "label": "PhD申请",
        "country": "us",
    },
    "academia": {
        "url": "https://www.1point3acres.com/bbs/forum-247-1.html",
        "label": "学术/科研",
        "country": "us",
    },
    # job-search-strategy boards
    "job_search": {
        "url": "https://www.1point3acres.com/bbs/forum-94-1.html",
        "label": "求职/工作",
        "country": "us",
    },
    "career_canada": {
        "url": "https://www.1point3acres.com/bbs/forum-242-1.html",
        "label": "加拿大求职",
        "country": "canada",
    },
}

SKILL_BOARDS: dict[str, list[str]] = {
    "immigration-planning": ["us_visa", "immigration", "canada"],
    "grad-school-selection": ["phd_application", "academia"],
    "job-search-strategy": ["job_search", "career_canada"],
}

MIN_REPLIES = 5
MIN_LIKES = 3
MAX_REPLIES_PER_POST = 15

# Regions implied by each board key
BOARD_REGIONS: dict[str, list[str]] = {
    "us_visa": ["us"],
    "immigration": ["us"],
    "canada": ["canada"],
    "phd_application": ["us", "canada"],
    "academia": ["us", "canada"],
    "job_search": ["us"],
    "career_canada": ["canada"],
}


# ── Output format helpers ────────────────────────────────────────────────────

def _slug(text: str) -> str:
    text = re.sub(r"[^\w一-鿿]+", "_", text).strip("_")
    return text[:50]


def _format_post(section: str, title: str, body: str, likes: int, url: str,
                 replies: list[tuple[str, int]], scraped_at: str,
                 board_key: str = "", regions: list[str] | None = None) -> str:
    import json as _json
    r = regions if regions is not None else BOARD_REGIONS.get(board_key, ["us", "canada"])
    lines = [
        "platform: 1p3a",
        f"section: {section}",
        f"regions: {_json.dumps(r)}",
        f"post_title: {title}",
        f"post_likes: {likes}",
        f"post_url: {url}",
        f"scraped_at: {scraped_at}",
        "",
        "内容：",
        body.strip(),
        "",
        "回复：",
    ]
    for i, (text, vote) in enumerate(replies, 1):
        lines.append(f"[{i}] (likes: {vote})")
        lines.append(text.strip())
        lines.append("")
    return "\n".join(lines)


# ── Real Scrapling crawler ───────────────────────────────────────────────────

def scrape_with_scrapling(boards: list[str], posts_per_board: int,
                          out_dir: Path) -> list[Path]:
    # Scrapling v0.4.9+: use class-method .fetch() — no instantiation needed
    try:
        from scrapling.fetchers import StealthyFetcher
    except ImportError:
        sys.exit("scrapling[all] not installed. Run: pip install 'scrapling[all]'")

    written: list[Path] = []
    scraped_at = datetime.utcnow().strftime("%Y-%m-%d")

    for board_key in boards:
        board = BOARDS[board_key]
        print(f"  Scraping 一亩三分地 [{board['label']}]…")
        try:
            page = StealthyFetcher.fetch(board["url"], headless=True, network_idle=True)
        except Exception as e:
            print(f"    Warning: could not load board {board_key}: {e}")
            continue

        # html_content is empty due to GBK encoding confusion in Scrapling.
        # _raw_body contains the full GBK response bytes — decode and regex-extract thread IDs.
        raw = page._raw_body if hasattr(page, "_raw_body") else None
        if raw:
            # Playwright converts GBK→Unicode internally, so _raw_body bytes are UTF-8
            decoded = raw.decode("utf-8", errors="replace") if isinstance(raw, bytes) else raw
            thread_ids = list(dict.fromkeys(re.findall(r"thread-(\d+)-", decoded)))
        else:
            thread_ids = []

        if not thread_ids:
            print(f"    Warning: no thread IDs found in raw body for {board_key}")
            continue

        hrefs = [f"https://www.1point3acres.com/bbs/thread-{tid}-1-1.html"
                 for tid in thread_ids[:posts_per_board * 4]]
        count = 0
        for href in hrefs:

            try:
                post_page = StealthyFetcher.fetch(href, headless=True)
                time.sleep(1.5)  # polite delay
            except Exception as e:
                print(f"    Skipping {href}: {e}")
                continue

            # html_content is always empty on 1p3a (GBK page; Playwright converts
            # internally to UTF-8 stored in _raw_body) — use _raw_body + regex
            post_raw = post_page._raw_body if hasattr(post_page, "_raw_body") else None
            if not post_raw:
                continue
            post_decoded = post_raw.decode("utf-8", errors="replace") if isinstance(post_raw, bytes) else post_raw

            title_m = re.search(r'id="thread_subject"[^>]*>([^<]+)<', post_decoded)
            if not title_m:
                continue
            title = title_m.group(1).strip()

            # div.t_f contains the post body in Discuz/1p3a
            body_blocks = re.findall(r'class="t_f"[^>]*>(.*?)</td>', post_decoded, re.DOTALL)
            if not body_blocks:
                continue
            body = re.sub(r'<[^>]+>', ' ', body_blocks[0]).strip()
            body = re.sub(r'\s+', ' ', body).strip()

            # Skip paywalled posts (login required message)
            if '您需要 登录' in body or '登录才可以' in body or len(body) < 100:
                continue

            likes = 0  # like counts not accessible without login
            replies: list[tuple[str, int]] = []
            for rb in body_blocks[1:MAX_REPLIES_PER_POST + 1]:
                rtext = re.sub(r'<[^>]+>', ' ', rb).strip()
                rtext = re.sub(r'\s+', ' ', rtext).strip()
                if rtext and '您需要 登录' not in rtext and len(rtext) >= 50:
                    replies.append((rtext, 0))
            replies.sort(key=lambda x: x[1], reverse=True)

            content = _format_post(
                section=board["label"],
                title=title,
                body=body,
                likes=likes,
                url=href,
                replies=replies,
                scraped_at=scraped_at,
            )

            fname = f"{board_key}_{_slug(title)}.txt"
            path = out_dir / fname
            path.write_text(content, encoding="utf-8")
            written.append(path)
            count += 1
            print(f"    [{count}] {title[:60]} ({likes} likes)")

            if count >= posts_per_board:
                break

    return written


# ── Demo data (realistic synthetic posts) ───────────────────────────────────

DEMO_POSTS = [
    # ═══════════════════════════════════════════════════════════
    # 美国签证 / OPT / H-1B
    # ═══════════════════════════════════════════════════════════
    {
        "board": "us_visa",
        "section": "美国签证/OPT/H-1B",
        "title": "H-1B三连败后成功上岸cap-exempt经历分享",
        "likes": 312,
        "url": "https://www.1point3acres.com/bbs/thread-demo-us1",
        "body": """花了三年抽H-1B，2021、2022、2023年连续落选，终于在2024年通过cap-exempt路线解决了身份问题，来分享一下经验。

我的情况：
- F-1 → OPT → STEM OPT（用光了）
- 雇主是一家百人左右的科技公司，H-1B两次落选后说无法再等
- 我自己另找出路，通过大学researcher合作的方式找到了解决方案

Cap-exempt路线具体是什么：
联邦政府豁免的雇主（大学、非盈利研究机构）可以不占H-1B名额随时申请。我通过认识的教授，在大学lab做兼职研究员（每周10-15小时），同时大学帮我申请H-1B。原来的公司不会申请，但大学可以。

申请后，我以H-1B身份继续在原公司全职工作（concurrent employment），大学这边做研究是真实的合作项目。

重要提醒：
1. 大学researcher的工作必须是真实的，不能只是挂名
2. 律师费和申请费（premium processing）大概$4000-6000
3. 这条路需要有教授愿意合作，不是人人都能找到的

这条路合法但复杂，强烈建议找专门做移民的律师，不要DIY。""",
        "replies": [
            ("请问大学那边怎么找到愿意合作的教授的？是通过导师介绍还是自己冷联系的？", 89),
            ("cap-exempt的H-1B和普通H-1B有什么区别吗？以后换工作还需要H-1B transfer吗？", 67),
            ("我也是三连败，现在STEM OPT快到期了，请问concurrent employment在税务上怎么处理？", 56),
            ("这条路真的很有用的信息。补充一下：国家实验室（DOE下属的那种）也是cap-exempt，可以去查一下", 45),
            ("O-1签证有没有考虑过？听说科技行业还是有机会够到O-1标准的", 34),
        ],
    },
    {
        "board": "us_visa",
        "section": "美国签证/OPT/H-1B",
        "title": "OPT期间换工作完整攻略——我踩过的所有坑",
        "likes": 267,
        "url": "https://www.1point3acres.com/bbs/thread-demo-us2",
        "body": """在OPT期间换了两次工作，第一次差点出问题，整理一下正确流程供大家参考。

OPT期间换工作的核心：
OPT是你的工作许可，不是雇主的担保，所以换工作本身是允许的。但有几个关键点：

1. 工作必须和你专业相关（DSO需要在SEVIS里更新）
2. 换工作后需要在10天内通知DSO更新SEVIS记录
3. 失业天数有限制：整个OPT期间累计不超过90天

我第一次换工作犯的错误：
- 先辞职，再找工作 → 结果gap了95天，超过90天限制
- 我不知道90天是累计计算的（不是单次）
- DSO后来帮我补救了，但那段时间非常焦虑

第二次换工作做对的事：
- 先拿到offer letter，确认入职日期，再提辞职
- 辞职当天就联系DSO更新SEVIS
- 留了15天buffer，不到10天就入职了

STEM OPT额外注意：
- 需要新公司在E-Verify里注册
- 需要重新提交I-983 Training Plan
- 雇主需要在你开始工作前就完成这些，不是入职后再补

最重要的一点：换工作之前一定先咨询你的DSO，不要假设没问题。""",
        "replies": [
            ("90天失业限制真的很多人不知道！我之前gap了4个月以为没事，后来H-1B RFE被问到这段时间", 134),
            ("请问SEVIS更新是自己操作还是DSO操作？需要什么材料？", 89),
            ("我现在STEM OPT，新公司说E-Verify已经注册了，但I-983能入职后再交吗？", 67),
            ("关于90天：自由职业/freelance算不算employed？我在找正式工作期间接了一些项目", 56),
            ("补充：OPT EAD上写的employer是允许有变化的，OPT EAD本身不需要重新申请", 45),
        ],
    },
    {
        "board": "us_visa",
        "section": "美国签证/OPT/H-1B",
        "title": "Day 1 CPT的真实风险——一个差点中招的故事",
        "likes": 445,
        "url": "https://www.1point3acres.com/bbs/thread-demo-us3",
        "body": """这帖子可能会让一些人不舒服，但我觉得必须说清楚。

我当时的情况：
本科毕业，工作了两年，想继续在美国。朋友推荐了一个"可以Day 1就给CPT"的学校，说很多人都这么做。我当时差点报名，最后因为种种原因没有去，现在庆幸不已。

Day 1 CPT的问题在哪里：
1. CPT本来要求"学习计划的组成部分"，即课程设置里必须明确要求实习/工作
2. USCIS从来没有明确说Day 1 CPT违法，但他们通过审查案例来否认某些授权
3. 一旦USCIS认定你之前的CPT授权无效，你之前的工作就变成了非法工作，可能触发unlawful presence，导致3年或10年的入境禁令

真实案例（我朋友的经历）：
她用Day 1 CPT工作了两年，后来申请H-1B，RFE专门问了CPT授权的合理性。虽然最终批了，但经历了半年的等待和焦虑，律师费多花了几千美元。

我的建议：
如果你的最终目标是长期留在美国，Day 1 CPT提供的短期工作资格不值得冒这个风险。STEM OPT是正规路线，好好规划。

当然每个人情况不同，在做决定前务必咨询持牌移民律师，不要只听朋友说或者听学校说。""",
        "replies": [
            ("这个帖子真的很重要。我身边有朋友去了这种学校，很担心他们未来的情况", 223),
            ("请问H-1B RFE里问CPT的情况常见吗？我朋友现在也在用Day 1 CPT，很担心", 167),
            ("有没有人知道哪些学校是被SEVP警告过的？有没有公开名单？", 134),
            ("unlawful presence的3年/10年ban是真的很严重，但我理解很多人当时不知道这个风险", 112),
            ("O1/EB1走extraordinary ability路线是那些陷入Day 1 CPT的人唯一的希望吗？", 89),
        ],
    },
    {
        "board": "immigration",
        "section": "移民/绿卡",
        "title": "EB-2 NIW自己申请全攻略（I-140批准，分享经验）",
        "likes": 534,
        "url": "https://www.1point3acres.com/bbs/thread-demo-us4",
        "body": """历经14个月，I-140终于批准了。全程自己申请，没有用律师，来分享一下经验。

我的背景：
- PhD（工科），美国毕业
- 发表论文6篇，其中第一作者4篇
- 有一定引用量（不算顶尖，但够用）
- 工作经历：postdoc 2年

EB-2 NIW三步测试（Matter of Dhanasar）：

测试一：你的努力是否有实质性价值？
要证明你的研究/工作对美国有实质利益，且这个利益比较宽泛（不只是你的employer）。我的策略：把我的研究与美国国家政策和优先领域挂钩（引用了相关政府报告）。

测试二：你的工作为什么是national in scope？
要证明你的工作影响是全国性的，不只是局部的。我引用了我的研究被其他州的机构和联邦机构引用的证据。

测试三：为什么豁免劳工证书对美国有益？
要证明单独为你做PERM会对美国有害（耽误重要工作），或者你实在太优秀了PERM显得多此一举。

我的材料：
- 10封推荐信（6封独立推荐人，4封合作者）
- 引用证据（Google Scholar + Web of Science截图）
- 期刊审稿邀请
- 会议邀请
- 媒体引用
- 自己写的Personal Statement（最重要！）

Personal Statement我觉得是关键——要讲故事，说明你的工作为什么对美国重要，不是列清单。

如果大家有具体问题可以在回复里问，我尽量回答。""",
        "replies": [
            ("EB-2 NIW对发表文章数量有要求吗？我只有3篇（全部第一作者）但引用量相对高", 234),
            ("自己申请会不会被移民官看低？律师申请成功率更高吗？", 189),
            ("推荐信10封是不是太多了？听说移民官喜欢精炼，有人说6-8封就够", 145),
            ("印度国籍也可以走NIW吗？EB-2 NIW和EB-2 PERM的排期是同一个吗？", 123),
            ("NIW批了之后还要等多久才能拿到绿卡？中国大陆国籍排期现在是哪年？", 98),
            ("Personal Statement字数限制是多少？我看到有人写了10页有人写了3页", 87),
        ],
    },
    {
        "board": "immigration",
        "section": "移民/绿卡",
        "title": "关于H-1B抽签后身份焦虑——说几句心里话",
        "likes": 398,
        "url": "https://www.1point3acres.com/bbs/thread-demo-us5",
        "body": """不是技术帖，就是想说说在美国做international student/worker的心理状态。

连续两年没抽到H-1B，我发现自己有了一些很奇怪的行为模式：

1. 不敢太认同这个地方。心想"反正可能要走"，所以没有好好建立关系，没有好好扎根
2. 在工作上不敢too visible，怕显得indispensable然后公司因此不愿意帮我想替代方案
3. 每年3月到5月处于chronic anxiety状态，抽签结果出来之前很难做任何长期决定
4. 对Plan B（回国、去加拿大）有一种奇怪的抗拒——觉得研究Plan B就等于承认失败

后来我意识到，最后一点是最有害的。

真正帮助我的是：
- 认真研究了加拿大的PGWP和Express Entry路线，发现它是一个我genuinely可以接受的选项，不只是backup
- 和公司HR谈清楚了：如果H-1B第三年也没中，公司支持我转到加拿大office
- 和一个在美国生活超过十年的senior工程师聊了，她说"我也不确定这里是不是permanent，但我选择活在当下"

移民身份的不确定性是真实的压力，但我们常常把"可能要离开"变成了"现在就不能完全在这里"，这个逻辑对我们自己最不公平。

如果你也在等签证，我觉得you're not alone这句话很苍白，但确实是真的。""",
        "replies": [
            ("谢谢你写这个。我现在就是这个状态，3月到5月几乎什么都做不了", 245),
            ("'认真研究Plan B让Plan B变得不那么可怕'——这个思路真的很有用", 198),
            ("工作上不敢visible这点我太有共鸣了。总觉得要be invisible才安全", 167),
            ("我连续三年没中，现在已经回国了。回来之后反而发现生活没有我想象的那么差", 145),
            ("还有一个压力：跟父母解释为什么还不知道能不能留下来。他们每次问我都不知道怎么说", 134),
        ],
    },
    # ═══════════════════════════════════════════════════════════
    # 加拿大签证 & 移民
    # ═══════════════════════════════════════════════════════════
    {
        "board": "canada",
        "section": "加拿大签证&移民",
        "title": "PGWP申请全流程——从毕业到拿到permit只用了5周",
        "likes": 456,
        "url": "https://www.1point3acres.com/bbs/thread-demo-ca1",
        "body": """刚刚拿到PGWP，分享一下完整流程和时间线，希望能帮到正在等待的同学。

我的情况：
- 加拿大2年硕士（所以可以拿3年PGWP）
- 毕业后第3天就提交了申请
- 全程网申，没有去IRCC服务中心

申请材料清单：
1. IMM 5710表格（在线填写）
2. 护照（所有页的彩色扫描）
3. 当前有效学生签证（study permit）
4. 官方成绩单（带学校章）
5. 毕业证明信（registrar office出具，要写明degree和complete date）
6. 照片（符合要求的）

时间线：
- 第0天：提交申请，支付255加元
- 第2天：收到AOR，系统显示"In Progress"
- 第15天：生物信息请求（我之前已经采集过，直接豁免）
- 第35天：收到approval letter，同时发了eTA
- 第40天：实体work permit寄到

注意事项（很重要！）：
1. 学生签证到期不代表你不能留在加拿大，如果PGWP申请已经在处理中，你在加拿大处于"implied status"，可以继续待
2. implied status期间不能工作（除非学生permit允许打工），等PGWP批准才能全职工作
3. 毕业后要在180天内申请，否则资格失效

大家有问题可以问我！""",
        "replies": [
            ("请问毕业证明信和毕业证书有区别吗？registrar的信上要写什么内容才算有效？", 178),
            ("我是1年项目，申请PGWP会给几年？有没有办法延长？", 145),
            ("implied status期间可以出境加拿大吗？如果出境了implied status还存在吗？", 123),
            ("学生permit上写的work permit也会自动延续到PGWP吗？还是要单独申请？", 98),
            ("我的项目是1.5年（3学期），PGWP会给1年还是1.5年？四舍五入吗？", 87),
            ("网申和纸申哪个快一些？我听说现在全部改成网申了？", 67),
        ],
    },
    {
        "board": "canada",
        "section": "加拿大签证&移民",
        "title": "Express Entry CRS从450到490的真实经历——法语是关键",
        "likes": 623,
        "url": "https://www.1point3acres.com/bbs/thread-demo-ca2",
        "body": """花了9个月把CRS从450提到490，最终在一次tech worker专项抽签中拿到ITA。分享一下我的打分优化路径。

我的基础分（450分）：
- 年龄：30岁
- 学历：加拿大硕士学位
- 英语：IELTS 7.5/7.5/8.0/7.5，CLB 10
- 工作经验：1年加拿大工作经验（PGWP在职）
- 无雇主offer，无省提名

我尝试过的提分方法：

法语（+50分，效果最显著）：
花了3个月学法语，参加TEF Canada考试，达到CLB 7（B1水平）。
这50分是最高性价比的提分方式——不需要工作经验或省提名，只需要考试。
学习资源：Duolingo + italki上找法语老师每周2小时 + 官方备考材料。

配偶英语（+20分）：
让配偶参加了IELTS，她考到CLB 7，给我们的综合分加了20点。

工作经验年限（+时间换分）：
第2年加拿大工作经验给的分比第1年多，所以时间本身也是资产。

换了薪资更高的工作（间接提分）：
工作本身不影响CRS，但我在这段时间找到了更好的职位，工资提高了，也为未来省提名做了准备。

最终：法语+配偶英语大概加了68分，从450提到约490，等到一次联邦专项抽签被选中。

如果你是印度/中国背景，联邦全项目抽签的CRS分数经常在530以上，专项抽签（tech、healthcare等）分数会低很多，值得关注。""",
        "replies": [
            ("法语TEF Canada和DELF有什么区别？移民局认可两种吗？", 267),
            ("我的配偶不在加拿大，她在国内考IELTS可以加分吗？还是必须本人在加拿大？", 212),
            ("Alberta Advantage Immigration Program（AAIP）现在开放吗？听说对tech有专项", 178),
            ("BC省PNP Tech Pilot对NOC有要求吗？我是数据分析师，不确定我的职位够不够", 156),
            ("法语CLB 7具体要求多少分？TEF Canada各项最低分是什么？", 134),
            ("我英语已经CLB 12了，继续考能不能再提CRS？还是已经满分了？", 112),
            ("加拿大工作经验：contract工作算吗？我目前是通过agency的合同工", 89),
        ],
    },
    {
        "board": "canada",
        "section": "加拿大签证&移民",
        "title": "加拿大vs美国移民路线的真实对比——从两边都走过的角度",
        "likes": 789,
        "url": "https://www.1point3acres.com/bbs/thread-demo-ca3",
        "body": """在美国工作了5年（F-1→OPT→STEM OPT→H-1B），2022年转到加拿大，现在已经拿到PR，来做一个真实对比。

美国的优势：
- 薪资确实高很多，湾区tech比多伦多高30-50%
- 行业多样性更强，尤其是金融和某些专业领域
- 某些领域的顶尖公司和资源确实在美国
- 如果能拿到绿卡（尤其是非印度/中国背景），长期来说非常稳定

美国的问题（对我这种背景来说）：
- H-1B抽签：连续两年没中，第三年中了但心理上太消耗了
- EB-2 India排期：等我毕业时，优先日期是2012年。我算了一下，我可能在退休之前拿不到GC
- 每次换工作都需要H-1B transfer，60天内必须找到新工作，心理压力很大
- 每次续签都是重新答一遍"你到底要不要留这里"

加拿大的优势：
- PGWP = open work permit，换工作无压力
- Express Entry：有规则可循，CRS分数够了就能拿ITA，不是抽签
- PR申请：8个月左右拿到，之后就是永久居民了
- 公民：5年居住要求，相对清晰

加拿大的问题：
- 薪资差距真实存在，senior工程师gap更大
- 多伦多温哥华房价问题很严重
- 小城市工作机会少，但房价友好
- 某些行业加拿大的机会确实不如美国多

我的建议（仅供参考）：
- 如果你是印度/中国背景，认真考虑加拿大路线。不是说美国不好，是绿卡这件事在你的职业生涯内可能实现不了
- 如果你其他背景，美国GC等待时间短，可以坚持美国路线
- 两条路都走过的人都说：加拿大的心理压力小非常多

这是个非常个人的决定，但希望分享有用。""",
        "replies": [
            ("印度背景的EB-2排期真的是这样……我认识的前辈说他2009年排队到现在还没拿到", 456),
            ("加拿大薪资差距现在还有30-50%吗？我看到一些帖子说这两年缩小了", 312),
            ("在加拿大拿到PR之后还能去美国工作吗？会不会影响PR维持？", 234),
            ("你说换工作在美国有60天限制——如果H-1B transfer已经在处理中但还没批，我可以开始在新雇主工作吗？", 198),
            ("请问你是先去加拿大读书再工作的，还是直接工作签证过来的？", 167),
            ("加拿大的公司有没有remote for US office的可能？两边都要是最理想的", 134),
        ],
    },
    {
        "board": "canada",
        "section": "加拿大签证&移民",
        "title": "PGWP项目切换的大坑——差点损失两年work permit",
        "likes": 398,
        "url": "https://www.1point3acres.com/bbs/thread-demo-ca4",
        "body": """来分享一个险些让我损失两年PGWP的经历，希望能帮到有类似想法的同学。

背景：
我在读2年制硕士项目，读到第一年发现这个研究方向不适合我，很想换到同一所大学的1年制Graduate Certificate项目。

我的naive想法：
"反正都是硕士水平的课程，1年certificate应该也够用"

什么我差点没想到：
PGWP的年限 = 你完成的项目的年限（上限3年）
- 2年制硕士 = 3年PGWP（因为超过2年就给3年）
- 1年制Graduate Certificate = 1年PGWP

换项目 = 直接少了2年工作许可 = 少了2年加拿大工作经验 = Express Entry CRS分数少了很多分 = 拿PR的时间推后可能2-3年

我的最终选择：
和导师、系里的advisor谈了很久，最终找到了在同一个硕士项目内换研究方向的方法，不需要换项目。多花了一些时间和精力，但保住了2年硕士+3年PGWP的组合。

什么情况下换项目影响没那么大：
- 如果你的PGWP年限本来就是1年的项目，或者两个项目都是2年+
- 如果你打算用其他pathway拿PR（比如通过雇主担保，或者有省提名）

核心建议：
在做任何项目变动前，先去找你的国际学生advisor谈PGWP影响。学术上的最优解不一定是移民上的最优解。""",
        "replies": [
            ("这条信息太重要了！我正在考虑从2年项目换到1年项目，没想到PGWP会有这么大差距", 234),
            ("如果换学校（比如从小学校转到UBC）会怎么样？PGWP从转学后算还是从第一所学校开始算？", 189),
            ("两个项目连读（1年diploma + 2年master）可以累计计算PGWP年限吗？", 167),
            ("我的项目本来是2年，但因为疫情延期变成了2.5年，PGWP还是3年上限吗？", 145),
            ("有没有人知道：co-op项目的co-op学期算不算在PGWP年限里？", 123),
        ],
    },
    {
        "board": "canada",
        "section": "加拿大签证&移民",
        "title": "在加拿大找第一份工作的经验——PGWP身份怎么向雇主解释",
        "likes": 334,
        "url": "https://www.1point3acres.com/bbs/thread-demo-ca5",
        "body": """刚刚找到第一份正式工作，感谢这个版块很多帖子帮助了我，来回馈一下。

关于PGWP身份向雇主解释：
很多加拿大雇主不了解移民状态，看到"work permit"就以为需要他们做担保。正确解释方式：

"我持有Post-Graduation Work Permit（PGWP），这是加拿大政府发给国际毕业生的开放工作许可。我可以在加拿大任何雇主工作，您不需要提交任何申请或担保。这和employer-specific work permit不同。"

把这句话准备好，面试开始前或收到offer后主动说清楚。

求职过程中的发现：
1. 大公司（Shopify、RBC、TD等）HR通常了解PGWP，反应正常
2. 中小公司HR经常不了解，需要解释，有的需要解释两三次
3. 有少数公司明确说"只招public resident"——这种直接放弃，可能他们只想要PR/公民（这实际上可能违反加拿大人权法，但维权成本高）

有效的求职方式（按效果排序）：
1. 内推（朋友、校友、Linkedin connection）
2. 公司官网直投（不通过第三方平台）
3. Linkedin主动联系hiring manager
4. 职业博览会（学校通常有）
5. Indeed/Linkedin Easy Apply（效果最差，竞争激烈）

我总共投了90份，拿到12个电话面，4个技术面，2个offer。历时3个月。

最大的体会：
加拿大比我想象的更看重"Canadian experience"。有些雇主其实更偏向有加拿大实习或co-op经历的人。如果你学校的co-op机会好，一定要做。""",
        "replies": [
            ("关于HR不理解PGWP这点：我直接在简历最顶部加了一行'Authorized to work in Canada (Open Work Permit – no sponsorship required)'，效果好很多", 189),
            ("请问你说的90投12电话面的成功率——是在Toronto吗？还是其他城市？", 145),
            ("技术类岗位的情况怎么样？我是做数据科学的，感觉岗位没有美国那么多", 123),
            ("co-op如果没机会做（学校没有），有没有其他办法获得'加拿大经验'？", 98),
            ("只招public resident（PR/公民）这种要求是合法的吗？我以为加拿大不允许这种歧视", 87),
        ],
    },
    # ═══════════════════════════════════════════════════════════
    # job-search-strategy
    # ═══════════════════════════════════════════════════════════
    {
        "board": "job_search",
        "section": "求职/工作",
        "title": "冷邮件找工作——真实成功案例和模板（OPT身份）",
        "likes": 567,
        "url": "https://www.1point3acres.com/bbs/thread-demo-job1",
        "body": """毕业两个月，海投没结果，转向冷邮件找到工作。分享一下方法。

背景：CS硕士，OPT，目标软件工程师岗位，主要在湾区和西雅图投递。

之前的方法（失败）：
- 海投LinkedIn Easy Apply：投了200份，3个电话面
- 简历发招聘网站：几乎零响应
- 直接联系HR：回复率极低，而且HR会直接问"你需要sponsorship吗"，然后就没了

转向方法（成功）：冷邮件联系hiring manager

**模板：**

Subject: 关于[公司]的[具体产品/团队]的问题

Hi [姓名],

我注意到您最近在[平台]分享的关于[具体主题]的[文章/演讲]，您提到的[具体观点]和我在[项目]里遇到的问题高度相关。

我是[大学]的应届CS硕士，做过[一行描述项目]。我对贵团队在[具体方向]的工作特别感兴趣。

请问您方便在接下来几周安排一个20分钟的电话交流吗？

[姓名]

关键原则：
1. **全文不超过100字**——manager没时间看长邮件
2. **只要求一个call，不提工作机会**——第一封邮件要求工作是关系破坏者
3. **找具体的人，不找HR**——找LinkedIn上实际可能是你未来老板的manager
4. **OPT身份不要在第一封邮件提**——先让对方对你这个人感兴趣

发了约40封邮件，回复率约15%，进入面试流程4个，拿到offer 1个。""",
        "replies": [
            ("冷邮件方向对了，但我想补充：找manager的时候，最好找入职1-2年的新manager。他们通常正在建团队，回复率比老manager高很多。", 312),
            ("请问不提OPT身份的话，对方如果直接问怎么办？", 234),
            ("这个回复率挺高的。你找的是什么level的人？Senior engineer还是manager？", 189),
            ("我试了类似方法，但总是被说'我们现在不招人'——碰到这个情况怎么回？", 156),
            ("关于只发100字：有没有例外情况？比如对方是非常资深的人，要不要多写背景？", 123),
        ],
    },
    {
        "board": "job_search",
        "section": "求职/工作",
        "title": "H-1B Lottery三连输之后——我最终怎么解决身份问题的",
        "likes": 892,
        "url": "https://www.1point3acres.com/bbs/thread-demo-job2",
        "body": """三年抽签，三次落选。STEM OPT快到期了，但最后找到了出路。记录一下这段经历。

时间线：
- 2021年5月：MS毕业，开始OPT，在一家mid-size tech公司工作
- 2022年3月：第一次H-1B抽签，落选。继续OPT
- 2022年5月：申请STEM OPT延期，获批，再2年（到2024年5月）
- 2023年3月：第二次H-1B抽签，落选
- 2024年3月：第三次H-1B抽签，落选
- 2024年4月：距STEM OPT到期只剩一个月

最终解决方案：Cap-exempt H-1B

朋友介绍了一个路子：部分大学附属的研究院是H-1B cap-exempt的，不用抽签，可以全年随时申请。我找到了一所Top-20大学的附属研究院的岗位，薪资比private sector低30%但工作比较有意思，更重要的是——可以立刻transfer过去，不用等10月1日。

Cap-exempt申请：
- 2024年4月初：找到cap-exempt岗位
- 2024年4月中：律师提交I-129
- 2024年5月初：I-129获批（加急premium processing，15天）
- OPT到期前完成transfer，从未有gap

现在的计划：
Cap-exempt职位工作一年左右，再通过已工作的公司回去走regular cap lottery——已经积累了一年多工作经验的人，很多sponsoring公司会愿意给priority processing。

给卡在STEM OPT快到期的同学：
1. 大学/非营利研究机构 = cap-exempt，不用抽签，全年可申请
2. 代价是薪资通常低20-40%
3. 但这是合法的bridge，保住身份比什么都重要
4. 在cap-exempt工作180天后，H-1B具有portability，可以transfer到private employer""",
        "replies": [
            ("这个cap-exempt路子太重要了！很多人不知道大学附属研究院可以用H-1B不用抽签。你能分享一下找这类岗位去哪里搜吗？", 456),
            ("Premium processing现在要$2805，公司付还是自己付的？如果是cap-exempt，费用分担是怎样的？", 312),
            ("180天portability这条：如果在cap-exempt工作满180天然后transfer到private company，transfer还需要抽签吗？", 267),
            ("同是三连输的人，正在走类似的路。补充一点：很多医院系统（特别是大学附属医院）也是cap-exempt，职位选择比纯研究院多很多。", 234),
            ("薪资低30%其实对于保住身份来说很值。尤其是和被迫回国或者转去加拿大的机会成本比较的话。", 189),
        ],
    },
    {
        "board": "career_canada",
        "section": "加拿大求职",
        "title": "PGWP身份找工作全攻略——90投12电话面4技术面2offer",
        "likes": 734,
        "url": "https://www.1point3acres.com/bbs/thread-demo-job3",
        "body": """在加拿大用PGWP找到了两个offer，分享完整经历。

背景：
- 学校：加拿大某Top-5大学，2年制硕士
- 专业：计算机
- PGWP：3年（2年+项目对应3年上限）
- 目标城市：多伦多和温哥华
- 求职时长：3个月

关于PGWP身份怎么跟雇主说：

**关键认知**：PGWP是open work permit，不是employer-specific。你不需要雇主"帮你做任何事"，不需要他们提交任何文件，不需要他们支付任何费用。

**怎么在申请中写**：
在工作授权那一栏：「Open Work Permit (Post-Graduation Work Permit) – Authorized to work for any employer in Canada. No employer action required.」

**如果HR问**：
「我持有PGWP，这是加拿大移民局颁发给国际学生的开放工作许可。有效期3年，您完全不需要为我申请任何东西，我可以直接入职工作。」

实际经验：
- 大公司（Shopify, RBC, TD, 各大tech）：HR基本懂PGWP，没问题
- 中小公司：可能需要解释1-2次，耐心说明即可
- 偶尔遇到说"只招公民/PR"的：这是他们的权力（在联邦法里有争议），不要浪费时间

求职渠道效果排名（根据我的经验）：
1. 内推（朋友/校友）- 最高效，投1拿1面试率
2. 公司官网直接投 - 效果好
3. LinkedIn联系hiring manager - 有效但需要技巧
4. LinkedIn Easy Apply / Indeed - 效率最低，但覆盖面广

三个月总结：投90份，12个电话面，4个技术面，2个offer，最终选了薪资更高的那个（$112k CAD base）。""",
        "replies": [
            ("关于'只招公民/PR'：加拿大《人权法》禁止因公民身份歧视就业，但执行力度参差不齐。遇到这种要求可以向各省人权委员会投诉，但维权成本确实高，大多数人选择放弃。", 298),
            ("加拿大工资单位是CAD，和美国USD差距比较大。$112k CAD现在大概$80k USD左右。选择加拿大主要是移民路径确定性，不是薪资。", 267),
            ("联系hiring manager的方法：我一般搜LinkedIn上该公司的SWE/DE Manager头衔，找最近6个月发过技术帖子的人——说明他们活跃在LinkedIn上，更可能回复。", 234),
            ("校友网络在加拿大比美国更重要——市场更小，人与人之间更熟，校友愿意帮忙的比例更高。把学校校友录找一遍很值得。", 198),
        ],
    },
    # ═══════════════════════════════════════════════════════════
    # grad-school-selection
    # ═══════════════════════════════════════════════════════════
    {
        "board": "phd_application",
        "section": "PhD申请",
        "title": "选导师比选学校重要100倍——我的血泪教训",
        "likes": 445,
        "url": "https://www.1point3acres.com/bbs/thread-demo-phd1",
        "body": """申请季结束两年了，现在PhD在读，来说说我当时做对和做错的事情。

背景：拿到了A校（全美top5，导师方向一般）和B校（全美top25，导师方向完全match）两个offer。最后选了A校，理由是"排名更高，牌子更好"。

现在的情况：
- A校导师每学期见我一次，基本放养
- 我发邮件平均2周才回
- 他的grant快到期了，我的RA funding下学期有问题
- B校我想要的那个导师，她组里刚出了两篇顶会，学生人手一篇

我犯的三个错误：

1. 没有check导师的grant状态。可以在NIH Reporter或者NSF Award Search查到导师的在研项目，以及项目结束时间。我的导师那时候主grant只剩一年了。

2. 没有联系他组里的前学生。现在的学生会保留好话，离开的学生才说实话。LinkedIn上找到他组里过去5年毕业的学生，发消息问问。

3. 把排名当成导师质量的proxy。导师质量和系排名的相关性其实很低。同一个系里可以有publication机器，也可以有让学生毕不了业的ghost advisor。

选校建议：
- 先确定3个以上你愿意和他/她工作5年的导师
- 每个目标导师都联系，看看谁回复、谁有bandwidth
- offer比较时，问每个导师：funding是部门保证的还是你的grant来的？你最近5个毕业生去了哪里？
- 排名只作为同等条件下的tiebreaker，不是主要指标""",
        "replies": [
            ("NIH Reporter查grant这个方法真的很实用！我申请前就是这么筛的，直接排除了几个grant快断的导师", 178),
            ("联系已经毕业的学生这个太关键了。我套磁时特意LinkedIn找到了目标导师的前两届学生，一个直接跟我说'他不适合做主导师，最好有co-advisor'，这个信息我绝对问不到现在的学生", 145),
            ("补充：还可以看导师最近的publication，author里学生名字出现频率。一个好导师的学生应该经常是一作或者二作，如果每篇都是导师一作、学生不在前三，要注意", 112),
            ("我在B校，我们组的情况就是楼主说的那种。导师每周组会，每两周一对一，每个人都有paper在投。当初我拒了排名更高的offer，现在完全不后悔", 98),
            ("请问funding是部门保证的怎么问？直接这么问导师会不会尴尬？", 67),
            ("不尴尬的。我直接问过：'Can you tell me about the funding structure for this position — is the stipend guaranteed by the department for multiple years, or does it depend on your current grant funding?' 好的导师会直接回答", 56),
        ],
    },
    {
        "board": "phd_application",
        "section": "PhD申请",
        "title": "套磁经验分享：发了60封邮件，8个回复，3个offer",
        "likes": 389,
        "url": "https://www.1point3acres.com/bbs/thread-demo-phd2",
        "body": """申请季结束，来分享一下套磁的经验，因为我看到太多人套磁方式有问题。

我的背景：CS方向，主要申请ML/AI相关的PhD项目，最终录取3个，全funded。

套磁有效率：60封邮件 → 8个有实质回复 → 3个offer，这个比例我觉得还算正常。

有效的套磁长什么样：

第一段：一句话说你是谁，你在读什么，你为什么联系他/她（具体到论文名字和你的问题）

第二段：你做过的最相关的研究，要非常具体，不要说"我对机器学习很感兴趣"，要说"我在X项目里用了Y方法解决Z问题，遇到了W的limitation，我看到您2024年的论文在这个方向有新的进展"

第三段：你的具体问题或者表达希望聊聊

长度：3段，每段2-4句，总共不超过250字。导师不会读超过一屏的邮件。

最无效的套磁（我见过同学发的）：
- 复制粘贴模板，只改了名字和学校名
- "我对您所有的研究都很感兴趣"（没有读过任何论文的标志）
- 超过500字的长邮件
- 附件里放了简历但邮件正文什么都没说
- 套磁时间太晚（deadline前一个月才发，很多导师已经决定名额了）

最佳时间：比申请deadline早3-6个月，也就是大概7-9月发秋季申请的套磁邮件。

一个实际有用的技巧：找到导师最新的一篇论文（3个月内发表的），问一个具体的问题。导师回不回取决于你的问题够不够有趣，不只是你的背景强不强。""",
        "replies": [
            ("250字限制这个建议太好了。我以前写的套磁邮件都是500+字，后来改成简短版之后回复率明显提高", 167),
            ("时间节点很关键。我10月发的套磁，很多教授直接回说名额已经定了。后来发现很多CS方向的导师在暑假就已经确定要招谁了", 134),
            ("补充：套磁前先看看导师的主页，有些导师写了'我不接受unsolicited emails'或者'请通过正式申请系统联系'，这种就不要套磁了，直接写SOP里表达兴趣", 112),
            ("关于具体问题这点：我问了一个导师他最新论文里某个实验设计的问题，他不仅回了，还花了20分钟Zoom给我解释。直接进了shortlist。有时候真的就是一个好问题", 89),
            ("回复率8/60=13%，我发了30封只有1个回复，可能我的背景不够强还是邮件方式有问题？", 45),
            ("建议你把邮件内容贴出来大家帮看看。另外，不同方向差异很大，有些细分方向导师特别少，竞争特别激烈", 38),
        ],
    },
    {
        "board": "academia",
        "section": "学术/科研",
        "title": "读博第三年换导师全过程记录，给后来人参考",
        "likes": 312,
        "url": "https://www.1point3acres.com/bbs/thread-demo-phd3",
        "body": """读博三年后换了导师，整个过程比我想象的难，但结果好于预期。把经历记录下来给有需要的人参考。

为什么换：
我的导师属于典型的Ghost advisor。每学期见面3-4次，邮件平均10天回，对我的研究方向没有实质帮助。他的grant在我入学第二年就结束了，我一直在靠TA funding，每学期教课20小时，研究进展极慢。入学三年，零publication。

我怎么确定要换：
1. 问了组里唯一一个快毕业的学生（入学7年），他的情况跟我一样
2. 发现导师有个合作者，风格完全不同，每年出3-4篇paper，学生都有一作
3. 做了最坏情况分析：如果继续下去，我最快几年能毕业？答案是"不确定"

换导师的过程：

第一步：先确定接收方。我非正式问了那个合作教授愿不愿意接我，她说愿意但需要我自己处理和原导师的关系。

第二步：和原导师谈。这是最难的部分。我直接说：我觉得我们的研究方向不太match，我想转到X教授组。他有些不高兴，但没有阻拦。

第三步：DGS（研究生项目主任）介入。我和DGS谈了情况，他帮助正式完成了导师变更，包括committee重新组建。

第四步：重新入轨。新导师给我3个月时间了解她的研究，然后一起确定了新的研究方向。

时间代价：大概损失了8-10个月的进度。

结果：换导师后18个月，投出第一篇顶会论文。现在在读第五年，预计明年毕业。

如果你也在考虑换导师：越早越好。三年比五年损失小太多。不要因为沉没成本留下去。""",
        "replies": [
            ("第二步直接跟导师谈这个需要很大勇气。请问你是怎么措辞的？说了'研究方向不match'，导师有没有问很多问题或者刁难你？", 134),
            ("我现在第四年，情况跟你很像。但我担心换了之后毕不了业……请问你的学分、已经完成的coursework这些换了导师还有效吗？", 112),
            ("coursework是有效的，看你们学校的规定，一般换导师不影响之前的学分。需要重新组建committee，可能会要求补一些方向相关的课，但主体是保留的。", 89),
            ("我是第五年换的，损失了差不多一年半。现在第七年在写论文。如果你在考虑换，不要等到第四五年再行动，代价比你想的大", 78),
            ("国际学生换导师有个实际问题：如果延期毕业，OPT的开始时间会推迟，如果超过了签证有效期可能还需要续签F-1。建议去找DSO（国际学生顾问）提前咨询", 67),
            ("DGS在这件事里的角色很关键。有些系DGS会积极帮学生，有些系DGS会向着导师。建议在正式谈之前先侧面了解你们系DGS的风格", 56),
        ],
    },
]


def scrape_demo(boards: list[str], posts_per_board: int, out_dir: Path) -> list[Path]:
    scraped_at = datetime.utcnow().strftime("%Y-%m-%d")
    posts = [p for p in DEMO_POSTS if not boards or p["board"] in boards]
    # Limit to posts_per_board per board
    seen: dict[str, int] = {}
    filtered = []
    for p in posts:
        b = p["board"]
        seen[b] = seen.get(b, 0)
        if seen[b] < posts_per_board:
            filtered.append(p)
            seen[b] += 1

    written: list[Path] = []
    for post in filtered:
        content = _format_post(
            section=post["section"],
            title=post["title"],
            body=post["body"],
            likes=post["likes"],
            url=post["url"],
            replies=post["replies"],
            scraped_at=scraped_at,
            board_key=post["board"],
        )
        fname = f"{post['board']}_{_slug(post['title'])}.txt"
        path = out_dir / fname
        path.write_text(content, encoding="utf-8")
        written.append(path)
        country_tag = "🇺🇸" if post["board"] in ("us_visa", "immigration") else "🇨🇦"
        print(f"  [demo] {country_tag} [{post['section']}] {post['title'][:55]}")

    return written


# ── Main ─────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Scrape 一亩三分地 community data")
    parser.add_argument("--skill", default="immigration-planning", help="Skill slug")
    parser.add_argument("--boards", nargs="+",
                        choices=list(BOARDS.keys()),
                        help="Boards to scrape (default: all for skill)")
    parser.add_argument("--posts", type=int, default=5, help="Posts per board")
    parser.add_argument("--demo", action="store_true",
                        help="Use synthetic demo data (no scraping needed)")
    args = parser.parse_args()

    skill_dir = get_skill_dir(args.skill)
    if not skill_dir.exists():
        sys.exit(f"Error: skill directory not found: {skill_dir}")

    out_dir = skill_dir / "raw" / "community" / "1p3a"
    out_dir.mkdir(parents=True, exist_ok=True)

    boards = args.boards or SKILL_BOARDS.get(args.skill, list(BOARDS.keys()))

    if args.demo:
        print(f"[demo mode] Generating synthetic 一亩三分地 posts for {args.skill}")
        written = scrape_demo(boards, args.posts, out_dir)
    else:
        # Check if scrapling is installed
        try:
            import scrapling  # noqa: F401
        except ImportError:
            print("scrapling not installed. Falling back to --demo mode.")
            print("To install: pip install scrapling && scrapling install playwright")
            written = scrape_demo(boards, args.posts, out_dir)
        else:
            print(f"[Scrapling] Scraping 一亩三分地 boards: {boards}")
            written = scrape_with_scrapling(boards, args.posts, out_dir)

    print(f"\nWrote {len(written)} file(s) to {out_dir.relative_to(skill_dir.parent.parent)}/")
    for p in written:
        print(f"  {p.name}")
    print(f"\nNext step: python scripts/clean_community.py "
          f"{skill_dir.relative_to(skill_dir.parent.parent)}/raw/community/1p3a/ --platform 1p3a")


if __name__ == "__main__":
    main()
