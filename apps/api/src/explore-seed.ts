import type { ExploreCard, TeamDiscussionPost } from '@shouldi/contracts';

type ExploreCardDraft = Omit<ExploreCard, 'discussionPosts'>;

/** 留学生与海外华裔高共鸣题库：身分路线、择校求职、家庭经济、归属感与心理健康；用户可见正文全中文（内部字段键名除外）。 */
const exploreCardsBase: ExploreCardDraft[] = [
  {
    id: 'seed-ai-validation-1',
    category: 'career',
    status: 'open',
    author: { id: 'u-shouldi-demo', name: '匿名决策者', avatarEmoji: '🛰️' },
    question:
      '在课业许可还能覆盖实习窗口的前提下，我应该优先押「先实习摸清行业」还是「直接冲有身分担保的全职」？',
    options: [
      { id: 'yes', label: '是，先实习再决定押哪条全职' },
      { id: 'no', label: '否，我更该直接押担保全职' },
    ],
    distribution: [
      { optionId: 'yes', votes: 156 },
      { optionId: 'no', votes: 89 },
    ],
    discussionPreview: [
      'Harmence 把「合法实习小时」写进前提，很多人漏看这条硬杠。',
      '家人要的是确定性——把 8–12 周试验讲清，往往比空喊「我会努力」有用。',
    ],
    rewardPoints: 18,
    savedByMe: false,
    followedByMe: false,
    notifiedOnOutcome: false,
    hook: '我把 Harmence 草稿贴进 Explore，只想知道陌生人敢不敢和我拍同一侧。',
    tension: '实习像拖延，可对很多人是唯一不伤身分的试探；全职像标准答案，抽签失手就是断崖。',
    provenance: 'community_ai_validation',
    matchHint: '验证 AI 立场 + 众人按踩 · 海外求职经典张力',
    aiSuggestedOptionId: 'yes',
    aiSuggestionNote:
      '若体面的实习谈话已在进行，把它当成信息期权，常常比空等抽签更能说服家里与时间线。',
    aiValidation: {
      verdictLine: 'Lean yes — 先实习再锁全职',
      verdictBecause:
        '在课业许可仍覆盖实习的前提下，用 8–12 周试岗换行业与人际信号，比一次性 all-in 担保全职更能降低「错赛道 + 身分卡死」联合风险。前提是每周小时数与 CPT/学期规则已书面核对。',
      agreeWithAiVotes: 156,
      disagreeWithAiVotes: 89,
    },
  },
  {
    id: 'seed-money-1',
    category: 'money',
    status: 'resolved',
    author: { id: 'u-alex', name: '林方舟', avatarEmoji: '🛂' },
    question:
      '毕业几年后，更应优先在海外把身分（工作许可／永居排队）稳住，还是把事业与照护重心放回国内发展？',
    options: [
      { id: 'take-pay', label: '稳住海外：先有合法身分与时间线再谈下一阶段' },
      { id: 'stay-stable', label: '放回国内：离父母近些，重新搭职业与人脉底盘' },
      { id: 'negotiate', label: '先折中：境外再干几年攒本金，同时为国内窗口做准备' },
    ],
    distribution: [
      { optionId: 'take-pay', votes: 132 },
      { optionId: 'stay-stable', votes: 187 },
      { optionId: 'negotiate', votes: 64 },
    ],
    discussionPreview: [
      '同乡群里一半人在算身分排期，一半人在和家长视频吵相亲与婚房。',
      '先写清楚「身分若卡住一年以上」月供与医药费谁扛，和谁吵都会冷静些。',
      '折中往往不是软弱，是照料父母养老和自己职业曲线的叠加解法。',
    ],
    rewardPoints: 20,
    savedByMe: false,
    followedByMe: true,
    myVoteOptionId: 'stay-stable',
    winningOptionId: 'stay-stable',
    rewardEligibleOptionId: 'stay-stable',
    notifiedOnOutcome: true,
    hook: '母亲在视频里说：老家的手续与亲戚红白事都摞在我桌上，你还要在那边排队排到什么时候？',
    tension:
      '留下意味着雇主担保或抽签年复一年；回流意味着重写「争光」的版本——两段剧本都说服不了对方。',
    outcome:
      '我回国照顾父母两年，再在境内接境外公司的岗位——身分与孝心都没拿满分，但最难的那几年没有缺席。',
    takeaway:
      '别在没被量化的羞愧里下注；把时间线（排期、父母年纪、本国行业周期）并列写出来，每条路都像项目一样可被复盘。',
    provenance: 'community_story',
    matchHint: '「留下还是海归」最典型的拉扯之一。',
    aiSuggestedOptionId: 'negotiate',
    aiSuggestionNote:
      '若父母健康问题在加速而你卡在身分死循环里，写一个「两三年试验期」常能安抚家里，也给自己的不甘心留刻度。',
  },
  {
    id: 'seed-career-1',
    category: 'career',
    status: 'open',
    author: { id: 'u-maya', name: '周可扬', avatarEmoji: '🎯' },
    question:
      '学业将尽：应全力找愿意办身分担保的全职，还是再读一个学位把合法停留拉长，或先用实习把行业摸清？',
    options: [
      { id: 'mgmt-now', label: '先锁全职：雇主愿担保越早越好' },
      { id: 'stay-ic', label: '再升学：换专业或换学校，把时间换空间' },
      { id: 'trial-lead', label: '先实习：课程许可内试岗再决定押哪条路' },
    ],
    distribution: [
      { optionId: 'mgmt-now', votes: 102 },
      { optionId: 'stay-ic', votes: 141 },
      { optionId: 'trial-lead', votes: 196 },
    ],
    discussionPreview: [
      '理工科与文商科抽签难度差很多，别拿别人的时间表惩罚自己。',
      '「再读两三年」被骂逃避，对部分人是唯一不伤身分的喘息口。',
      '实习翻车会伤到日后全职背调——别小看带你的前辈愿不愿意写推荐信。',
    ],
    rewardPoints: 15,
    savedByMe: false,
    followedByMe: false,
    notifiedOnOutcome: false,
    hook: '留学顾问、家里长辈和系主任同一天给我发三段互相打架的建议。',
    tension:
      '全职像成年人的标准答案；可抽签失手就是断崖。继续念书像在读逃避，但能保住医疗保险与身分连续性。',
    provenance: 'curated_digest',
    aiSuggestedOptionId: 'trial-lead',
    aiSuggestionNote:
      '手上若已有体面的实习面谈，先试岗再想大额押在二硕——能少很多次信息不对称的痛。',
  },
  {
    id: 'seed-relationship-1',
    category: 'relationship',
    status: 'resolved',
    author: { id: 'u-jordan', name: '何予安', avatarEmoji: '💬' },
    question: '恋人还在国内读研，我才刚开始海外第一份工作：要马上谈婚期与汇合计划，还是先约定两三年窗口身分稳了再说？',
    options: [
      { id: 'address-now', label: '现在对齐：大致婚期与城市写进记事，哪怕粗线条' },
      { id: 'wait', label: '先缓缓：身分与试用期风险跑完一轮再摊牌' },
    ],
    distribution: [
      { optionId: 'address-now', votes: 244 },
      { optionId: 'wait', votes: 89 },
    ],
    discussionPreview: [
      '跨国最怕各自猜默契，把最坏情况说出口反而松一口气。',
      '拖成默认剧本很危险；但也要避免在焦虑症峰值做决定。',
      '可以约定身分下一次结果的固定复盘夜，好过无限期漂移。',
    ],
    rewardPoints: 12,
    savedByMe: false,
    followedByMe: true,
    myVoteOptionId: 'address-now',
    winningOptionId: 'address-now',
    rewardEligibleOptionId: 'address-now',
    notifiedOnOutcome: true,
    hook: '视频会议里谁先提领证就好像谁在「逼着推进」。',
    tension:
      '马上谈像在逼承诺书；如果长期不谈，两个人的「什么叫做稳定」从来不是同一本书。',
    outcome:
      '我们写了两年内的城市与身分假设表，半年复盘一次——不是婚庆清单，但每次都知道对方卡在哪里。',
    takeaway: '用可复查的时间盒代替无限拖延；亲密关系和排队纸一样，含糊往往是最大的成本。',
    provenance: 'community_story',
    aiSuggestedOptionId: 'wait',
    aiSuggestionNote:
      '若有一方还在「刚上岸恐慌期」，先约好冷静窗和固定谈心日，往往比凌晨摊牌更能走得远。',
  },
  {
    id: 'seed-life-1',
    category: 'life',
    status: 'open',
    author: { id: 'u-rin', name: '顾澜', avatarEmoji: '🧭' },
    question: '课程与打工地点换来换去，该立刻搬家离学校近些，还是硬撑等合同与身分消息再动？',
    options: [
      { id: 'move-now', label: '立刻搬：省通勤，哪怕房租略疼' },
      { id: 'delay', label: '再忍忍：等合同续签或奖学金结果落定' },
      { id: 'pilot', label: '先短租两个月：测通勤与室友，再签长约' },
    ],
    distribution: [
      { optionId: 'move-now', votes: 118 },
      { optionId: 'delay', votes: 97 },
      { optionId: 'pilot', votes: 173 },
    ],
    discussionPreview: [
      '短租试一轮常比押一年长约少后悔。',
      '搬家表面是物流，其实是押金、治安与能不能做饭。',
      '确定能承受的月租上限再决定城市区块。',
    ],
    rewardPoints: 18,
    savedByMe: false,
    followedByMe: false,
    notifiedOnOutcome: false,
    hook: '我把「等身分稳了再搬」当咒语念了两年，后来明白稳态像地平线。',
    tension:
      '课表刚松一周，租约截止、打工换店、伴侣轮岗就跟着来——永远在等「全体对齐」的那一天。',
    provenance: 'ai_framework',
    aiSuggestedOptionId: 'pilot',
    aiSuggestionNote: '可逆的小试点往往提前暴露通勤与厨房规则，比在纸上空想城市分区有用。',
  },
  {
    id: 'seed-career-2',
    category: 'career',
    status: 'open',
    author: { id: 'u-sam', name: '丁野', avatarEmoji: '🛠️' },
    question: '作为组里少数东亚脸，该主动争取对外项目练表达，还是先在熟悉的华语同事圈里求稳，又或请上级当中间人慢慢扩圈？',
    options: [
      { id: 'startup', label: '搏对外项目：会议与汇报里刷存在感' },
      { id: 'stay-mid', label: '守熟悉圈层：把活做稳，少冒文化雷' },
      { id: 'counter-offer', label: '请导师或上级铺路：小步进入跨组合作' },
    ],
    distribution: [
      { optionId: 'startup', votes: 198 },
      { optionId: 'stay-mid', votes: 156 },
      { optionId: 'counter-offer', votes: 211 },
    ],
    discussionPreview: [
      '能见度靠会议纪要、跨部门抄送与小型分享也能一点点攒出来。',
      '舒适圈暖，但三年不动简历故事很难写。',
      '有人带着引荐，比冷撞文化墙省一半内伤。',
    ],
    rewardPoints: 16,
    savedByMe: false,
    followedByMe: false,
    notifiedOnOutcome: false,
    hook: '年终评估里「影响力」一栏我写了又删，删了又写。',
    tension:
      '主动争取像抢戏；一直低头又像默认透明——哪条路都在付心理利息。',
    provenance: 'curated_digest',
    aiSuggestedOptionId: 'counter-offer',
    aiSuggestionNote:
      '把「想参与哪类项目、需要哪些引荐」写成三条给主管，比空泛喊要机会更像成年人协作。',
  },
  {
    id: 'seed-money-2',
    category: 'money',
    status: 'open',
    author: { id: 'u-ken', name: '高远', avatarEmoji: '📊' },
    question: '海外月薪刚够生活，家里又盼补贴：该优先定期汇款，还是先紧着自己的应急金，还是固定比例两边都顾？',
    options: [
      { id: 'pay-loans', label: '优先汇款：家里开口不能拖' },
      { id: 'invest', label: '先堆自己的应急金：至少撑住六个月房租' },
      { id: 'split', label: '固定比例：例如七成自用三成寄回' },
    ],
    distribution: [
      { optionId: 'pay-loans', votes: 401 },
      { optionId: 'invest', votes: 288 },
      { optionId: 'split', votes: 312 },
    ],
    discussionPreview: [
      '应急金不是自私，是防止你在国外突然失业又不敢跟家里说。',
      '汇款别只谈面子，把汇率与手续费摊给全家听。',
      '孝心和可持续往往要一起设计，而不是二选一吼完。',
    ],
    rewardPoints: 14,
    savedByMe: false,
    followedByMe: false,
    notifiedOnOutcome: false,
    hook: '视频里亲戚一句「你在国外赚得多」比任何汇率都烫嘴。',
    tension:
      '全寄回家像在赎罪；全留下又像冷血——电子表格算不出视频那头的沉默。',
    provenance: 'ai_framework',
    aiSuggestedOptionId: 'split',
    aiSuggestionNote: '把比例设成自动转账，比每次临时良心发作更能撑过三年五年。',
  },
  {
    id: 'seed-relationship-2',
    category: 'relationship',
    status: 'open',
    author: { id: 'u-eli', name: '许夏', avatarEmoji: '🫶' },
    question: '家里越洋电话总在夜里崩溃，我该每次接满，还是收紧频率，或明确改由兄弟姐妹轮流？',
    options: [
      { id: 'direct', label: '坚持每次接：怕他们多想' },
      { id: 'gentle-limit', label: '约好固定时段：例如周末两通，每通不超过四十分钟' },
      { id: 'distance', label: '请亲戚或手足先扛一阵，我专注考试与身分材料' },
    ],
    distribution: [
      { optionId: 'direct', votes: 91 },
      { optionId: 'gentle-limit', votes: 402 },
      { optionId: 'distance', votes: 67 },
    ],
    discussionPreview: [
      '说清「我现在能做什么、不能做什么」往往比突然失踪温柔。',
      '你不是家里唯一的孩子也不是唯一出口——责任要可分配。',
      '偶尔拒绝长期反而保住关系，不然只剩怨。',
    ],
    rewardPoints: 11,
    savedByMe: false,
    followedByMe: false,
    notifiedOnOutcome: false,
    hook: '凌晨三点的语音未接像罪证一样躺在通知栏。',
    tension:
      '想孝顺又怕被掏空；话说硬了像不孝，不说硬了自己先烧干。',
    provenance: 'community_story',
    matchHint: '第一代留学生家长情绪承载的经典题。',
    aiSuggestedOptionId: 'gentle-limit',
    aiSuggestionNote: '用「我关心你 + 具体可改约的时间」写脚本，比单纯关机少愧疚。',
  },
  {
    id: 'seed-life-2',
    category: 'life',
    status: 'resolved',
    author: { id: 'u-nora', name: '宋宁', avatarEmoji: '🌿' },
    question: '持续失眠与恐慌，课业与打工都在硬撑：该不该休一个学期或裸辞放空，还是先顶着把身分材料递出去？',
    options: [
      { id: 'leave-now', label: '先停一阵：身分材料可以晚交，人不能先报废' },
      { id: 'keep-going', label: '再扛一下：考完这轮／递件后再处理情绪' },
    ],
    distribution: [
      { optionId: 'leave-now', votes: 189 },
      { optionId: 'keep-going', votes: 76 },
    ],
    discussionPreview: [
      '停课或辞职前先问校医与国际学生处有什么合法停顿选项。',
      '硬扛有时也会把身分与签证风险一起放大。',
      '短期心理咨询在很多校园首几次免费。',
    ],
    rewardPoints: 22,
    savedByMe: false,
    followedByMe: false,
    myVoteOptionId: 'leave-now',
    winningOptionId: 'leave-now',
    rewardEligibleOptionId: 'leave-now',
    notifiedOnOutcome: true,
    hook: '我在日历上轮流圈「自私」和「等大崩溃」。',
    tension:
      '冷静那天看停摆像鲁莽；喘不过气那天继续像自杀——两件事很少同一天发生。',
    outcome:
      '我休满一个学期再配合咨询与运动，回来后课量减半身分照跑——不是靠表演坚强过关。',
    takeaway:
      '当身体告警已经升级到「旁人看得出来」而银行存款只够硬撑几周，更值得调整的是生活节奏而不是单靠志气。',
    provenance: 'community_story',
    aiSuggestedOptionId: 'leave-now',
    aiSuggestionNote:
      '若症状在陡坡上冲，给身体恢复排的队往往早于「再等老板／导师签字」的假性许可。',
  },
  {
    id: 'seed-career-3',
    category: 'career',
    status: 'resolved',
    author: { id: 'u-priya', name: '陆晴', avatarEmoji: '✨' },
    question:
      '身分抽签多年不中：该死守现雇主的担保排队，还是再读书换身分窗口，亦或接受「降薪但能立刻换赛道」的岗位？',
    options: [
      { id: 'deep', label: '深挖现赛道：稳住雇主与绩效，等政策松动' },
      { id: 'broad', label: '改写路径：回学校或换工种，重新排队' },
    ],
    distribution: [
      { optionId: 'deep', votes: 512 },
      { optionId: 'broad', votes: 203 },
    ],
    discussionPreview: [
      '身分策略没有道德高低，只看谁的身体与存款先撑不住。',
      '读书不是逃避，有时是合法身份的唯二出口之一。',
    ],
    rewardPoints: 13,
    savedByMe: false,
    followedByMe: false,
    myVoteOptionId: 'broad',
    winningOptionId: 'deep',
    rewardEligibleOptionId: 'deep',
    notifiedOnOutcome: true,
    hook: '社交媒体每年抽签日都像海啸，只有我在岸上看浪。',
    tension:
      '留下像赌耐心；重写路径像认输——两种叙事都让自己夜里醒着。',
    outcome:
      '我又熬了两轮绩效与内部转岗证据，在政策微调时卡点递件——不是靠鸡汤，是靠可审计的工作记录。',
    takeaway:
      '没有「正确勇敢」，只有「哪张日历更吃得消」；把体检、存款与心理门诊一起排进决策表。',
    provenance: 'curated_digest',
    matchHint: '北美理工华人常见的身分马拉松。',
    aiSuggestedOptionId: 'deep',
    aiSuggestionNote:
      '若雇主仍愿配合且你身体还能扛加班，继续堆可证明成果往往比频繁换赛道更利于律师讲故事。',
  },
  {
    id: 'seed-money-3',
    category: 'money',
    status: 'open',
    author: { id: 'u-tessa', name: '白沐', avatarEmoji: '🏠' },
    question: '没有当地亲人担保，租房押金与信用历史又薄：该咬牙刷小套上车，还是继续租并攒首付，或先观望政策与利率？',
    options: [
      { id: 'buy-smaller', label: '买小套：月供当强制储蓄' },
      { id: 'rent-save', label: '继续租：攒够首付与维修基金再说' },
      { id: 'pause', label: '观望半年：把利率、学费与身分窗口一起算清' },
    ],
    distribution: [
      { optionId: 'buy-smaller', votes: 124 },
      { optionId: 'rent-save', votes: 267 },
      { optionId: 'pause', votes: 88 },
    ],
    discussionPreview: [
      '月供、物业、维修与涨租四行一起摊，别只比广告利率。',
      '低首付往往伴随更高保险费，别被销售话术带着跑。',
      '有时等待是算计，有时是拖延，要诚实区分。',
    ],
    rewardPoints: 19,
    savedByMe: false,
    followedByMe: false,
    notifiedOnOutcome: false,
    hook: '涨租通知和贷款预批邮件同一天挤进收件箱。',
    tension:
      '小户型能锁定住房成本；继续租灵活但现金像被租金电梯一点点抬走。',
    provenance: 'community_story',
    aiSuggestedOptionId: 'rent-save',
    aiSuggestionNote:
      '把「利率上调两个点、每年维修预提」一起做压力测试，再谈「差不多能扛」。',
  },
  {
    id: 'seed-relationship-3',
    category: 'relationship',
    status: 'open',
    author: { id: 'u-marcus', name: '沈黎', avatarEmoji: '💛' },
    question: '恋情跨文化：对方家庭完全按另一套规则谈钱与假期，我该温和讲清底线，还是先维持轻松相处，亦或主动退一步冷处理？',
    options: [
      { id: 'name-it', label: '摊开讲：哪些习俗可以弹性、哪些寸步不让' },
      { id: 'keep-drift', label: '先轻松处：大家都不逼定义' },
      { id: 'step-back', label: '有意识后撤：需要时间消化价值观差异' },
    ],
    distribution: [
      { optionId: 'name-it', votes: 233 },
      { optionId: 'keep-drift', votes: 98 },
      { optionId: 'step-back', votes: 45 },
    ],
    discussionPreview: [
      '模糊舒适经常是节奏错位的一层膜。',
      '提前讲清≠攻击对方家庭，而是省去几个月误读。',
      '不提规则的拖延最后会变成无声的委屈账本。',
    ],
    rewardPoints: 12,
    savedByMe: false,
    followedByMe: false,
    notifiedOnOutcome: false,
    hook: '我们像情侣一样相处，却对「谁先见家长」默契装看不见。',
    tension:
      '怕显得太传统又怕显得太疏离——留白被两边脑补成了从未盖章的协定。',
    provenance: 'community_story',
    aiSuggestedOptionId: 'name-it',
    aiSuggestionNote:
      '开一次认真对话往往只尴尬一晚；躲开往往用几个月一厢情愿付账。',
  },
  {
    id: 'seed-life-3',
    category: 'life',
    status: 'open',
    author: { id: 'u-diego', name: '马遥', avatarEmoji: '🎸' },
    question:
      '课外兼职与自媒体有一点收入：该主动申报报税建立信用，还是先放在现金里不向学校与税务局交代，或先试半年厘清规则？',
    options: [
      { id: 'monetize', label: '照规矩报：细水长流省后患' },
      { id: 'pure-play', label: '先只做许可内小时数：不踩身分许可红线' },
      { id: 'hybrid-six', label: '半年试验：找会计师或国际学生处厘清灰区' },
    ],
    distribution: [
      { optionId: 'monetize', votes: 156 },
      { optionId: 'pure-play', votes: 201 },
      { optionId: 'hybrid-six', votes: 277 },
    ],
    discussionPreview: [
      '身分条款里打工上限是硬杠杠，别把网红故事当判例。',
      '信用记录与未来贷款挂钩，也值得放进权衡。',
      '先试半年能减少「想当然违法」的恐惧。',
    ],
    rewardPoints: 10,
    savedByMe: false,
    followedByMe: false,
    notifiedOnOutcome: false,
    hook: '账户里突然出现「副业」入账，我才发现自己一无所知。',
    tension:
      '申报像自己往雷区点灯；不报又像悬梁——身份与罚金哪个先落下心里没谱。',
    provenance: 'curated_digest',
    aiSuggestedOptionId: 'hybrid-six',
    aiSuggestionNote: '约一次校国际学生顾问加本地会计师咨询，常有固定套餐价，比在论坛赌答案稳。',
  },
  {
    id: 'seed-career-4',
    category: 'career',
    status: 'open',
    author: { id: 'u-linh', name: '江澄', avatarEmoji: '📣' },
    question:
      '路线图明显排爆：我该在全体会议指出资源不够，还是先私下写邮件备案，亦或先一对一和主管对齐再给团队看方案？',
    options: [
      { id: 'push-back', label: '在会上提出风险与需要你补充的人手' },
      { id: 'document-only', label: '私下留邮件与文档时间线，公开场合少出头' },
      { id: 'one-on-one', label: '先单独找主管对齐预期，再带进大房间讨论' },
    ],
    distribution: [
      { optionId: 'push-back', votes: 189 },
      { optionId: 'document-only', votes: 52 },
      { optionId: 'one-on-one', votes: 311 },
    ],
    discussionPreview: [
      '会上硬顶要有盟友与清晰任务边界，否则容易被标成难搞。',
      '私下记录救的是日后爆炸时的自己。',
      '先让主管和你同一叙事，再开大会火小很多。',
    ],
    rewardPoints: 14,
    savedByMe: false,
    followedByMe: false,
    notifiedOnOutcome: false,
    hook: '演示文稿把交付量翻倍却没给人头预算。',
    tension:
      '开口像不配合；闭嘴像预定背锅——还没有证据链以后谁也说不清。',
    provenance: 'ai_framework',
    aiSuggestedOptionId: 'one-on-one',
    aiSuggestionNote: '简短一对一若带着两套方案而不是纯抱怨，往往比走廊吐槽更能挪截止日期。',
  },
  {
    id: 'seed-money-4',
    category: 'money',
    status: 'open',
    author: { id: 'u-ina', name: '岑予', avatarEmoji: '💳' },
    question:
      '父母要汇一整年学费与房租：该趁汇率好一点一次换足，还是分几批减低踏空风险，亦或先拉表算手续费与时间成本再动？',
    options: [
      { id: 'refi-now', label: '尽量一次到位：省去反复盯盘心烦' },
      { id: 'wait', label: '分三到四批：配合汇率凹槽' },
      { id: 'run-numbers', label: '先拉表：把手续费、价差与活期利息一起算进门' },
    ],
    distribution: [
      { optionId: 'refi-now', votes: 142 },
      { optionId: 'wait', votes: 88 },
      { optionId: 'run-numbers', votes: 264 },
    ],
    discussionPreview: [
      '银行中间价与家长群里的「听说」往往不是一回事。',
      '猜宏观拐点多半赌心情，对家庭现金流帮助有限。',
      '真正的决策单元是到手本币与时间成本。',
    ],
    rewardPoints: 15,
    savedByMe: false,
    followedByMe: false,
    notifiedOnOutcome: false,
    hook: '家族群里突然甩来一张汇款单截图。',
    tension:
      '一次换省心但怕踏错点；分批换弹性高但耗费注意力——父母和你对「亏钱」的定义也不一样。',
    provenance: 'community_story',
    aiSuggestedOptionId: 'run-numbers',
    aiSuggestionNote:
      '把每笔手续费除进本金，再与家长同步「最坏也不影响学费截止日」的规则，能减少半夜互相指责。',
  },
  {
    id: 'seed-life-4',
    category: 'life',
    status: 'open',
    author: { id: 'u-amelia', name: '韩朵', avatarEmoji: '🐕' },
    question:
      '父母要来住半年照护小孩：该立刻收拾客房长期同住，还是先订邻近短租让父母有缓冲空间，或与手足轮流分担照护？',
    options: [
      { id: 'yes-now', label: '直接同住：省租金，亲情密度也高' },
      { id: 'foster-first', label: '先短租邻近：试水作息与管教边界' },
      { id: 'wait-year', label: '再缓一年：等身分与托儿所更稳' },
    ],
    distribution: [
      { optionId: 'yes-now', votes: 67 },
      { optionId: 'foster-first', votes: 318 },
      { optionId: 'wait-year', votes: 112 },
    ],
    discussionPreview: [
      '三代同堂的喜乐与摩擦会同时放大。',
      '短住试水能看出厨房卫浴与带娃分工雷区。',
      '旅行签证长度与托儿制度往往比孝心先到达现实。',
    ],
    rewardPoints: 11,
    savedByMe: false,
    followedByMe: false,
    notifiedOnOutcome: false,
    hook: '父母把机票改签链接发进群时，我才发现自己还没和心理准备对齐。',
    tension:
      '承诺听起来温暖，直到要面对作息、卫生习惯与两代管教话语权。',
    provenance: 'community_story',
    matchHint: '华裔家庭常见的「跨海育儿援助」谈判。',
    aiSuggestedOptionId: 'foster-first',
    aiSuggestionNote:
      '先试住八到十二周往往能测出是否真的够住——比签一纸长期默契少翻船。',
  },
  {
    id: 'seed-career-5',
    category: 'career',
    status: 'open',
    author: { id: 'u-omar', name: '吴朗', avatarEmoji: '🌍' },
    question:
      '总部想调人去亚洲分部镀金两年，配偶工作与孩子学校都在本地：我该全家搬一次，还是先争取只做远程支援，亦或折中每月飞一两周肉身到场？',
    options: [
      { id: 'relocate', label: '全家搬迁：配偶暂停工作、孩子转学一次解决' },
      { id: 'remote-only', label: '申明家庭锚点在此，只做远程／少数出差' },
      { id: 'fly-monthly', label: '折中派驻：月度集中到场，其余远程' },
    ],
    distribution: [
      { optionId: 'relocate', votes: 94 },
      { optionId: 'remote-only', votes: 181 },
      { optionId: 'fly-monthly', votes: 255 },
    ],
    discussionPreview: [
      '签证、税务与教育条款写清前不要被「镀金故事」催眠。',
      '总部要脸面时远程特权最容易被收回。',
      '阶段性到场有时比一刀切拒绝更能缓冲家庭冲击。',
    ],
    rewardPoints: 17,
    savedByMe: false,
    followedByMe: false,
    notifiedOnOutcome: false,
    hook: '组织图上钉子先挪动，托儿所候补名单却只前进两位。',
    tension:
      '机会看起来很体面；现实是配偶身分、课业与语言能力很难一张嘴表決。',
    provenance: 'curated_digest',
    aiSuggestedOptionId: 'fly-monthly',
    aiSuggestionNote:
      '若能谈成「先试六个月再复盘」，既给家里缓冲，又让总部看见合作意愿。',
  },
];

