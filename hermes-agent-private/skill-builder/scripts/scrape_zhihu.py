#!/usr/bin/env python3
"""知乎社区数据抓取器，用于 skill-builder。

优先使用 Scrapling（需要 Playwright）抓取知乎回答，
无法抓取时自动 fallback 到 httpx 简单模式或 --demo 合成数据。

输出格式兼容 clean_community.py --platform zhihu。

目标话题（移民规划）：
  - H-1B / OPT 相关问题
  - 加拿大 PGWP / Express Entry
  - 美加移民路线对比

用法:
    python scripts/scrape_zhihu.py --skill immigration-planning --demo
    python scripts/scrape_zhihu.py --skill immigration-planning --posts 8
    python scripts/scrape_zhihu.py --skill immigration-planning \
        --questions 31234567 398765432 --posts 5
"""

import argparse
import json
import re
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Optional

sys.path.insert(0, str(Path(__file__).parent))
from utils import get_skill_dir

# ── 目标问题 ID（已知的移民相关知乎问题）────────────────────────────────────
SKILL_QUESTIONS: dict[str, list[str]] = {
    "immigration-planning": [
        # 美国签证/H-1B
        "21014657",   # 美国H1B签证抽签失败了怎么办？
        "43629089",   # 美国四大工作一年，h1b连续两年没抽中，接下来该咋走？
        "596304593",  # H-1B没中签，还想留在美国怎么办？
        "29165411",   # 去美国读CS研究生，最终能留下工作甚至拿到绿卡有多难？
        # 美国绿卡
        "473514443",  # 从H1B到绿卡要多少年？
        # 加拿大移民
        "34491996",   # 在加拿大申请毕业工签PGWP过程（网申和边境申请）
        "324882228",  # 加拿大PGWP能毕业后先回国再出国办理吗？
        "19684217",   # 移民加拿大有哪些攻略？
    ],
    "grad-school-selection": [
        # 套磁/联系教授
        "460081164",  # 申请国外博士如何与教授「套磁」？
        "25380930",   # 申请国外 PhD 的时候如何与教授套磁？
        "376167481",  # 美国的PhD是都需要套磁吗？
        # 导师选择
        "9313552960", # 海外PhD申请中，如何选择导师？
        # 读博 vs 工作决策
        "418370837",  # 计算机视觉读博还是工作？
        "654583143",  # 读博还是工作？
        # 国内 vs 国外读博
        "23482329",   # 国内读博和国外读博的优劣各在那些方面？
    ],
    "job-search-strategy": [
        # 留学生美国求职
        "37852933",   # 留学生在美国找工作怎么找？
        "28302246",   # CS专业留学生毕业之后留美的难度有多大？
        "68214796",   # 在美国名校毕业后找工作有多难？
        # Cold email
        "58641447",   # 如何进行cold email？
        "50714531",   # 加拿大留学生在本地找工作有多难？
        # H1B cap-exempt / 非盈利路线
        "460879945",  # 美国留学：留学生如何拿到非盈利机构的H1B？
    ],
    "pm-career": [
        # 职业规划/晋升
        "20791021",   # 产品经理的职业生涯规划是怎么样的？
        "20785803",   # 产品经理的职业发展、岗位晋升方面怎么样，是否很困难？
        "534288159",  # 产品经理要如何晋升？有哪些晋升路径？
        "290236275",  # 产品经理工作 3-5 年后有哪些发展路径？
        "585866628",  # 产品经理应该如何进行职业规划？
        # 35岁/跳槽
        "376753435",  # 那些35岁以上的产品经理都去做什么了？
        "22179195",   # 互联网人跳槽的注意事项有哪些？
    ],
    "salary-negotiation": [
        # Offer谈判
        "365593505",  # 收到offer了还能不能再谈薪资？
        "19972942",   # 收到 offer 后能重新谈吗？
        "300000799",  # 接到了不同的 OFFER 应该怎么比较？
        "23273036",   # 应聘时何时适合谈薪资？
        "667374182",  # 面试时谈薪的技巧有些什么啊？
        # 股权/RSU
        "19853693",   # 受限股票单位（RSU）与股票期权（Stock Option）的区别
        "29939373",   # 求问美国it公司的rsu和bonus是怎么回事？
    ],
    "stay-or-return": [
        # 留美 vs 回国
        "28965134",   # 未来应留在美国还是回国生活？
        "452317991",  # 留在美国还是回中国？
        "496079523",  # 出国留学后应不应该回国？
        "41981949",   # 海归女硕士，快毕业了是继续留在美国还是回国工作？
        "269916009",  # 出国留学后到底是否回国工作？
        "452485057",  # 如果你已经有了美国工作签，你会选择留美还是回国？
        "275084689",  # 要不要回国？
    ],
}

MIN_UPVOTES = 50
MAX_ANSWERS_PER_QUESTION = 8


# ── 输出格式 ─────────────────────────────────────────────────────────────────

def _slug(text: str) -> str:
    text = re.sub(r"[^\w一-鿿]+", "_", text).strip("_")
    return text[:50]


def _format_post(question: str, answer_body: str, upvotes: int,
                 url: str, regions: list[str], scraped_at: str,
                 more_answers: Optional[list[tuple[str, int]]] = None) -> str:
    lines = [
        "platform: zhihu",
        f"question_title: {question}",
        f"answer_upvotes: {upvotes}",
        f"regions: {json.dumps(regions, ensure_ascii=False)}",
        f"post_url: {url}",
        f"scraped_at: {scraped_at}",
        "",
        "最佳回答：",
        answer_body.strip(),
    ]
    if more_answers:
        lines.append("")
        lines.append("其他回答：")
        for i, (text, votes) in enumerate(more_answers, 1):
            lines.append(f"[{i}] (赞同数: {votes})")
            lines.append(text.strip())
            lines.append("")
    return "\n".join(lines)


# ── Scrapling 真实抓取 ────────────────────────────────────────────────────────

