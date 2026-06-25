#!/usr/bin/env python3
"""Community data cleaner — Layer 2 format preprocessing.

Cleans raw scraped community content and outputs structured .txt files
ready to be placed in raw/community/<platform>/.

Supported platforms:
  reddit       — English forum; ">" quote removal; English noise patterns
  1p3a         — 一亩三分地; BB code quote removal; Chinese noise patterns
  xiaohongshu  — 小红书; hashtag + @mention stripping; emoji-light filtering
  zhihu        — 知乎; mixed Chinese content; answer-focused structure
  generic      — Universal cleaning only; no platform-specific handling

This is a pure text-processing step (no LLM calls). Operations per platform:

  All platforms:
    - HTML tag and entity stripping
    - Paragraph-level deduplication
    - Encoding normalization to UTF-8
    - Noise-line removal (platform-aware patterns)
    - Short comment filtering

  reddit:
    - ">" quoted reply block removal
    - English noise patterns (me too, same, following, +1...)

  1p3a:
    - BB code quote block removal ([quote=...]...[/quote])
    - Chinese noise patterns (沙发, 板凳, mark, 同问, 顶贴...)
    - Lower default min-comment-length (30 chars — Chinese is compact)

  xiaohongshu:
    - Hashtag stripping (#话题标签#)
    - @mention stripping (@用户名)
    - Aggressive emoji filtering (lower threshold: 0.35)
    - XHS-specific noise patterns (求链接, 种草了, 绝绝子, yyds...)
    - Lower default min-comment-length (20 chars)

  zhihu:
    - Chinese noise patterns (赞同, 感谢邀请, 占坑...)
    - Lower default min-comment-length (30 chars)

Output format (structured header + body):
  ---
  platform: reddit
  subreddit: f1visa
  post_date: 2025-03-15
  post_upvotes: 234
  post_title: "..."
  ---

  post_text: |
    [cleaned text]

  COMMENT [rank=1, length=412]:
  [cleaned text]

Usage:
    python scripts/clean_community.py raw_dump.txt --platform reddit -o out.txt
    python scripts/clean_community.py raw_dir/ --platform 1p3a --output-dir clean/
    python scripts/clean_community.py dump.txt \\
        --platform 1p3a \\
        --title "H1B抽签失败了怎么办" \\
        --post-date 2025-04-10 \\
        --section 美国工作签证 \\
        --verbose --output clean/1p3a_h1b_fail.txt
"""

import argparse
import hashlib
import re
import sys
from pathlib import Path


# ---------------------------------------------------------------------------
# HTML stripping
# ---------------------------------------------------------------------------

_TAG_RE = re.compile(r"<[^>]+>")
_ENTITY_MAP = {
    "&amp;": "&", "&lt;": "<", "&gt;": ">",
    "&quot;": '"', "&#39;": "'", "&nbsp;": " ",
    "&apos;": "'",
}
_ENTITY_RE = re.compile(r"&[a-zA-Z0-9#]+;")


def _replace_entity(m: re.Match) -> str:
    return _ENTITY_MAP.get(m.group(0), " ")


def strip_html(text: str) -> str:
    text = _TAG_RE.sub(" ", text)
    text = _ENTITY_RE.sub(_replace_entity, text)
    return text


# ---------------------------------------------------------------------------
# Platform-specific: quoted-reply removal
# ---------------------------------------------------------------------------

# Reddit ">" style quotes
_REDDIT_QUOTE_LINE_RE = re.compile(r"^\s*>")

# 1p3a BB code: [quote=username;123456]...[/quote]  (may span multiple lines)
_1P3A_QUOTE_BLOCK_RE = re.compile(
    r"\[quote[^\]]*\].*?\[/quote\]",
    re.DOTALL | re.IGNORECASE,
)

# Zhihu inline reference markers like "原文：..." or "来自知乎@..."
_ZHIHU_REF_RE = re.compile(r"^(原文|来自知乎|编辑于|发布于)[：:].+$", re.MULTILINE)


