# 同步上游更新（NousResearch/hermes-agent）

## 背景

本仓库是 [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent) 的私有镜像，
不使用 GitHub fork（fork 只能是 public），改用双 remote 方式管理。

## Remote 配置

| remote | 地址 | 用途 |
|--------|------|------|
| `origin` | `https://github.com/Andyyy777/hermes-agent-private.git` | 你的私有仓库，日常 push/pull |
| `upstream` | `https://github.com/NousResearch/hermes-agent.git` | 上游原始仓库，只用来拉取更新 |

## 日常同步上游更新

```bash
git fetch upstream
git merge upstream/main
git push origin main
```

如果有冲突（你修改了上游也改过的文件），解决冲突后：

```bash
git add <冲突文件>
git commit
git push origin main
```

## 初次配置步骤（已完成，仅供参考）

```bash
# 1. 把原来的 origin（public fork）改名为 upstream
git remote rename origin upstream

# 2. 将 upstream 指向 NousResearch 原始仓库
git remote set-url upstream https://github.com/NousResearch/hermes-agent.git

# 3. 添加私有仓库为新的 origin
git remote add origin https://github.com/Andyyy777/hermes-agent-private.git

# 4. 推送到私有仓库
git push -u origin main
```

## 验证 remote 配置

```bash
git remote -v
```

期望输出：

```
origin    https://github.com/Andyyy777/hermes-agent-private.git (fetch)
origin    https://github.com/Andyyy777/hermes-agent-private.git (push)
upstream  https://github.com/NousResearch/hermes-agent.git (fetch)
upstream  https://github.com/NousResearch/hermes-agent.git (push)
```