def _scrape_scrapling(question_ids: list[str], posts_per_q: int,
                      out_dir: Path) -> list[Path]:
    # Scrapling v0.4.9+: use class-method .fetch() — no instantiation needed
    try:
        from scrapling.fetchers import StealthyFetcher
        print("  [Scrapling] 使用 StealthyFetcher.fetch() (patchright + stealth)")
    except ImportError:
        print("  scrapling[all] 未安装，切换到 httpx 模式...")
        return _scrape_httpx(question_ids, posts_per_q, out_dir)

    scraped_at = datetime.utcnow().strftime("%Y-%m-%d")
    written: list[Path] = []

    for qid in question_ids:
        url = f"https://www.zhihu.com/question/{qid}"
        print(f"  [Scrapling] 抓取问题 {qid}...")
        try:
            page = StealthyFetcher.fetch(url, headless=True, network_idle=True)
            time.sleep(2)
        except Exception as e:
            print(f"    跳过 {qid}: {e}")
            continue

        # 问题标题
        title_el = page.css("h1.QuestionHeader-title")
        if not title_el:
            print(f"    {qid}: 未找到标题，跳过")
            continue
        question = title_el[0].text.strip()

        # 回答列表 — iterate answers independently of vote buttons
        # (vote counts may not be visible without login; zip with vote_els causes all
        # answers to be skipped if vote_els is empty)
        answer_els = page.css("div.RichContent-inner")
        vote_els = page.css("button.VoteButton--up")
        vote_texts = [v.text.strip() for v in vote_els]

        results: list[tuple[str, int]] = []
        for i, ans_el in enumerate(answer_els[:posts_per_q + 3]):
            # .text only returns direct text nodes; get_all_text() traverses children
            raw_text = ans_el.get_all_text(separator=" ")
            text = (raw_text if isinstance(raw_text, str) else " ".join(raw_text)).strip()
            if len(text) < 100:
                continue
            try:
                votes = int(re.sub(r"[^\d]", "", vote_texts[i]) or "0") if i < len(vote_texts) else 0
            except (ValueError, IndexError):
                votes = 0
            results.append((text, votes))

        if not results:
            print(f"    {qid}: 无有效回答，跳过")
            continue

        results.sort(key=lambda x: x[1], reverse=True)
        best_text, best_votes = results[0]
        more = results[1:posts_per_q]

        # 推断 regions
        regions = _infer_regions_from_content(question + " " + best_text)

        content = _format_post(
            question=question,
            answer_body=best_text,
            upvotes=best_votes,
            url=url,
            regions=regions,
            scraped_at=scraped_at,
            more_answers=more,
        )
        fname = f"zhihu_{_slug(question)}.txt"
        path = out_dir / fname
        path.write_text(content, encoding="utf-8")
        written.append(path)
        print(f"    ✓ {question[:60]} ({best_votes} 赞)")

    return written


def _scrape_httpx(question_ids: list[str], posts_per_q: int,
                  out_dir: Path) -> list[Path]:
    """使用 httpx + 移动端 UA 尝试抓取（无 JS 渲染，命中率低）。"""
    try:
        import httpx
    except ImportError:
        print("  httpx 未安装 (pip install httpx)，切换到 demo 模式")
        return []

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) "
            "AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/20A362"
        ),
        "Accept-Language": "zh-CN,zh;q=0.9",
        "Referer": "https://www.zhihu.com/",
    }

    scraped_at = datetime.utcnow().strftime("%Y-%m-%d")
    written: list[Path] = []

    with httpx.Client(headers=headers, follow_redirects=True, timeout=15) as client:
        for qid in question_ids:
            url = f"https://m.zhihu.com/question/{qid}"
            print(f"  [httpx] 抓取 {url}...")
            try:
                resp = client.get(url)
                time.sleep(1.5)
            except Exception as e:
                print(f"    失败: {e}")
                continue

            if resp.status_code != 200:
                print(f"    HTTP {resp.status_code}，跳过")
                continue

            html = resp.text
            # 简单提取（知乎移动端部分内容在 JSON-LD 里）
            title_match = re.search(r'"name"\s*:\s*"([^"]+)"', html)
            if not title_match:
                print(f"    {qid}: 未找到标题（可能被反爬）")
                continue

            question = title_match.group(1)
            # 尝试从 script 标签里提取回答内容
            content_match = re.search(r'"content"\s*:\s*"((?:[^"\\]|\\.)*)\"', html)
            if not content_match:
                print(f"    {qid}: 无法提取内容")
                continue

            answer_text = content_match.group(1).replace("\\n", "\n").replace('\\"', '"')
            if len(answer_text) < 100:
                continue

            regions = _infer_regions_from_content(question + " " + answer_text)
            content = _format_post(
                question=question,
                answer_body=answer_text,
                upvotes=0,
                url=f"https://www.zhihu.com/question/{qid}",
                regions=regions,
                scraped_at=scraped_at,
            )
            fname = f"zhihu_{_slug(question)}.txt"
            path = out_dir / fname
            path.write_text(content, encoding="utf-8")
            written.append(path)
            print(f"    ✓ {question[:60]}")

    return written


def _infer_regions_from_content(text: str) -> list[str]:
    """从内容关键词推断适用地区。"""
    has_us = bool(re.search(
        r"H-?1B|OPT|STEM OPT|F-?1|USCIS|绿卡.*美国|美国.*移民|美国.*签证", text
    ))
    has_ca = bool(re.search(
        r"PGWP|Express Entry|CRS|加拿大.*PR|IRCC|省提名|PNP|BC|安大略", text
    ))
    if has_us and has_ca:
        return ["us", "canada"]
    if has_us:
        return ["us"]
    if has_ca:
        return ["canada"]
    return ["us", "canada"]  # 默认北美


# ── Demo 合成数据 ─────────────────────────────────────────────────────────────