def remove_reddit_quotes(text: str) -> str:
    return "\n".join(
        line for line in text.splitlines()
        if not _REDDIT_QUOTE_LINE_RE.match(line)
    )


def remove_1p3a_quotes(text: str) -> str:
    return _1P3A_QUOTE_BLOCK_RE.sub("", text)


def remove_zhihu_refs(text: str) -> str:
    return _ZHIHU_REF_RE.sub("", text)


# ---------------------------------------------------------------------------
# Platform-specific: xiaohongshu pre-processing
# ---------------------------------------------------------------------------

# XHS hashtags: #话题名# (with full-width or half-width #)
_XHS_HASHTAG_RE = re.compile(r"[#＃][^\s#＃]{1,30}[#＃]?")

# @mentions: @用户名 (ends at space or punctuation)
_XHS_MENTION_RE = re.compile(r"@[\w一-鿿\-_.]{1,30}")


def strip_xhs_markup(text: str) -> str:
    text = _XHS_HASHTAG_RE.sub("", text)
    text = _XHS_MENTION_RE.sub("", text)
    return text


# ---------------------------------------------------------------------------
# Emoji-dominant line detection
# ---------------------------------------------------------------------------

def _char_is_emoji(c: str) -> bool:
    cp = ord(c)
    return (
        0x1F600 <= cp <= 0x1F64F  # emoticons
        or 0x1F300 <= cp <= 0x1F5FF  # misc symbols & pictographs
        or 0x1F680 <= cp <= 0x1F6FF  # transport & map
        or 0x2600 <= cp <= 0x26FF    # misc symbols
        or 0x2700 <= cp <= 0x27BF    # dingbats
        or 0xFE00 <= cp <= 0xFE0F    # variation selectors
        or 0x1F900 <= cp <= 0x1F9FF  # supplemental symbols
        or 0x1FA00 <= cp <= 0x1FAFF  # extended symbols
    )


def filter_emoji_dominant(text: str, threshold: float = 0.5) -> str:
    """Remove lines where emoji chars exceed `threshold` fraction of total chars."""
    lines = []
    for line in text.splitlines():
        if not line.strip():
            lines.append(line)
            continue
        emoji_count = sum(1 for c in line if _char_is_emoji(c))
        if len(line) > 0 and emoji_count / len(line) >= threshold:
            continue
        lines.append(line)
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Platform-specific noise patterns
# ---------------------------------------------------------------------------

# Common across all platforms
_NOISE_COMMON = [
    re.compile(r"^(mark|占坑|顶|同上|同問|同问|following|f+|same here|me too|same\s*\.?|watching)[\s!！。.]*$", re.IGNORECASE),
    re.compile(r"^\+1[\s.!]*$"),
]

# English/Reddit
_NOISE_REDDIT = _NOISE_COMMON + [
    re.compile(r"^(thanks?!?|thx|ty|nice|great post|good luck|gl)[！!.。\s]*$", re.IGNORECASE),
    re.compile(r"^(this|exactly|^ this|^ this\.|yep|yup|agreed)[.!\s]*$", re.IGNORECASE),
    re.compile(r"^lol+[.!\s]*$", re.IGNORECASE),
]

# 一亩三分地
_NOISE_1P3A = _NOISE_COMMON + [
    re.compile(r"^(沙发|板凳|二楼|三楼|楼主好|楼主加油|感谢楼主|谢谢楼主|谢谢分享|感谢分享|支持一下)[！!.。\s]*$"),
    re.compile(r"^(顶贴|回复楼主|坐等|等待|有同样问题|同样问题|同问|求置顶|求精|加精|精华)[！!.。\s]*$"),
    re.compile(r"^(赞|点赞|好帖|好文|好问题|mark一下|学习了|学习)[！!.。\s]*$"),
    re.compile(r"^(祝楼主顺利|楼主加油|祝好运)[！!.。\s]*$"),
]

