#!/usr/bin/env python3
"""Reddit community data scraper for skill-builder.

Scrapes immigration-relevant subreddits using PRAW (Reddit API) or httpx
(no credentials needed via old.reddit.com) and writes files to
raw/community/reddit/.

Priority order:
  1. PRAW — if REDDIT_CLIENT_ID + REDDIT_CLIENT_SECRET are set
  2. httpx — scrapes old.reddit.com directly, no API credentials needed
  3. --demo — generates realistic synthetic posts (for development only)

Usage:
    python scripts/scrape_reddit.py --skill immigration-planning
    python scripts/scrape_reddit.py --skill immigration-planning --demo
    python scripts/scrape_reddit.py --skill immigration-planning \
        --subreddits f1visa immigration cscareerquestions --posts 20
"""

import argparse
import os
import re
import sys
from datetime import datetime
from html import unescape
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from utils import get_skill_dir

# ── Default subreddits per skill ────────────────────────────────────────────
SKILL_SUBREDDITS: dict[str, list[str]] = {
    "immigration-planning": [
        # US-focused
        "f1visa", "immigration", "cscareerquestions", "USCIS",
        # Canada-focused
        "ImmigrationCanada", "canadaimmigration", "cscareerquestionsCAD",
    ],
    "grad-school-selection": [
        "gradadmissions", "PhD", "GradSchool", "cscareerquestions", "AskAcademia",
    ],
    "job-search-strategy": [
        "cscareerquestions", "jobs", "recruitinghell", "cscareerquestionsCAD", "f1visa",
    ],
    "pm-career": [
        "ProductManagement", "ExperiencedDevs", "cscareerquestions",
        "cscareerquestionsCAD",
    ],
    "salary-negotiation": [
        "cscareerquestions", "ExperiencedDevs", "personalfinance",
        "cscareerquestionsCAD", "PersonalFinanceCanada",
    ],
    "stay-or-return": [
        "f1visa", "cscareerquestions", "ImmigrationIndia",
        "ImmigrationCanada", "cscareerquestionsCAD",
    ],
}

# Regions implied by each subreddit — used to tag output files for extract.py
SUBREDDIT_REGIONS: dict[str, list[str]] = {
    "f1visa": ["us"],
    "immigration": ["us"],
    "USCIS": ["us"],
    "cscareerquestions": ["us", "canada"],
    "ImmigrationCanada": ["canada"],
    "canadaimmigration": ["canada"],
    "cscareerquestionsCAD": ["canada"],
    # grad-school-selection
    "gradadmissions": ["us", "canada"],
    "PhD": ["us", "canada"],
    "GradSchool": ["us", "canada"],
    "AskAcademia": ["us", "canada"],
    # pm-career / salary-negotiation / stay-or-return
    "ProductManagement": ["us", "canada"],
    "ExperiencedDevs": ["us", "canada"],
    "personalfinance": ["us", "canada"],
    "ImmigrationIndia": ["us"],
    # job-search-strategy
    "jobs": ["us", "canada"],
    "recruitinghell": ["us", "canada"],
}

# ── Minimum upvotes to include a post / comment ──────────────────────────────
MIN_POST_UPVOTES = 30
MIN_COMMENT_UPVOTES = 5
MAX_COMMENTS_PER_POST = 15


# ── Output format helpers ────────────────────────────────────────────────────

def _slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")[:60]


def _format_post(subreddit: str, title: str, body: str, score: int, url: str,
                 comments: list[tuple[str, int]], scraped_at: str,
                 regions: list[str] | None = None) -> str:
    import json as _json
    r = regions if regions is not None else SUBREDDIT_REGIONS.get(subreddit, ["us", "canada"])
    lines = [
        f"platform: reddit",
        f"subreddit: {subreddit}",
        f"regions: {_json.dumps(r)}",
        f"post_title: {title}",
        f"post_upvotes: {score}",
        f"post_url: {url}",
        f"scraped_at: {scraped_at}",
        "",
        "POST CONTENT:",
        body.strip(),
        "",
        "TOP COMMENTS:",
    ]
    for i, (text, votes) in enumerate(comments, 1):
        lines.append(f"[{i}] (upvotes: {votes})")
        lines.append(text.strip())
        lines.append("")
    return "\n".join(lines)


# ── Real PRAW scraper ────────────────────────────────────────────────────────

def scrape_with_praw(subreddits: list[str], posts_per_sub: int,
                     client_id: str, client_secret: str,
                     user_agent: str, out_dir: Path) -> list[Path]:
    try:
        import praw
    except ImportError:
        sys.exit("praw not installed. Run: pip install praw")

    reddit = praw.Reddit(
        client_id=client_id,
        client_secret=client_secret,
        user_agent=user_agent,
    )
    reddit.read_only = True

    written: list[Path] = []
    scraped_at = datetime.utcnow().strftime("%Y-%m-%d")

    for sub_name in subreddits:
        print(f"  Scraping r/{sub_name}…")
        try:
            sub = reddit.subreddit(sub_name)
            posts = list(sub.hot(limit=posts_per_sub * 3))
        except Exception as e:
            print(f"    Warning: could not access r/{sub_name}: {e}")
            continue

        count = 0
        for post in posts:
            if post.score < MIN_POST_UPVOTES:
                continue
            if post.is_self and not post.selftext:
                continue
            if count >= posts_per_sub:
                break

            # Fetch top comments
            post.comments.replace_more(limit=0)
            comments = [
                (c.body, c.score)
                for c in post.comments.list()
                if hasattr(c, "body") and c.score >= MIN_COMMENT_UPVOTES
            ]
            comments.sort(key=lambda x: x[1], reverse=True)
            comments = comments[:MAX_COMMENTS_PER_POST]

            content = _format_post(
                subreddit=sub_name,
                title=post.title,
                body=post.selftext or f"[link post] {post.url}",
                score=post.score,
                url=f"https://reddit.com{post.permalink}",
                comments=comments,
                scraped_at=scraped_at,
            )

            fname = f"{sub_name}_{_slug(post.title)[:50]}.txt"
            path = out_dir / fname
            path.write_text(content, encoding="utf-8")
            written.append(path)
            count += 1
            print(f"    [{count}] {post.title[:70]} ({post.score} upvotes)")

    return written


# ── httpx scraper (no credentials needed) ───────────────────────────────────

def scrape_with_httpx(subreddits: list[str], posts_per_sub: int,
                      out_dir: Path) -> list[Path]:
    try:
        import httpx
    except ImportError:
        sys.exit("httpx not installed. Run: pip install httpx")

    HEADERS = {
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    }

    written: list[Path] = []
    scraped_at = datetime.utcnow().strftime("%Y-%m-%d")

    for sub_name in subreddits:
        print(f"  Scraping r/{sub_name} via httpx (old.reddit.com)…")
        listing_url = f"https://old.reddit.com/r/{sub_name}/top/?t=year"
        try:
            resp = httpx.get(listing_url, headers=HEADERS,
                             follow_redirects=True, timeout=20)
        except Exception as e:
            print(f"    Warning: could not access r/{sub_name}: {e}")
            continue

        if resp.status_code != 200:
            print(f"    Warning: r/{sub_name} returned {resp.status_code}")
            continue

        # Extract post thread URLs
        thread_urls = re.findall(
            rf'href="(/r/{sub_name}/comments/[^"]+)"',
            resp.text,
        )
        thread_urls = list(dict.fromkeys(thread_urls))[: posts_per_sub * 2]

        # Extract post titles (parallel list with thread_urls)
        raw_titles = re.findall(
            r'data-event-action="title"[^>]*>([^<]{5,})</a>', resp.text
        )
        titles = [unescape(t) for t in raw_titles]

        count = 0
        for i, thread_url in enumerate(thread_urls):
            if count >= posts_per_sub:
                break
            title = titles[i] if i < len(titles) else "Unknown thread"
            full_url = f"https://old.reddit.com{thread_url}"

            try:
                tr = httpx.get(full_url, headers=HEADERS,
                                follow_redirects=True, timeout=20)
            except Exception as e:
                print(f"    Warning: could not fetch {thread_url}: {e}")
                continue
            if tr.status_code != 200:
                continue

            # Extract all usertext-body blocks (first = post, rest = comments)
            blocks = re.findall(
                r'class="usertext-body[^"]*"[^>]*>.*?<div class="md">(.*?)</div>',
                tr.text, re.DOTALL,
            )
            if not blocks:
                continue

            body_text = re.sub(r"<[^>]+>", "", blocks[0]).strip()
            body_text = unescape(body_text)

            comments: list[tuple[str, int]] = []
            for cb in blocks[1:MAX_COMMENTS_PER_POST + 1]:
                text = unescape(re.sub(r"<[^>]+>", "", cb).strip())
                if len(text) > 30:
                    comments.append((text, 0))  # score not available in HTML

            if not body_text and not comments:
                continue

            content = _format_post(
                subreddit=sub_name,
                title=title,
                body=body_text or "[link post]",
                score=0,
                url=f"https://reddit.com{thread_url}",
                comments=comments,
                scraped_at=scraped_at,
            )

            fname = f"{sub_name}_{_slug(title)[:50]}.txt"
            path = out_dir / fname
            path.write_text(content, encoding="utf-8")
            written.append(path)
            count += 1
            print(f"    [{count}] {title[:70]}")

    return written


# ── Demo mode (realistic synthetic data) ────────────────────────────────────