DEMO_POSTS = [
    # ═══════ 美国 ════════
    {
        "question": "F-1留学生从OPT到H-1B，中间有哪些需要注意的关键节点？",
        "regions": ["us"],
        "url": "https://www.zhihu.com/question/demo-us1",
        "upvotes": 2341,
        "answer": """作为过来人，我来梳理一下关键时间节点和常见误区。

**OPT阶段（毕业后12个月）**

OPT的工作授权是EAD（Employment Authorization Document），需要提前60-90天申请，USCIS处理时间3-5个月。

关键点：
- 申请OPT后有90天失业上限（整个OPT期间累计，不是单次）
- 换工作要在10天内通知DSO更新SEVIS
- 工作必须与专业相关

**STEM OPT延期（额外24个月）**

条件：STEM学位（需在官方列表上）+ 雇主在E-Verify注册

需要提交I-983 Training Plan，描述工作如何与你的STEM专业相关。

关键误区：很多人以为换工作就需要重新申请，实际上STEM OPT是绑定到你身上的，但新雇主需要重新提交I-983。

**H-1B抽签窗口**

每年3月初注册，4月初抽签结果，10月1日生效。

- 普通名额：65,000个
- 硕士以上（美国学位）：额外20,000个名额，先从这个池子抽，没中再进普通池

重要：H-1B注册和STEM OPT不冲突。你可以在STEM OPT期间参加H-1B抽签，中了之后10月1日切换身份。

**STEM OPT用完怎么办**

如果3年内没中H-1B（概率约50-60%，三次尝试）：
1. 继续读书（F-1重置，新的OPT机会）
2. Cap-exempt雇主（大学、非营利研究机构）
3. 其他签证类别（O-1、TN等）
4. 转赴加拿大

**我的建议**

从OPT第一年就要和雇主谈H-1B意愿，不要等到STEM OPT最后一年才开始。大多数雇主需要时间走内部审批。""",
        "more_answers": [
            ("补充一点：申请H-1B前确认雇主会支付premium processing（$2805），这样能在15个工作日内拿到结果，避免等待期间身份悬空。", 567),
            ("关于90天失业上限，需要强调：这是整个OPT期间的累计总数，不是单次。所以如果第一份工作结束到第二份工作开始中间空了60天，你只剩30天buffer了。很多人不知道这个。", 445),
            ("STEM OPT的雇主培训计划（I-983）要认真写，不要copy-paste通用模板。有人就是因为I-983写得太模板化收到了NOID。", 312),
        ],
    },
    {
        "question": "H-1B三次抽签都没中的话，留在美国还有哪些合法途径？",
        "regions": ["us"],
        "url": "https://www.zhihu.com/question/demo-us2",
        "upvotes": 1876,
        "answer": """三次没中H-1B是很多中国/印度留学生的真实经历。认真梳理一下合法选项：

**路径一：Cap-exempt H-1B（绕过抽签）**

某些雇主不受H-1B名额限制：
- 大学和附属研究机构
- 非营利性研究机构（主要功能是研究）
- 政府研究机构

在这些机构工作，雇主随时可以帮你申请H-1B，不需要等抽签窗口。

实操：有人通过大学-企业合作项目，在大学做兼职研究员（保住cap-exempt资格），同时在公司全职工作（concurrent employment）。这是合法的，但结构需要律师设计。

**路径二：O-1A（杰出人才）**

条件：在你的领域有"extraordinary ability"的证明。
- 论文引用
- 获奖
- 媒体报道
- 审稿人身份
- 高薪（relative to others in field）

O-1比H-1B难，但不受抽签限制。科技行业有人在积累了一定成果后走这条路。

**路径三：TN（加拿大/墨西哥公民专属）**

如果你是加拿大或墨西哥公民，TN签证适用于特定职业（工程师、科学家等），入境口岸即可申请，无配额限制。

**路径四：L-1（跨国企业内部调动）**

需要：在同一跨国公司的海外分支工作满1年，调回美国。

适合在外企工作、公司有美国office的情况。

**路径五：转赴加拿大**

加拿大PGWP（给在加拿大读书的人）或雇主担保。Express Entry PR申请是点数制，无抽签。很多H-1B多次失败的人转向了加拿大并在2-3年内拿到PR。

**关于等待策略**

STEM OPT 3年 = 3次抽签机会。三次都没中的概率约25-30%（单次中签率约35-45%，视年份）。做好这个心理预期，早早准备Plan B，不是认输，是理性规划。""",
        "more_answers": [
            ("EB-1A（杰出人才绿卡）也可以考虑，不需要雇主担保，自己申请。条件比O-1还高，但批了直接绿卡，跳过H-1B。适合有很强学术背景的人。", 445),
            ("加拿大这条路值得认真研究，不是退而求其次。Express Entry的CRS分数制度透明可预测，很多人2年内就能拿到PR。而且PGWP是open work permit，换工作没有visa anxiety。", 398),
            ("EB-2 NIW（国家利益豁免）可以不通过雇主自己申请绿卡。STEM背景的留学生很多人符合条件。Matter of Dhanasar的三步测试比你想象的门槛低一些。", 267),
        ],
    },
    {
        "question": "美国绿卡排期对印度、中国大陆出生的申请人有多严重？",
        "regions": ["us"],
        "url": "https://www.zhihu.com/question/demo-us3",
        "upvotes": 3210,
        "answer": """这是一个很多人直到开始办绿卡才意识到的严峻问题。

**基本背景**

美国绿卡（永久居留权）有国家配额限制：每个国家每年最多占总名额的7%，不论该国申请人数量。

对于中国大陆和印度出生的申请人，这意味着排队等候。

**EB-2 India 的现实**

截至2024年，EB-2（高级职位，包含NIW）印度优先日期大约在2012年。

这意味着：2024年审理的是2012年排队的申请人。

如果你今天排进EB-2 India的队列，你的优先日期是2024年，大概需要等到……2070年代初。

不是我乱说数字，这是根据USCIS每年消耗名额速度和积压人数算出来的。

**EB-2 China 的情况**

稍好但也很严峻。优先日期大约在2019-2020年左右，积压相对印度少，但仍需数年等待。

**H-1B持有者的困境**

很多人以为H-1B是过渡，办绿卡就是走流程的事。现实是：
1. H-1B可以续签，理论上可以一直持着等GC
2. 但每次换工作需要重新走PERM程序（雇主劳工证书），重置部分流程
3. 如果公司倒闭或被收购，GC申请可能中断

**EB-1A / EB-1B 的可能性**

EB-1（特别优先）对中国大陆和印度也有排期，但远比EB-2短。目前EB-1 China约2022年，EB-1 India约2022年。

**我的判断**

对于中国大陆背景的人：如果你在科技行业，有足够的发表/引用记录，认真考虑EB-1B（杰出研究员）或EB-2 NIW。如果没有这些条件，绿卡可能是一个20-30年的项目。

对于印度背景的人：EB-2的等待时间对很多人来说已经超过了职业规划的时间轴。很多人选择了加拿大PR作为替代路径。""",
        "more_answers": [
            ("补充一个很多人不知道的：EB-1A（杰出人才，Individual）不需要雇主担保，可以自己申请，且没有PERM流程。对中国背景的人，目前EB-1A比EB-2排期短很多。", 678),
            ("我认识的一个印度同事，2009年开始排EB-2 India，到2024年还在等。他的孩子在美国出生，是美国公民了，而他还是H-1B。这不是段子，这是真实发生的事情。", 543),
            ("我在美国H-1B工作了7年后转到了加拿大，用Express Entry 14个月拿到了PR。薪资降了25%，但睡得好了。不是说哪个选择更好，只是说两条路的心理成本是完全不同的。", 489),
        ],
    },
    # ═══════ 加拿大 ════════
    {
        "question": "在加拿大读完研究生，毕业后移民有多现实？从PGWP到PR需要几年？",
        "regions": ["canada"],
        "url": "https://www.zhihu.com/question/demo-ca1",
        "upvotes": 2089,
        "answer": """这个路径我自己走过，来分享一下真实时间线。

**标准路径：读书 → PGWP → Express Entry → PR**

**第一步：PGWP**
毕业后申请Post-Graduation Work Permit，时长 = 你的项目时长（上限3年）。
2年制硕士 = 3年PGWP。

关键：PGWP是开放工作许可（open work permit），可以在任何加拿大雇主工作，不需要雇主担保。

**第二步：积累加拿大工作经验**
Express Entry的Canadian Experience Class（CEC）要求：
- 过去3年内有至少1年全职加拿大工作经验（NOC TEER 0/1/2/3类）
- 英语/法语达到最低要求（通常CLB 7）

大多数工程师/科技/商业类职位都符合NOC要求。

**第三步：Express Entry ITA**
建立EE profile，等待联邦政府发出Invitation to Apply（ITA）。
CRS分数越高，越早收到ITA。

近年来联邦综合类别（General）抽签CRS分数在490-530之间波动，有技术背景的2年制硕士毕业生通常在450-500范围。

**第四步：PR申请**
收到ITA后60天内提交申请，之后等待处理，一般6-12个月。

**总时间线（我的情况）**

| 阶段 | 时长 |
|------|------|
| 硕士读书 | 2年 |
| PGWP开始工作 | 第0个月 |
| 达到1年工作经验 | 第12个月 |
| 建立EE Profile | 第12个月 |
| 收到ITA | 第18个月（等了6个月） |
| 提交PR申请 | 第18个月 |
| 拿到PR | 第26个月 |

毕业后约26个月拿到PR。

**影响时间的关键因素**

1. CRS分数：法语加分最高效（50分），配偶英语也能加分
2. 省提名（PNP）：很多省有针对科技人才的项目，CRS要求比联邦低
3. Job Offer：TEER 0/1类的工作邀请加50-200分

**现实建议**

这条路是目前中国/印度背景人士移民北美最可预期的路径之一。没有抽签，CRS分数透明，规则稳定（相对于美国而言）。""",
        "more_answers": [
            ("省提名的补充：Alberta Advantage Immigration Program (AAIP)和Saskatchewan PNP的分数要求通常比联邦综合类低50-80分。如果联邦的CRS够不到，先去这两个省找工作是一个策略。", 567),
            ("关于法语加分：TEF Canada考到CLB 7（大约B1水平）可以加50分。对英语母语者来说不那么难，但对中文背景的人同时学法语成本还是不低。不过50分的ROI非常高。", 432),
            ("我是从美国H-1B转到加拿大的，通过雇主担保拿到工作签证，之后再转Express Entry。如果你已经有加拿大工作offer，还有直接省提名的路径，不一定要先读书。", 345),
        ],
    },
    {
        "question": "加拿大Express Entry的CRS分数怎么计算？有哪些可以主动提升的因素？",
        "regions": ["canada"],
        "url": "https://www.zhihu.com/question/demo-ca2",
        "upvotes": 1654,
        "answer": """CRS（Comprehensive Ranking System）满分1200分，实际竞争区间大约在450-560之间。

**核心得分因素**

**1. 年龄（最高110分）**
18-35岁得分高，每过一年减少几分，45岁以上只有几分。年龄是你无法控制的，尽早行动。

**2. 学历（最高150分）**
- 加拿大博士：150分
- 外国博士 / 加拿大硕士：135分
- 外国硕士 / 加拿大学士：120分

加拿大学位比同等海外学位多15分。

**3. 语言（最高160分，主要语言）**
IELTS或CELPIP，四项（读写听说）都要CLB 9才能拿到最高分。

**4. 加拿大工作经验（最高80分）**
- 1年：40分
- 2年：53分
- 3年以上：64分

**可以主动提升的因素**

**法语（+50分，双语优势）**

这是性价比最高的提分点。参加TEF Canada达到CLB 7（约B1），不需要太流利。+50分在目前竞争环境下经常是决定性的差距。

学习路径：Duolingo（免费）+ 语言学校（3-6个月） + TEF备考材料。费用：RMB 3,000-8,000 + 考试费约200加元。

**配偶语言（+20分）**

配偶参加语言考试，达到CLB 7可以给主申请人增加约20分。

**工作邀请（+50或+200分）**

NOC TEER 0/1职位的工作邀请+50分，部分特殊条件+200分。

**省提名（+600分）**

这是最大的加分项——但它不是你"提升"的，而是省政府选你。被提名后直接获得600分，基本确保拿到ITA。所以很多人的策略是：在目标省找工作，争取省提名。

**实操建议**

如果你的联邦CRS在450以下，短期内拿到ITA很难（除非有联邦专项抽签）。这种情况下：
1. 优先学法语，争取+50分
2. 研究省提名，联系目标省的移民顾问
3. 继续积累加拿大工作经验（每年会涨分）""",
        "more_answers": [
            ("补充：CRS分数会因为年龄每年降一次，但工作经验和语言是可以提升的。很多人在PGWP第一年觉得CRS不够，到第二年因为多了一年工作经验+考了法语，就够了。不用慌，在时间轴上规划好。", 423),
            ("BC省的Tech Pilot、Ontario的Human Capital Priority……每个省的PNP有不同的职业类别要求。建议提前研究你的NOC Code对应哪个省有专项，不要等到要提名了才去看。", 356),
            ("一个经常被忽视的提分方法：如果你有海外工作经验（在加拿大以外的国家工作），也可以给CRS加分。具体是NOC同等级海外职位1-2年+13分，3年以上+25分。", 278),
        ],
    },
    # ═══════ 美加对比 ════════
    {
        "question": "美国H-1B和加拿大PR，对于中国背景的留学生，哪条路更现实？",
        "regions": ["us", "canada"],
        "url": "https://www.zhihu.com/question/demo-both1",
        "upvotes": 4521,
        "answer": """这是一个非常个人的问题，但我可以从制度层面做一个尽量客观的比较。

**核心差异：确定性 vs 薪资**

美国路径：
- H-1B：每年约35%的单次中签率，STEM OPT给3次机会，三次都没中的概率约25-27%
- 绿卡（EB-2 China）：目前优先日期约2019-2020年，等待时间5-10年（非印度背景相对好一些）
- 薪资：湾区科技岗位比多伦多高40-60%

加拿大路径：
- PGWP：毕业直接给，时间=项目时长（上限3年）
- Express Entry：点数制，无抽签，分数够就能拿ITA
- PR时间线：毕业后2-3年可以拿到PR，之后5年可申请公民
- 薪资：比美国低，但比中国高，生活成本扣除后差距缩小

**对中国大陆背景的特殊考量**

关键数据：EB-2 China的排期约为5-10年（相比之下印度要50年+）。这意味着中国背景的人走美国绿卡路径是有可能在职业生涯内完成的——但需要承受这段时间的不确定性。

**什么情况下选美国**

1. 你已经在美国有稳定H-1B，公司会持续赞助
2. 你的领域（金融、某些tech方向）在美国薪资优势特别大
3. 你能接受3-10年的身份不确定性作为换取更高薪资的代价
4. 你的EB-1/NIW申请条件好，可以走快速通道

**什么情况下选加拿大**

1. 你已经在或打算去加拿大读研究生（PGWP是起点）
2. 你更看重PR/公民身份的确定性，不想每年都有H-1B焦虑
3. 你对移民身份本身有需求（如带父母过来、长期稳定等）
4. 你有法语或其他提分条件，CRS分数比较有竞争力

**我的判断**

这不是一道有标准答案的题。但如果你问我从20多岁开始规划职业生涯，我的建议是：尽早想清楚"你最想要的是什么"——是最大化职业天花板，还是最早实现身份稳定。这两个目标目前在北美往往对应不同的地理选择。

两条路都走得通，但它们需要的心理成本是完全不同的。""",
        "more_answers": [
            ("我走的是在美国工作5年（H-1B x2），H-1B没出问题但实在不想每年担心绿卡排期，最后主动转到加拿大，14个月拿到PR。现在回头看两段经历，薪资确实美国高，但睡眠质量是在加拿大这边好。这不是夸张，是真实感受。", 987),
            ("一个很多人没考虑到的维度：如果你有结婚/生育计划，加拿大的儿童福利、育儿假、学前教育资助等会让总体经济账和你想象的不一样。两国在家庭政策上差异很大。", 756),
            ("从HR角度补充：加拿大雇主很多不了解什么是open work permit和employer-specific work permit的区别。PGWP持有者需要主动跟HR解释'我可以在你这工作，你不需要做任何申请'，否则很多公司看到'work permit'就以为需要担保。", 634),
        ],
    },
    {
        "question": "在美国还是加拿大工作，对国内父母将来的团聚有多大影响？",
        "regions": ["us", "canada"],
        "url": "https://www.zhihu.com/question/demo-both2",
        "upvotes": 1234,
        "answer": """这是个很实际但经常被忽略的问题。来比较一下两国的父母团聚政策。

**美国：父母移民签证**

绿卡持有者和公民都可以申请父母移民（直系亲属，IR-5类别）。

- 美国公民申请父母：没有数量限制，当前排期约1年左右
- 绿卡持有者申请父母：有数量限制，排期可能需要5-10年+

关键：你必须先拿到绿卡才能启动这个流程。如果你在美国等绿卡等了10年，父母可能已经70多岁了才能开始团聚申请。

**加拿大：父母/祖父母移民**

Super Visa：父母/祖父母可以申请最长5年的访客签证，每次入境可以住最长2年，可以续签。处理时间通常3-8个月，是更快速的父母来访渠道。

父母移民（PR）：每年有名额限制，通过抽签或先到先得系统分配。近年来中签率约在20-30%，不确定。一旦选中，处理时间约24-30个月。

**实际影响**

- 如果你最终想让父母来陪你住，加拿大的Super Visa是一个相对快的短期解决方案（可以合法居住几年）
- 长期PR团聚，两国都有挑战，但美国需要你先拿到绿卡才能启动，等待时间更长

**我的建议**

如果父母团聚是你重要的优先项，在选择路径时就要把这个因素算进去，不要等到移民了才发现团聚比预期难得多。""",
        "more_answers": [
            ("Super Visa的好处被很多人忽视。我父母持Super Visa在加拿大已经住了快3年了，每次最多住2年，然后出去转一圈回来继续。比很多国家的父母团聚政策灵活多了。", 456),
            ("美国绿卡持有者申请父母这条路我研究过，排期真的很长。我现在H-1B身份，估计等我拿到绿卡，最快也是10年后的事，那时候父母七十多了再申请父母移民……时间轴根本不对。", 378),
        ],
    },
    # ═══════ grad-school-selection ════════
    {
        "skill": "grad-school-selection",
        "question": "申请PhD时排名重要还是导师重要？怎么权衡？",
        "regions": ["us", "canada"],
        "url": "https://www.zhihu.com/question/gs-demo1",
        "upvotes": 3241,
        "answer": """直接结论：**导师远比排名重要**，但这个结论需要几个重要的前提条件。

**为什么导师比排名重要**

PhD录取和培养的核心机制是「局部竞争」而非「全局竞争」——你不是在和全球所有申请者竞争，你是在和对同一个导师感兴趣的一小批人竞争。一个和某导师有很强研究匹配的普通申请者，往往比一个背景强但方向不匹配的申请者更容易被录取。

毕业后的去向更是由导师决定的：推荐信是导师写的，合作网络是导师建立的，第一份工作的敲门砖是导师打开的。

一个数据点：全美排名第一的项目里有Ghost advisor，也有Exploiter（榨取学生的导师）。排名第25的项目里有每年帮学生发3篇顶会的好导师。你最后去哪里，取决于你在哪个实验室，不是你在哪个系。

**排名真正有影响的情形**

1. **学术职场**：如果你目标是当教授，top-5/top-10项目确实在academic job market上有优势。但即便如此，导师的推荐信和学生的publication record才是核心，不是系名。

2. **信息不足时的proxy**：如果你对导师完全没有研究，排名可以作为平均质量的粗略代理。但这是信息不足时的fallback，不是真正的决策依据。

3. **完全同等条件下**：如果两个导师的所有维度都相同（publication speed、mentorship quality、grant stability、placement record），那排名更高的项目是合理的tiebreaker。

**如何真正评估导师**

不要只看h-index和论文数量。看：
1. **最近5个毕业生去了哪里**（是你想去的方向吗？）
2. **学生的一作论文数量**（学生有没有独立的publication track record？）
3. **Grant状态**（NSF/NIH Award Search可以查到在研项目和结束时间）
4. **实验室规模**（20个学生的明星导师不等于你能得到充足的mentorship）
5. **现任和前任学生的真实反馈**（LinkedIn找前学生，私信问"Would you choose this advisor again?"）

一个"很独立"的导师描述几乎从来不是优点。它的实际含义是：你在自己摸索，导师不管你。""",
        "more_answers": [
            ("补充一个具体建议：套磁时问导师'您最近毕业的5个学生现在在哪里？'这个问题很难造假，答案直接告诉你这个实验室的培养质量。如果导师回答不上来或者含糊其辞，这本身就是信息。", 891),
            ("我亲身经历：拒了top3，去了top20，原因是top20那个导师的组平均毕业时间4.5年且人人有顶会，top3那个导师的组平均6年+有人毕不了业。现在第三年，两篇顶会，完全不后悔。", 734),
            ("学术方向补充：如果你的目标是美国教职，学校排名确实在academic job market上有作用，但没有大家想的那么绝对。看AcademicJobsOnline的数据，tenured/tenure-track职位有相当比例来自top10以外的项目，关键在于publication在领域的影响力。", 456),
        ],
    },
    {
        "skill": "grad-school-selection",
        "question": "读PhD值不值？从移民、职业、个人发展三个角度分析",
        "regions": ["us", "canada"],
        "url": "https://www.zhihu.com/question/gs-demo2",
        "upvotes": 2876,
        "answer": """这个问题没有统一答案，但有清晰的分析框架。我从三个角度拆解。

**移民角度（针对国际学生）**

Funded PhD是一种被严重低估的移民工具：
- F-1身份持续5-6年（甚至更长）
- 毕业后有新的12个月OPT，加STEM OPT可延长到3年
- 相当于总共多了4-7年的合法居留时间，多3次参与H-1B抽签的机会
- PhD期间可以积累EB-1A/O-1的资质（顶刊论文、审稿人经历、获奖）

对比：自费MS给你1-3年OPT窗口，花费15-20万美元，没有H-1B之外的immigration pathway积累。

这不是说PhD比MS好，而是说如果你要读研究生，funded PhD的immigration value远高于self-funded MS。

**职业角度**

PhD值不值取决于你想做什么：

| 目标职位 | PhD价值 |
|--------|--------|
| 学术研究/教职 | 必须的，没有选项 |
| 工业界Research Scientist | 高，大多数顶级职位要求PhD |
| Applied Scientist/ML Engineer | 中，PhD有溢价但不是门槛 |
| 普通SWE/数据工程师 | 低，4-5年机会成本很难回收 |
| 管理/产品方向 | 几乎没有额外价值 |

**个人发展角度**

读PhD的隐性代价经常被低估：
- 5-6年是人生最黄金的职业积累期
- Stipend（$30K-40K）在消费物价较高的大学城往往很紧张
- 导师关系的好坏对心理健康影响极大，这不是小事
- PhD dropout率40-50%，进去不一定能出来

读PhD的隐性收益也经常被低估：
- 真正的研究方法论训练
- 高密度的领域专家网络
- 5年时间慢慢确认你真正想做什么

**我的建议**

在决定读不读PhD之前，先回答这一个问题：「你能说出一个具体的研究问题，它让你觉得值得花5年去回答吗？」

如果答案是yes——读。如果答案是「我对这个领域感兴趣」但说不出具体问题——先工作1-2年再决定。""",
        "more_answers": [
            ("关于EB-1A那段：需要说明，PhD毕业直接申EB-1A通过率不高，通常需要postdoc或工业界研究职位积累更多成果。但PhD期间确实可以开始积累（审稿人、领域获奖），方向是对的，只是不能高估速度。", 678),
            ("补充一个很多人忽略的点：Funded PhD期间通常有医疗保险（学校提供），这对国际学生来说价值不小。自费MS的医疗保险经常是单独购买的，一年额外几千美元。", 512),
        ],
    },
    {
        "skill": "grad-school-selection",
        "question": "CS/ML方向工业界PhD和学术PhD有什么实质区别？",
        "regions": ["us"],
        "url": "https://www.zhihu.com/question/gs-demo3",
        "upvotes": 2134,
        "answer": """这两条路在申请阶段看起来类似，但实际上培养逻辑、选择标准、毕业后的竞争力都有明显不同。

**核心区别**

| 维度 | 学术导向PhD | 工业界导向PhD |
|-----|-----------|------------|
| 发表目标 | NeurIPS/ICML/ICLR等顶会，追求理论novelty | 顶会发表+应用相关性，两者都要 |
| 导师重要性 | 极高，影响学术job market的推荐信 | 高，但更看重导师的工业界connection |
| 导师选择标准 | h-index、citation、学术声誉 | 在Google/Meta/OpenAI等地的合作项目、前学生的去向 |
| 实习重要性 | 中等，不影响学术轨道 | 极高，实习是进入工业界lab的核心pathway |
| 程序排名 | 更重要（学术job market偏好top5） | 相对不那么重要，导师connection > 程序排名 |
| 毕业时间 | 5-6年 | 4-5年更常见 |

**如何判断一个导师是工业界导向还是学术导向**

看这几个维度：
1. 他/她的学生毕业后主要去了哪里？（学术vs工业界比例）
2. 他/她有没有Google/Meta/Microsoft的合作项目或consulting关系？
3. 他/她的学生每年internship在哪里？（DeepMind/OpenAI > 普通科技公司 > 没有实习）
4. 他/她自己有没有工业界经历？

**一个常见的误区**

很多人以为「工业界PhD」只是指去工业界lab（如Google Brain）做的PhD。实际上，大多数工业界导向的PhD还是在大学，只是导师风格不同。

另外，工业界lab（Google、Meta、Microsoft）现在也有自己的PhD项目或合作项目，和大学联合培养。这是第三条路，不完全等同于传统大学PhD。

**我的建议**

如果你目标是工业界research scientist：
- 选有工业界connection的导师 > 选顶排名的程序
- 实习track record > 论文数量（但要有足够的publication）
- 申请时主动问：「您的学生在哪里实习过？有没有和工业界lab的合作项目？」""",
        "more_answers": [
            ("补充工业界PhD申请中经常被忽视的一点：问清楚导师对internship的态度。有些学术导向的导师不鼓励学生实习（'影响研究进度'），有些工业界导向的导师主动帮学生找实习。这个差别在毕业找工作时影响巨大。", 567),
            ("Applied Scientist（AS）和Research Scientist（RS）在大厂的区别：RS通常要求PhD，做更偏基础的研究；AS门槛更低，硕士也可以申请，工作更偏应用。如果你的目标是RS，PhD几乎是必须的；如果目标是AS，PhD溢价存在但不是硬性要求。", 434),
        ],
    },
    {
        "skill": "grad-school-selection",
        "question": "如何判断一个PhD导师是好导师还是坏导师？有什么具体指标？",
        "regions": ["us", "canada"],
        "url": "https://www.zhihu.com/question/gs-demo4",
        "upvotes": 1987,
        "answer": """判断导师质量是申请PhD过程中最重要也最容易被忽视的步骤。给几个具体可操作的指标。

**可以直接查的客观指标**

1. **最近毕业生去向**：Google Scholar或LinkedIn查他/她指导的学生，看过去5年毕业的学生现在在哪里。这是最难造假的指标。

2. **学生publication track record**：看学生是不是一作/二作出现在论文里。如果一个导师发了很多论文但学生名字总是排在第5位之后，说明学生没有得到应有的credit。

3. **Grant状态**：NSF Award Search或NIH Reporter查导师的在研项目。grant快断掉意味着RA funding可能有风险。

4. **实验室规模**：一个导师带20个学生和带5个学生，你能得到的attention完全不同。

**需要主动问的定性指标**

联系实验室的在读学生，问：
- 「每周/每月和导师见几次面？」
- 「导师一般多久回邮件？」
- 「你们有问题可以随时找导师还是只有固定的meeting？」

联系已经毕业或离开的学生（更重要！），问：
- **「如果重来一次，你还会选择这个导师吗？」**
- 「你毕业用了几年？」
- 「你觉得导师对你的职业发展有什么帮助？」

**四种导师类型**

- **理想型**：定期meeting，快速回复，推学生publication，有industry/academic connection帮助就业
- **Ghost型**：消失不见，不管你，见面靠你追，发表靠你自己——很多人说的"很独立的导师"
- **Exploiter型**：让你做项目但不给你author credit，或者让你做大量tech支持而不是真正研究
- **Pre-tenure高风险型**：本人很好，但可能tenure失败或中途离开，你面临换导师或换学校

最重要的一点：**"很独立"这个词出现在学生评价里，几乎永远是警告而不是优点。** 它的实际含义是导师不管学生，学生被迫自己摸索。""",
        "more_answers": [
            ("补充一个简单粗暴但很有效的方法：去看导师指导的学生的毕业年份。正常PhD 4-6年毕业。如果一个导师的学生普遍7-9年才毕业，或者有人入学很多年了还没有毕业在读，这是很大的红旗。", 734),
            ("关于联系学生：很多学生不方便公开说导师的坏话（毕竟还在实验室），但在私信里通常更坦诚。问问题的方式也很重要，不要直接问'你导师怎么样'，而是问具体的问题，比如'你觉得在这个实验室做research最困难的地方是什么'。", 589),
        ],
    },
    {
        "skill": "job-search-strategy",
        "question": "国际留学生在美国找工作，如何应对雇主对visa sponsorship的顾虑？",
        "regions": ["us"],
        "url": "https://www.zhihu.com/question/jss-demo1",
        "upvotes": 3421,
        "answer": """这是国际学生找工作最核心的心理和策略问题。分几个层面回答。

**首先要理解雇主的顾虑是什么**

雇主说"我们不sponsor"通常不是因为他们有什么原则性反对，而是因为：
1. H-1B有lottery（抽签），他们不确定你能留下来
2. 他们不清楚流程，觉得很复杂
3. 他们有过不好的经历（之前帮人sponsor了，然后人走了）
4. 公司规模小，没有immigration attorney

这意味着不同的公司有不同的objection，需要不同的应对方式。

**策略一：用数据降低他们对lottery的顾虑**

H-1B抽签概率大约是35-40%（近年）。如果雇主赞助了你但你没被选上，意味着他们前功尽弃。

可以这样说：「我了解H-1B的流程。我有3年STEM OPT，不管lottery结果怎样，我都可以持续工作。如果第一年没中，我还有两次机会。在这段时间内，我和普通美国员工没有任何区别。」

**策略二：目标公司先做sponsorship调研**

在投简历之前，先查H1Bdata.info或MyVisaJobs——看这家公司过去几年sponsor了多少H-1B，什么职位，批准率多少。没有sponsorship记录的公司基本不值得投入时间。

**策略三：internship路径比full-time cold apply更可靠**

在一家公司实习过并拿到return offer，比从外部cold apply好10-20倍。公司已经认识你，已经invest过training，他们的sponsor意愿比对陌生人高得多。

Internship → return offer是国际学生最reliable的H-1B sponsorship路径。

**策略四：networking先于投简历**

通过内推进入面试流程的人，在offer阶段很少被因为visa问题拒掉——因为已经有人在内部为你背书了。

冷申请被以「我们不sponsor」直接刷掉，很多时候是因为根本没有人在内部了解你是谁。

**关于visa问题什么时候提**

最好的时机是offer阶段，而不是第一轮面试。到了offer阶段，他们已经决定要你了，visa只是一个需要解决的行政问题，不是决定要不要你的因素。

如果他们在电话面试里直接问，诚实回答，但要把重点放在"我可以合法工作X年"上，而不是"我需要你帮我做Y件事"上。""",
        "more_answers": [
            ("补充一点关于中小公司：很多中小公司说'我们不sponsor'不是因为他们不愿意，而是因为他们从来没做过，不知道流程，觉得很麻烦。如果你面试进展顺利，可以说：'关于H-1B我可以介绍一下流程，实际上公司的工作量没有想象中那么大。'有些公司是可以被说服的。", 1234),
            ("关于timing：研究显示大多数international student在拿到offer之前就提visa的话，rejection率显著更高。拿到offer之后再谈，双方都更有motivation解决这个问题。", 876),
        ],
    },
    {
        "skill": "job-search-strategy",
        "question": "如何用冷邮件/LinkedIn冷链接找到工作？有没有具体有效的模板？",
        "regions": ["us", "canada"],
        "url": "https://www.zhihu.com/question/jss-demo2",
        "upvotes": 2876,
        "answer": """冷邮件找工作的核心误区是：大家把它当成"发简历的另一种方式"，但实际上它是"建立关系的第一步"。这个认知的差别决定了一切。

**结构：三段话，不多不少**

第一段（1-2句）：具体的共同点或连接
- 不要写：「我对贵公司非常感兴趣」
- 要写：「我看了你上周在[大会]分享的[具体话题]，你提到的[某个具体观点]恰好解决了我在[项目]里遇到的一个问题」

第二段（1句）：一行证明你是相关的人
- 不要写：「我有扎实的编程能力和良好的沟通能力」
- 要写：「我在[某项目]做了[具体的事]，结果是[具体的数字]」

第三段（1句）：唯一的要求——一个20分钟的电话
- 不要写：「希望有机会加入贵公司」
- 要写：「请问您接下来几周有没有方便的时间通个20分钟的电话？」

**总字数：100字以内（英文）或200字以内（中文邮件）**

**找谁发？**

目标是你未来可能的直属manager，不是HR，不是VP，不是CEO。

LinkedIn搜索：[公司名] + [你目标的team名] + [Manager/Lead级别] → 找最近6个月在LinkedIn上发过技术帖子的人（说明他们活跃，更可能回复）。

**跟进节奏**

- 发出后第4天：如果没回复，发一条1句话的跟进（「Hi XX，上周发过一封邮件，不知道是否有机会聊聊」）
- 第9天：再跟进一次，这次可以加一个具体的问题或者分享一个相关的东西
- 第14天：最后一次，给对方一个台阶下（「如果现在不是好时机，完全理解，之后有机会再联系」）
- 三次之后没回复：移步联系同公司的另一个人

**回复率参考**：精准执行这个方法，对tech岗位通常有15-25%的回复率（远高于海投的1-3%）。""",
        "more_answers": [
            ("关于什么时候ask for referral（内推）：不要在第一封邮件里要内推，也不要在第一个call里要内推。做法是：第一个call好好聊，结束后当天发感谢邮件（提一个具体的聊天内容），2-4周后如果有合适的职位再ask for referral。这时候社交债务已经建立，成功率高很多。", 987),
            ("LinkedIn InMail vs 邮件：邮件的回复率通常高于InMail，因为InMail太多人用，已经有了spam的感觉。如果能找到对方的工作邮箱（公司官网、GitHub、学术主页）优先用邮件。找不到邮箱再用InMail。", 756),
        ],
    },
    {
        "skill": "job-search-strategy",
        "question": "国际学生在美国拿到offer之后可以谈薪吗？谈了会影响visa sponsorship吗？",
        "regions": ["us"],
        "url": "https://www.zhihu.com/question/jss-demo3",
        "upvotes": 4123,
        "answer": """可以谈，而且应该谈。「谈薪会影响visa sponsorship」这个担心是错误的，但它让很多国际学生每年损失数万美元。

**为什么这个担心是错的**

雇主决定是否sponsor visa，和雇主决定给你多少薪资，是两个独立的决策。

到了offer阶段，sponsor的决策已经做完了——他们已经决定要你，已经愿意承担sponsorship的成本和流程。谈薪是在这个决定之后进行的，它不会"撤销"sponsorship决定。

公司因为专业的薪资谈判而撤回offer，在正规公司几乎不存在。这样做对公司的声誉伤害远大于多付几千美元薪资。

**H-1B的prevailing wage要求实际上帮了你**

H-1B要求雇主支付"prevailing wage"——也就是该职位在该地区的市场平均工资水平。如果雇主在sponsor H-1B，他们的底价已经被法规锚定了。你从这个底价往上谈，完全正当。

**怎么谈**

拿到offer之后，给recruiting coordinator或recruiter打电话：

「感谢贵公司的offer，我非常excited。在正式接受之前，我想就薪资聊一聊。Base是$X，根据我对这个职位在[城市]的市场行情的了解，我希望能讨论一个接近$Y的数字。请问这方面有灵活性吗？」

然后保持沉默，等对方回应。

**如果对方说"这个price是固定的"**

大公司的pay band可能确实有限制，但你还有：
1. Signing bonus（通常在band之外，更灵活）
2. Equity（RSU数量，通常可谈）
3. 如果有competing offer，这是最强的筹码

国际学生谈薪的心理障碍主要来自感觉自己"应该感激对方愿意sponsor"。但这个框架是错的——你是一个有市场价值的专业人士，visa只是一个需要处理的行政事项，不是你的身份定义。""",
        "more_answers": [
            ("补充数据：根据各种调查，不谈薪的人和谈薪的人，第一年薪资差距平均在$10,000-$20,000之间，而且这个差距会随着每次涨薪百分比积累，长期差距更大。国际学生群体不谈薪比例显著高于本地学生，差距来自于这个错误的担心。", 1567),
            ("关于timing：最好在oral offer之后（written offer之前）谈，这个时间窗口双方都还在'一起把事情做成'的心态里，而不是正式的合同阶段。", 1023),
        ],
    },
    {
        "skill": "job-search-strategy",
        "question": "加拿大PGWP毕业生如何规划从找工作到拿到PR的完整路径？",
        "regions": ["canada"],
        "url": "https://www.zhihu.com/question/jss-demo4",
        "upvotes": 2654,
        "answer": """PGWP到PR是一个可以清晰规划的路径，但需要理解几个关键节点。

**第一步：理解PGWP的年限**

PGWP年限 = 你完成的项目年限，上限3年。
- 2年制硕士 → 3年PGWP
- 1年制硕士/Graduate Certificate → 1年PGWP

年限的重要性：1年PGWP意味着你必须在1年内找到工作、积累1年经验、启动PR申请，时间非常紧；3年PGWP则有充裕的时间。项目选择很大程度上决定了移民路径的难度。

**第二步：找工作期间的核心优势**

PGWP是open work permit，不是employer-specific。你告诉雇主：「我有3年开放工作许可，不需要您做任何申请或提交任何文件。」

这和美国的OPT/H-1B体验完全不同——加拿大雇主不需要为你做任何移民相关的事情。

**第三步：1年工作经验后进入CEC（加拿大经验类别）**

在加拿大技术性工作（NOC TEER 0/1/2/3）满1年后，你有资格申请Canadian Experience Class（CEC）。

CEC通过Express Entry系统运作：
- 创建Express Entry profile
- 系统根据CRS（综合排名分数）排名
- 分数够高的人收到ITA（邀请申请）
- 提交申请 → PR（处理时间约6-12个月）

**第四步：提升CRS分数的具体方法**

CRS分数由年龄、教育、工作经验、语言成绩决定。可以主动提升的部分：

1. **语言成绩（最重要）**：IELTS Academic或CELPIP要尽量拿高分。CLB 9-10分对应的CRS分明显更高。
2. **法语成绩**：有法语能力（TEF/TCF）可以额外加分，且进入法语bilingual池，CRS门槛低很多。哪怕B1/B2水平都有帮助。
3. **省提名（PNP）**：很多省有tech-specific的提名项目（BC Tech Pilot、Ontario OINP等），被省提名后可以额外加600分，基本等于直接拿到PR邀请。
4. **Job offer加分**：LMIA支持的job offer可以加50-200分（但获得LMIA本身需要雇主主动操作）

**整体时间线（以3年PGWP为例）**：

- Year 1：找工作，开始工作
- Month 12-18：满足CEC 1年经验要求，语言考试（提前准备）
- Month 18-24：创建Express Entry profile，等待ITA
- Month 24-36：提交PR申请，等待批准（通常6-12个月）

最理想的情况：在PGWP到期前就能拿到PR，之后不再依赖任何work permit。""",
        "more_answers": [
            ("关于PNP的补充：各省的tech PNP池子经常开放和关闭，而且对NOC代码有要求。BC Tech Pilot和Ontario Masters Graduate Stream是最常被推荐的两个。建议关注各省移民局官网，有新批次时第一时间申请。", 876),
            ("法语加分这点被很多人低估了。进入French bilingual pool的CRS门槛通常比regular pool低30-50分。如果你有法语背景（甚至只是高中学过），认真备考TEF或TCF很值得。3-6个月的准备可能让你早一两年拿到PR。", 734),
        ],
    },
]


