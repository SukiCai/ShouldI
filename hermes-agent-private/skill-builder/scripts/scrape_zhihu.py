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
        # 美国签证/移民
        "21561791",   # H-1B 相关
        "19864430",   # OPT 转 H-1B
        "20399714",   # 美国绿卡
        "23020116",   # F-1 签证
        # 加拿大移民
        "24259711",   # Express Entry
        "22578394",   # PGWP
        "21304289",   # 加拿大 PR
        # 美加对比
        "20987654",   # 美国 vs 加拿大移民
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
    # 优先用 StealthyFetcher（curl_cffi，TLS 指纹伪装，不需要 Playwright）
    # 若不可用则尝试 DynamicFetcher（Playwright）
    fetcher = None
    try:
        from scrapling.fetchers import StealthyFetcher
        fetcher = StealthyFetcher(auto_match=True)
        print("  [Scrapling] 使用 StealthyFetcher (curl_cffi)")
    except Exception:
        pass

    if fetcher is None:
        try:
            from scrapling.fetchers import DynamicFetcher
            fetcher = DynamicFetcher(auto_match=True)
            print("  [Scrapling] 使用 DynamicFetcher (Playwright)")
        except Exception:
            pass

    if fetcher is None:
        print("  Scrapling 不可用，尝试 httpx 模式...")
        return _scrape_httpx(question_ids, posts_per_q, out_dir)

    scraped_at = datetime.utcnow().strftime("%Y-%m-%d")
    written: list[Path] = []

    for qid in question_ids:
        url = f"https://www.zhihu.com/question/{qid}"
        print(f"  [Scrapling] 抓取问题 {qid}...")
        try:
            page = fetcher.get(url, headless=True, network_idle=True)
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

        # 回答列表
        answer_els = page.css("div.RichContent-inner")
        vote_els = page.css("button.VoteButton--up")

        results: list[tuple[str, int]] = []
        for ans_el, vote_el in zip(answer_els[:posts_per_q + 3], vote_els):
            text = ans_el.text.strip()
            try:
                votes = int(re.sub(r"[^\d]", "", vote_el.text.strip()) or "0")
            except ValueError:
                votes = 0
            if votes >= MIN_UPVOTES and len(text) > 100:
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
]


def scrape_demo(posts_per_q: int, out_dir: Path,
                question_ids: Optional[list[str]] = None) -> list[Path]:
    scraped_at = datetime.utcnow().strftime("%Y-%m-%d")
    posts = DEMO_POSTS if not question_ids else DEMO_POSTS[:len(question_ids)]

    written: list[Path] = []
    for post in posts[:max(posts_per_q * 2, len(DEMO_POSTS))]:
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
        written = scrape_demo(args.posts, out_dir, question_ids)
    else:
        print(f"[知乎抓取] 目标问题数: {len(question_ids)}")
        written = _scrape_scrapling(question_ids, args.posts, out_dir)
        if not written:
            print("真实抓取未返回结果，切换到 demo 模式")
            written = scrape_demo(args.posts, out_dir, question_ids)

    print(f"\n写入 {len(written)} 个文件 → {out_dir.relative_to(skill_dir.parent.parent)}/")
    for p in written:
        print(f"  {p.name}")
    print(f"\n下一步: python scripts/clean_community.py "
          f"{skill_dir.relative_to(skill_dir.parent.parent)}/raw/community/zhihu/ "
          f"--platform zhihu")


if __name__ == "__main__":
    main()
