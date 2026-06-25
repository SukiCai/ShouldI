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
}

SKILL_BOARDS: dict[str, list[str]] = {
    "immigration-planning": ["us_visa", "immigration", "canada"],
}

MIN_REPLIES = 5
MIN_LIKES = 3
MAX_REPLIES_PER_POST = 15

# Regions implied by each board key
BOARD_REGIONS: dict[str, list[str]] = {
    "us_visa": ["us"],
    "immigration": ["us"],
    "canada": ["canada"],
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
    try:
        from scrapling import Fetcher
    except ImportError:
        sys.exit("scrapling not installed. Run: pip install scrapling")

    written: list[Path] = []
    scraped_at = datetime.utcnow().strftime("%Y-%m-%d")
    fetcher = Fetcher(auto_match=True)

    for board_key in boards:
        board = BOARDS[board_key]
        print(f"  Scraping 一亩三分地 [{board['label']}]…")
        try:
            page = fetcher.get(board["url"])
        except Exception as e:
            print(f"    Warning: could not load board {board_key}: {e}")
            continue

        # Extract post links from the thread list
        links = page.css("a[href*='/bbs/thread-']")
        count = 0
        for link in links[:posts_per_board * 4]:
            href = link.attrib.get("href", "")
            if not href.startswith("http"):
                href = "https://www.1point3acres.com" + href

            try:
                post_page = fetcher.get(href)
                time.sleep(1.5)  # polite delay
            except Exception as e:
                print(f"    Skipping {href}: {e}")
                continue

            title_el = post_page.css("h1.posthead")
            if not title_el:
                continue
            title = title_el[0].text.strip()

            body_el = post_page.css("div.postmessage")
            if not body_el:
                continue
            body = body_el[0].text.strip()

            # Parse likes
            likes_el = post_page.css("span.likenum")
            try:
                likes = int(likes_el[0].text.strip()) if likes_el else 0
            except ValueError:
                likes = 0

            if likes < MIN_LIKES:
                continue

            # Parse replies
            reply_els = post_page.css("div.postmessage")[1:]
            replies: list[tuple[str, int]] = []
            for rel in reply_els[:MAX_REPLIES_PER_POST]:
                rtext = rel.text.strip()
                rl_el = rel.parent.css("span.likenum")
                try:
                    rl = int(rl_el[0].text.strip()) if rl_el else 0
                except ValueError:
                    rl = 0
                if rl >= MIN_LIKES and rtext:
                    replies.append((rtext, rl))

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