function defaultDiscussionPosts(card: ExploreCardDraft): TeamDiscussionPost[] {
  const { options, discussionPreview: preview, id: cardId } = card;
  if (options.length === 0) return [];
  const lines =
    preview.length > 0
      ? preview
      : [
          '我把心里最怕的那一种坏结果写出来，再想「下周出现什么信号我会改主意」。',
          '你的结构很清楚，我仍不同意节奏，但欣赏这种表述方式。',
          '有人用同一套假设重算过一次吗？我想看分歧从哪一行开始。',
        ];
  const authors = ['王安之', '李若岑', '陈默', '张语桐', '周航'];
  const emojis = ['🧭', '🎯', '📎', '🌊', '✨'];
  const times = ['刚刚', '18 分钟', '1 小时', '3 小时', '昨天'];
  const count = Math.min(5, Math.max(3, options.length + 2));
  const roots = Array.from({ length: count }, (_, i) => {
    const choice = options[i % options.length]!;
    const body =
      preview.length > 0
        ? lines[Math.min(i % lines.length, lines.length - 1)] ?? lines[0]!
        : lines[i % lines.length]!;
    return {
      id: `${cardId}-tp-${choice.id}-${i}`,
      authorName: authors[i % authors.length]!,
      authorEmoji: emojis[i % emojis.length]!,
      optionId: choice.id,
      body,
      timeLabel: times[i % times.length],
      upvoteCount: 3 + ((i * 5) % 24),
    };
  });
  const first = roots[0];
  const replies: TeamDiscussionPost[] =
    first == null
      ? []
      : [
          {
            id: `${cardId}-thr-a`,
            parentId: first.id,
            authorName: authors[(count + 1) % authors.length]!,
            authorEmoji: '💬',
            optionId: first.optionId,
            body:
              '同感——先把「身分若拖一年」最坏现金流写死后，才敢谈接受或回流哪个更不辜负自己。',
            timeLabel: times[(count + 1) % times.length],
            upvoteCount: 4 + ((count * 3) % 14),
          },
          {
            id: `${cardId}-thr-b`,
            parentId: `${cardId}-thr-a`,
            authorName: authors[(count + 3) % authors.length]!,
            authorEmoji: '🧩',
            optionId: first.optionId,
            body:
              '如果你的假设里「九十天内能找到下家」但现实是人脉稀薄，务必把最坏求职周期乘系数再打一次压力测试。',
            timeLabel: times[(count + 2) % times.length],
            upvoteCount: 6,
          },
        ];
  return [...roots, ...replies];
}