def scrape_demo(posts_per_q: int, out_dir: Path,
                question_ids: Optional[list[str]] = None,
                skill: str = "immigration-planning") -> list[Path]:
    scraped_at = datetime.utcnow().strftime("%Y-%m-%d")
    # Filter by skill field; posts without a skill field default to immigration-planning
    posts = [p for p in DEMO_POSTS if p.get("skill", "immigration-planning") == skill]
    if not posts:
        posts = DEMO_POSTS  # fallback: return all if no skill match

    written: list[Path] = []
    for post in posts[:max(posts_per_q * 2, len(posts))]:
        more = post.get("more_answers", [])
        content = _format_post(
            question=post["question"],
            answer_body=post["answer"],
            upvotes=post["upvotes"],
            url=post["url"],
            regions=post["regions"],
            scraped_at=scraped_at,
            more_answers=more,
        )
        tag = "🇺🇸" if post["regions"] == ["us"] else (
              "🇨🇦" if post["regions"] == ["canada"] else "🌐")
        print(f"  [demo] {tag} {post['question'][:55]}")
        fname = f"zhihu_{_slug(post['question'])}.txt"
        path = out_dir / fname
        path.write_text(content, encoding="utf-8")
        written.append(path)

    return written


# ── Main ─────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="知乎社区数据抓取器")
    parser.add_argument("--skill", default="immigration-planning")
    parser.add_argument("--questions", nargs="+",
                        help="指定知乎问题ID（不传则用预设列表）")
    parser.add_argument("--posts", type=int, default=5,
                        help="每个问题抓取的回答数量")
    parser.add_argument("--demo", action="store_true",
                        help="使用合成演示数据（不需要网络）")
    args = parser.parse_args()

    skill_dir = get_skill_dir(args.skill)
    if not skill_dir.exists():
        sys.exit(f"Error: 找不到技能目录 {skill_dir}")

    out_dir = skill_dir / "raw" / "community" / "zhihu"
    out_dir.mkdir(parents=True, exist_ok=True)

    question_ids = args.questions or SKILL_QUESTIONS.get(args.skill, [])

    if args.demo:
        print(f"[demo 模式] 生成知乎合成数据 ({args.skill})")
        written = scrape_demo(args.posts, out_dir, question_ids, skill=args.skill)
    else:
        print(f"[知乎抓取] 目标问题数: {len(question_ids)}")
        written = _scrape_scrapling(question_ids, args.posts, out_dir)
        if not written:
            print("真实抓取未返回结果，切换到 demo 模式")
            written = scrape_demo(args.posts, out_dir, question_ids, skill=args.skill)

    print(f"\n写入 {len(written)} 个文件 → {out_dir.relative_to(skill_dir.parent.parent)}/")
    for p in written:
        print(f"  {p.name}")
    print(f"\n下一步: python scripts/clean_community.py "
          f"{skill_dir.relative_to(skill_dir.parent.parent)}/raw/community/zhihu/ "
          f"--platform zhihu")


if __name__ == "__main__":
    main()