# 小红书
_NOISE_XHS = _NOISE_COMMON + [
    re.compile(r"^(求链接|求同款|在哪买|哪里买|怎么买|在哪里|链接呢|求地址)[？?！!.。\s]*$"),
    re.compile(r"^(种草了|已种草|拔草|已拔草|已下单|下单了|买了|在买)[！!.。\s]*$"),
    re.compile(r"^(绝绝子|yyds|YYDS|绝了|太绝了|太好了|好棒|棒棒)[！!.。\s]*$"),
    re.compile(r"^(收藏了|已收藏|转发了|学习了|笔记收藏)[！!.。\s]*$"),
    re.compile(r"^(哇|哇哦|哇塞|嗯嗯|嗯|哦|哦哦|好的|okay|ok)[！!.。\s]*$", re.IGNORECASE),
]

# 知乎
_NOISE_ZHIHU = _NOISE_COMMON + [
    re.compile(r"^(赞同|感谢邀请|感谢|谢谢|匿名用户|好问题|同问|很好的问题)[！!.。\s]*$"),
    re.compile(r"^(占坑|先占楼|持续更新|待补充|未完待续)[！!.。\s]*$"),
]

_PLATFORM_NOISE: dict[str, list] = {
    "reddit": _NOISE_REDDIT,
    "1p3a": _NOISE_1P3A,
    "xiaohongshu": _NOISE_XHS,
    "zhihu": _NOISE_ZHIHU,
    "generic": _NOISE_COMMON,
}

# Default min comment length per platform (Chinese text is compact)
_PLATFORM_MIN_LENGTH: dict[str, int] = {
    "reddit": 100,
    "1p3a": 30,
    "xiaohongshu": 20,
    "zhihu": 30,
    "generic": 80,
}

# Emoji threshold per platform (XHS is heavily emoji-decorated but substantive)
_PLATFORM_EMOJI_THRESHOLD: dict[str, float] = {
    "reddit": 0.5,
    "1p3a": 0.5,
    "xiaohongshu": 0.35,  # lower: XHS embeds emojis inline; drop lines that are mostly emoji
    "zhihu": 0.5,
    "generic": 0.5,
}


def remove_noise_lines(text: str, platform: str) -> str:
    patterns = _PLATFORM_NOISE.get(platform, _NOISE_COMMON)
    lines = []
    for line in text.splitlines():
        stripped = line.strip()
        if any(p.match(stripped) for p in patterns):
            continue
        lines.append(line)
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Paragraph-level deduplication
# ---------------------------------------------------------------------------

def dedup_paragraphs(text: str) -> str:
    paragraphs = re.split(r"\n{2,}", text)
    seen: set[str] = set()
    unique = []
    for para in paragraphs:
        normalized = re.sub(r"\s+", " ", para.strip()).lower()
        if not normalized:
            continue
        key = hashlib.md5(normalized.encode()).hexdigest()
        if key not in seen:
            seen.add(key)
            unique.append(para.strip())
    return "\n\n".join(unique)


# ---------------------------------------------------------------------------
# Main cleaning pipeline (platform-aware)
# ---------------------------------------------------------------------------

def clean_text(raw: str, platform: str = "generic") -> str:
    text = strip_html(raw)

    # Platform-specific pre-processing
    if platform == "reddit":
        text = remove_reddit_quotes(text)
    elif platform == "1p3a":
        text = remove_1p3a_quotes(text)
    elif platform == "xiaohongshu":
        text = strip_xhs_markup(text)
    elif platform == "zhihu":
        text = remove_zhihu_refs(text)

    emoji_threshold = _PLATFORM_EMOJI_THRESHOLD.get(platform, 0.5)
    text = filter_emoji_dominant(text, threshold=emoji_threshold)
    text = remove_noise_lines(text, platform)

    # Collapse whitespace within lines, preserve paragraph breaks
    lines = [re.sub(r"[ \t]+", " ", line).rstrip() for line in text.splitlines()]
    text = "\n".join(lines)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = dedup_paragraphs(text)
    return text.strip()