function curatedMoneySeedOne(): TeamDiscussionPost[] {
  return [
    {
      id: 'seed-money-1-tp-take-pay-0',
      authorName: '唐薇',
      authorEmoji: '💼',
      optionId: 'take-pay',
      body:
        '我曾为体面薪水略过把「身分衔接与解约补偿」钉进纸质条款——票面好看，真正能救命的是最坏情况下雇主还愿不愿意替你说话。',
      timeLabel: '32 分钟',
      upvoteCount: 12,
    },
    {
      id: 'seed-money-1-tp-stable-0',
      authorName: '陆衡',
      authorEmoji: '🛡️',
      optionId: 'stay-stable',
      body:
        '回国那几年我把「照顾父母」写成可执行任务，反而后来海外谈薪多了真实故事可说，不仅是鸡汤。',
      timeLabel: '1 小时',
      upvoteCount: 8,
    },
    {
      id: 'seed-money-1-tp-stable-1',
      authorName: '赵颖博',
      authorEmoji: '🧾',
      optionId: 'stay-stable',
      body:
        '我做表只认一条：「身分卡壳加失业同时发生能撑几个月」——过不了这条就别被长辈一句争气带走。',
      timeLabel: '3 小时',
      upvoteCount: 21,
    },
    {
      id: 'seed-money-1-tp-nego-0',
      authorName: '吴桐',
      authorEmoji: '🤝',
      optionId: 'negotiate',
      body:
        '折中不等于骑墙——把境内外两边的时间盒写清，比口头「再看」少无数夜间自我攻击。',
      timeLabel: '昨天',
      upvoteCount: 15,
    },
    {
      id: 'seed-money-1-re-st0-1',
      parentId: 'seed-money-1-tp-stable-0',
      authorName: '李安可',
      authorEmoji: '📎',
      optionId: 'stay-stable',
      body:
        '附议楼上——单列「税后现金还能撑几张机票」这一项，很多家庭对话会冷静下来。',
      timeLabel: '55 分钟',
      upvoteCount: 9,
    },
    {
      id: 'seed-money-1-re-st0-2',
      parentId: 'seed-money-1-tp-stable-0',
      authorName: '苏洋',
      authorEmoji: '🌊',
      optionId: 'stay-stable',
      body:
        '如果父母期待你立刻买房，也请他们看见你手上罚金与身分律师费那一栏。',
      timeLabel: '42 分钟',
      upvoteCount: 14,
    },
    {
      id: 'seed-money-1-re-st1-1',
      parentId: 'seed-money-1-tp-stable-1',
      authorName: '林子墨',
      authorEmoji: '✨',
      optionId: 'stay-stable',
      body:
        '窄行业求职者把「最坏半年零录用通知」沙盘跑两遍，再回到桌边谈孝心会诚实很多。',
      timeLabel: '2 小时',
      upvoteCount: 17,
    },
    {
      id: 'seed-money-1-re-st1-deep',
      parentId: 'seed-money-1-re-st1-1',
      authorName: '唐薇',
      authorEmoji: '💼',
      optionId: 'stay-stable',
      body:
        '对——我们每月固定一天更新表格，体感焦虑比一次性摊牌骗人。',
      timeLabel: '1 小时',
      upvoteCount: 11,
    },
    {
      id: 'seed-money-1-re-pay-1',
      parentId: 'seed-money-1-tp-take-pay-0',
      authorName: '程乐',
      authorEmoji: '🎯',
      optionId: 'take-pay',
      body:
        '若公司已经传出冻结招聘，请先写清到什么信号就立刻撤回报价——自保不是负能量。',
      timeLabel: '2 小时',
      upvoteCount: 22,
    },
    {
      id: 'seed-money-1-re-nego-1',
      parentId: 'seed-money-1-tp-nego-0',
      authorName: '叶舒',
      authorEmoji: '🧭',
      optionId: 'negotiate',
      body:
        '我当时同时维护国内引荐与海外猎头，没有把命运绑在一家口头承诺上——心态宽裕很多。',
      timeLabel: '5 小时',
      upvoteCount: 13,
    },
  ];
}