DEMO_POSTS = [
    {
        "subreddit": "f1visa",
        "title": "Finally got my H-1B approved after 3 lottery attempts — here's what changed",
        "score": 847,
        "url": "https://reddit.com/r/f1visa/comments/demo1",
        "body": """Long post but hope it helps someone. Background: F-1 → OPT → STEM OPT. Lost H-1B lottery in 2022, 2023, and finally selected + approved in 2024.

What I think made the difference in year 3:
1. My employer switched to a larger H-1B cap-exempt sponsor as a bridge while filing — gave me runway
2. We filed for a specialty occupation role with very specific SOC code documentation (I'm a data scientist but we filed under 15-2051 not the generic "computer programmer" bucket)
3. Used a different law firm with actual immigration specialization, not just any employment attorney

Key things I wish I knew earlier:
- The H-1B cap is 65k + 20k master's cap. If you have a US master's degree, register for the master's cap — it's a separate pool with better odds
- Cap-exempt employers (universities, nonprofits with research primary purpose) can sponsor anytime
- Some employers do internal transfers to cap-exempt affiliated entities — worth asking HR

The STEM OPT extension bought me the extra 2 years I needed. Without it I'd have had to leave after first OPT year.

Happy to answer questions.""",
        "comments": [
            ("This is so helpful. Quick question — when you say the SOC code matters, how do you even know which one to use? Does the employee or the attorney decide?", 234),
            ("Congrats! For the cap-exempt path — which nonprofit structures typically qualify? I've heard university hospital systems sometimes count but not always.", 187),
            ("I'm in STEM OPT year 1 right now and terrified. My employer is small (~50 people). Any advice on vetting whether they've done H-1B sponsorship before?", 156),
            ("The master's cap thing is something so many people don't know about. I've seen people from top programs register only for the regular cap. Free extra shot at it.", 143),
            ("One thing to add: premium processing ($2805 as of this year) gives you a 15 business day decision. Totally worth it if your OPT is expiring soon and you need certainty.", 98),
            ("Did you have any gaps in status? I'm worried about the 60-day grace period if I don't get selected.", 87),
            ("For the cap-exempt employer bridge strategy — does the H-1B transfer happen without counting against cap? I thought it only works if you're already in H-1B status.", 76),
        ],
    },
    {
        "subreddit": "f1visa",
        "title": "Day 1 CPT schools — what no one tells you until it's too late",
        "score": 612,
        "url": "https://reddit.com/r/f1visa/comments/demo2",
        "body": """I work adjacent to immigration compliance and see a lot of international students make this mistake. Posting because I keep seeing the same questions come up.

Day 1 CPT = schools that grant Curricular Practical Training authorization from the first day of enrollment, with no prior academic year required.

USCIS has never explicitly banned Day 1 CPT. However:
1. Many consular officers treat Day 1 CPT schools as red flags during visa interviews/renewals
2. SEVP (Student and Exchange Visitor Program) has audited and terminated these schools' programs
3. H-1B petitions filed with Day 1 CPT experience sometimes trigger RFEs questioning prior work authorization

The real risk: if USCIS decides your prior CPT was improper, it can create unlawful presence retroactively. This can trigger a 3-year or 10-year bar.

I've seen people get H-1B RFEs years later asking to explain their Day 1 CPT authorization. Some got approved, some didn't.

Bottom line: if your goal is long-term immigration to the US, the risk-reward of Day 1 CPT is bad. The short-term work authorization isn't worth potential permanent bar from the country.""",
        "comments": [
            ("This needs to be pinned. I have a friend who used Day 1 CPT and is now on H-1B but got an RFE about their work authorization history. It was stressful even though it got resolved.", 312),
            ("Is STEM OPT from a Day 1 CPT school also risky? Or is it just the CPT itself?", 198),
            ("What about schools that grant CPT on Day 1 but only for students who transfer in credits or prove prior enrollment elsewhere? Different risk profile?", 145),
            ("The 'USCIS hasn't banned it' argument is technically true but misses the point. ICE SEVP has been shutting these schools down and stranding students mid-semester.", 134),
            ("I enrolled in one of these. Graduated, on OPT now. Should I be worried when I apply for H-1B?", 89),
        ],
    },
    {
        "subreddit": "immigration",
        "title": "STEM OPT employer validation horror stories — and how I finally fixed mine",
        "score": 445,
        "url": "https://reddit.com/r/immigration/comments/demo3",
        "body": """STEM OPT requires your employer to be enrolled in E-Verify and to submit a Training Plan (Form I-983) that describes how the job relates to your degree. This is where a lot of people run into problems.

My experience:
- Applied for STEM OPT extension 90 days before OPT expiry (correct)
- Employer submitted I-983 but used wrong NAICS code and didn't describe the STEM connection clearly
- Got an RFE from USCIS asking for evidence the position qualified as STEM OPT eligible

What fixed it:
1. Our DSO (Designated School Official) helped draft a supplemental letter
2. We added a detailed description of how my computer science degree specifically applied to my ML engineering role
3. Employer's attorney submitted an updated I-983 with specific project descriptions

Key lessons:
- Your employer's HR might not know how to fill out I-983 correctly — especially if you're their first STEM OPT employee
- The DSO at your school is a free resource. Use them more.
- Apply early. 90 days gives you buffer for RFEs. The grace period after OPT expiry is thin.
- If your I-765 (EAD) receipt date is before your OPT expiry and you get a timely filed notice, you can continue working even if the EAD hasn't arrived. Know this before you panic.""",
        "comments": [
            ("The timely filed point is so important. A lot of people don't know they can keep working if the receipt is before expiry. Their employer freaks out and they think they have to stop.", 223),
            ("Is the I-983 requirement new? I did STEM OPT in 2019 and don't remember submitting it.", 167),
            ("My employer is a staffing agency / consulting firm. My actual client is different. Who fills out the I-983 — the agency or the client?", 134),
            ("What counts as STEM for this purpose? My degree is in Information Systems which is on the STEM designated degree program list but not obviously 'hard science'.", 98),
            ("Does the employer need to be E-Verify enrolled when I submit my I-765, or by the time USCIS approves it?", 87),
        ],
    },
    {
        "subreddit": "cscareerquestions",
        "title": "Asking about visa sponsorship in job interviews — the unwritten rules",
        "score": 1203,
        "url": "https://reddit.com/r/cscareerquestions/comments/demo4",
        "body": """As an international student who's been through this and now helps interview at my company, here's what I've learned:

WHEN TO DISCLOSE:
- Don't bring it up in a phone screen unless directly asked
- For onsite/final rounds: absolutely bring it up before accepting an offer
- If recruiter asks "are you authorized to work in the US?": F-1 OPT means YES. Be confident.
- "Will you now or in the future require sponsorship?": be honest. OPT doesn't require sponsorship but H-1B will.

THE TIMING DANCE:
- OPT: you can work without employer sponsoring anything (it's your authorization, not theirs)
- STEM OPT extension: employer needs to fill out some forms (I-983) and be E-Verify enrolled — this IS a minor ask
- H-1B: employer petitions on your behalf, pays attorney fees (~$3-8k) — this is the real ask

WHAT COMPANIES ACTUALLY THINK:
- Big tech (FAANG etc): sponsors routinely, not even a real question
- Mid-size funded startups: varies, ask explicitly
- Small startups: probably won't unless you're irreplaceable
- Consulting/staffing: often explicitly "no sponsorship" due to client restrictions

HOW TO ASK:
"Just so we're aligned — I'm currently on OPT and authorized to work. I'd need H-1B sponsorship in the future. Is that something [company] does?"

Direct, matter-of-fact. Don't apologize. Don't hedge. It's a logistics question, not a weakness.""",
        "comments": [
            ("'Don't apologize. Don't hedge.' This needs to be repeated louder. The anxiety around this question makes candidates come across worse than the actual visa situation warrants.", 534),
            ("The distinction between OPT and H-1B sponsorship is something I had to explain to 3 different recruiters this year. Many don't understand that OPT is already your authorization.", 387),
            ("What about asking mid-process? Like after a technical but before the final? I always feel like it's 'too late' if I ask then.", 234),
            ("For STEM OPT specifically — some companies say 'no sponsorship' meaning no H-1B but will do STEM OPT extension forms. Worth clarifying what they mean by 'no sponsorship'.", 198),
            ("I had a recruiter tell me 'we don't sponsor visas' and then when I explained I'm on OPT and don't need sponsorship yet they were suddenly fine. Miscommunication both ways.", 176),
            ("Is it legal for companies to ask if you need sponsorship now? I thought that was considered national origin discrimination?", 134),
            ("The 'will you require sponsorship in the future' question is legally allowed because it's about authorization, not national origin. But employers aren't supposed to discriminate based on citizenship status.", 112),
        ],
    },
    {
        "subreddit": "f1visa",
        "title": "Common misconceptions about the 60-day grace period — a correction post",
        "score": 389,
        "url": "https://reddit.com/r/f1visa/comments/demo5",
        "body": """Seeing a lot of wrong info about this lately so let me clarify.

THE 60-DAY GRACE PERIOD (8 CFR 214.2(f)(5)(iv)):
- Starts after your authorized stay ENDS (program end date, not OPT end date)
- You CANNOT work during this period — it's for transitioning out, not continuing employment
- You CAN stay in the US to: find new status, transfer schools, prepare to depart
- You CANNOT: work, start OPT from a different employer, extend your existing status during this period alone

COMMON MISCONCEPTIONS I SEE:
1. "I have 60 days to find a new job after H-1B rejection" — NO. You can't work. You can look, but any new job requires new authorization first.
2. "The 60 days starts when my OPT EAD expires" — It depends on your I-20 program end date vs OPT authorization end date
3. "I can use the 60 days to switch to a different F-1 school" — Yes, but you need to maintain valid status at the new school immediately

IF YOU LOSE OPT AUTHORIZATION:
- Termination of employment doesn't end your OPT by itself — you can be between jobs for up to 90 days of aggregate unemployment on post-completion OPT
- Voluntary resignation ends your authorized employment, not necessarily your OPT status
- If you're on STEM OPT and lose your job, the 150-day unemployment limit still applies

THE REAL BOTTOM LINE:
Get legal advice from a licensed immigration attorney for your specific situation. Not Reddit. Not me.""",
        "comments": [
            ("The 90-day unemployment rule is something I had to learn the hard way. I took 95 days between jobs thinking I had buffer and my OPT technically became invalid.", 234),
            ("Does the 90-day counter reset if you go back to work, then leave again? Or is it 90 days total for the entire OPT period?", 187),
            ("This should be required reading before applying for OPT. My university's international office glossed over the unemployment rule entirely.", 156),
            ("What counts as 'unemployment'? If I'm doing freelance work or consulting, does that count as employed?", 123),
            ("The STEM OPT 150-day rule is different from regular OPT 90-day rule — why?", 98),
        ],
    },
    {
        "subreddit": "USCIS",
        "title": "I-765 EAD processing times — what the USCIS website doesn't tell you",
        "score": 267,
        "url": "https://reddit.com/r/USCIS/comments/demo6",
        "body": """USCIS publishes processing times but they're an average, not a guarantee. Here's what actually matters:

FIELD OFFICE vs SERVICE CENTER:
- OPT I-765 goes to service centers (currently Texas or Nebraska depending on school address)
- Processing time varies wildly by center — check the USCIS website for current estimates per center
- You can request transfer to a different center but it rarely helps and resets your place in line

THE 90-DAY APPLICATION WINDOW:
- You can apply up to 90 days BEFORE your program end date
- You can apply up to 60 days AFTER your program end date (but EAD won't start until after program ends)
- Early submission = earlier in the queue

WHAT ACTUALLY SPEEDS THINGS UP:
1. Submit complete, accurate forms — errors cause RFEs which add weeks
2. Premium processing is NOT available for I-765 (OPT applications)
3. If your EAD hasn't arrived 30+ days before you need to start work: contact the USCIS contact center + have your DSO submit an inquiry

PROCESSING TIME REALITY CHECK (as of mid-2024):
- Published estimates were ~3-4 months
- Actual receipt-to-approval was running 3-5 months for many applicants
- Some people got approvals in 6-8 weeks, others waited 6 months
- It's not first-in-first-out — they process in batches

YOUR DSO IS YOUR BEST ALLY — they can submit congressional inquiries for severely delayed cases, which often gets movement within weeks.""",
        "comments": [
            ("The DSO congressional inquiry thing is real. My EAD was 5 months old with no movement, DSO submitted an inquiry to our senator's office, and I got approval 3 weeks later.", 178),
            ("Does submitting a case inquiry through the USCIS website do anything? I've submitted two and gotten boilerplate responses.", 134),
            ("If my I-765 is pending and my OPT hasn't started yet, can I still graduate and leave the university? Or do I need to stay enrolled?", 112),
            ("The service center thing is important. I'm at a university in Texas but my mailing address was in California and I was confused about which center handled my case.", 89),
        ],
    },
    {
        "subreddit": "f1visa",
        "title": "H-1B cap-exempt employer strategy — real talk from someone who used it",
        "score": 334,
        "url": "https://reddit.com/r/f1visa/comments/demo7",
        "body": """TLDR: When you don't get selected in H-1B lottery 2 years in a row, you start getting creative. Here's what I learned about cap-exempt employers.

CAP-EXEMPT EMPLOYER TYPES:
1. Universities and affiliated research organizations
2. Nonprofit research organizations (primary purpose must be research)
3. Government research organizations

NOT automatically cap-exempt:
- For-profit university affiliates (like a startup spun out of a university)
- Hospitals that primarily provide medical care (even if university-affiliated)
- Foundations that are grantmaking but not conducting research themselves

THE STRATEGY PEOPLE USE:
Some companies have partnerships with cap-exempt entities. You work part-time (~20%) for the cap-exempt employer (usually a university doing research relevant to your work), full-time for your regular employer. The H-1B is filed by the cap-exempt entity, so it bypasses the lottery.

RISKS:
- Your immigration attorney needs to structure this correctly — it's complex
- The arrangement needs to be real (you actually work for both)
- If USCIS audits and finds the cap-exempt employment was not genuine: serious consequences
- Some employers don't like sharing an employee even nominally

REALISTIC ADVICE:
If you've lost the lottery twice and your STEM OPT is running out, talk to an immigration attorney about cap-exempt options. It's legitimate when done correctly, but it's not a DIY situation.""",
        "comments": [
            ("University hospital systems are interesting — some departments qualify, others don't. The 'primary purpose' test is applied at the department level sometimes.", 187),
            ("What salary threshold applies for cap-exempt petitions? Same prevailing wage requirements?", 145),
            ("I did exactly this for 2 years through a university collaboration. Eventually got H-1B through regular cap after the third try. Was absolutely worth the complexity.", 134),
            ("National labs (DOE, DOD affiliated) — cap exempt?", 112),
        ],
    },
    {
        "subreddit": "immigration",
        "title": "Canada vs US immigration for international students — my honest comparison after doing both",
        "score": 578,
        "url": "https://reddit.com/r/immigration/comments/demo8",
        "body": """Did US for 5 years (F-1 → OPT → STEM OPT), now in Canada on PGWP and in Express Entry pool. Here's my honest take:

US PROS:
- Higher salaries (especially tech, finance)
- More diverse economy = more job options
- If you get H-1B and eventually GC, you're set
- Network effects in certain industries are stronger

US CONS:
- H-1B lottery: annual anxiety, statistically ~25-30% chance per year, can fail multiple times
- Green card wait: India and China nationals can wait 50+ YEARS. Not a typo.
- STEM OPT limit is 3 years total, then you must have H-1B or leave
- Status anxiety is constant — any job change requires paperwork

CANADA PROS:
- PGWP = open work permit for up to 3 years (length = your program length)
- Express Entry can get you PR in 6-12 months if you have points
- No employer-specific work permit for most pathways = job flexibility
- No lottery for PR — it's a points system you can strategize around

CANADA CONS:
- Lower salaries (30-50% lower than comparable US roles in tech)
- Smaller job market, especially for niche fields
- Canadian work experience valued more than international experience for PR
- Healthcare and housing costs in Vancouver/Toronto are brutal

THE REAL CALCULATION:
If you're from India/China with a US master's in tech: the green card backlog may literally mean you retire before you get PR. Canada Express Entry might get you PR in under a year. The salary gap might be worth the certainty.

If you're from anywhere with a short GC queue (most of the world outside India/China): the US often makes more sense.

There's no universal answer. Model your specific situation.""",
        "comments": [
            ("The India GC backlog point cannot be overstated. Someone who entered the EB-2 queue for India in 2012 is still waiting. This is a real life decision that's being made.", 345),
            ("For Canadian pathways, the PGWP length matching program length is key strategy info. A 2-year master's = 3-year PGWP (capped at 3). A 1-year graduate diploma = 1-year PGWP.", 267),
            ("I switched to Canada after 3 H-1B losses. Took a $40k salary cut but got PR in 8 months. Sleep better at night.", 234),
            ("The job flexibility with open work permit (PGWP) in Canada is something people undervalue. You can quit a bad job without 60 days of panic.", 198),
            ("Provincial nominee programs (PNP) are another route that people miss. Alberta and Saskatchewan have tech pathways with lower CRS score thresholds.", 167),
            ("One thing not mentioned: US taxes for green card holders living abroad. The US taxes worldwide income. Canada does not. This affects long-term planning.", 134),
        ],
    },
    {
        "subreddit": "f1visa",
        "title": "Navigating the emotional reality of H-1B uncertainty — from someone who's been there",
        "score": 423,
        "url": "https://reddit.com/r/f1visa/comments/demo9",
        "body": """Non-technical post but I think it's needed here.

Year 1 after H-1B lottery loss: disbelief, made backup plan (applied to Canadian universities for master's, kept working STEM OPT)
Year 2 after H-1B loss: genuine depression, started questioning if the US was worth it
Year 3: selected AND approved. Relief I can't describe.

What I wish someone had told me earlier:

YOUR IMMIGRATION STATUS IS NOT YOUR SELF-WORTH. It's a visa category decided by lottery. Statistically, a lot of qualified, hardworking people don't get selected.

THE WAITING KILLS MORE THAN THE OUTCOME. The period between registration and lottery results (March to ~May) caused me more anxiety than any result. Having contingency plans I genuinely was okay with made this better.

HAVING A PLAN B THAT DOESN'T FEEL LIKE SETTLING helped enormously. I didn't just list Canada as backup — I actually explored it, visited, talked to people there. Knowing I had a real option reduced the desperation feeling.

THERAPY HELPED. I'm saying this plainly. The chronic uncertainty of immigrant life — will this job change affect my status, will this employer do what they promised, will the government change the rules — is a legitimate form of chronic stress. Treating it as such is not weakness.

COMMUNITY MATTERS. The people on this subreddit who shared their timelines, gave honest answers, and said 'I've been there' mattered to me more than I expected.

Wherever you are in this process: you're not alone, your situation is not permanent, and there are real paths forward.""",
        "comments": [
            ("Thank you for writing this. The emotional aspect of immigration is almost completely absent from the 'official' guidance and it's real and it matters.", 287),
            ("I'm in year 2 of STEM OPT, 2 H-1B losses. The paragraph about waiting killing more than the outcome describes my March-May exactly.", 234),
            ("The 'status anxiety on job changes' is something non-immigrants don't understand at all. Leaving a job is not simple when your authorization is employer-specific.", 198),
            ("Having a plan B that doesn't feel like settling — this reframe saved me. Once I actually researched Canada and made peace with it, the H-1B result felt less catastrophic either way.", 167),
            ("Immigration lawyer here. The chronic stress my clients are under is real and often underacknowledged. Thank you for naming it.", 145),
        ],
    },
    # ── Canada-focused posts ───────────────────────────────────────────────
    {
        "subreddit": "ImmigrationCanada",
        "title": "PGWP approved in 6 weeks — full timeline and what actually worked",
        "score": 723,
        "url": "https://reddit.com/r/ImmigrationCanada/comments/demo_ca1",
        "body": """Just got my PGWP (Post-Graduation Work Permit) in the mail. Here's the full breakdown for anyone anxious about timing.

BACKGROUND:
- 2-year Master's program → eligible for 3-year PGWP (max)
- Applied online through IRCC portal
- Submitted: Day after graduation ceremony (convocation letter as proof)

TIMELINE:
- Day 0: Applied online, paid $255 CAD
- Day 3: Received AOR (Acknowledgement of Receipt)
- Day 14: Biometrics request sent (already had valid biometrics from study permit)
- Day 42: PGWP approved, eTA issued same day
- Day 46: Physical permit arrived by mail

DOCUMENTS I SUBMITTED:
1. Completed IMM 5710 form
2. Passport copy (all pages)
3. Current study permit
4. Official transcript showing graduation
5. Convocation/completion letter from registrar
6. Proof of legal status (study permit valid until 90 days after program end)

KEY THINGS I WISH I'D KNOWN:
- Apply within 180 days of receiving your final marks/transcript — don't wait for the physical degree parchment
- Your study permit has implicit status for 90 days after program completion even if it shows an earlier expiry date — you can stay and work (up to 20hrs/week off-campus) while PGWP is pending
- Joint programs (co-op etc) usually still qualify — your letter of completion should mention the full integrated program

COMMON MISTAKE I ALMOST MADE:
I almost applied too early — before I had official completion confirmed. The convocation letter from the registrar is key. Don't use a program completion email from a professor; IRCC wants the official registrar document.""",
        "comments": [
            ("Congrats! One thing to add: if your study permit expires before you get the PGWP decision, you're on 'maintained status' (implied status). You can stay but cannot work during that gap until PGWP arrives.", 287),
            ("Does the PGWP really cap at 3 years even for a 4-year bachelor's? I thought it matched program length exactly.", 234),
            ("The 180-day window is critical. IRCC has denied PGWP applications from people who waited too long thinking they had more time.", 198),
            ("What about co-op programs? My program was 20 months with a 4-month co-op. Does the PGWP length count the full 24 months or just the academic 20?", 167),
            ("The biometrics point is helpful. Mine are still valid from study permit and I was worried I'd have to redo them.", 134),
            ("Did you need to be physically in Canada when you applied? I'm doing my last semester remotely from abroad.", 112),
        ],
    },
    {
        "subreddit": "ImmigrationCanada",
        "title": "Express Entry CRS score strategy — what actually moved my needle from 460 to 491",
        "score": 891,
        "url": "https://reddit.com/r/ImmigrationCanada/comments/demo_ca2",
        "body": """Background: Indian national, Master's from Canadian university, working as software engineer in Ontario on PGWP. Spent 14 months optimizing my CRS score. Here's what worked.

STARTING SITUATION (CRS ~460):
- Age: 29 (good, not great)
- Education: Canadian Master's = 23 points
- Language: IELTS 7.5/7.5/8.0/7.5 = CLB 10 (first language)
- Work experience: 1 year Canadian = good
- No job offer, no provincial nomination at the time

WHAT I TRIED (roughly in order of impact):

1. **Second language (French) — +50 points**
   Took TEF Canada, scored B1 level. Not fluent, but enough for the Bilingual Advantage points.
   This was the single biggest lever. 14 weeks of Duolingo + tutors.

2. **Spouse's language score — +20 points**
   My spouse took IELTS. Her CLB 7 added substantial points.

3. **Job offer — +50 or +200 points**
   Got a job offer from a different company (stayed in same field). At NOC level (TEER 0/1), this added 50 points. Major.

4. **Canadian work experience (year 2) — incremental**
   Second year of Canadian experience gives more points than first.

WHAT DIDN'T MOVE THE NEEDLE MUCH:
- Improving IELTS from CLB 10 to CLB 11: only ~6 points marginal gain
- Foreign work experience: much lower weight than Canadian experience

RESULT:
CRS went from ~460 to 491. Received ITA in a tech-specific draw at 489. PR application in progress.

TAKEAWAY: If you're stuck below 470 and from a high-ITA-score country (India, China), the French bilingual route and a Canadian job offer are your two biggest real levers. Language score improvements past CLB 10 have diminishing returns.""",
        "comments": [
            ("The French bilingual route is genuinely underutilized. TEF Canada is more lenient than DELF and B1 is achievable in 3-6 months of consistent study for English speakers.", 445),
            ("Job offer worth 50 vs 200 points — can you clarify? I thought NOC 0/A/B gets 200?", 312),
            ("The spouse language score is a sleeper. My wife's IELTS CLB 7 added 20 points that I hadn't accounted for at all.", 267),
            ("What CRS range has been clearing lately for federal Express Entry draws (all programs)?", 234),
            ("PNP stream in Ontario — do you know what NOC categories they're currently targeting? Their tech stream seems to have specific requirements.", 198),
            ("For the French TEF, what level did you hit exactly? B1 overall or B1 in speaking specifically?", 167),
            ("Important to note: provincial draws (PNPs) often have lower CRS requirements than federal draws but require provincial ties or job offers. Worth looking at if federal score isn't cutting it.", 145),
        ],
    },
    {
        "subreddit": "canadaimmigration",
        "title": "The PGWP program change trap — read before switching your program",
        "score": 456,
        "url": "https://reddit.com/r/canadaimmigration/comments/demo_ca3",
        "body": """Sharing this because I almost made this mistake and my DSA saved me.

THE SITUATION:
I was in a 2-year Master's program and in the second semester realized the research focus wasn't a good fit. A professor suggested switching to a related 1-year Graduate Certificate program at the same institution.

WHY THIS MATTERS FOR PGWP:
PGWP length is based on the LENGTH OF YOUR COMPLETED PROGRAM.
- 2-year Master's → 3-year PGWP (capped at 3)
- 1-year Graduate Certificate → 1-year PGWP

If I'd switched, I would have lost 2 years of work permit. That's potentially 2 additional Express Entry years of Canadian work experience — a massive PR impact.

THE LESS OBVIOUS RULE:
If you complete MULTIPLE programs, IRCC sometimes allows you to combine the lengths, but ONLY if:
1. The programs are consecutive (no gap)
2. Both are at designated learning institutions (DLIs)
3. The combined length is still accurate

Example: 2-year Bachelor's + 2-year Master's = 3-year PGWP (capped at 3)
NOT: 1-year cert (gap) + 2-year Master's = might not combine

WHAT I DID INSTEAD:
Talked to the graduate advisor and my DSO. Found a way to change my research focus within the same Master's program without switching programs. More paperwork, same outcome I wanted, kept my 3-year PGWP.

KEY TAKEAWAY: Before changing programs, talk to your international student advisor about the PGWP implications. The short-term academic benefit might not be worth the long-term immigration cost.""",
        "comments": [
            ("This is so important and barely mentioned anywhere. I've seen people voluntarily downgrade their PGWP eligibility without realizing it.", 312),
            ("What about switching universities? I'm at a smaller school and want to transfer to U of T for my second year. Does the PGWP reset to only counting the new school's program?", 256),
            ("The combining rule for consecutive programs — is there a maximum gap allowed between programs? Like if I graduate in April and start the next program in September?", 198),
            ("Can you stack a post-grad diploma on top of a bachelor's to get a longer PGWP than the bachelor's alone would give?", 167),
            ("My program changed its name and structure mid-degree due to faculty restructuring. Does this affect PGWP length?", 134),
        ],
    },
    {
        "subreddit": "ImmigrationCanada",
        "title": "Honest comparison: Canadian PR process vs US green card — from someone who chose Canada",
        "score": 634,
        "url": "https://reddit.com/r/ImmigrationCanada/comments/demo_ca4",
        "body": """Indian national, CS background, had both options. Chose Canada. Writing this 3 years later.

WHY I CHOSE CANADA:
1. EB-2 India priority date: currently around 2012-2013. I'd be waiting 40+ years for a US green card. Not a typo.
2. Express Entry CRS-based system: meritocratic, no lottery, no country quota for PR
3. PGWP gave me open work authorization immediately — could change jobs freely
4. Canadian PR timeline: ~6-12 months from ITA to landing

WHAT CANADA ACTUALLY LOOKS LIKE 3 YEARS IN:
- Got PR 14 months after arriving on PGWP
- Now eligible for citizenship in ~2 more years (3 of 5 years in Canada)
- Salary: genuinely 25-35% lower than comparable Bay Area role, but Toronto comp has improved
- Life quality: healthcare stress removal is real (no COBRA anxiety, no benefits tied to employer)
- Job flexibility: open work permit → PR means zero visa anxiety when changing jobs

THINGS THAT SURPRISED ME:
- Canadian work culture is real. Work-life balance is better than US tech in my experience.
- The immigration process for Canada is HEAVILY points-based but also HEAVILY dependent on timing of draws. A 480 CRS score might clear one draw and not another.
- PNPs (Provincial Nominee Programs) are a genuine backdoor if your federal score isn't clearing — Alberta and Saskatchewan have been aggressive.
- "Canadian experience" bias in the job market is real — some employers specifically want people who've worked in Canada, which creates a chicken-and-egg problem for new PGWP holders.

REGRETS:
- None on the immigration path
- Some on specific city choice (Toronto housing prices are brutal)
- The US still has better career trajectory ceiling for senior IC roles, but that gap is closing

IF I'D STAYED IN THE US:
Would have needed 3+ more years of H-1B renewals, annual lottery anxiety, then 40+ years of GC waiting. The salary delta doesn't compensate for that uncertainty for me.""",
        "comments": [
            ("The EB-2 India timeline point needs to be shouted from rooftops. People genuinely don't understand that the GC backlog for India nationals is multigenerational.", 478),
            ("What NOC code did you use for Express Entry? I'm trying to figure out if my data analyst role qualifies as TEER 1.", 312),
            ("The Canadian experience bias — how did you navigate it as a new PGWP holder? Did you take any lower-paying role to get Canadian work experience first?", 267),
            ("Healthcare tied to employer is genuinely underrated as a stress factor. I didn't realize how much mental bandwidth it took until I had universal coverage.", 234),
            ("Saskatchewan and Alberta PNPs — do you need a job offer for those or can you get nominated based on your Express Entry profile?", 198),
            ("Is it possible to maintain Canadian PR while working in the US short-term? I want PR but might need to spend 1-2 years in the US for career reasons.", 167),
        ],
    },
    {
        "subreddit": "cscareerquestionsCAD",
        "title": "Getting your first Canadian tech job on PGWP — what worked and what didn't",
        "score": 387,
        "url": "https://reddit.com/r/cscareerquestionsCAD/comments/demo_ca5",
        "body": """Just landed my first Canadian tech job after 3 months of searching on PGWP. Sharing what I learned.

WHAT DIDN'T WORK:
1. Applying cold to large companies (Amazon, Google, Shopify) — never heard back
2. LinkedIn Easy Apply for roles with 500+ applicants
3. Mentioning in my cover letter that I'd need future sponsorship (I don't — PGWP is open work permit — but I accidentally implied it)
4. Remote-only job search excluding Canadian offices

WHAT WORKED:
1. Local meetups and events (Python meetup, local tech events) — met my eventual hiring manager at one
2. Being specific about work authorization: "I hold an open work permit (PGWP) valid until [date]. No current or future sponsorship required for PR purposes."
3. Targeting mid-size companies (50-200 people) in Toronto/Waterloo tech corridor
4. Referrals — when I started asking people I met to refer me, response rate jumped from ~2% to ~30%

THE WORK AUTHORIZATION CONFUSION:
Many Canadian employers don't understand PGWP. They see "work permit" and think "requires sponsorship." The correct framing:

"I hold an open work permit. I can work for any Canadian employer without any employer-specific authorization. You do not need to sponsor me or file any applications. I am pursuing PR independently."

HONEST TIMELINE:
- Week 1-4: Applied to 80+ jobs, 2 phone screens
- Week 5-8: Started networking actively, 8 phone screens
- Week 9-12: 4 onsites, 2 offers

The networking shift was the real inflection point.""",
        "comments": [
            ("The work authorization framing is so important. I literally put 'Open Work Permit — no sponsorship needed' in bold at the top of my resume and interview intro after getting confused looks from recruiters.", 267),
            ("Which meetups were most useful? Toronto specifically.", 198),
            ("Mid-size companies being more receptive than big tech is counterintuitive but matches my experience. The big Canadian companies (Shopify, etc) get flooded with apps.", 167),
            ("The 30% referral response rate vs 2% cold application rate is real. This is true everywhere but especially in Canada where your network = Canadian network matters.", 145),
            ("Did you ever consider doing a contract/agency role first to get Canadian work experience on the resume? That's the backdoor some people use.", 123),
        ],
    },
    {
        "subreddit": "ImmigrationCanada",
        "title": "PGWP anxiety is real — what helped me cope with the uncertainty",
        "score": 312,
        "url": "https://reddit.com/r/ImmigrationCanada/comments/demo_ca6",
        "body": """Not a procedural question post. Just sharing what helped me emotionally through the immigration process.

I was on PGWP for 14 months before getting my PR ITA. During that time I had:
- Anxiety every time a colleague mentioned a new job opening (could I even take it? yes, open permit, but I still felt frozen)
- Panic when CRS score drops were announced in draws (will I ever be selected?)
- Imposter syndrome about whether I "deserved" to be here
- Exhaustion from having immigration as a constant background process

WHAT HELPED:

1. Understanding the system fully reduced anxiety significantly. Reading NDP (national draw profiles), understanding what CRS factors I could control, made me feel like I had agency.

2. Stopping the daily IRCC portal refresh. I set a schedule: check once a week. Constant checking amplifies anxiety without adding information.

3. Finding others in the same situation. My university's international student WhatsApp group became a support network. Shared timelines, successes, and honest feelings about the process.

4. Separating career decisions from immigration optimization. I was turning down interesting projects because I was scared to leave my stable PR-sponsoring employer. Realized this was making me miserable AND wasn't actually required — as a PGWP holder I could change jobs freely.

5. Having a genuine plan B. When I actually researched what returning to India would look like (realistic opportunity, salary, life), it stopped feeling like pure loss. Having a real alternative reduced the desperation.

The immigration process is genuinely hard and uncertain. Feeling anxious about it is not weakness. But the anxiety is often worse than the actual risk.

Sending solidarity to everyone in the waiting period.""",
        "comments": [
            ("The 'stopping daily portal refresh' advice is something I needed to hear. I check multiple times a day and it's making the wait feel endless.", 234),
            ("The career paralysis from status anxiety is something I haven't seen named before but it's exactly what I've been experiencing. I've said no to two interesting opportunities because I was scared to rock the boat.", 198),
            ("The plan B point. My plan B was going back to India and I'd made it into a catastrophic narrative. Actually listing out what that would concretely look like made it less scary.", 176),
            ("The imposter syndrome part — yes. Feeling like you have to be on your best behavior constantly, never make mistakes, never complain, because you 'don't belong here yet.'", 156),
            ("I cried reading this. Thank you for posting something human in a subreddit usually full of processing time questions.", 145),
        ],
    },
    # ── Original US post (kept last) ──────────────────────────────────────────
    {
        "subreddit": "cscareerquestions",
        "title": "My employer said they'd sponsor H-1B then rescinded — what are my options",
        "score": 334,
        "url": "https://reddit.com/r/cscareerquestions/comments/demo10",
        "body": """Throwaway for obvious reasons.

Got hired 18 months ago with explicit verbal promise of H-1B sponsorship in my offer conversation. Now my manager says company policy changed and they won't sponsor. I'm 9 months into STEM OPT with 15 months left before I need another status.

What I've learned from talking to an immigration attorney and doing research:

1. VERBAL PROMISES AREN'T LEGALLY BINDING FOR H-1B. The company never signed anything committing to sponsor. My only claim would be promissory estoppel which is hard to prove and even harder to litigate.

2. MY OPTIONS:
   a. Find a new employer who will sponsor (most realistic)
   b. Find a cap-exempt employer bridge
   c. Switch to a different status (L-1 if you can, O-1 if you qualify, marriage-based if applicable)
   d. Go back to school on F-1 to buy time

3. TIMELINE MATTERS: I need to find a new employer willing to file by April of next year's cap season. That means finding a job, getting an offer, confirming H-1B sponsorship commitment IN WRITING, and having everything ready by early registration (usually early March).

4. GET IT IN WRITING NEXT TIME: Any new offer, I'm asking for explicit written commitment on H-1B sponsorship as a condition of acceptance.

The lesson I'm paying in anxiety: don't assume immigration commitments are safe just because a company seems reputable.""",
        "comments": [
            ("The 'get it in writing' advice is crucial. Include specific language like 'Company will file H-1B petition on employee's behalf for the next available cap season.' Get it in the offer letter.", 287),
            ("What would be in the written commitment? Just 'we will sponsor' or specific about timeline and cost coverage?", 198),
            ("I was in a similar situation and found a new sponsor within 8 months. The key was being upfront in interviews: 'I'm on STEM OPT and need H-1B sponsorship by [date].' Honest screening saves everyone time.", 176),
            ("L-1 is only an option if you've worked for a multinational employer abroad for 1+ years. O-1 is hard to qualify for unless you're genuinely extraordinary. Don't count on these.", 156),
            ("F-1 bridge (go back to school) is real but consider: you need to actually pursue the degree, it buys you OPT again (usually), and you lose career momentum.", 134),
            ("Have you documented any written communications about the sponsorship? Even Slack messages could support a promissory estoppel claim in some jurisdictions.", 112),
        ],
    },
    # ═══════════════════════════════════════════════════════════
    # grad-school-selection
    # ═══════════════════════════════════════════════════════════
    {
        "subreddit": "gradadmissions",
        "title": "Ranking vs advisor: I chose the wrong one and want to warn you",
        "score": 1843,
        "url": "https://reddit.com/r/gradadmissions/comments/gs_demo1",
        "body": """I'm finishing year 4 of a PhD at a top-5 program in my field and I'm miserable. Not because of the work — because of my advisor. I chose the program over a rank-15 offer because the name was better. I didn't have a specific advisor in mind when I accepted.

Year 1: rotations. My first-choice advisor took 1 other student instead of me (her lab was full). Second choice was fine but his grant got cut. I ended up with my third rotation advisor who I'd never really considered seriously.

Year 2-4: classic Ghost advisor situation. We meet maybe 4 times a year. He doesn't read my drafts for months. I have no publication. My funding is TA (not RA) which means 15 hrs/week teaching on top of research. Several lab members have left without finishing.

The rank-15 program I turned down: I just checked and my would-have-been advisor there placed 5 of her last 6 graduates in faculty/industry research positions. She publishes 3-4 papers/year with student co-authorship. She has a 5-year guaranteed fellowship.

I chose a name. I should have chosen a person.

What I wish someone had told me:
1. The advisor IS the program. Department rank is background noise.
2. "Very independent" in student reviews = Ghost advisor. It's never a compliment.
3. 3+ advisors per program isn't overkill — it's insurance. Bandwidth changes between app and admission.
4. Call former students who LEFT the lab. They tell you what current ones won't.
5. Ask: "Where are your last 5 graduates?" If they can't answer easily, that's the answer.""",
        "comments": [
            ("This is one of the most important posts I've seen here. The advisor IS the program. Every ranking-obsessed person on this sub needs to read this.", 723),
            ("The 'very independent' euphemism is so real. I've started mentally replacing it with 'abandoned' in my head when I read student reviews.", 567),
            ("Counterpoint worth adding: even within the same lab, students have different experiences. Calling FORMER students — not just current ones — is the only way to get the unfiltered version.", 412),
            ("I made the same mistake. Rank-8 over rank-22. My advisor turned out to be pre-tenure and got denied tenure in year 3 of my PhD. Had to scramble for a new advisor. Lost a year.", 389),
            ("What's your plan now? Can you switch advisors within the department or are you considering leaving?", 234),
            ("For anyone reading this: when you're interviewing at a program, ask 'can you name the last 3 people who left the lab before finishing?' If they get defensive, that's information.", 198),
        ],
    },
    {
        "subreddit": "PhD",
        "title": "My advisor's grant ran out in year 3. Here's what no one tells you about RA funding",
        "score": 1127,
        "url": "https://reddit.com/r/PhD/comments/gs_demo2",
        "body": """RA (Research Assistant) funding sounds like the gold standard — you get paid to do your own research. But there's a version of RA funding that's much riskier than it sounds: when your stipend comes entirely from your advisor's active grants, not from department funds.

My situation: accepted a fully funded PhD with RA funding. Didn't ask WHERE the RA funding came from. Year 3, my advisor's NSF grant ended and the renewal got rejected. Suddenly my advisor told me she could only fund me for 2 more semesters while she resubmitted.

Things I didn't know to ask before accepting:
- Is funding guaranteed by the DEPARTMENT for X years regardless of my advisor's grant status?
- What happens to students if the advisor loses funding?
- Does the department have a bridge funding policy?

Questions that WOULD have surfaced this:
- "Is my stipend guaranteed for 4-5 years, or is it contingent on your current grants?"
- "What happened to the students whose funding came from your previous NSF grant when it ended?"

The difference between safe and unsafe RA funding:
SAFE: Department guarantees 5 years, advisor's grant covers cost — you're protected.
UNSAFE: All funding flows through advisor's active grant with no department backstop.

I ended up okay — my advisor got a bridge grant and I finished — but I spent 8 months in real financial and academic anxiety that I didn't need to be in. Ask the question before you sign.""",
        "comments": [
            ("The question 'is my funding guaranteed by the DEPARTMENT or contingent on your grants' is one every admitted student should ask before accepting. Brilliant framing.", 489),
            ("Adding to this: TA funding is actually more stable than grant-dependent RA funding in many departments. TA = department budget, not advisor's external grants. Different risk profile.", 356),
            ("I asked my advisor this exact question during my visit and she seemed offended. But I'm glad I asked — her answer revealed the funding was grant-contingent. I chose a different offer.", 287),
            ("Pre-tenure advisors face an even bigger version of this risk. If they don't get tenure and leave the university, you need a new advisor OR you follow them (if they go somewhere else). Most people don't think about this until it happens.", 234),
            ("The offer letter language matters a lot here. 'Funding is available for X years subject to satisfactory progress and availability of funds' is very different from 'The department guarantees X years of funding.' Read it carefully.", 198),
        ],
    },
    {
        "subreddit": "GradSchool",
        "title": "I spent $180K on an unfunded MS from a top school. Honest reflection 3 years later.",
        "score": 934,
        "url": "https://reddit.com/r/GradSchool/comments/gs_demo3",
        "body": """Three years post-graduation, I want to give an honest accounting of my unfunded MS decision because I see so many people about to make the same one.

Background: I was admitted to a top-10 CS MS program (unfunded, $65K/year) and a rank-30 CS PhD program (funded, $32K/year stipend). I chose the MS because of the "brand name" and because I didn't feel ready for a PhD.

Total cost of MS: ~$180K (tuition + living in an expensive city). No federal loans for international students, so I used family savings.

What I got: degree from a well-known school, some industry connections from on-campus recruiting, and a software engineering job I probably could have gotten with my undergrad degree.

What I thought I'd get but didn't:
- The "name" doesn't matter as much as people think after your first job
- Recruiting happened through OCI (on-campus interviews) — same companies recruit at state schools
- The MS networking lasted about 6 months before the alumni connection faded
- My colleagues from the rank-30 PhD program are now 3 years ahead of me in seniority (they started working while I was in school)

What actually matters in CS hiring: your portfolio, your interview skills, and early experience. The $180K bought me 18 months of credential signaling that decayed quickly.

Would I do it again? No. I would do the funded PhD (if I wanted research) or just recruit straight from undergrad (if I wanted industry). The unfunded MS occupies an awkward middle ground that costs the most and delivers the least durable value.

Not saying it's wrong for everyone. Just saying: model the ROI before you commit. Don't buy prestige on credit.""",
        "comments": [
            ("This is the post I wish existed when I was making this decision. The ROI math on unfunded MS is brutal when you actually do it, especially for international students with no federal loan access.", 567),
            ("The point about PhD peers being 3 years ahead in seniority is underrated. If you go industry anyway, the funded PhD costs you nothing and gives you more options.", 423),
            ("Counterpoint: some industries (finance, consulting) do care significantly about the MS brand even past the first job. But even then — have you actually verified this with people who work in those industries, or is it received wisdom?", 312),
            ("The other thing no one mentions: unfunded MS students don't get the TA/RA experience that builds actual research and teaching skills. You're paying to take classes. The PhD students are building a professional track record.", 278),
            ("As someone who did the funded PhD at a rank-35 school: my advisor placed me at a FAANG company. No one at FAANG cares that my program wasn't top-10. They cared about my publications and what I could do.", 234),
        ],
    },
    {
        "subreddit": "cscareerquestions",
        "title": "Industry PhD vs academic PhD in CS/ML — the real differences nobody explains",
        "score": 2341,
        "url": "https://reddit.com/r/cscareerquestions/comments/gs_demo4",
        "body": """I have a CS PhD and have worked at both a university lab and an industry research lab. Here's what I actually see as the differences that matter for choosing between academic and industry-track programs:

ACADEMIC PhD (aiming for professor/academic researcher):
- What you optimize for: top venue publications (NeurIPS, ICML, CVPR, etc.), citation count, original contribution
- Advisor matters more: they write your reference letters for faculty jobs
- Program prestige matters more: top-5 programs dominate academic hiring in CS
- Timeline: 5-6 years, sometimes longer
- Salary after: $120-180K starting faculty (with massive variance); postdoc = $55-75K for 1-3 years first
- Key risk: academic job market in CS is competitive even from top programs; have a backup plan

INDUSTRY PhD (aiming for research scientist / applied scientist at tech company):
- What you optimize for: publications still matter, but also internship track record, applied relevance
- Advisor matters differently: their industry connections and internship pipeline matter more than academic prestige
- Program prestige matters less: FAANG and top AI labs recruit from a wider range of PhD programs than academic jobs do
- Timeline: 4-5 years, more structured
- Salary after: $200-350K TC at major tech companies
- Key factor: has your advisor placed students at Google, Meta, Apple, OpenAI, etc.? Check LinkedIn.

THE THING MOST APPLICANTS MISS:
If you're aiming for industry research, the advisor's industry network and internship access matters more than their h-index. An advisor who sends 3 interns/year to Google Brain places students differently than an equally-cited advisor who has no industry connections.

Ask during visits: "Where did your students intern? Which ones ended up at industry labs?" That's the signal.

For pure software engineering (not research): a funded PhD usually isn't worth the 4-5 year opportunity cost vs. direct industry entry. The PhD premium is real for research roles; it barely exists for SWE roles.""",
        "comments": [
            ("The advisor industry network point is so undervalued. I've seen students at rank-20 programs get OpenAI offers because their advisor had direct collaborations there. Meanwhile rank-5 students with no industry-connected advisors are in postdoc limbo.", 987),
            ("Adding a nuance: 'industry research' is itself a spectrum. Applied Scientist at Amazon and Research Scientist at DeepMind are very different roles with very different PhD requirements.", 678),
            ("The SWE point needs emphasis. If you're going to end up as a software engineer, a 4-year funded PhD gives you $32K/year when you could be making $150K+. The math rarely works out in PhD's favor for pure SWE paths.", 534),
            ("One more thing: industry PhD programs (like at Google, Meta, Microsoft) exist now too. Different from a university PhD — less publication pressure, more applied, co-supervised with industry researcher. Worth looking into if you want industry research.", 423),
            ("The internship pipeline is the metric I use when evaluating programs now. If an advisor can't name where their last 5 students interned, that tells you something about their industry engagement.", 312),
        ],
    },
    {
        "subreddit": "AskAcademia",
        "title": "Pre-tenure advisor risk: what I learned when my advisor didn't get tenure",
        "score": 678,
        "url": "https://reddit.com/r/AskAcademia/comments/gs_demo5",
        "body": """My advisor was denied tenure in year 3 of my PhD. I want to share what happened and what I wish I'd known, because pre-tenure advisor risk is almost never discussed in PhD application advice.

Context: she was excellent — highly productive, 3+ papers/year, good mentor, secured two grants. She was denied tenure partly for political reasons I won't go into. It happens more than people think.

What happened to her students:
- 2 students moved with her to her new university (she got a position elsewhere)
- 1 student switched to another advisor in the same department and lost about 8 months
- I was in year 3 and chose to stay at my home institution with a new advisor — lost about a year of progress

What I wish I'd known:
1. Ask about tenure trajectory before accepting. "Is your advisor pre-tenure?" should be a standard question. First 1-3 years on faculty = higher risk.
2. Moving with an advisor is possible but complicated (different state, visa status, program requirements differ by institution)
3. Switching advisors within department loses time — new advisor needs to get up to speed, relationships need to be rebuilt
4. Even if she was "excellent," pre-tenure = real institutional risk

Pre-tenure advisors aren't always bad. They can be high-touch, passionate, and growing faster than tenured faculty. But you should price in the risk explicitly.

Questions to ask: "When is your tenure review? What's the typical trajectory in this department? Have you had students finish under your supervision yet?"

The last question is the most important. A pre-tenure advisor who has already graduated students has proven they can do it. First cohort = more risk.""",
        "comments": [
            ("This happened to someone in my program too. The rule I now tell everyone: pre-tenure advisor is fine, but ask 'have you graduated students before?' If this is their first cohort, you're taking on institutional risk alongside all the normal PhD risk.", 312),
            ("Worth adding: some universities have formal policies about what happens to students if an advisor leaves or is denied tenure. Ask the DGS (Director of Graduate Studies) what the department's policy is. Some places have real protections; some don't.", 267),
            ("The flip side: I had a pre-tenure advisor who was extremely invested in my success because his tenure case partly depended on student outcomes. I got more mentorship than my friends with tenured advisors. High variance, not always bad.", 198),
            ("For international students: switching advisors mid-PhD can have visa implications if it delays your defense date past your anticipated graduation, which affects OPT timing. Something most people don't think about until it's a problem.", 167),
            ("My question when evaluating pre-tenure advisors now: 'What's your plan if tenure doesn't go through?' Not a rude question — a serious one. A good advisor will have a thoughtful answer.", 134),
        ],
    },
    # ── job-search-strategy ───────────────────────────────────────────────
    {
        "subreddit": "cscareerquestions",
        "title": "Cold email got me my job — actual template that worked (international student on OPT)",
        "score": 1243,
        "url": "https://reddit.com/r/cscareerquestions/comments/jss_demo1",
        "body": """I'm an international student who graduated in May, spent 2 months applying through job boards with no results, then switched to cold outreach and got 3 interviews and 1 offer in 6 weeks. Here's what actually worked.

THE EMAIL THAT GOT RESPONSES (template):

Subject: Quick question about [Company]'s [specific team/product]

Hi [Name],

I've been following [Company]'s work on [specific thing] — your recent [blog post/talk/paper] on [topic] was one of the clearest things I've read on [subject].

I'm a recent grad from [University] with a background in [area]. I built [one-line project] and I'm specifically interested in the kind of [specific problems] your team works on.

Would you have 20 minutes for a call sometime in the next few weeks?

[Name]

WHAT DIDN'T WORK BEFORE:
- Applying through job portals (maybe 1% callback rate)
- Emailing HRs directly (HRs filter for sponsorship, often no response)
- Long emails (anything over 150 words gets skimmed to death)
- Asking for a job in the first email (instant close)

WHAT ACTUALLY WORKED:
- Finding the actual hiring manager on LinkedIn (not recruiter, not HR)
- Referencing something specific they wrote or did
- Keeping it under 100 words
- Asking ONLY for a call, not for a job
- Following up exactly twice more (day 4 and day 9)

For international students specifically: I never mentioned visa/OPT in the first email. I mentioned it only when the call started turning into a real opportunity. By then they were interested in me as a person first.

Response rate went from ~1% (job boards) to ~18% (this approach).""",
        "comments": [
            ("The 'don't mention visa in the first email' advice is counterintuitive but correct. By the time you've had a conversation, the person is invested in you. Opening with 'I need sponsorship' immediately triggers rejection before they even read your skills.", 456),
            ("The 'ask for a call not a job' framing is the most important thing in this post. You're asking for a low-commitment 20 minutes. Every ask is for the next small step only.", 389),
            ("What did you say when they asked about sponsorship on the call? That's where I always get stuck.", 267),
            ("Follow-up timing is key. Day 4 and day 9 after first email — if nothing after three touches, move to a different person at the same company.", 198),
            ("The manager vs. HR targeting tip is huge. Managers hire because they have a problem to solve. HR screens because they have quotas. Very different conversations.", 176),
        ],
    },
    {
        "subreddit": "recruitinghell",
        "title": "Body shop offered to 'sponsor my H-1B' — everything about it was a scam",
        "score": 2341,
        "url": "https://reddit.com/r/recruitinghell/comments/jss_demo2",
        "body": """Story time. This is a warning for international students.

Month 3 of job searching post-graduation. STEM OPT but struggling to find companies willing to go through H-1B. A consulting firm reached out on LinkedIn with "we specialize in placing international talent and can sponsor your H-1B."

RED FLAGS I IGNORED:
1. They offered sponsorship within 24 hours of our first call — before knowing anything about me
2. They couldn't describe what I'd actually be doing (just "consulting projects")
3. They mentioned I might be "on bench" between placements — and pay during bench was "negotiated"
4. When I asked which clients I'd work with, they said it was "confidential"
5. They asked me to "update my resume" to include specific technologies I hadn't used

That last one is the one that finally made me say no. They wanted me to lie on my resume.

WHAT I FOUND OUT LATER:
- This pattern is called a "body shop" and it's extremely common targeting F-1 students
- They file an H-1B for you with a fake or stretched job description
- You might be paid nothing while "on bench" waiting for a client
- The H-1B petition itself may be technically fraudulent
- If USCIS discovers it, YOU get the immigration consequences, not them

THE ACTUAL RULES:
- Employers MUST pay all H-1B fees. If they ask you to pay, it's illegal.
- H-1B employers must pay you the "offered wage" even during non-productive periods (bench time). Zero pay on bench = H-1B violation.
- You can report wage theft to the Dept of Labor. Workers are protected from retaliation for doing so.

Ended up finding a legitimate offer 3 weeks later through a LinkedIn connection. The extra time was worth it.""",
        "comments": [
            ("The resume 'updating' ask is the clearest red flag of all. Any company asking you to add skills you don't have is asking you to commit fraud alongside them.", 678),
            ("'Bench pay' is a real thing and legitimate staffing firms do pay during bench periods. The difference is: legitimate firms disclose it upfront and their bench pay is in the contract, not 'negotiated' later.", 534),
            ("Employer must pay H-1B fees — this is so important. The specific law is INA §212(n). Anyone charging workers for H-1B fees is breaking federal law.", 423),
            ("H-1Bdata.info — check any company that claims to sponsor. If they've never filed an H-1B petition or have very high denial rates, that's data.", 312),
            ("I was in a body shop for 8 months before I found a real job. The wasted time and the status anxiety (was my H-1B actually compliant?) wasn't worth whatever I thought I was getting.", 267),
        ],
    },
    {
        "subreddit": "jobs",
        "title": "Salary negotiation works even when you need visa sponsorship — I just did it",
        "score": 876,
        "url": "https://reddit.com/r/jobs/comments/jss_demo3",
        "body": """I negotiated $18k above initial offer while needing H-1B sponsorship. Writing this because the prevailing advice in international student communities is 'don't negotiate, they might withdraw the offer.'

That advice is wrong and it's costing international students a lot of money.

MY SITUATION:
- Recent MSCS grad
- Got an offer at $145k base
- Market rate for the role/location was $160-170k
- I needed H-1B sponsorship

WHAT I DID:
Called the recruiter back the next day. Said:

"I'm really excited about this role and I want to make this work. I've done some research on market rates for this position in [city] and I was hoping we could discuss a base closer to $165k. Is there flexibility?"

Silence. Then: "Let me check with the hiring manager."

Next day: $163k. Counter-asked for $167k. Got $163k plus a $10k signing bonus.

TOTAL EXTRA COMPENSATION: ~$28k in year 1.

THE THING EVERYONE GETS WRONG:
The sponsorship decision is already made by the time they give you an offer. They've decided you're worth the cost and hassle of sponsorship. You didn't use up your leverage by needing a visa. The salary negotiation is a completely separate conversation.

Companies almost never rescind offers over professional salary negotiations. I researched this. It basically doesn't happen at legitimate employers. The cost to them of rescinding (reputation, lost time, restarting the search) far exceeds the cost of paying you more.

If a company would rescind an offer over a professional negotiation request, you don't want to work there anyway.""",
        "comments": [
            ("The framing of 'sponsorship decision is already made' is the key insight. People confuse two separate decisions: (1) will we hire and sponsor this person, and (2) what will we pay them. These are decided by different people at different times.", 412),
            ("What did you say when they pushed back and said the offer was firm?", 234),
            ("For people worried about offending: asking 'is there flexibility?' is not aggressive. It's a question. The worst answer is 'no, this is our best offer' — and you haven't lost anything.", 198),
            ("Signing bonus is often easier to negotiate than base because it's a one-time cost and doesn't affect salary benchmarks. If base is capped, always ask about signing bonus.", 167),
            ("I work in recruiting. We build negotiation room into offers because we expect candidates to negotiate. If you don't negotiate, that money just stays on the table.", 145),
        ],
    },
    {
        "subreddit": "cscareerquestionsCAD",
        "title": "PGWP job search reality check — what nobody tells you before you graduate",
        "score": 1089,
        "url": "https://reddit.com/r/cscareerquestionsCAD/comments/jss_demo4",
        "body": """2 years in Canada post-graduation. Went through PGWP job search, Express Entry pool, and now have PR. Here's what I wish I'd known.

PGWP BASICS THAT PEOPLE GET WRONG:
1. PGWP is an OPEN work permit — you can work for ANY employer. You don't need to say "I need sponsorship" because there's nothing to sponsor. Your PGWP is yours.
2. Duration: Your PGWP is the length of your program, capped at 3 years. A 2-year master's = 3-year PGWP. A 1-year post-grad cert = 1-year PGWP. This matters hugely.
3. You can tell employers: "I have a 3-year open work permit — no employer action required." That's it.

WHAT I SAID ON APPLICATIONS:
In the "work authorization" field: "Open Work Permit (PGWP) — authorized to work for any employer in Canada. No sponsorship required."

Response rate: significantly higher than when I said "international student."

JOB SEARCH STRATEGY IN CANADA VS US:
The Canadian job search is much more similar to a domestic job search because PGWP removes the sponsorship filter. But there are still differences:
- Canadian employers still have some bias toward "Canadian experience" (vague and annoying but real)
- Co-op experience in Canada is heavily valued — if you had a co-op, mention it everywhere
- The market in tech is smaller, especially outside Toronto/Vancouver
- LinkedIn and direct referrals >> job boards (same as US, but even more pronounced in Canada's smaller market)

PR TIMING STRATEGY:
After 1 year of work in Canada, you're eligible for Canadian Experience Class (CEC). CRS score determines who gets invited. Strong English scores + French = major boost. Start IELTS prep early if you haven't already.

The goal is: get job with PGWP → accumulate 1 year Canadian experience → maximize CRS score (language scores, maybe a PNP if your province has a stream) → get ITA → PR.

My PR took 9 months from when I submitted the Express Entry profile to when I got the confirmation.""",
        "comments": [
            ("The 'no sponsorship required' framing for PGWP is gold. So many international grads in Canada undersell this because they're used to the US framing where visa is a burden. PGWP is genuinely not a burden to employers.", 378),
            ("French language skills (TEF/TCF scores) can add 25-50+ points to your CRS score. If you have any French background or are willing to invest 6 months in learning, it's one of the highest-ROI things you can do for your Express Entry score.", 298),
            ("One thing not mentioned: Provincial Nominee Programs (PNPs). BC Tech Pilot, Ontario Masters Graduate stream, etc. Some provinces can nominate you directly, bypassing the federal CRS competition. Worth researching based on your province.", 234),
            ("For the 1-year Canadian experience CEC eligibility — the experience must be in NOC TEER 0, 1, 2, or 3 (skilled work). Make sure you're tracking this is in your NOC code properly.", 189),
        ],
    },
    {
        "subreddit": "f1visa",
        "title": "Internship return offer is your best path to H-1B sponsorship — the math explains why",
        "score": 934,
        "url": "https://reddit.com/r/f1visa/comments/jss_demo5",
        "body": """Every year international students ask "should I do an internship or go straight for full-time?" Here's the honest math.

CONVERSION RATES (rough estimates from available data):
- Internship → return offer at large tech companies: ~70-85%
- Cold application to offer for new grad with no prior relationship: ~1-5%

EXPECTED VALUE CALCULATION:
If you get an internship at Google, you have a ~75% chance of getting a full-time offer.
If you apply cold to Google as a new grad, you have maybe a 2-3% chance.

The internship path is roughly 25-40x higher probability of landing the role.

WHY THIS MATTERS EVEN MORE FOR INTERNATIONAL STUDENTS:
1. Companies have already decided you're worth sponsoring BEFORE the return offer decision. You've worked there, they know you.
2. The H-1B lottery isn't filed until you're already employed as a full-timer. The company is far more invested in helping you through the lottery after they've trained you.
3. Return offer → H-1B timing aligns well: start on OPT after graduation, do your first H-1B lottery the following March, keep working through OPT if you lose (STEM gives you 3 years total).

TARGETING INTERNSHIPS CORRECTLY:
1. Check H-1B sponsorship history FIRST. H1Bdata.info or MyVisaJobs — look up companies you're targeting. Any company with <5 H-1B filings/year is high risk. You don't want to intern at a company that won't sponsor.
2. The internship subreddit recruiting season at big tech is Fall (Sept-Nov) for following Summer. Not spring. If you're applying in February you've already missed most of it.
3. Express intent to return. During the internship, find natural moments to say you're enjoying it and would want to come back. Managers who know you want a return offer advocate for it. Managers who aren't sure don't.

THE CPT WARNING:
One 12-month internship on full-time CPT = OPT gone. The limit is 12 cumulative months of full-time CPT — hit it and you lose OPT permanently for that degree level. Do multiple shorter internships, not one long one.""",
        "comments": [
            ("The CPT limit is the thing that catches people. '12 months' sounds like it's exactly 12, but it's anything meeting or exceeding 12. Someone who did 11 months, took a break, then did 2 more months is at 13 total and has lost OPT. Cumulative across all CPT use.", 423),
            ("'Express intent to return' is underrated advice. I thought showing too much eagerness was unprofessional. A career counselor told me I was wrong. Managers literally advocate more for interns they know want to come back.", 312),
            ("The fall recruiting timeline for tech internships blindsides a lot of international students who come from countries where hiring cycles work differently. August or September of junior year. Not February.", 267),
            ("For non-tech industries (finance, consulting): this is even more true and the timelines are even earlier. Banking summer analyst recruiting can start in August of junior year for the following summer. Check the Wall Street Oasis wiki for updated timelines.", 198),
        ],
    },
]