# ---------------------------------------------------------------------------
# Structured output builder
# ---------------------------------------------------------------------------

# Platform-specific labels for metadata fields
_PLATFORM_LABELS: dict[str, dict] = {
    "reddit":       {"section_key": "subreddit",  "upvotes_key": "post_upvotes"},
    "1p3a":         {"section_key": "section",    "upvotes_key": "post_likes"},
    "xiaohongshu":  {"section_key": "tag",        "upvotes_key": "post_likes"},
    "zhihu":        {"section_key": "topic",      "upvotes_key": "question_followers"},
    "generic":      {"section_key": "section",    "upvotes_key": "post_upvotes"},
}


def build_structured_output(
    cleaned_body: str,
    platform: str,
    title: str | None = None,
    post_date: str | None = None,
    post_upvotes: int | None = None,
    subreddit: str | None = None,
    subsection: str | None = None,
    min_comment_length: int | None = None,
) -> str:
    if min_comment_length is None:
        min_comment_length = _PLATFORM_MIN_LENGTH.get(platform, 80)

    labels = _PLATFORM_LABELS.get(platform, _PLATFORM_LABELS["generic"])
    header_lines = ["---", f"platform: {platform}"]

    if subreddit:
        header_lines.append(f"{labels['section_key']}: {subreddit}")
    if subsection:
        header_lines.append(f"{labels['section_key']}: {subsection}")
    if post_date:
        header_lines.append(f"post_date: {post_date}")
    if post_upvotes is not None:
        header_lines.append(f"{labels['upvotes_key']}: {post_upvotes}")
    if title:
        header_lines.append(f'post_title: "{title}"')
    header_lines.append("---")
    header = "\n".join(header_lines)

    paragraphs = [p.strip() for p in re.split(r"\n{2,}", cleaned_body) if p.strip()]
    if not paragraphs:
        return f"{header}\n\n(empty after cleaning)"

    post_text = paragraphs[0]
    comment_paras = [p for p in paragraphs[1:] if len(p) >= min_comment_length]

    sections = [header, "", "post_text: |"]
    for line in post_text.splitlines():
        sections.append(f"  {line}")
    sections.append("")

    for i, para in enumerate(comment_paras):
        sections.append(f"COMMENT [rank={i+1}, length={len(para)}]:")
        sections.append(para)
        sections.append("")

    return "\n".join(sections).rstrip()


# ---------------------------------------------------------------------------
# Quality report
# ---------------------------------------------------------------------------

def quality_report(original: str, cleaned: str) -> dict:
    original_words = len(original.split())
    cleaned_words = len(cleaned.split())
    return {
        "original_chars": len(original),
        "cleaned_chars": len(cleaned),
        "original_lines": len(original.splitlines()),
        "cleaned_lines": len(cleaned.splitlines()),
        "original_words": original_words,
        "cleaned_words": cleaned_words,
        "retention_rate": round(cleaned_words / original_words, 2) if original_words else 0,
    }


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def _extract_regions_from_raw(raw: str) -> str | None:
    """Parse 'regions: [...]' from the first 20 lines of a raw scraper file."""
    for i, line in enumerate(raw.splitlines()):
        if i >= 20:
            break
        line = line.strip()
        if line.startswith("regions:"):
            return line[len("regions:"):].strip()
    return None