function curatedCareerSeedOne(): TeamDiscussionPost[] {
  return [
    {
      id: 'seed-career-1-mgmt',
      authorName: '董航',
      authorEmoji: '🧭',
      optionId: 'mgmt-now',
      body:
        '太早 all-in 全职担保，我见过同事被项目组裁掉身分一夜悬空——摸清老板真实意愿再上船。',
      timeLabel: '20 分钟',
      upvoteCount: 31,
    },
    {
      id: 'seed-career-1-ic',
      authorName: '梁舒',
      authorEmoji: '🧱',
      optionId: 'stay-ic',
      body:
        '二硕被骂水不要紧，要问清楚新课程能不能给你新的课业许可与时间缓冲——身分角度有时比名声重要。',
      timeLabel: '1 小时',
      upvoteCount: 19,
    },
    {
      id: 'seed-career-1-trial',
      authorName: '秦予',
      authorEmoji: '🧪',
      optionId: 'trial-lead',
      body:
        '先有实习推荐信再谈读研预算，很多父母更容易点头——他们知道你不是逃避现实。',
      timeLabel: '4 小时',
      upvoteCount: 7,
    },
    {
      id: 'seed-career-1-trial-b',
      authorName: '阮静',
      authorEmoji: '📚',
      optionId: 'trial-lead',
      body:
        '问清实习是否占用课业许可全时额度，别稀里糊涂黑工——罚款与遣返故事每年都在新生群转发。',
      timeLabel: '昨天',
      upvoteCount: 24,
    },
    {
      id: 'seed-career-1-re-mgmt-1',
      parentId: 'seed-career-1-mgmt',
      authorName: '梁舒',
      authorEmoji: '🧱',
      optionId: 'mgmt-now',
      body:
        '谈录用条件时请对方书面确认身分流程谁负责付钱、多少时间给递件——含糊承诺别签字。',
      timeLabel: '35 分钟',
      upvoteCount: 26,
    },
    {
      id: 'seed-career-1-re-mgmt-2',
      parentId: 'seed-career-1-mgmt',
      authorName: '秦予',
      authorEmoji: '🧪',
      optionId: 'mgmt-now',
      body:
        '第四周回看日历——如果一半时间在杂务打转，趁早和主管改预期，身分材料拖不起。',
      timeLabel: '50 分钟',
      upvoteCount: 18,
    },
    {
      id: 'seed-career-1-re-ic-1',
      parentId: 'seed-career-1-ic',
      authorName: '董航',
      authorEmoji: '🧭',
      optionId: 'stay-ic',
      body:
        '读研不等于躲——把「毕业之后三个月内身分备用方案」也写一页，父母和导师都好谈。',
      timeLabel: '2 小时',
      upvoteCount: 12,
    },
    {
      id: 'seed-career-1-re-trial-1',
      parentId: 'seed-career-1-trial',
      authorName: '阮静',
      authorEmoji: '📚',
      optionId: 'trial-lead',
      body:
        '同意楼上——与同事约定「试用期结束要写双方复盘」，别把模糊拖成身分风险。',
      timeLabel: '3 小时',
      upvoteCount: 15,
    },
    {
      id: 'seed-career-1-re-trial-deep',
      parentId: 'seed-career-1-re-trial-1',
      authorName: '董航',
      authorEmoji: '🧭',
      optionId: 'trial-lead',
      body:
        '我们最后用共享时间表写清「算不算优秀实习」，比口头互相猜高效得多。',
      timeLabel: '昨天',
      upvoteCount: 9,
    },
  ];
}

export const seededExploreCards: ExploreCard[] = exploreCardsBase.map((c) => {
  if (c.id === 'seed-money-1') {
    return { ...c, discussionPosts: curatedMoneySeedOne() };
  }
  if (c.id === 'seed-career-1') {
    return { ...c, discussionPosts: curatedCareerSeedOne() };
  }
  return { ...c, discussionPosts: defaultDiscussionPosts(c) };
});