def scrape_demo(subreddits: list[str], posts_per_sub: int, out_dir: Path) -> list[Path]:
    scraped_at = datetime.utcnow().strftime("%Y-%m-%d")
    # Filter demo posts by requested subreddits (or return all if none specified)
    posts = [p for p in DEMO_POSTS if not subreddits or p["subreddit"] in subreddits]
    posts = posts[:posts_per_sub * max(len(subreddits), 1)]

    written: list[Path] = []
    for post in posts:
        content = _format_post(
            subreddit=post["subreddit"],
            title=post["title"],
            body=post["body"],
            score=post["score"],
            url=post["url"],
            comments=post["comments"],
            scraped_at=scraped_at,
        )
        fname = f"{post['subreddit']}_{_slug(post['title'])[:50]}.txt"
        path = out_dir / fname
        path.write_text(content, encoding="utf-8")
        written.append(path)
        print(f"  [demo] r/{post['subreddit']}: {post['title'][:70]}")

    return written


# ── Main ─────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Scrape Reddit community data")
    parser.add_argument("--skill", default="immigration-planning", help="Skill slug")
    parser.add_argument("--subreddits", nargs="+", help="Subreddits to scrape")
    parser.add_argument("--posts", type=int, default=10, help="Posts per subreddit")
    parser.add_argument("--demo", action="store_true",
                        help="Use synthetic demo data (no Reddit API needed)")
    parser.add_argument("--client-id", default=os.getenv("REDDIT_CLIENT_ID"),
                        help="Reddit API client ID (or REDDIT_CLIENT_ID env var)")
    parser.add_argument("--client-secret", default=os.getenv("REDDIT_CLIENT_SECRET"),
                        help="Reddit API client secret (or REDDIT_CLIENT_SECRET env var)")
    parser.add_argument("--user-agent", default=os.getenv("REDDIT_USER_AGENT", "skill-builder/1.0"),
                        help="Reddit API user agent")
    args = parser.parse_args()

    skill_dir = get_skill_dir(args.skill)
    if not skill_dir.exists():
        sys.exit(f"Error: skill directory not found: {skill_dir}")

    out_dir = skill_dir / "raw" / "community" / "reddit"
    out_dir.mkdir(parents=True, exist_ok=True)

    subreddits = args.subreddits or SKILL_SUBREDDITS.get(args.skill, ["f1visa", "immigration"])

    if args.demo:
        print(f"[demo mode] Generating synthetic Reddit posts for {args.skill}")
        written = scrape_demo(subreddits, args.posts, out_dir)
    elif args.client_id and args.client_secret:
        print(f"[PRAW] Scraping {subreddits} for {args.skill}")
        written = scrape_with_praw(
            subreddits, args.posts, args.client_id, args.client_secret,
            args.user_agent, out_dir,
        )
    else:
        print(f"[httpx] No PRAW credentials — scraping old.reddit.com directly")
        written = scrape_with_httpx(subreddits, args.posts, out_dir)

    print(f"\nWrote {len(written)} file(s) to {out_dir.relative_to(skill_dir.parent.parent)}/")
    for p in written:
        print(f"  {p.name}")
    print(f"\nNext step: python scripts/clean_community.py {skill_dir.relative_to(skill_dir.parent.parent)}/raw/community/reddit/ --platform reddit")


if __name__ == "__main__":
    main()