def process_file(
    input_path: Path,
    output_path: Path,
    platform: str,
    title: str | None,
    post_date: str | None,
    post_upvotes: int | None,
    subreddit: str | None,
    subsection: str | None,
    min_comment_length: int | None,
    verbose: bool,
) -> None:
    raw = input_path.read_text(encoding="utf-8", errors="replace")

    # Preserve regions tag from scraper header so extract.py can route correctly
    regions_line = _extract_regions_from_raw(raw)

    cleaned_body = clean_text(raw, platform=platform)
    output = build_structured_output(
        cleaned_body,
        platform=platform,
        title=title or input_path.stem.replace("_", " "),
        post_date=post_date,
        post_upvotes=post_upvotes,
        subreddit=subreddit,
        subsection=subsection,
        min_comment_length=min_comment_length,
    )

    # Inject regions into the output header (after "platform: ..." line)
    if regions_line:
        output = output.replace(
            f"platform: {platform}\n",
            f"platform: {platform}\nregions: {regions_line}\n",
            1,
        )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(output, encoding="utf-8")

    if verbose:
        report = quality_report(raw, cleaned_body)
        print(f"  {input_path.name}")
        print(f"    chars:  {report['original_chars']:,} → {report['cleaned_chars']:,}")
        print(f"    words:  {report['original_words']:,} → {report['cleaned_words']:,}  (retention {report['retention_rate']:.0%})")
        print(f"    saved → {output_path}")
    else:
        print(f"  {input_path.name} → {output_path.name}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Clean community forum data for skill-builder ingestion",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Platforms:
  reddit       r/f1visa, r/immigration, r/cscareerquestions, etc.
  1p3a         一亩三分地 — 签证/移民/工作 boards
  xiaohongshu  小红书 — 移民/留学/工作 notes
  zhihu        知乎 — 移民/签证 Q&A
  generic      Any other source
        """,
    )
    parser.add_argument("input", help="Input file or directory of .txt files")
    parser.add_argument(
        "--platform", "-p", default="generic",
        choices=["reddit", "1p3a", "xiaohongshu", "zhihu", "generic"],
        help="Source platform (default: generic)",
    )
    parser.add_argument("--output", "-o", help="Output file path (single-file mode)")
    parser.add_argument("--output-dir", help="Output directory (directory mode)")
    parser.add_argument("--title", help="Post title")
    parser.add_argument("--post-date", help="Post date ISO format e.g. 2025-03-15")
    parser.add_argument("--post-upvotes", type=int, help="Post upvote / like count")
    parser.add_argument("--subreddit", help="Subreddit name (reddit only)")
    parser.add_argument("--section", help="Board / section name (1p3a / zhihu / xiaohongshu)")
    parser.add_argument(
        "--min-comment-length", type=int, default=None,
        help="Minimum chars per comment block (default varies by platform: "
             "reddit=100, 1p3a=30, xiaohongshu=20, zhihu=30)",
    )
    parser.add_argument("--verbose", "-v", action="store_true", help="Show quality stats per file")
    args = parser.parse_args()

    input_path = Path(args.input)

    if input_path.is_file():
        output_path = Path(args.output) if args.output else input_path.parent / f"clean_{input_path.name}"
        process_file(
            input_path=input_path,
            output_path=output_path,
            platform=args.platform,
            title=args.title,
            post_date=args.post_date,
            post_upvotes=args.post_upvotes,
            subreddit=args.subreddit,
            subsection=args.section,
            min_comment_length=args.min_comment_length,
            verbose=args.verbose,
        )
        print(f"\nDone. Output: {output_path}")
        print("Next step: review the output, then move to raw/community/<platform>/")

    elif input_path.is_dir():
        output_dir = Path(args.output_dir) if args.output_dir else input_path.parent / f"{input_path.name}_cleaned"
        txt_files = sorted(input_path.glob("*.txt"))
        if not txt_files:
            sys.exit(f"No .txt files found in {input_path}")
        print(f"Cleaning {len(txt_files)} file(s) from {input_path}/  [{args.platform}]\n")
        for f in txt_files:
            process_file(
                input_path=f,
                output_path=output_dir / f.name,
                platform=args.platform,
                title=args.title,
                post_date=args.post_date,
                post_upvotes=args.post_upvotes,
                subreddit=args.subreddit,
                subsection=args.section,
                min_comment_length=args.min_comment_length,
                verbose=args.verbose,
            )
        print(f"\nDone. {len(txt_files)} file(s) written to {output_dir}/")
        print("Next step: review outputs, then move to raw/community/<platform>/")

    else:
        sys.exit(f"Error: {input_path} is not a file or directory")


if __name__ == "__main__":
    main()
